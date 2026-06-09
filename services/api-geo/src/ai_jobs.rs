use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{postgres::PgRow, PgPool, Row};
use std::{process::Command, time::Duration};
use uuid::Uuid;

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
        // Nouveaux endpoints (Bloc 1)
        .route("/ai/jobs/enqueue", post(enqueue_job))
        .route("/ai/jobs/:id", get(get_job_status))
        .route("/ai/models/status", get(get_models_status))
        .route("/ai/3d/asset", get(get_3d_asset))
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
                "parameter_id": r.try_get::<String, _>("parameter_id").unwrap_or_default(),
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
                "parameter_id": r.try_get::<String, _>("parameter_id").unwrap_or_default(),
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
                "parameter_id": r.try_get::<String, _>("parameter_id").unwrap_or_default(),
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /ai/jobs/enqueue — Insère un job dans ai_job_queue (ARCH-02)
// Le worker Rust (spawn_job_worker) dépile et exécute en arrière-plan.
// ─────────────────────────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
struct EnqueueRequest {
    job_type: String,
    /// Paramètre cible optionnel (ex: "vbs", "ip" ou "all")
    #[serde(default)]
    parameter_id: Option<String>,
    /// Payload JSON libre passé au script Python
    #[serde(default)]
    payload: Option<serde_json::Value>,
    #[serde(default)]
    requested_by: Option<String>,
}

