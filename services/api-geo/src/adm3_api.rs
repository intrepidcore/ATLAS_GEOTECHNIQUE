use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use sqlx::Row;

use crate::state::AppState;

pub async fn get_adm3_geojson(State(state): State<AppState>) -> impl IntoResponse {
    let pool = &state.pool;

    // Prefer atlas.adm3_tg (already in EPSG:4326)
    let rows = sqlx::query(
        r#"
        SELECT id, name, adm2_name, code, ST_AsGeoJSON(geom) AS g
        FROM atlas.adm3_tg
        ORDER BY id
        "#,
    )
    .fetch_all(pool)
    .await;

    let (source, rows) = match rows {
        Ok(r) if !r.is_empty() => ("atlas.adm3_tg", r),
        _ => {
            // Fallback atlas.adm3
            let rows2 = sqlx::query(
                r#"
                SELECT gid, adm3_fr, adm2_fr, adm3_pcode, ST_AsGeoJSON(geom) AS g
                FROM atlas.adm3
                ORDER BY gid
                "#,
            )
            .fetch_all(pool)
            .await;

            match rows2 {
                Ok(r) if !r.is_empty() => ("atlas.adm3", r),
                Ok(_) => {
                    return (
                        StatusCode::NOT_FOUND,
                        Json(serde_json::json!({"error":"adm3 not found"})),
                    )
                        .into_response();
                }
                Err(e) => {
                    tracing::error!(?e, "adm3 geojson query failed");
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({"error":"db error"})),
                    )
                        .into_response();
                }
            }
        }
    };

    let mut features = Vec::with_capacity(rows.len());
    for r in rows {
        let (id, name, adm2_name, code, g): (String, Option<String>, Option<String>, Option<String>, Option<String>) =
            if source == "atlas.adm3_tg" {
                (
                    r.get::<i32, _>("id").to_string(),
                    r.try_get::<String, _>("name").ok(),
                    r.try_get::<String, _>("adm2_name").ok(),
                    r.try_get::<String, _>("code").ok(),
                    r.try_get::<String, _>("g").ok(),
                )
            } else {
                (
                    r.get::<i32, _>("gid").to_string(),
                    r.try_get::<String, _>("adm3_fr").ok(),
                    r.try_get::<String, _>("adm2_fr").ok(),
                    r.try_get::<String, _>("adm3_pcode").ok(),
                    r.try_get::<String, _>("g").ok(),
                )
            };

        let Some(g) = g else { continue; };
        let Ok(geom) = serde_json::from_str::<serde_json::Value>(&g) else { continue; };

        let mut props = serde_json::json!({
            "id": id,
            "name": name,
            "code": code,
            "adm2_name": adm2_name,
            "source": source,
        });

        // Also expose legacy keys used in some tooltips
        if let Some(n) = name.clone() {
            props["adm3_fr"] = serde_json::Value::String(n);
        }

        features.push(serde_json::json!({
            "type":"Feature",
            "geometry": geom,
            "properties": props
        }));
    }

    Json(serde_json::json!({
        "type":"FeatureCollection",
        "features": features
    }))
    .into_response()
}
