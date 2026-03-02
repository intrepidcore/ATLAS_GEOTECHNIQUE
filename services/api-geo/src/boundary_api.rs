use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use sqlx::Row;

use crate::state::AppState;

pub async fn get_adm0_geojson(State(state): State<AppState>) -> impl IntoResponse {
    let pool = &state.pool;

    // Prefer atlas.boundary_togo
    let row = sqlx::query(
        r#"
        SELECT ST_AsGeoJSON(ST_Transform(geom, 4326)) AS g
        FROM atlas.boundary_togo
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1
        "#,
    )
    .fetch_optional(pool)
    .await;

    let g_opt: Option<String> = match row {
        Ok(Some(r)) => r.try_get("g").ok(),
        Ok(None) => None,
        Err(_) => None,
    };

    let g2_opt = if g_opt.is_some() {
        g_opt
    } else {
        let row2 = sqlx::query(
            r#"
            SELECT ST_AsGeoJSON(ST_Transform(geom, 4326)) AS g
            FROM public.adm0_raw
            LIMIT 1
            "#,
        )
        .fetch_optional(pool)
        .await;

        match row2 {
            Ok(Some(r)) => r.try_get("g").ok(),
            _ => None,
        }
    };

    let g = match g2_opt {
        Some(v) => v,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error":"adm0 boundary not found"})),
            )
                .into_response();
        }
    };

    let geom: serde_json::Value = match serde_json::from_str(&g) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"invalid geojson"})),
            )
                .into_response();
        }
    };

    let fc = serde_json::json!({
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": geom,
                "properties": {"name": "Togo"}
            }
        ]
    });

    (StatusCode::OK, Json(fc)).into_response()
}
