use axum::{extract::State, http::StatusCode, routing::{get, post}, Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::process::Command;

use crate::{auth::AuthUser, state::AppState};

#[derive(Debug, Deserialize)]
pub struct VariogramPlotRequest {
    pub parameter_id: String,
    pub horizon: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct VariogramPlotResponse {
    pub svg: String,
    pub cached: bool,
    pub cache_key: String,
    pub parameter_id: String,
    pub horizon: Option<String>,
    pub rows: i32,
}

pub fn ai_plots_routes() -> Router<AppState> {
    Router::new()
        .route("/ai/plots/variogram", post(post_variogram_plot))
        .route("/ai/variograms/summary", get(get_variograms_summary))
        .route("/ai/plots/variogram-compare", post(variogram_compare))
}

/// GET /ai/variograms/summary — synthèse LOO / métriques (UI validation / drawer).
async fn get_variograms_summary(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let rows = sqlx::query(
        r#"
        SELECT
            id,
            parameter_id,
            COALESCE(fit_quality->>'horizon_label', '') AS horizon,
            loo_rmse,
            block_cv_rmse,
            model_type,
            range_m,
            nugget,
            sill,
            fit_quality,
            created_at
        FROM atlas.ai_variograms
        ORDER BY created_at DESC
        LIMIT 500
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let mut out = Vec::new();
    for r in rows {
        let fit_quality: serde_json::Value = r.try_get("fit_quality").unwrap_or(json!({}));
        let horizon = r.get::<String, _>("horizon");
        out.push(json!({
            "parameter_id": r.get::<String, _>("parameter_id"),
            "horizon": if horizon.is_empty() { serde_json::Value::Null } else { json!(horizon) },
            "loo_rmse": r.try_get::<Option<f64>, _>("loo_rmse").ok().flatten(),
            "block_rmse": r.try_get::<Option<f64>, _>("block_cv_rmse").ok().flatten(),
            "model_type": r.try_get::<Option<String>, _>("model_type").ok().flatten(),
            "range_m": r.try_get::<Option<f64>, _>("range_m").ok().flatten(),
            "nugget": r.try_get::<Option<f64>, _>("nugget").ok().flatten(),
            "sill": r.try_get::<Option<f64>, _>("sill").ok().flatten(),
            "variogram_id": r.get::<uuid::Uuid, _>("id"),
            "run_id": serde_json::Value::Null,
            "fit_quality": fit_quality,
            "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
        }));
    }

    let n = out.len();
    Ok(Json(json!({ "success": true, "items": out, "count": n })))
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

async fn post_variogram_plot(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<VariogramPlotRequest>,
) -> Result<Json<VariogramPlotResponse>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }
    let parameter_id = payload.parameter_id.trim().to_string();
    if parameter_id.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"parameter_id requis"}))));
    }
    let horizon = payload
        .horizon
        .as_ref()
        .map(|h| h.trim().to_uppercase())
        .filter(|h| !h.is_empty());
    let cache_key = format!("variogram:{}:{}", parameter_id, horizon.clone().unwrap_or_else(|| "ALL".to_string()));

    // Cache hit
    if let Ok(Some(row)) = sqlx::query(
        r#"
        SELECT svg, COALESCE((payload->>'rows')::int, 0) AS rows
        FROM atlas.ai_plot_cache
        WHERE cache_key = $1
        LIMIT 1
        "#,
    )
    .bind(&cache_key)
    .fetch_optional(&state.pool)
    .await
    {
        let svg: String = row.get("svg");
        let rows: i32 = row.try_get("rows").unwrap_or(0);
        return Ok(Json(VariogramPlotResponse {
            svg,
            cached: true,
            cache_key,
            parameter_id,
            horizon,
            rows,
        }));
    }

    let db_url = require_database_url().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e }))))?;
    let script = script_path("../../scripts/generate_variogram_plot.py");
    let mut args = vec![script.as_str(), "--database-url", db_url.as_str(), "--parameter-id", parameter_id.as_str()];
    if let Some(h) = &horizon {
        args.push("--horizon");
        args.push(h.as_str());
    }
    let py = run_python_json(&args).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e }))))?;
    let svg = py
        .get("svg")
        .and_then(|v| v.as_str())
        .ok_or_else(|| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"svg missing in python output"}))))?
        .to_string();
    let rows = py.get("rows").and_then(|v| v.as_i64()).unwrap_or(0) as i32;

    let payload_cache = json!({"rows": rows});
    let _ = sqlx::query(
        r#"
        INSERT INTO atlas.ai_plot_cache(cache_key, plot_type, parameter_id, horizon_label, svg, payload, updated_at)
        VALUES ($1, 'variogram', $2, $3, $4, $5::jsonb, now())
        ON CONFLICT (cache_key) DO UPDATE SET
          svg = EXCLUDED.svg,
          payload = EXCLUDED.payload,
          updated_at = now()
        "#,
    )
    .bind(&cache_key)
    .bind(&parameter_id)
    .bind(horizon.clone())
    .bind(&svg)
    .bind(payload_cache.to_string())
    .execute(&state.pool)
    .await;

    Ok(Json(VariogramPlotResponse {
        svg,
        cached: false,
        cache_key,
        parameter_id,
        horizon,
        rows,
    }))
}

#[derive(serde::Deserialize)]
pub struct VariogramCompareRequest {
    pub parameter_base: String,
    pub horizons: Option<Vec<String>>,
}

pub async fn variogram_compare(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<VariogramCompareRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let horizons = req.horizons.unwrap_or_else(|| {
        vec!["h1".to_string(), "h2".to_string(), "h3".to_string()]
    });

    let params_with_vario: Vec<serde_json::Value> = {
        let mut results = vec![];
        for h in &horizons {
            let param_id = format!("{}_{}", req.parameter_base, h);

            let row = sqlx::query(r#"
                SELECT parameter_id, nugget, sill, range_m, loo_rmse,
                    COALESCE(
                        fit_quality->>'horizon_label',
                        split_part(parameter_id, '_h', 2)
                    ) AS horizon_label
                FROM atlas.ai_variograms
                WHERE parameter_id = $1
                  AND nugget IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 1
            "#)
            .bind(&param_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()}))))?;

            if let Some(r) = row {
                results.push(json!({
                    "parameter_id": r.get::<String, _>("parameter_id"),
                    "nugget": r.try_get::<Option<f64>, _>("nugget").ok().flatten(),
                    "sill": r.try_get::<Option<f64>, _>("sill").ok().flatten(),
                    "range_m": r.try_get::<Option<f64>, _>("range_m").ok().flatten(),
                    "loo_rmse": r.try_get::<Option<f64>, _>("loo_rmse").ok().flatten(),
                    "horizon_label": r.try_get::<Option<String>, _>("horizon_label")
                                    .ok().flatten().unwrap_or_else(|| h.to_uppercase()),
                }));
            }
        }
        results
    };

    if params_with_vario.is_empty() {
        return Ok(Json(json!({
            "svg": null,
            "error": "Aucun variogramme avec métadonnées pour ce paramètre"
        })));
    }

    let params_json = serde_json::to_string(&params_with_vario)
        .unwrap_or_default();

    let script = script_path("../../scripts/generate_variogram_plot.py");
    let db_url = require_database_url().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e }))))?;
    let result = run_python_json(
        &[
            script.as_str(),
            "--multi-compare", &params_json,
            "--parameter-id", &req.parameter_base,
            "--database-url", &db_url,
        ]
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": e}))))?;

    Ok(Json(json!({
        "svg": result.get("svg"),
        "parameters": params_with_vario,
        "parameter_base": req.parameter_base,
    })))
}

