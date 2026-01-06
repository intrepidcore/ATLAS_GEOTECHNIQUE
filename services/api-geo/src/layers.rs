use crate::state::AppState;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;
use sqlx::Row;
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct LayerQuery {
    pub bbox: Option<String>,
}

/// GET /api/layers/geologie?bbox=xmin,ymin,xmax,ymax
pub async fn get_geologie(
    State(state): State<AppState>,
    Query(params): Query<LayerQuery>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let bbox_filter = if let Some(bbox_str) = params.bbox {
        let coords: Vec<f64> = bbox_str
            .split(',')
            .filter_map(|s| s.trim().parse().ok())
            .collect();
        
        if coords.len() == 4 {
            format!(
                "WHERE ST_Intersects(geom, ST_Transform(ST_MakeEnvelope({},{},{},{},4326),25231))",
                coords[0], coords[1], coords[2], coords[3]
            )
        } else {
            String::new()
        }
    } else {
        String::new()
    };
    
    let query = format!(
        r#"
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(jsonb_agg(
                jsonb_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326))::jsonb,
                    'properties', jsonb_build_object(
                        'id', id,
                        'code', code,
                        'libelle', libelle,
                        'description', description
                    )
                )
            ), '[]'::jsonb)
        ) AS geojson
        FROM (
            SELECT 
                ogc_fid as id,
                code,
                libelle,
                description,
                geom
            FROM atlas.unites_geologiques
            {}
            LIMIT 1000
        ) t
        "#,
        bbox_filter
    );
    
    match sqlx::query(&query).fetch_one(pool).await {
        Ok(row) => {
            let geojson: serde_json::Value = row.try_get("geojson").unwrap_or(serde_json::json!({
                "type": "FeatureCollection",
                "features": []
            }));
            Json(geojson).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "get_geologie error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "database error"})),
            )
                .into_response()
        }
    }
}

/// GET /api/layers/pedologie?bbox=xmin,ymin,xmax,ymax
pub async fn get_pedologie(
    State(state): State<AppState>,
    Query(params): Query<LayerQuery>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let bbox_filter = if let Some(bbox_str) = params.bbox {
        let coords: Vec<f64> = bbox_str
            .split(',')
            .filter_map(|s| s.trim().parse().ok())
            .collect();
        
        if coords.len() == 4 {
            format!(
                "WHERE ST_Intersects(geom, ST_Transform(ST_MakeEnvelope({},{},{},{},4326),25231))",
                coords[0], coords[1], coords[2], coords[3]
            )
        } else {
            String::new()
        }
    } else {
        String::new()
    };
    
    let query = format!(
        r#"
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(jsonb_agg(
                jsonb_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326))::jsonb,
                    'properties', jsonb_build_object(
                        'id', id,
                        'code', code,
                        'libelle', libelle,
                        'description', description
                    )
                )
            ), '[]'::jsonb)
        ) AS geojson
        FROM (
            SELECT 
                ogc_fid as id,
                code,
                libelle,
                description,
                geom
            FROM atlas.unites_pedologiques
            {}
            LIMIT 1000
        ) t
        "#,
        bbox_filter
    );
    
    match sqlx::query(&query).fetch_one(pool).await {
        Ok(row) => {
            let geojson: serde_json::Value = row.try_get("geojson").unwrap_or(serde_json::json!({
                "type": "FeatureCollection",
                "features": []
            }));
            Json(geojson).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "get_pedologie error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "database error"})),
            )
                .into_response()
        }
    }
}

/// GET /api/layers/risque-gonflement?bbox=xmin,ymin,xmax,ymax
pub async fn get_risque_gonflement(
    State(state): State<AppState>,
    Query(params): Query<LayerQuery>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let bbox_filter = if let Some(bbox_str) = params.bbox {
        let coords: Vec<f64> = bbox_str
            .split(',')
            .filter_map(|s| s.trim().parse().ok())
            .collect();
        
        if coords.len() == 4 {
            format!(
                "WHERE ST_Intersects(geom, ST_Transform(ST_MakeEnvelope({},{},{},{},4326),25231))",
                coords[0], coords[1], coords[2], coords[3]
            )
        } else {
            String::new()
        }
    } else {
        String::new()
    };
    
    let query = format!(
        r#"
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(jsonb_agg(
                jsonb_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326))::jsonb,
                    'properties', jsonb_build_object(
                        'id', id,
                        'code', code,
                        'libelle', libelle,
                        'niveau_risque', niveau_risque,
                        'description', description
                    )
                )
            ), '[]'::jsonb)
        ) AS geojson
        FROM (
            SELECT 
                ogc_fid as id,
                code,
                libelle,
                niveau_risque,
                description,
                geom
            FROM atlas.risque_gonflement
            {}
            LIMIT 1000
        ) t
        "#,
        bbox_filter
    );
    
    match sqlx::query(&query).fetch_one(pool).await {
        Ok(row) => {
            let geojson: serde_json::Value = row.try_get("geojson").unwrap_or(serde_json::json!({
                "type": "FeatureCollection",
                "features": []
            }));
            Json(geojson).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "get_risque_gonflement error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "database error"})),
            )
                .into_response()
        }
    }
}
