// Module pour le géocodage manuel (Géocodage Amélioré)
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sqlx::FromRow;
use crate::state::AppState;

#[derive(Debug, FromRow, Serialize)]
pub struct SondageWithoutGeometry {
    pub id: Uuid,
    pub code: String,
    pub localite: Option<String>,
    pub adm3_id: Option<Uuid>,
    pub adm3_name: Option<String>,
    pub location_mode: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ManualGeocodeQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateGeometryPayload {
    pub lon: Option<f64>,
    pub lat: Option<f64>,
    pub adm3_id: Option<Uuid>,
    pub location_mode: String, // 'exact' ou 'adm'
}

/// GET /geocode/manual - Liste des sondages sans géométrie
pub async fn list_without_geometry(
    State(state): State<AppState>,
    Query(params): Query<ManualGeocodeQuery>,
) -> Result<Json<Vec<SondageWithoutGeometry>>, (StatusCode, String)> {
    let pool = &state.pool;
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);
    
    let rows = sqlx::query_as::<_, SondageWithoutGeometry>(
        r#"
        SELECT 
            id, code, 
            COALESCE(adm3_name, '') as localite,
            adm3_id, adm3_name, 
            location_mode::text as location_mode, 
            created_at
        FROM sondages
        WHERE (geom IS NULL AND adm3_id IS NULL)
          AND ($1::text IS NULL OR code ILIKE '%' || $1 || '%' OR adm3_name ILIKE '%' || $1 || '%')
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#
    )
    .bind(&params.search)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    Ok(Json(rows))
}

/// POST /geocode/manual/:id - Mettre à jour la géométrie d'un sondage
pub async fn update_geometry(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateGeometryPayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    let pool = &state.pool;
    
    if payload.location_mode == "exact" {
        // Mode exact: lon/lat requis
        let lon = payload.lon.ok_or((StatusCode::BAD_REQUEST, "lon required".to_string()))?;
        let lat = payload.lat.ok_or((StatusCode::BAD_REQUEST, "lat required".to_string()))?;
        
        sqlx::query(
            r#"
            UPDATE sondages
            SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326),
                location_mode = 'exact',
                is_geocoded = true,
                updated_at = NOW()
            WHERE id = $3
            "#
        )
        .bind(lon)
        .bind(lat)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        
    } else if payload.location_mode == "adm" {
        // Mode ADM: adm3_id requis
        let adm3_id = payload.adm3_id.ok_or((StatusCode::BAD_REQUEST, "adm3_id required".to_string()))?;
        
        sqlx::query(
            r#"
            UPDATE sondages s
            SET adm3_id = $1,
                location_mode = 'adm',
                is_geocoded = true,
                updated_at = NOW()
            WHERE s.id = $2
            "#
        )
        .bind(adm3_id)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    } else {
        return Err((StatusCode::BAD_REQUEST, "Invalid location_mode".to_string()));
    }
    
    Ok(StatusCode::OK)
}

/// GET /geocode/manual/stats - Statistiques du géocodage manuel
#[derive(Debug, Serialize)]
pub struct ManualGeocodeStats {
    pub total_without_geom: i64,
    pub total_geocoded: i64,
    pub percent_done: f64,
}

pub async fn get_manual_stats(
    State(state): State<AppState>,
) -> Result<Json<ManualGeocodeStats>, (StatusCode, String)> {
    let pool = &state.pool;
    
    let (without_geom, geocoded): (i64, i64) = sqlx::query_as(
        r#"
        SELECT 
            COUNT(*) FILTER (WHERE geom IS NULL AND adm3_id IS NULL) as without_geom,
            COUNT(*) FILTER (WHERE geom IS NOT NULL OR adm3_id IS NOT NULL) as geocoded
        FROM sondages
        "#
    )
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    let total = without_geom + geocoded;
    let percent = if total > 0 {
        (geocoded as f64 / total as f64) * 100.0
    } else {
        0.0
    };
    
    Ok(Json(ManualGeocodeStats {
        total_without_geom: without_geom,
        total_geocoded: geocoded,
        percent_done: percent,
    }))
}
