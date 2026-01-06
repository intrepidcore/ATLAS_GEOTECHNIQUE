use crate::state::AppState;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;
use sqlx::Row;
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct DsmQuery {
    pub bbox: Option<String>,
    pub grid: Option<String>,
}

/// GET /coverage/mailles-dsm?grid=2km|28km&bbox=west,south,east,north
/// Retourne les mailles avec statistiques d'altitude DSM COP30
pub async fn get_coverage_mailles_dsm(
    Query(params): Query<DsmQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    let grid_type = params.grid.as_deref().unwrap_or("2km");

    // Construire le filtre bbox si fourni
    let bbox_filter = if let Some(bbox_str) = params.bbox {
        let coords: Vec<f64> = bbox_str
            .split(',')
            .filter_map(|s| s.trim().parse().ok())
            .collect();
        
        if coords.len() == 4 {
            format!(
                "AND m.geom && ST_Transform(ST_MakeEnvelope({},{},{},{},4326),25231)",
                coords[0], coords[1], coords[2], coords[3]
            )
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    let query = if grid_type == "28km" {
        // Grille 28km avec DSM
        format!(
            r#"
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(ST_Transform(m.geom, 4326))::jsonb,
                        'properties', jsonb_build_object(
                            'code_m28', m.code_m28,
                            'profil_num', m.profil_num,
                            'altitude_mean', d.altitude_mean,
                            'altitude_min', d.altitude_min,
                            'altitude_max', d.altitude_max,
                            'altitude_range', d.altitude_range,
                            'altitude_stddev', d.altitude_stddev
                        )
                    )
                ), '[]'::jsonb)
            ) AS geojson
            FROM atlas.maille_28km m
            LEFT JOIN atlas.v_maille_dsm_28km_flat d ON d.id_m28 = m.id_m28
            WHERE 1=1 {}
            "#,
            bbox_filter
        )
    } else {
        // Grille 2km avec DSM
        format!(
            r#"
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(ST_Transform(m.geom, 4326))::jsonb,
                        'properties', jsonb_build_object(
                            'code', m.code,
                            'altitude_mean', d.altitude_mean,
                            'altitude_min', d.altitude_min,
                            'altitude_max', d.altitude_max,
                            'altitude_range', d.altitude_range,
                            'altitude_stddev', d.altitude_stddev
                        )
                    )
                ), '[]'::jsonb)
            ) AS geojson
            FROM atlas.mailles m
            LEFT JOIN atlas.v_maille_dsm_2km_flat d ON d.id = m.id
            WHERE 1=1 {}
            LIMIT 5000
            "#,
            bbox_filter
        )
    };

    match sqlx::query(&query).fetch_one(pool).await {
        Ok(row) => {
            let geojson: serde_json::Value = row.try_get("geojson").unwrap_or(serde_json::json!({
                "type": "FeatureCollection",
                "features": []
            }));
            Json(geojson).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "get_coverage_mailles_dsm error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "database error"})),
            )
                .into_response()
        }
    }
}
