use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{postgres::PgRow, PgPool, Row};
use std::{process::Command, time::Duration};

use crate::{auth::AuthUser, state::AppState};

#[derive(Debug, Clone, Serialize)]
pub struct AiJobPublic {
    pub id: uuid::Uuid,
    pub model_target: String,
    pub trigger_reason: String,
    pub status: String,
    pub requested_at: String,
    pub requested_by: Option<uuid::Uuid>,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub logs: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RunOnceRequest {
    pub max_jobs: Option<u32>,
}

pub fn ai_jobs_routes() -> Router<AppState> {
    Router::new()
        .route("/ai/jobs/recent", get(list_recent_jobs))
        .route("/ai/jobs/run-once", post(run_jobs_once))
        .route("/ai/plan/summary", get(get_ai_plan_summary))
}

pub fn spawn_job_worker(state: AppState) {
    tokio::spawn(async move {
        let mut backoff_ms: u64 = 1_000;
        loop {
            // Process at most one job per tick to avoid starving the server under load.
            match process_one_job(&state.pool).await {
                Ok(Some(_)) => {
                    backoff_ms = 1_000;
                }
                Ok(None) => {
                    backoff_ms = (backoff_ms * 2).min(30_000);
                }
                Err(e) => {
                    tracing::error!(error = %e, "ai job worker error");
                    backoff_ms = (backoff_ms * 2).min(30_000);
                }
            }
            tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
        }
    });
}

async fn list_recent_jobs(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let queue_rows = sqlx::query(
        r#"
        SELECT id, parameter_id, job_type, status, payload,
               requested_at, started_at, finished_at, error_message
        FROM atlas.ai_job_queue
        ORDER BY requested_at DESC
        LIMIT 80
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let queue_jobs: Vec<serde_json::Value> = queue_rows
        .into_iter()
        .map(|r| {
            json!({
                "id": r.get::<uuid::Uuid, _>("id"),
                "parameter_id": r.get::<String, _>("parameter_id"),
                "job_type": r.get::<String, _>("job_type"),
                "status": r.get::<String, _>("status"),
                "payload": r.try_get::<serde_json::Value, _>("payload").unwrap_or(json!({})),
                "requested_at": r.get::<chrono::DateTime<chrono::Utc>, _>("requested_at").to_rfc3339(),
                "started_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("started_at").ok().map(|d| d.to_rfc3339()),
                "finished_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("finished_at").ok().map(|d| d.to_rfc3339()),
                "error_message": r.try_get::<Option<String>, _>("error_message").ok().flatten(),
            })
        })
        .collect();

    let legacy_rows = sqlx::query(
        r#"
        SELECT id, model_target, trigger_reason, status,
               requested_at, requested_by, started_at, finished_at, logs
        FROM atlas.ai_training_jobs
        ORDER BY requested_at DESC
        LIMIT 50
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let legacy: Vec<AiJobPublic> = legacy_rows.into_iter().map(row_to_public).collect();

    Ok(Json(json!({
        "success": true,
        "source_table": "ai_job_queue",
        "jobs": queue_jobs,
        "legacy_training_jobs": legacy,
    })))
}

async fn run_jobs_once(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<RunOnceRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let max_jobs = payload.max_jobs.unwrap_or(1).clamp(1, 25);
    let mut processed = 0_u32;
    let mut results: Vec<serde_json::Value> = Vec::new();
    for _ in 0..max_jobs {
        match process_one_job(&state.pool).await {
            Ok(Some(res)) => {
                processed += 1;
                results.push(res);
            }
            Ok(None) => break,
            Err(e) => {
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": e.to_string(), "processed": processed, "results": results })),
                ))
            }
        }
    }

    Ok(Json(json!({ "success": true, "processed": processed, "results": results })))
}

async fn get_ai_plan_summary(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let interpolation_rows = sqlx::query(
        r#"
        SELECT category, parameter_id, unit, method
        FROM atlas.v_ai_interpolation_plan
        ORDER BY category, parameter_id
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let prediction_rows = sqlx::query(
        r#"
        SELECT category, parameter_id, unit, model_kind
        FROM atlas.v_ai_prediction_plan
        ORDER BY category, parameter_id
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let interpolation: Vec<serde_json::Value> = interpolation_rows
        .into_iter()
        .map(|r| {
            json!({
                "category": r.get::<String, _>("category"),
                "parameter_id": r.get::<String, _>("parameter_id"),
                "unit": r.try_get::<Option<String>, _>("unit").ok().flatten(),
                "method": r.try_get::<Option<String>, _>("method").ok().flatten(),
            })
        })
        .collect();

    let prediction: Vec<serde_json::Value> = prediction_rows
        .into_iter()
        .map(|r| {
            json!({
                "category": r.get::<String, _>("category"),
                "parameter_id": r.get::<String, _>("parameter_id"),
                "unit": r.try_get::<Option<String>, _>("unit").ok().flatten(),
                "model_kind": r.try_get::<Option<String>, _>("model_kind").ok().flatten(),
            })
        })
        .collect();

    Ok(Json(json!({
        "success": true,
        "interpolation_count": interpolation.len(),
        "prediction_count": prediction.len(),
        "interpolation": interpolation,
        "prediction": prediction
    })))
}

fn row_to_public(r: PgRow) -> AiJobPublic {
    let requested_at: chrono::DateTime<chrono::Utc> = r.get("requested_at");
    let started_at: Option<chrono::DateTime<chrono::Utc>> = r.try_get("started_at").ok();
    let finished_at: Option<chrono::DateTime<chrono::Utc>> = r.try_get("finished_at").ok();
    AiJobPublic {
        id: r.get("id"),
        model_target: r.get("model_target"),
        trigger_reason: r.get("trigger_reason"),
        status: r.get("status"),
        requested_at: requested_at.to_rfc3339(),
        requested_by: r.try_get("requested_by").ok(),
        started_at: started_at.map(|d| d.to_rfc3339()),
        finished_at: finished_at.map(|d| d.to_rfc3339()),
        logs: r.try_get::<serde_json::Value, _>("logs").unwrap_or(json!({})),
    }
}

fn require_database_url() -> Result<String, String> {
    std::env::var("DATABASE_URL").map_err(|_| "DATABASE_URL missing".to_string())
}

fn script_path(relative_from_manifest_dir: &str) -> String {
    if let Ok(dir) = std::env::var("ATLAS_SCRIPTS_DIR") {
        let script_name = std::path::Path::new(relative_from_manifest_dir)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(relative_from_manifest_dir);
        return format!("{}/{}", dir.trim_end_matches('/'), script_name);
    }
    format!("{}/{}", env!("CARGO_MANIFEST_DIR"), relative_from_manifest_dir)
}

fn python_candidates() -> Vec<&'static str> {
    if cfg!(windows) {
        vec!["python", "py"]
    } else {
        vec!["python", "python3"]
    }
}

fn run_python_json(args: &[&str]) -> Result<serde_json::Value, String> {
    let mut last_err = String::new();
    let mut out_opt = None;
    for exe in python_candidates() {
        match Command::new(exe).args(args).output() {
            Ok(out) => {
                out_opt = Some(out);
                break;
            }
            Err(e) => {
                last_err = format!("{exe}: {e}");
            }
        }
    }
    let out = out_opt.ok_or_else(|| format!("python execution failed: {last_err}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if !out.status.success() {
        return Err(format!("python failed: {stderr}\n{stdout}"));
    }
    serde_json::from_str(&stdout).map_err(|e| format!("invalid json from python: {e}: {stdout}"))
}

/// Consomme un job `atlas.ai_job_queue` (SKIP LOCKED) avant la file legacy `ai_training_jobs`.
async fn try_process_ai_job_queue(pool: &PgPool) -> anyhow::Result<Option<serde_json::Value>> {
    let mut tx = pool.begin().await?;
    let job = sqlx::query(
        r#"
        SELECT id, parameter_id, job_type, payload
        FROM atlas.ai_job_queue
        WHERE status = 'queued'
        ORDER BY requested_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
        "#,
    )
    .fetch_optional(&mut *tx)
    .await?;

    let Some(job) = job else {
        tx.rollback().await?;
        return Ok(None);
    };

    let job_id: uuid::Uuid = job.get("id");
    let parameter_id: String = job.get("parameter_id");
    let job_type: String = job.get("job_type");
    let payload: serde_json::Value = job.try_get("payload").unwrap_or(json!({}));

    let started_at = chrono::Utc::now();
    sqlx::query(
        r#"
        UPDATE atlas.ai_job_queue
        SET status = 'running', started_at = $2
        WHERE id = $1
        "#,
    )
    .bind(job_id)
    .bind(started_at)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let db_url = require_database_url().map_err(|e| anyhow::anyhow!(e))?;
    let script = script_path("../../scripts/kriging_gp_global_interpolate.py");
    let (status, detail) = match run_python_json(&[
        &script,
        "--database-url",
        &db_url,
        "--method",
        "kriging_gp_global_v1",
    ]) {
        Ok(v) => ("finished", json!({"result": v, "parameter_id": parameter_id, "job_type": job_type, "payload": payload})),
        Err(e) => ("failed", json!({"error": e.to_string()})),
    };

    let finished_at = chrono::Utc::now();
    let err_msg: Option<String> = if status == "failed" {
        Some(detail.to_string())
    } else {
        None
    };
    sqlx::query(
        r#"
        UPDATE atlas.ai_job_queue
        SET status = $2, finished_at = $3, error_message = $4
        WHERE id = $1
        "#,
    )
    .bind(job_id)
    .bind(status)
    .bind(finished_at)
    .bind(err_msg)
    .execute(pool)
    .await?;

    Ok(Some(json!({
        "source_table": "ai_job_queue",
        "job_id": job_id,
        "parameter_id": parameter_id,
        "job_type": job_type,
        "status": status,
        "finished_at": finished_at.to_rfc3339(),
        "detail": detail
    })))
}

async fn process_one_job(pool: &PgPool) -> anyhow::Result<Option<serde_json::Value>> {
    if let Some(v) = try_process_ai_job_queue(pool).await? {
        return Ok(Some(v));
    }

    let mut tx = pool.begin().await?;

    // Claim one queued training job atomically (legacy).
    let job = sqlx::query(
        r#"
        SELECT id, model_target, trigger_reason
        FROM atlas.ai_training_jobs
        WHERE status = 'queued'
        ORDER BY requested_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
        "#,
    )
    .fetch_optional(&mut *tx)
    .await?;

    let Some(job) = job else {
        tx.rollback().await?;
        return Ok(None);
    };

    let job_id: uuid::Uuid = job.get("id");
    let model_target: String = job.get("model_target");
    let trigger_reason: String = job.get("trigger_reason");

    let started_at = chrono::Utc::now();
    let _ = sqlx::query(
        r#"
        UPDATE atlas.ai_training_jobs
        SET status = 'running', started_at = $2,
            logs = jsonb_set(COALESCE(logs,'{}'::jsonb), '{events}', COALESCE(logs->'events','[]'::jsonb) || $3::jsonb, true)
        WHERE id = $1
        "#,
    )
    .bind(job_id)
    .bind(started_at)
    .bind(
        serde_json::to_string(&json!([{
            "ts": started_at.to_rfc3339(),
            "level": "info",
            "msg": "job claimed",
            "model_target": model_target,
            "trigger_reason": trigger_reason
        }]))
        .unwrap_or_else(|_| "[]".to_string()),
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Execute outside transaction.
    let db_url = require_database_url().map_err(|e| anyhow::anyhow!(e))?;
    let (status, result_or_error) = match model_target.as_str() {
        "kriging_gp_global_v1" | "kriging" => {
            let script = script_path("../../scripts/kriging_gp_global_interpolate.py");
            match run_python_json(&[
                &script,
                "--database-url",
                &db_url,
                "--method",
                "kriging_gp_global_v1",
            ]) {
                Ok(v) => ("finished", json!({"result": v})),
                Err(e) => ("failed", json!({"error": e})),
            }
        }
        // Default supervised job
        _ => {
            let script = script_path("../../scripts/supervised_rga_train_infer.py");
            match run_python_json(&[
                &script,
                "--database-url",
                &db_url,
                "--model-version",
                "supervised_ml_gb_v1",
                "--target",
                "rga_predictor",
            ]) {
                Ok(v) => ("finished", json!({"result": v})),
                Err(e) => ("failed", json!({"error": e})),
            }
        }
    };

    let finished_at = chrono::Utc::now();
    let mut tx2 = pool.begin().await?;
    let _ = sqlx::query(
        r#"
        UPDATE atlas.ai_training_jobs
        SET status = $2,
            finished_at = $3,
            logs = jsonb_set(
              jsonb_set(COALESCE(logs,'{}'::jsonb), '{last_run}', $4::jsonb, true),
              '{events}',
              COALESCE(logs->'events','[]'::jsonb) || $5::jsonb,
              true
            )
        WHERE id = $1
        "#,
    )
    .bind(job_id)
    .bind(status)
    .bind(finished_at)
    .bind(serde_json::to_string(&result_or_error).unwrap_or_else(|_| "{}".to_string()))
    .bind(
        serde_json::to_string(&json!([{
            "ts": finished_at.to_rfc3339(),
            "level": if status == "finished" { "info" } else { "error" },
            "msg": "job finished",
            "status": status,
        }]))
        .unwrap_or_else(|_| "[]".to_string()),
    )
    .execute(&mut *tx2)
    .await?;
    tx2.commit().await?;

    Ok(Some(json!({
        "job_id": job_id,
        "model_target": model_target,
        "status": status,
        "finished_at": finished_at.to_rfc3339(),
        "details": result_or_error
    })))
}

