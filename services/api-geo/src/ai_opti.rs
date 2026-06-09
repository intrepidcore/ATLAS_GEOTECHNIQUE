use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::process::Command;

use crate::{ai_infer, auth::AuthUser, internal_services, state::AppState};

/// POST `/ai/opti/campaign/simple` — classement heuristique (passe par api-opti si configuré).
pub async fn optimize_campaign_simple(
    State(_state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }
    match internal_services::forward_opti_campaign_simple(payload).await {
        Ok(Some(v)) => Ok(Json(v)),
        Ok(None) => Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "api_opti_required",
                "detail": "Configurer ATLAS_API_OPTI_URL et démarrer api-opti avec DATABASE_URL (migration 159)."
            })),
        )),
        Err(e) => Err((StatusCode::BAD_GATEWAY, Json(json!({ "error": "api-opti", "detail": e })))),
    }
}

/// POST `/ai/opti/campaign` — AG bitmask sous contrainte budget + dépression.
pub async fn optimize_campaign_ga(
    State(_state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }
    match internal_services::forward_opti_campaign_ga(payload).await {
        Ok(Some(v)) => Ok(Json(v)),
        Ok(None) => Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "api_opti_required",
                "detail": "Configurer ATLAS_API_OPTI_URL et démarrer api-opti avec DATABASE_URL."
            })),
        )),
        Err(e) => Err((StatusCode::BAD_GATEWAY, Json(json!({ "error": "api-opti", "detail": e })))),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct OptiRequest {
    pub maille_code: Option<String>,
    pub maille_id: Option<uuid::Uuid>,
    pub charge_kpa: Option<f64>,
    pub budget_fcfa: Option<f64>,
    pub generations: Option<u32>,
    pub population_size: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RetrainRequest {
    pub target: Option<String>,
    pub trigger_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptiCandidate {
    pub rank: usize,
    pub traitement_sol: String,
    pub fondation: String,
    pub cout_fcfa: f64,
    pub safety_factor: f64,
    pub durability_score: f64,
    pub fitness: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptiResponse {
    pub maille_id: uuid::Uuid,
    pub maille_code: String,
    pub model_version: String,
    pub generations: u32,
    pub population_size: u32,
    pub best_candidates: Vec<OptiCandidate>,
}

pub async fn optimize_strategy(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<OptiRequest>,
) -> Result<Json<OptiResponse>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let features = ai_infer::load_features(&state, payload.maille_id, payload.maille_code.as_deref()).await?;
    let charge = payload.charge_kpa.unwrap_or(150.0).clamp(50.0, 500.0);
    let budget = payload.budget_fcfa.unwrap_or(45_000_000.0).clamp(5_000_000.0, 500_000_000.0);
    let generations = payload.generations.unwrap_or(25).clamp(5, 100);
    let population_size = payload.population_size.unwrap_or(40).clamp(10, 200);

    let response = match internal_services::forward_opti_strategie(json!({
        "maille_id": features.maille_id,
        "maille_code": features.maille_code,
        "features": serde_json::to_value(&features).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("serialize features: {}", e) })),
            )
        })?,
        "charge_kpa": charge,
        "budget_fcfa": budget,
        "generations": generations,
        "population_size": population_size
    }))
    .await
    {
        Ok(Some(v)) => serde_json::from_value::<OptiResponse>(v).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("opti service response: {}", e) })),
            )
        })?,
        Ok(None) => {
            let mut candidates = build_candidates(&features, charge, budget);
            candidates.sort_by(|a, b| b.fitness.partial_cmp(&a.fitness).unwrap_or(std::cmp::Ordering::Equal));
            for (idx, c) in candidates.iter_mut().enumerate() {
                c.rank = idx + 1;
            }
            OptiResponse {
                maille_id: features.maille_id,
                maille_code: features.maille_code.clone(),
                model_version: "api-opti-v0-genetic-inspired".to_string(),
                generations,
                population_size,
                best_candidates: candidates.into_iter().take(5).collect(),
            }
        }
        Err(e) => {
            return Err((
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": "api-opti", "detail": e })),
            ));
        }
    };

    let _ = sqlx::query(
        r#"
        INSERT INTO atlas.ai_opti_runs (maille_id, maille_code, model_version, constraints, candidates, created_by)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
        "#,
    )
    .bind(response.maille_id)
    .bind(&response.maille_code)
    .bind(&response.model_version)
    .bind(
        serde_json::to_string(&json!({
            "charge_kpa": charge,
            "budget_fcfa": budget,
            "generations": generations,
            "population_size": population_size
        }))
        .unwrap_or_else(|_| "{}".to_string()),
    )
    .bind(serde_json::to_string(&response.best_candidates).unwrap_or_else(|_| "[]".to_string()))
    .bind(auth.id)
    .execute(&state.pool)
    .await;

    Ok(Json(response))
}

