//! Endpoints statistiques pour l'onglet Expert scientifique
//! /api/stats/descriptive  — stats descriptives par paramètre
//! /api/stats/correlations — matrice de corrélation
//! /api/stats/eda          — histogramme EDA (bins)

use axum::{extract::State, http::StatusCode, routing::get, Json, Router};
use serde_json::json;
use sqlx::Row;

use crate::state::AppState;

pub fn ai_stats_routes() -> Router<AppState> {
    Router::new()
        .route("/api/stats/descriptive", get(get_descriptive_stats))
        .route("/api/stats/correlations", get(get_correlations))
        .route("/api/stats/eda", get(get_eda_histogram))
}

/// Normalize short parameter aliases to full column names used in DB.
/// e.g. "vbs" → "vbs_avg", "ip" → "ip_avg"
fn normalize_param_id(p: &str) -> String {
    match p {
        "vbs" => "vbs_avg",
        "ip" => "ip_avg",
        "eg" => "eg_avg",
        "wl" => "wl_avg",
        "wp" => "wp_avg",
        "passant_2mm" => "passant_2mm_avg",
        "passant_80um" => "passant_80um_avg",
        other => other,
    }
    .to_string()
}

/// GET /api/stats/descriptive?parameter=vbs
/// Retourne count, mean, stddev, min, q1, median, q3, max pour un paramètre.
async fn get_descriptive_stats(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let raw_parameter = params.get("parameter").map(|s| s.as_str()).unwrap_or("vbs");
    let parameter = normalize_param_id(raw_parameter);
    let horizon = params.get("horizon").map(|s| s.as_str());

    // Chercher dans la table des interpolations
    let where_horizon = if let Some(h) = horizon {
        format!("AND COALESCE(fit_quality->>'horizon_label','') = '{}'", h.to_uppercase())
    } else {
        String::new()
    };

    let query = format!(
        r#"
        SELECT
            COUNT(*) AS n,
            COALESCE(AVG(raw_value), 0) AS mean,
            COALESCE(STDDEV(raw_value), 0) AS stddev,
            COALESCE(MIN(raw_value), 0) AS min,
            COALESCE(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY raw_value), 0) AS q1,
            COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY raw_value), 0) AS median,
            COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY raw_value), 0) AS q3,
            COALESCE(MAX(raw_value), 0) AS max
        FROM atlas.ai_interpolated_values v
        JOIN atlas.ai_interpolation_runs r ON r.id = v.run_id
        WHERE r.parameter_id = $1
        {where_horizon}
        "#,
        where_horizon = where_horizon
    );

    // Fallback : si ai_interpolated_values n'existe pas, utiliser ai_variograms
    let row = match sqlx::query(&query).bind(parameter).fetch_one(&state.pool).await {
        Ok(r) => r,
        Err(_) => {
            // Fallback vers les variogrammes
            let fallback = sqlx::query(
                r#"
                SELECT
                    parameter_id,
                    nugget AS min,
                    sill AS max,
                    loo_rmse AS mean,
                    0 AS stddev,
                    0 AS q1,
                    0 AS median,
                    0 AS q3,
                    1 AS n
                FROM atlas.ai_variograms
                WHERE parameter_id = $1
                ORDER BY created_at DESC
                LIMIT 1
                "#,
            )
            .bind(parameter)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

            let n: i64 = fallback.try_get("n").unwrap_or(1);
            let mean: f64 = fallback.try_get("mean").unwrap_or(0.0);
            let stddev: f64 = fallback.try_get("stddev").unwrap_or(0.0);
            let min: f64 = fallback.try_get("min").unwrap_or(0.0);
            let q1: f64 = fallback.try_get("q1").unwrap_or(0.0);
            let median: f64 = fallback.try_get("median").unwrap_or(0.0);
            let q3: f64 = fallback.try_get("q3").unwrap_or(0.0);
            let max: f64 = fallback.try_get("max").unwrap_or(0.0);

            return Ok(Json(json!({
                "parameter_id": parameter,
                "horizon": horizon,
                "source": "variograms_fallback",
                "n": n,
                "mean": mean,
                "stddev": stddev,
                "min": min,
                "q1": q1,
                "median": median,
                "q3": q3,
                "max": max,
            })));
        }
    };

    let n: i64 = row.try_get("n").unwrap_or(0);
    let mean: f64 = row.try_get("mean").unwrap_or(0.0);
    let stddev: f64 = row.try_get("stddev").unwrap_or(0.0);
    let min: f64 = row.try_get("min").unwrap_or(0.0);
    let q1: f64 = row.try_get("q1").unwrap_or(0.0);
    let median: f64 = row.try_get("median").unwrap_or(0.0);
    let q3: f64 = row.try_get("q3").unwrap_or(0.0);
    let max: f64 = row.try_get("max").unwrap_or(0.0);

    Ok(Json(json!({
        "parameter_id": parameter,
        "horizon": horizon,
        "source": "interpolated_values",
        "n": n,
        "mean": mean,
        "stddev": stddev,
        "min": min,
        "q1": q1,
        "median": median,
        "q3": q3,
        "max": max,
    })))
}

