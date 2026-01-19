use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct LayerQuery {
    pub bbox: Option<String>,
}

#[derive(Serialize)]
pub struct LayerStyleItem {
    pub unit_code: String,
    pub unit_label: String,
    pub color_hex: String,
    pub sort_order: i32,
}

/// GET /api/layers/{layer_type}/styles
/// Récupère les styles (couleurs, labels) pour une couche contextuelle
/// layer_type: geologie | pedologie | risque
pub async fn get_layer_styles(
    State(state): State<AppState>,
    Path(layer_type): Path<String>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    // Valider le type de couche
    let valid_types = ["geologie", "pedologie", "risque"];
    if !valid_types.contains(&layer_type.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Invalid layer type",
                "valid_types": valid_types
            })),
        ).into_response();
    }
    
    let query = r#"
        SELECT unit_code, unit_label, color_hex, sort_order
        FROM atlas.layer_style
        WHERE layer_id = $1
        ORDER BY sort_order
    "#;
    
    match sqlx::query(query)
        .bind(&layer_type)
        .fetch_all(pool)
        .await
    {
        Ok(rows) => {
            let styles: Vec<LayerStyleItem> = rows
                .iter()
                .map(|row| LayerStyleItem {
                    unit_code: row.get("unit_code"),
                    unit_label: row.get("unit_label"),
                    color_hex: row.get("color_hex"),
                    sort_order: row.get("sort_order"),
                })
                .collect();
            
            Json(styles).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "get_layer_styles error for {}", layer_type);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "database error"})),
            ).into_response()
        }
    }
}

/// GET /api/layers/styles
/// Récupère tous les styles pour toutes les couches contextuelles
pub async fn get_all_layer_styles(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let query = r#"
        SELECT layer_id, unit_code, unit_label, color_hex, sort_order
        FROM atlas.layer_style
        ORDER BY layer_id, sort_order
    "#;
    
    match sqlx::query(query).fetch_all(pool).await {
        Ok(rows) => {
            let mut result: HashMap<String, Vec<LayerStyleItem>> = HashMap::new();
            
            for row in rows {
                let layer_id: String = row.get("layer_id");
                let item = LayerStyleItem {
                    unit_code: row.get("unit_code"),
                    unit_label: row.get("unit_label"),
                    color_hex: row.get("color_hex"),
                    sort_order: row.get("sort_order"),
                };
                
                result.entry(layer_id).or_insert_with(Vec::new).push(item);
            }
            
            Json(result).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "get_all_layer_styles error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "database error"})),
            ).into_response()
        }
    }
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