pub async fn request_retrain(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<RetrainRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let target = payload.target.unwrap_or_else(|| "rga_predictor".to_string());
    let trigger_reason = payload
        .trigger_reason
        .unwrap_or_else(|| "manual_request".to_string());

    let job_id = uuid::Uuid::new_v4();
    let _ = sqlx::query(
        r#"
        INSERT INTO atlas.ai_training_jobs (id, model_target, trigger_reason, status, requested_by)
        VALUES ($1, $2, $3, 'queued', $4)
        "#,
    )
    .bind(job_id)
    .bind(&target)
    .bind(&trigger_reason)
    .bind(auth.id)
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "job_id": job_id,
        "status": "queued",
        "target": target,
        "trigger_reason": trigger_reason
    })))
}

pub async fn recompute_geotech_sources(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let row = sqlx::query(
        r#"
        SELECT infer_count, interpolation_count, foundation_count
        FROM atlas.refresh_ai_geotech_sources()
        LIMIT 1
        "#,
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("refresh failed: {}", e) })),
        )
    })?;

    let infer_count: i64 = row.try_get("infer_count").unwrap_or(0);
    let interpolation_count: i64 = row.try_get("interpolation_count").unwrap_or(0);
    let foundation_count: i64 = row.try_get("foundation_count").unwrap_or(0);

    Ok(Json(json!({
        "success": true,
        "infer_count": infer_count,
        "interpolation_count": interpolation_count,
        "foundation_count": foundation_count
    })))
}

fn script_path(relative_from_manifest_dir: &str) -> String {
    if let Ok(dir) = std::env::var("ATLAS_SCRIPTS_DIR") {
        let script_name = std::path::Path::new(relative_from_manifest_dir)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(relative_from_manifest_dir);
        return format!("{}/{}", dir.trim_end_matches('/'), script_name);
    }
    // `CARGO_MANIFEST_DIR` = .../services/api-geo
    format!("{}/{}", env!("CARGO_MANIFEST_DIR"), relative_from_manifest_dir)
}

fn require_database_url() -> Result<String, String> {
    std::env::var("DATABASE_URL").map_err(|_| "DATABASE_URL missing".to_string())
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

pub async fn recompute_kriging_global_gp(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let metrics = match internal_services::forward_infer_kriging().await {
        Ok(Some(v)) => v,
        Ok(None) => {
            let db_url = require_database_url()
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e }))))?;
            let kriging_script = script_path("../../scripts/kriging_gp_global_interpolate.py");
            run_python_json(&[
                &kriging_script,
                "--database-url",
                &db_url,
                "--method",
                "kriging_gp_global_v1",
            ])
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e }))))?
        }
        Err(e) => {
            return Err((
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": "api-infer", "detail": e })),
            ));
        }
    };

    let kriging_method_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM atlas.maille_geotech_interpolation
        WHERE method = $1
        "#,
    )
    .bind("kriging_gp_global_v1")
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    Ok(Json(json!({
        "success": true,
        "method": "kriging_gp_global_v1",
        "metrics": metrics,
        "rows": kriging_method_count
    })))
}