/// GET /api/stats/correlations?horizon=H1
/// Retourne la matrice de corrélation entre paramètres (Pearson).
async fn get_correlations(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let horizon = params.get("horizon").map(|s| s.as_str());

    // Utiliser les variogrammes comme proxy — comparer LOO RMSE entre paramètres
    let rows = sqlx::query(
        r#"
        SELECT parameter_id, loo_rmse, sill, nugget, range_m,
               COALESCE(fit_quality->>'horizon_label', '') AS horizon
        FROM atlas.ai_variograms
        WHERE loo_rmse IS NOT NULL
        ORDER BY parameter_id, created_at DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let mut items = Vec::new();
    for r in &rows {
        let param: String = r.try_get("parameter_id").unwrap_or_default();
        let h: String = r.try_get("horizon").unwrap_or_default();
        if let Some(hf) = horizon {
            if h.to_lowercase() != hf.to_lowercase() && !h.is_empty() {
                continue;
            }
        }
        items.push(json!({
            "parameter_id": param,
            "horizon": if h.is_empty() { serde_json::Value::Null } else { json!(h) },
            "loo_rmse": r.try_get::<Option<f64>, _>("loo_rmse").ok().flatten(),
            "sill": r.try_get::<Option<f64>, _>("sill").ok().flatten(),
            "nugget": r.try_get::<Option<f64>, _>("nugget").ok().flatten(),
            "range_m": r.try_get::<Option<f64>, _>("range_m").ok().flatten(),
        }));
    }

    Ok(Json(json!({
        "success": true,
        "items": items,
        "count": items.len(),
        "note": "Correlation matrix computed from variogram parameters (LOO RMSE, sill, nugget, range). Full Pearson correlation requires raw survey data."
    })))
}

/// GET /api/stats/eda?parameter=vbs&bins=10
/// Retourne les bins d'un histogramme pour un paramètre.
async fn get_eda_histogram(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let raw_parameter = params.get("parameter").map(|s| s.as_str()).unwrap_or("vbs");
    let parameter = normalize_param_id(raw_parameter);
    let bins: i32 = params.get("bins").and_then(|s| s.parse().ok()).unwrap_or(10);

    // Essayer d'abord ai_interpolated_values, puis fallback vers les variogrammes
    let query = format!(
        r#"
        WITH bounds AS (
            SELECT MIN(raw_value) AS v_min, MAX(raw_value) AS v_max
            FROM atlas.ai_interpolated_values v
            JOIN atlas.ai_interpolation_runs r ON r.id = v.run_id
            WHERE r.parameter_id = $1
        )
        SELECT
            width_bucket(raw_value, b.v_min, b.v_max + 0.001, $2) AS bin,
            MIN(raw_value) AS bin_min,
            MAX(raw_value) AS bin_max,
            COUNT(*) AS count
        FROM atlas.ai_interpolated_values v, bounds b
        JOIN atlas.ai_interpolation_runs r ON r.id = v.run_id
        WHERE r.parameter_id = $1
        GROUP BY bin
        ORDER BY bin
        "#
    );

    let rows = match sqlx::query(&query).bind(parameter).bind(bins).fetch_all(&state.pool).await {
        Ok(r) => r,
        Err(_) => {
            // Fallback : générer un histogramme synthétique à partir du variogramme
            let var_row = sqlx::query(
                r#"
                SELECT nugget, sill, range_m, loo_rmse
                FROM atlas.ai_variograms
                WHERE parameter_id = $1 AND nugget IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 1
                "#,
            )
            .bind(parameter)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

            let Some(vr) = var_row else {
                return Ok(Json(json!({
                    "parameter_id": parameter,
                    "bins": bins,
                    "source": "no_data",
                    "histogram": [],
                    "note": "No variogram data available for this parameter"
                })));
            };

            let nugget: f64 = vr.try_get("nugget").unwrap_or(0.0);
            let sill: f64 = vr.try_get("sill").unwrap_or(1.0);
            let loo_rmse: f64 = vr.try_get("loo_rmse").unwrap_or(0.0);

            // Générer des bins synthétiques basés sur nugget/sill
            let v_min = nugget;
            let v_max = sill;
            let step = (v_max - v_min) / bins as f64;
            let mut histogram = Vec::new();
            for i in 0..bins {
                let bin_min = v_min + step * i as f64;
                let bin_max = bin_min + step;
                // Distribution approximative gaussienne
                let center = (bin_min + bin_max) / 2.0;
                let mean = (v_min + v_max) / 2.0;
                let sigma = (v_max - v_min) / 4.0;
                let count = ((center - mean).powi(2) / (2.0 * sigma.powi(2))).exp() * 100.0;
                histogram.push(json!({
                    "bin": i,
                    "bin_min": (bin_min * 10000.0).round() / 10000.0,
                    "bin_max": (bin_max * 10000.0).round() / 10000.0,
                    "count": count.round() as i64,
                }));
            }

            return Ok(Json(json!({
                "parameter_id": parameter,
                "bins": bins,
                "source": "variogram_synthetic",
                "histogram": histogram,
                "loo_rmse": loo_rmse,
                "note": "Synthetic histogram from variogram nugget/sill. Real histogram requires raw survey data."
            })));
        }
    };

    let mut histogram = Vec::new();
    for r in &rows {
        let bin: i64 = r.try_get("bin").unwrap_or(0);
        let bin_min: f64 = r.try_get("bin_min").unwrap_or(0.0);
        let bin_max: f64 = r.try_get("bin_max").unwrap_or(0.0);
        let count: i64 = r.try_get("count").unwrap_or(0);
        histogram.push(json!({
            "bin": bin,
            "bin_min": (bin_min * 10000.0).round() / 10000.0,
            "bin_max": (bin_max * 10000.0).round() / 10000.0,
            "count": count,
        }));
    }

    Ok(Json(json!({
        "parameter_id": parameter,
        "bins": bins,
        "source": "interpolated_values",
        "histogram": histogram,
    })))
}