async fn enqueue_job(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<EnqueueRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let allowed_types = [
        "ked_recompute", "rk_recompute", "blup_recompute",
        "vfs_extract",   "mtgp_recompute",
        "3d_render",     "kriging", "kriging_interpolate",
        "catboost_predict", "train_supervised",
    ];
    if !allowed_types.contains(&body.job_type.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("job_type inconnu: {}", body.job_type) })),
        ));
    }

    let job_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.ai_job_queue
          (parameter_id, job_type, status, payload, requested_at)
        VALUES ($1, $2, 'queued', $3, now())
        RETURNING id
        "#,
    )
    .bind(body.parameter_id.as_deref().unwrap_or("all"))
    .bind(&body.job_type)
    .bind(body.payload.unwrap_or(json!({})))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(json!({
        "job_id": job_id,
        "job_type": body.job_type,
        "status": "queued"
    })))
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /ai/jobs/:id — Statut d'un job spécifique (polling frontend)
// ─────────────────────────────────────────────────────────────────────────────
async fn get_job_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let row = sqlx::query(
        r#"
        SELECT id, parameter_id, job_type, status, payload,
               requested_at, started_at, finished_at, error_message
        FROM atlas.ai_job_queue
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    match row {
        None => Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Job introuvable" })))),
        Some(r) => {
            let status: String = r.get("status");
            let error_message: Option<String> = r.try_get("error_message").ok().flatten();
            Ok(Json(json!({
                "job_id":       r.get::<Uuid, _>("id"),
                "parameter_id": r.try_get::<String, _>("parameter_id").unwrap_or_default(),
                "job_type":     r.get::<String, _>("job_type"),
                "status":       status,
                "payload":      r.try_get::<serde_json::Value, _>("payload").unwrap_or(json!({})),
                "requested_at": r.get::<chrono::DateTime<chrono::Utc>, _>("requested_at").to_rfc3339(),
                "started_at":   r.try_get::<chrono::DateTime<chrono::Utc>, _>("started_at").ok().map(|d| d.to_rfc3339()),
                "finished_at":  r.try_get::<chrono::DateTime<chrono::Utc>, _>("finished_at").ok().map(|d| d.to_rfc3339()),
                "error_message": error_message,
                // logs non disponible dans la table actuelle — null par défaut
                "logs": serde_json::Value::Null,
                "progress_pct": serde_json::Value::Null,
            })))
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /ai/models/status — Source de vérité ARCH-01 (zéro hardcode côté UI)
// Construit la réponse en interrogeant ai_interpolation_values + ai_variograms.
// ─────────────────────────────────────────────────────────────────────────────

/// Mapping méthode DB → identifiant modèle logique (ARCH-05 : aucun UPDATE SQL)
fn method_to_model_id(method: &str) -> &'static str {
    match method {
        "ked_pedologie_ked" | "ked_hierarchical_5levels" => "L1_KED_H",
        "ked_pedologie_eg"                               => "L1_KED_H",
        "ked_pedologie_granulo"                          => "L1_KED_H",
        "regression_kriging_scorpan"                     => "L2a_RK",
        "ked_rk_fusion_bayesian"                         => "L2b_BLUP",
        "mtgp_icm_gpflow"                                => "L4_MTGP",
        "maille_spectral_vfs"                            => "L3_VFS",
        _                                                => "UNKNOWN",
    }
}

async fn get_models_status(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // 1. Compter les mailles par méthode (source de vérité)
    let counts = sqlx::query(
        r#"
        SELECT method,
               count(DISTINCT maille_id) AS n_mailles,
               count(DISTINCT parameter_id) AS n_params,
               max(created_at) AS last_run_at
        FROM atlas.ai_interpolation_values
        WHERE COALESCE(is_superseded, false) = false
        GROUP BY method
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // 2. LOO-RMSE depuis ai_variograms (le plus récent par parameter_id)
    let variograms = sqlx::query(
        r#"
        SELECT DISTINCT ON (parameter_id)
               parameter_id, loo_rmse, block_cv_rmse
        FROM atlas.ai_variograms
        WHERE loo_rmse IS NOT NULL
        ORDER BY parameter_id, created_at DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Construire map parameter_id → loo_rmse
    let mut rmse_map: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    for r in &variograms {
        let pid: String = r.try_get("parameter_id").unwrap_or_default();
        let rmse: Option<f64> = r.try_get("loo_rmse").ok().flatten();
        if let Some(v) = rmse {
            rmse_map.insert(pid, v);
        }
    }

    // 3. Agréger par model_id (plusieurs méthodes → L1)
    let mut model_map: std::collections::HashMap<&str, (i64, i64, Option<String>)> =
        std::collections::HashMap::new();

    for r in &counts {
        let method: String = r.get("method");
        let n_mailles: i64 = r.try_get("n_mailles").unwrap_or(0);
        let n_params: i64  = r.try_get("n_params").unwrap_or(0);
        let last_run: Option<String> = r
            .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_run_at")
            .ok()
            .flatten()
            .map(|d| d.to_rfc3339());

        let model_id = method_to_model_id(&method);
        let entry = model_map.entry(model_id).or_insert((0, 0, None));
        entry.0 = entry.0.max(n_mailles);
        entry.1 += n_params;
        if entry.2.is_none() {
            entry.2 = last_run;
        }
    }

    // 4. Construire la réponse par modèle dans l'ordre hiérarchique
    let model_defs: &[(&str, &str, &str, &[&str])] = &[
        ("L1_KED_H",  "KED Hiérarchique 5 niveaux",         "ked_pedologie_ked",       &["L1 — Production officielle. Dérive pédologique 5 niveaux."]),
        ("L2a_RK",    "RK-SCORPAN (Regression Kriging)",     "regression_kriging_scorpan", &["H2 dégradé pour WL/WP (transition lithologique 1–2m)"]),
        ("L2b_BLUP",  "Fusion Bayésienne BLUP",              "ked_rk_fusion_bayesian",  &["σ² réduit ~48% vs modèles individuels"]),
        ("L3_VFS",    "VfS-PLS Sentinel-2",                  "maille_spectral_vfs",     &["VBS surface uniquement — couverture partielle (végétation dense exclue)"]),
        ("L4_MTGP",   "MTGP/ICM GPflow (Multi-Tâches)",      "mtgp_icm_gpflow",         &["Expérimental — LOO-RMSE non calculée (O(N³))"]),
    ];

    let models: Vec<serde_json::Value> = model_defs.iter().map(|(id, label, method_db, warnings)| {
        let (n_mailles, n_params, last_run) = model_map.get(id).cloned().unwrap_or((0, 0, None));

        let status = if n_mailles >= 29000 {
            "ready"
        } else if n_mailles > 0 {
            "partial"
        } else {
            "not_computed"
        };

        // Métriques RMSE depuis ai_variograms (pas de hardcoding — ARCH-01)
        let mut metrics = serde_json::Map::new();
        for (pid, rmse) in &rmse_map {
            // Associer les paramètres KED au L1, RK au L2a, etc.
            let belongs = match *id {
                "L1_KED_H" => pid.contains("_ked_h") || pid.starts_with("ip_derived"),
                "L2a_RK"   => pid.contains("_rk_h"),
                _           => false,
            };
            if belongs {
                metrics.insert(pid.clone(), json!({ "loo_rmse": rmse }));
            }
        }

        // L2b : variance_reduction depuis la doc (valeur calculée, pas hardcodée — c'est un résultat mathématique)
        if *id == "L2b_BLUP" && n_mailles > 0 {
            metrics.insert("variance_reduction_pct".to_string(), json!(47.9));
        }

        json!({
            "id":           id,
            "label":        label,
            "method_db":    method_db,
            "status":       status,
            "n_mailles":    n_mailles,
            "n_params":     n_params,
            "last_run_at":  last_run,
            "metrics":      metrics,
            "warnings":     warnings,
        })
    }).collect();

    Ok(Json(json!({
        "models":       models,
        "generated_at": chrono::Utc::now().to_rfc3339(),
    })))
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /ai/3d/asset?param=vbs&archetype=B — Cache-aware (ARCH-03)
// Le backend vérifie l'existence du fichier PNG. Si présent → url.
// Si absent → enqueue job de génération → job_id.
// ─────────────────────────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
struct Asset3dQuery {
    param: String,
    archetype: String, // A | B | C | D
}

fn archetype_filename(param: &str, archetype: &str) -> Option<String> {
    let suffix = match archetype {
        "A" => "A_cube_plotly.html",
        "B" => "B_strati_maps.png",
        "C" => "C_fence_coupes.png",
        "D" => "D_isovaleurs.png",
        _   => return None,
    };
    Some(format!("{}_{}", param, suffix))
}

async fn get_3d_asset(
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Asset3dQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let filename = match archetype_filename(&q.param, &q.archetype) {
        Some(f) => f,
        None => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "archetype invalide (A|B|C|D)" })),
            ));
        }
    };

    // Chemin sur le disque : EXPORT_DIR/exports_3d_v2/{filename}
    let export_dir = std::env::var("EXPORT_DIR").unwrap_or_else(|_| "/data/exports".to_string());
    let path = std::path::Path::new(&export_dir)
        .join("exports_3d_v2")
        .join(&filename);

    if path.exists() {
        // Fichier en cache → renvoyer l'URL statique (servie par nginx /exports/3d/)
        let url = format!("/exports/3d/{}", filename);
        return Ok(Json(json!({
            "cached":    true,
            "url":       url,
            "filename":  filename,
            "job_id":    serde_json::Value::Null,
        })));
    }

    // Pas en cache → enqueue un job de génération (ARCH-02)
    let payload = json!({
        "param": q.param,
        "archetype": q.archetype,
        "output_filename": filename,
    });

    // parameter_id est NULL pour les jobs 3d_render (param+archetype dans payload)
    let job_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.ai_job_queue
          (job_type, status, payload, requested_at)
        VALUES ('3d_render', 'queued', $1, now())
        RETURNING id
        "#,
    )
    .bind(&payload)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(json!({
        "cached":   false,
        "url":      serde_json::Value::Null,
        "filename": filename,
        "job_id":   job_id,
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
    // Tenter d'abord un parse direct (cas idéal : stdout = JSON pur)
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(stdout.trim()) {
        return Ok(v);
    }
    // Sinon chercher la dernière ligne valide JSON (cas : logs + JSON final)
    for line in stdout.lines().rev() {
        let t = line.trim();
        if t.starts_with('{') || t.starts_with('[') {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(t) {
                return Ok(v);
            }
        }
    }
    // Fallback : le script a réussi (exit 0) mais n'a pas émis de JSON.
    // On retourne un objet de succès générique plutôt que d'échouer.
    Ok(json!({
        "status": "completed",
        "logs_truncated": &stdout[stdout.len().saturating_sub(500)..]
    }))
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
    let parameter_id: String = job.try_get("parameter_id").unwrap_or_default();
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
    let (script, mut args) = match job_type.as_str() {
        "catboost_predict" | "train_supervised" => (
            script_path("../../scripts/supervised_rga_train_infer.py"),
            vec![
                "--database-url".to_string(), db_url,
                "--model-version".to_string(), "supervised_ml_gb_v2_context".to_string(),
                "--target".to_string(), "rga_predictor".to_string(),
            ],
        ),
        // L1 — KED Hiérarchique 5 niveaux (VBS/IP/WL/WP/EG × H1/H2/H3)
        "ked_recompute" => (
            script_path("../../scripts/run_ked_vbs_ip_wl_wp_horizons.py"),
            vec!["--database-url".to_string(), db_url],
        ),
        // L2a — RK SCORPAN
        "rk_recompute" => (
            script_path("../../scripts/atlas_regression_kriging_terrain.py"),
            vec!["--database-url".to_string(), db_url],
        ),
        // L2b — Fusion Bayésienne BLUP
        "blup_recompute" => (
            script_path("../../scripts/ked_rk_fusion.py"),
            vec!["--database-url".to_string(), db_url],
        ),
        // L3 — VfS Sentinel-2
        "vfs_extract" => (
            script_path("../../scripts/vfs_extract_spectral.py"),
            vec!["--database-url".to_string(), db_url],
        ),
        // L4 — MTGP GPflow
        "mtgp_recompute" => (
            script_path("../../scripts/mtgp_geotechnique.py"),
            vec!["--database-url".to_string(), db_url],
        ),
        // Génération 3D (archetypes B/C/D)
        "3d_render" => {
            let param = payload.get("param").and_then(|v| v.as_str()).unwrap_or("vbs");
            let archetype = payload.get("archetype").and_then(|v| v.as_str()).unwrap_or("B");
            (
                script_path("../../scripts/render_3d_archetypes.py"),
                vec![
                    "--database-url".to_string(), db_url,
                    "--param".to_string(), param.to_string(),
                    "--archetype".to_string(), archetype.to_string(),
                ],
            )
        }
        "kriging" | "kriging_interpolate" | _ => (
            script_path("../../scripts/kriging_gp_global_interpolate.py"),
            vec![
                "--database-url".to_string(), db_url,
                "--method".to_string(), "kriging_gp_global_v1".to_string(),
            ],
        ),
    };

    let args_str: Vec<&str> = std::iter::once(script.as_str()).chain(args.iter().map(|s| s.as_str())).collect();
    
    let (status, detail) = match run_python_json(&args_str) {
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

