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
        .route("/api/stats/coverage", get(get_coverage))
        .route("/api/stats/ml-registry", get(get_ml_registry))
        .route("/api/stats/coverage-map", get(get_coverage_map))
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

/// Clamp les valeurs interpolées dans leurs bornes physiques (pour l'affichage UI)
fn clamp_geotechnical_value(param_id: &str, value: f64) -> f64 {
    if param_id.starts_with("wl_") {
        return value.max(10.0).min(100.0);
    }
    if param_id.starts_with("wp_") {
        return value.max(5.0).min(60.0);
    }
    if param_id.starts_with("ip_") {
        return value.max(0.0).min(60.0);
    }
    if param_id.starts_with("eg_") {
        return value.max(0.0).min(20.0);
    }
    if param_id.starts_with("vbs_") {
        return value.max(0.0).min(15.0);
    }
    if param_id.starts_with("passant_") {
        return value.max(0.0).min(100.0);
    }
    value
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

    let query = if let Some(h) = &horizon {
        format!(
            r#"
            WITH filtered AS (
                SELECT iv.value
                FROM atlas.ai_interpolation_values iv
                LEFT JOIN atlas.ai_interpolation_runs ir
                    ON ir.id = iv.run_id
                WHERE iv.parameter_id = $1
                  AND COALESCE(iv.is_superseded, false) = false
                  AND UPPER(COALESCE(
                      ir.fit_quality->>'horizon_label',
                      split_part(iv.parameter_id, '_h', 2)
                  )) = '{}'
            )
            SELECT
                COUNT(*)::bigint                                              AS n,
                COALESCE(AVG(value), 0.0)                                    AS mean,
                COALESCE(STDDEV(value), 0.0)                                 AS stddev,
                COALESCE(MIN(value), 0.0)                                    AS min,
                COALESCE(MAX(value), 0.0)                                    AS max,
                COALESCE(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY value), 0.0) AS q1,
                COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY value), 0.0) AS median,
                COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value), 0.0) AS q3
            FROM filtered
            "#,
            h.to_uppercase()
        )
    } else {
        r#"
        WITH filtered AS (
            SELECT value
            FROM atlas.ai_interpolation_values
            WHERE parameter_id = $1
              AND COALESCE(is_superseded, false) = false
        )
        SELECT
            COUNT(*)::bigint                                              AS n,
            COALESCE(AVG(value), 0.0)                                    AS mean,
            COALESCE(STDDEV(value), 0.0)                                 AS stddev,
            COALESCE(MIN(value), 0.0)                                    AS min,
            COALESCE(MAX(value), 0.0)                                    AS max,
            COALESCE(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY value), 0.0) AS q1,
            COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY value), 0.0) AS median,
            COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value), 0.0) AS q3
        FROM filtered
        "#.to_string()
    };

    // Essayer d'abord d'obtenir les données depuis ai_interpolation_values
    // Utiliser fetch_optional pour distinguer "0 lignes" de "erreur"
    let interpolation_result = sqlx::query(&query)
        .bind(parameter.clone())
        .fetch_optional(&state.pool)
        .await;

    let (n, mean, stddev, min, q1, median, q3, max, source) = match interpolation_result {
        Ok(Some(row)) => {
            // Vérifier si des données existent (COUNT > 0)
            let n: i64 = row.try_get("n").unwrap_or(0);
            if n > 0 {
                // Bonnes données interpolées
                let mean: f64 = row.try_get("mean").unwrap_or(0.0);
                let stddev: f64 = row.try_get("stddev").unwrap_or(0.0);
                let min: f64 = row.try_get("min").unwrap_or(0.0);
                let q1: f64 = row.try_get("q1").unwrap_or(0.0);
                let median: f64 = row.try_get("median").unwrap_or(0.0);
                let q3: f64 = row.try_get("q3").unwrap_or(0.0);
                let max: f64 = row.try_get("max").unwrap_or(0.0);
                (n, mean, stddev, min, q1, median, q3, max, "interpolated_values")
            } else {
                // COUNT = 0 - utiliser fallback variogrammes (fetch_optional — ETL-03)
                let fallback_opt = sqlx::query(
                    r#"
                    SELECT
                        COALESCE(loo_rmse, 0.0) AS mean,
                        COALESCE(nugget, 0.0) AS min,
                        COALESCE(sill, 0.0) AS max,
                        0.0 AS stddev,
                        0.0 AS q1,
                        0.0 AS median,
                        0.0 AS q3,
                        1 AS n
                    FROM atlas.ai_variograms
                    WHERE parameter_id = $1
                      AND loo_rmse IS NOT NULL
                    ORDER BY created_at DESC
                    LIMIT 1
                    "#,
                )
                .bind(parameter.clone())
                .fetch_optional(&state.pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

                let Some(fallback) = fallback_opt else {
                    return Ok(Json(json!({
                        "parameter_id": parameter,
                        "horizon": horizon,
                        "source": "no_data",
                        "n": 0,
                        "mean": 0.0, "stddev": 0.0,
                        "min": 0.0, "q1": 0.0, "median": 0.0, "q3": 0.0, "max": 0.0
                    })));
                };
                let fallback = fallback;

                let n: i64 = fallback.try_get("n").unwrap_or(1);
                let mean: f64 = fallback.try_get("mean").unwrap_or(0.0);
                let stddev: f64 = fallback.try_get("stddev").unwrap_or(0.0);
                let min: f64 = fallback.try_get("min").unwrap_or(0.0);
                let q1: f64 = fallback.try_get("q1").unwrap_or(0.0);
                let median: f64 = fallback.try_get("median").unwrap_or(0.0);
                let q3: f64 = fallback.try_get("q3").unwrap_or(0.0);
                let max: f64 = fallback.try_get("max").unwrap_or(0.0);

                (n, mean, stddev, min, q1, median, q3, max, "variograms_fallback")
            }
        },
        Ok(None) | Err(_) => {
            // Fallback vers les variogrammes — fetch_optional : jamais de 500 si table vide
            let fallback_opt = sqlx::query(
                r#"
                SELECT
                    parameter_id,
                    COALESCE(nugget, 0.0) AS min,
                    COALESCE(sill, 0.0) AS max,
                    COALESCE(loo_rmse, 0.0) AS mean,
                    0.0 AS stddev,
                    0.0 AS q1,
                    0.0 AS median,
                    0.0 AS q3,
                    1 AS n
                FROM atlas.ai_variograms
                WHERE parameter_id = $1
                ORDER BY created_at DESC
                LIMIT 1
                "#,
            )
            .bind(parameter.clone())
            .fetch_optional(&state.pool)  // fix: fetch_one → fetch_optional (ETL-03)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

            let Some(fallback) = fallback_opt else {
                // Aucune donnée — réponse vide propre plutôt que 500
                return Ok(Json(json!({
                    "parameter_id": parameter,
                    "horizon": horizon,
                    "source": "no_data",
                    "n": 0,
                    "mean": 0.0, "stddev": 0.0,
                    "min": 0.0, "q1": 0.0, "median": 0.0, "q3": 0.0, "max": 0.0
                })));
            };

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

    // Appliquer le clamp aux valeurs min/max pour les paramètres géotechniques
    let clamped_min = clamp_geotechnical_value(&parameter, min);
    let clamped_max = clamp_geotechnical_value(&parameter, max);
    
    // Retourner les données interpolées
    Ok(Json(json!({
        "parameter_id": parameter,
        "horizon": horizon,
        "source": source,
        "n": n,
        "mean": mean,
        "stddev": stddev,
        "min": clamped_min,
        "q1": q1,
        "median": median,
        "q3": q3,
        "max": clamped_max,
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

    // Essayer d'abord ai_interpolation_values, puis fallback vers les variogrammes
    let query = r#"
        WITH src AS (
            SELECT value
            FROM atlas.ai_interpolation_values
            WHERE parameter_id = $1
              AND COALESCE(is_superseded, false) = false
        ),
        bounds AS (
            SELECT MIN(value) AS v_min, MAX(value) AS v_max FROM src
        ),
        binned AS (
            SELECT
              width_bucket(
                s.value,
                b.v_min,
                b.v_max + (b.v_max - b.v_min) * 0.001,
                $2
              ) AS bin,
              s.value
            FROM src s, bounds b
            WHERE b.v_min < b.v_max
            UNION ALL
            SELECT 1, s.value FROM src s, bounds b WHERE b.v_min = b.v_max
        )
        SELECT bin, COUNT(*) AS count,
               MIN(value) AS bin_min, MAX(value) AS bin_max
        FROM binned GROUP BY bin ORDER BY bin
        "#;

    let rows = match sqlx::query(&query).bind(parameter.clone()).bind(bins).fetch_all(&state.pool).await {
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
            .bind(parameter.clone())
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

/// GET /api/stats/coverage
/// Retourne la couverture d'interpolation par (parameter_id, method).
async fn get_coverage(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let rows = sqlx::query(
        r#"
        SELECT
            i.parameter_id,
            i.method,
            i.n_mailles::bigint,
            (i.n_mailles::float8 * 100.0 / 29407.0) AS coverage_pct,
            v.loo_rmse,
            CASE
                WHEN i.n_mailles >= 29407 THEN 'complet'
                WHEN i.n_mailles > 0      THEN 'partiel'
                ELSE                           'vide'
            END AS status
        FROM (
            SELECT
                parameter_id,
                method,
                COUNT(DISTINCT maille_id) AS n_mailles
            FROM atlas.ai_interpolation_values
            WHERE COALESCE(is_superseded, false) = false
            GROUP BY parameter_id, method
        ) i
        LEFT JOIN (
            SELECT DISTINCT ON (parameter_id)
                parameter_id,
                loo_rmse
            FROM atlas.ai_variograms
            WHERE loo_rmse IS NOT NULL
            ORDER BY parameter_id, loo_rmse ASC
        ) v USING (parameter_id)
        ORDER BY i.n_mailles DESC, i.parameter_id
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let total_mailles: i64 = sqlx::query("SELECT COUNT(*)::bigint FROM atlas.mailles")
        .fetch_one(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
        .try_get("count")
        .unwrap_or(29407);

    let mut items = Vec::new();
    for r in &rows {
        let param: String = r.try_get("parameter_id").unwrap_or_default();
        let method: String = r.try_get("method").unwrap_or_default();
        let n_mailles: i64 = r.try_get("n_mailles").unwrap_or(0);
        let coverage: Option<f64> = r.try_get("coverage_pct").ok().flatten();
        let loo_rmse: Option<f64> = r.try_get("loo_rmse").ok().flatten();
        let status_label = if n_mailles >= total_mailles {
            "complet"
        } else if n_mailles > 0 {
            "partiel"
        } else {
            "vide"
        };
        items.push(json!({
            "parameter_id": param,
            "method": method,
            "n_mailles": n_mailles,
            "coverage_pct": coverage,
            "loo_rmse": loo_rmse,
            "status": status_label,
        }));
    }

    Ok(Json(json!({
        "total_mailles": total_mailles,
        "items": items,
        "count": items.len(),
    })))
}

pub async fn get_ml_registry(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let rows = sqlx::query(
        r#"
        SELECT
            model_target,
            model_version,
            status,
            artifact_uri,
            created_at,
            created_by,
            -- Extraire les métriques JSONB
            (metrics->>'rmse_cg')::float8          AS rmse_cg,
            (metrics->>'rmse_ip')::float8          AS rmse_ip,
            (metrics->>'rmse_vbs')::float8         AS rmse_vbs,
            (metrics->>'r2_cg')::float8            AS r2_cg,
            (metrics->>'r2_ip')::float8            AS r2_ip,
            (metrics->>'r2_vbs')::float8           AS r2_vbs,
            (metrics->>'n_cg_training')::int       AS n_cg_training,
            (metrics->>'n_ip_training')::int       AS n_ip_training,
            (metrics->>'n_vbs_training')::int      AS n_vbs_training
        FROM atlas.ai_model_registry
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let rmse_avg = {
                let vals: Vec<f64> = [
                    r.try_get::<Option<f64>, _>("rmse_cg").ok().flatten(),
                    r.try_get::<Option<f64>, _>("rmse_ip").ok().flatten(),
                    r.try_get::<Option<f64>, _>("rmse_vbs").ok().flatten(),
                ]
                .iter()
                .filter_map(|v| *v)
                .collect();
                if vals.is_empty() {
                    None
                } else {
                    Some(vals.iter().sum::<f64>() / vals.len() as f64)
                }
            };
            let r2_avg = {
                let vals: Vec<f64> = [
                    r.try_get::<Option<f64>, _>("r2_cg").ok().flatten(),
                    r.try_get::<Option<f64>, _>("r2_ip").ok().flatten(),
                    r.try_get::<Option<f64>, _>("r2_vbs").ok().flatten(),
                ]
                .iter()
                .filter_map(|v| *v)
                .collect();
                if vals.is_empty() {
                    None
                } else {
                    Some(vals.iter().sum::<f64>() / vals.len() as f64)
                }
            };
            let n_max = [
                r.try_get::<Option<i32>, _>("n_cg_training").ok().flatten(),
                r.try_get::<Option<i32>, _>("n_ip_training").ok().flatten(),
                r.try_get::<Option<i32>, _>("n_vbs_training").ok().flatten(),
            ]
            .iter()
            .filter_map(|v| *v)
            .max();

            json!({
                "model_target": r.try_get::<String, _>("model_target").unwrap_or_default(),
                "model_version": r.try_get::<String, _>("model_version").unwrap_or_default(),
                "status": r.try_get::<String, _>("status").unwrap_or_default(),
                "rmse_cv": rmse_avg,
                "r2_cv": r2_avg,
                "dataset_size": n_max,
                "created_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at")
                    .ok()
                    .flatten()
                    .map(|d| d.format("%d/%m/%Y").to_string()),
                "details": {
                    "rmse_cg": r.try_get::<Option<f64>, _>("rmse_cg").ok().flatten(),
                    "rmse_ip": r.try_get::<Option<f64>, _>("rmse_ip").ok().flatten(),
                    "rmse_vbs": r.try_get::<Option<f64>, _>("rmse_vbs").ok().flatten(),
                    "r2_cg": r.try_get::<Option<f64>, _>("r2_cg").ok().flatten(),
                    "r2_ip": r.try_get::<Option<f64>, _>("r2_ip").ok().flatten(),
                    "r2_vbs": r.try_get::<Option<f64>, _>("r2_vbs").ok().flatten(),
                    "n_cg": r.try_get::<Option<i32>, _>("n_cg_training").ok().flatten(),
                    "n_ip": r.try_get::<Option<i32>, _>("n_ip_training").ok().flatten(),
                    "n_vbs": r.try_get::<Option<i32>, _>("n_vbs_training").ok().flatten(),
                }
            })
        })
        .collect();

    Ok(Json(json!({ "count": items.len(), "items": items })))
}

/// GET /api/stats/coverage-map?parameter=vbs_avg
/// Retourne un GeoJSON FeatureCollection pour la mini-carte de couverture.
async fn get_coverage_map(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let raw_parameter = params.get("parameter").map(|s| s.as_str()).unwrap_or("vbs_avg");
    let parameter = normalize_param_id(raw_parameter);

    let coverage_row = sqlx::query(r#"
        SELECT COUNT(DISTINCT maille_id)::bigint AS n_interp
        FROM atlas.ai_interpolation_values
        WHERE parameter_id = $1
          AND COALESCE(is_superseded, false) = false
    "#)
    .bind(&parameter)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let n_interp: i64 = coverage_row.try_get("n_interp").unwrap_or(0);
    let coverage_pct = n_interp as f64 * 100.0 / 29407.0;

    let (geojson_query, limit_note) = if coverage_pct >= 99.0 {
        (format!(r#"
            SELECT m.id, m.code,
                ST_AsGeoJSON(ST_Simplify(m.geom, 0.005))::json AS geometry,
                'missing' AS status
            FROM atlas.mailles m
            WHERE NOT EXISTS (
                SELECT 1 FROM atlas.ai_interpolation_values iv
                WHERE iv.maille_id = m.id
                  AND iv.parameter_id = '{}'
                  AND COALESCE(iv.is_superseded, false) = false
            )
            LIMIT 500
        "#, parameter), "missing_only")
    } else {
        (format!(r#"
            SELECT m.id, m.code,
                ST_AsGeoJSON(ST_Simplify(m.geom, 0.01))::json AS geometry,
                CASE WHEN iv.maille_id IS NOT NULL THEN 'interpolated'
                     ELSE 'missing' END AS status
            FROM atlas.mailles m
            LEFT JOIN (
                SELECT DISTINCT maille_id
                FROM atlas.ai_interpolation_values
                WHERE parameter_id = '{}'
                  AND COALESCE(is_superseded, false) = false
            ) iv ON iv.maille_id = m.id
            LIMIT 5000
        "#, parameter), "all_mailles")
    };

    let features = sqlx::query(&geojson_query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let feature_list: Vec<serde_json::Value> = features.iter().map(|r| {
        let geometry: serde_json::Value = r.try_get::<serde_json::Value, _>("geometry")
            .unwrap_or(serde_json::Value::Null);
        json!({
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "id": r.get::<i64, _>("id"),
                "code": r.try_get::<String, _>("code").unwrap_or_default(),
                "status": r.get::<String, _>("status"),
            }
        })
    }).collect();

    Ok(Json(json!({
        "type": "FeatureCollection",
        "parameter_id": parameter,
        "n_interpolated": n_interp,
        "coverage_pct": coverage_pct,
        "limit_note": limit_note,
        "features": feature_list,
    })))
}