pub async fn train_supervised_infer_rga(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    const MODEL_V2: &str = "supervised_ml_gb_v2_context";
    const TARGET: &str = "rga_predictor";

    let result = match internal_services::forward_infer_supervised(MODEL_V2, TARGET).await {
        Ok(Some(v)) => v,
        Ok(None) => {
            let db_url = require_database_url()
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e }))))?;
            let script = script_path("../../scripts/supervised_rga_train_infer.py");
            run_python_json(&[
                &script,
                "--database-url",
                &db_url,
                "--model-version",
                MODEL_V2,
                "--target",
                TARGET,
            ])
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e }))))?
        }
        Err(e) => {
            return Err((
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": "api-infer", "detail": e })),
            ));
        }
    };

    let _ = sqlx::query(
        r#"
        INSERT INTO atlas.ai_model_registry (model_target, model_version, status, metrics, created_by)
        VALUES ($1, $2, 'active', $3::jsonb, $4)
        ON CONFLICT (model_target, model_version) DO UPDATE SET
          status = EXCLUDED.status,
          metrics = EXCLUDED.metrics,
          created_at = NOW(),
          created_by = EXCLUDED.created_by
        "#,
    )
    .bind(TARGET)
    .bind(MODEL_V2)
    .bind(serde_json::to_string(&result.get("metrics").cloned().unwrap_or(json!({}))).unwrap_or_else(|_| "{}".to_string()))
    .bind(auth.id)
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "result": result
    })))
}

pub async fn refresh_ml_prereqs(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let row = sqlx::query(r#"SELECT atlas.refresh_atlas_ml_prereqs() AS payload"#)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("refresh_atlas_ml_prereqs: {}", e) })),
            )
        })?;

    let payload: serde_json::Value = row.try_get("payload").map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("decode refresh payload: {}", e) })),
        )
    })?;

    Ok(Json(json!({
        "success": true,
        "refresh": payload
    })))
}

fn build_candidates(features: &ai_infer::MailleFeatures, charge_kpa: f64, budget_fcfa: f64) -> Vec<OptiCandidate> {
    let treatments = [
        ("aucun", 1.0_f64, 0.0_f64, 0.85_f64),
        ("chaux", 1.18_f64, 7_500_000.0_f64, 0.9_f64),
        ("ciment", 1.28_f64, 10_500_000.0_f64, 0.92_f64),
        ("nere_experimental", 1.14_f64, 6_500_000.0_f64, 0.88_f64),
    ];
    let foundations = [
        ("semelles_superficielles", 1.0_f64, 12_000_000.0_f64),
        ("radier", 1.22_f64, 18_500_000.0_f64),
        ("micropieux", 1.45_f64, 26_000_000.0_f64),
    ];

    let risk_multiplier = if features.pct_in_lama.unwrap_or(0.0) >= 25.0 { 1.18 } else { 1.0 };
    let data_bonus = (features.n_sondages as f64 * 0.03).clamp(0.0, 0.15);

    let mut out = Vec::new();
    for (t_name, t_safety_mult, t_cost, t_durability) in treatments {
        for (f_name, f_safety_mult, f_cost) in foundations {
            let base_safety = (2.2 - (charge_kpa / 280.0)).clamp(0.8, 2.2);
            let safety = (base_safety * t_safety_mult * f_safety_mult / risk_multiplier + data_bonus).clamp(0.6, 3.0);
            let cost = t_cost + f_cost + (charge_kpa * 12_000.0);
            let budget_ratio = (budget_fcfa / cost).clamp(0.2, 2.0);
            let durability = (t_durability + if f_name == "micropieux" { 0.05 } else { 0.0 }).clamp(0.5, 1.0);
            let fitness = (safety * 45.0) + (durability * 35.0) + (budget_ratio * 20.0);

            out.push(OptiCandidate {
                rank: 0,
                traitement_sol: t_name.to_string(),
                fondation: f_name.to_string(),
                cout_fcfa: (cost * 100.0).round() / 100.0,
                safety_factor: (safety * 100.0).round() / 100.0,
                durability_score: (durability * 100.0).round() / 100.0,
                fitness: (fitness * 100.0).round() / 100.0,
            });
        }
    }
    out
}

/// POST `/ai/ked/recompute` — lance les scripts KED (vbs/ip/wl/wp/eg horizons) + derive_rga.
/// POST `/ai/rk/recompute` — lance le Regression Kriging SCORPAN (L2a) pour tous params × horizons.
///
/// Chaque combinaison (param, horizon) est un process indépendant — 15 process parallèles.
/// Calcule : vbs, ip, wl, wp, eg × h1, h2, h3 → ai_interpolation_values (method=regression_kriging_scorpan).
pub async fn recompute_rk(
    State(_state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    use std::thread;

    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let db_url = require_database_url()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e }))))?;

    let rk_script = script_path("../../scripts/atlas_regression_kriging_terrain.py");

    let params   = ["vbs", "ip", "wl", "wp", "eg"];
    let horizons = ["h1", "h2", "h3"];

    // 15 threads parallèles (param × horizon) — chacun indépendant, écriture atomique en DB
    let handles: Vec<_> = params.iter().flat_map(|&p| {
        // Cloner les captures AVANT la closure interne (évite move sur FnMut outer)
        let rk_script_outer = rk_script.clone();
        let db_url_outer    = db_url.clone();
        horizons.iter().map(move |&h| {
            let script  = rk_script_outer.clone();
            let db      = db_url_outer.clone();
            let param   = p.to_string();
            let horizon = h.to_string();
            thread::spawn(move || {
                let result = run_python_json(&[
                    &script,
                    "--database-url", &db,
                    "--parameter",    &param,
                    "--horizon",      &horizon,
                ]);
                (param, horizon, result)
            })
        }).collect::<Vec<_>>()
    }).collect();

    let mut results = Vec::new();
    let mut n_ok = 0usize;
    let mut n_err = 0usize;

    for h in handles {
        match h.join() {
            Ok((param, horizon, Ok(v))) => {
                n_ok += 1;
                results.push(json!({ "param": param, "horizon": horizon, "result": v }));
            }
            Ok((param, horizon, Err(e))) => {
                n_err += 1;
                results.push(json!({ "param": param, "horizon": horizon, "error": e }));
            }
            Err(_) => n_err += 1,
        }
    }

    Ok(Json(json!({
        "success": n_err == 0,
        "n_ok": n_ok,
        "n_err": n_err,
        "results": results,
    })))
}

pub async fn recompute_ked(
    State(_state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let db_url = require_database_url()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e }))))?;

    let ked_script = script_path("../../scripts/run_ked_vbs_ip_wl_wp_horizons.py");
    let eg_script = script_path("../../scripts/run_ked_eg_horizons.py");
    let granulo_script = script_path("../../scripts/run_ked_granulo_horizons.py");
    let rga_script = script_path("../../scripts/derive_rga_from_ked_h2.py");

    let mut results = Vec::new();

    // KED vbs/ip/wl/wp
    match run_python_json(&[&ked_script, "--database-url", &db_url]) {
        Ok(v) => results.push(json!({ "script": "run_ked_vbs_ip_wl_wp_horizons", "result": v })),
        Err(e) => results.push(json!({ "script": "run_ked_vbs_ip_wl_wp_horizons", "error": e })),
    }

    // KED eg
    match run_python_json(&[&eg_script, "--database-url", &db_url]) {
        Ok(v) => results.push(json!({ "script": "run_ked_eg_horizons", "result": v })),
        Err(e) => results.push(json!({ "script": "run_ked_eg_horizons", "error": e })),
    }

    // KED granulo
    match run_python_json(&[&granulo_script, "--database-url", &db_url]) {
        Ok(v) => results.push(json!({ "script": "run_ked_granulo_horizons", "result": v })),
        Err(e) => results.push(json!({ "script": "run_ked_granulo_horizons", "error": e })),
    }

    // derive RGA from KED H2
    match run_python_json(&[&rga_script, "--database-url", &db_url]) {
        Ok(v) => results.push(json!({ "script": "derive_rga_from_ked_h2", "result": v })),
        Err(e) => results.push(json!({ "script": "derive_rga_from_ked_h2", "error": e })),
    }

    Ok(Json(json!({
        "success": true,
        "scripts_run": results.len(),
        "results": results,
    })))
}
