// Module pour le géocodage unifié des sondages
// Endpoint POST /sondages/:id/geocode avec audit

use crate::state::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Deserialize)]
#[serde(tag = "mode", rename_all = "lowercase")]
pub enum GeocodeRequest {
    Adm3 { adm3_id: i32 },
    Coords { lon: f64, lat: f64 },
}

#[derive(Debug, Serialize)]
pub struct GeocodeResponse {
    pub id: Uuid,
    pub code: String,
    pub location_mode: String,
    pub is_geocoded: bool,
    pub adm3_id: Option<i32>,
    pub adm3_name: Option<String>,
    pub lon: Option<f64>,
    pub lat: Option<f64>,
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /sondages/:id/geocode
/// Géocoder un sondage (mode ADM3 ou coordonnées exactes)
pub async fn geocode_sondage(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<GeocodeRequest>,
) -> Result<Json<GeocodeResponse>, (StatusCode, String)> {
    let pool = &state.pool;

    match request {
        GeocodeRequest::Adm3 { adm3_id } => {
            geocode_by_adm3(pool, id, adm3_id).await
        }
        GeocodeRequest::Coords { lon, lat } => {
            geocode_by_coords(pool, id, lon, lat).await
        }
    }
}

// ============================================================================
// Implémentations
// ============================================================================

/// Géocodage par ADM3 (centroïde)
async fn geocode_by_adm3(
    pool: &PgPool,
    sondage_id: Uuid,
    adm3_id: i32,
) -> Result<Json<GeocodeResponse>, (StatusCode, String)> {
    // Vérifier que l'ADM3 existe
    let adm3_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM adm3 WHERE gid = $1)"
    )
    .bind(adm3_id)
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !adm3_exists {
        return Err((
            StatusCode::NOT_FOUND,
            format!("ADM3 with gid {} not found", adm3_id),
        ));
    }

    // Mettre à jour le sondage avec le centroïde de l'ADM3
    let result = sqlx::query_as::<_, (Uuid, String, String, bool, Option<i32>, Option<String>)>(
        r#"
        UPDATE public.sondages s
        SET 
            geom = ST_Centroid(a.geom),
            adm3_id = $2,
            adm3_name = a.adm3_fr,
            location_mode = 'adm3',
            is_geocoded = true,
            updated_at = now(),
            meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
                'geocoded_at', now()::text,
                'geocoded_mode', 'adm3',
                'geocoded_adm3_id', $2
            )
        FROM adm3 a
        WHERE a.gid = $2 AND s.id = $1
        RETURNING s.id, s.code, s.location_mode, s.is_geocoded, s.adm3_id, s.adm3_name
        "#
    )
    .bind(sondage_id)
    .bind(adm3_id)
    .fetch_one(pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (
            StatusCode::NOT_FOUND,
            format!("Sondage {} not found", sondage_id),
        ),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;

    tracing::info!(
        "Sondage {} géocodé par ADM3 (id={})",
        sondage_id,
        adm3_id
    );

    Ok(Json(GeocodeResponse {
        id: result.0,
        code: result.1,
        location_mode: result.2,
        is_geocoded: result.3,
        adm3_id: result.4,
        adm3_name: result.5,
        lon: None,
        lat: None,
    }))
}

/// Géocodage par coordonnées exactes
async fn geocode_by_coords(
    pool: &PgPool,
    sondage_id: Uuid,
    lon: f64,
    lat: f64,
) -> Result<Json<GeocodeResponse>, (StatusCode, String)> {
    // Valider les coordonnées
    if lon < -180.0 || lon > 180.0 {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("Invalid longitude: {}", lon),
        ));
    }
    if lat < -90.0 || lat > 90.0 {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("Invalid latitude: {}", lat),
        ));
    }

    // Mettre à jour le sondage avec les coordonnées exactes
    let result = sqlx::query_as::<_, (Uuid, String, String, bool)>(
        r#"
        UPDATE public.sondages
        SET 
            geom = ST_SetSRID(ST_MakePoint($2, $3), 4326),
            location_mode = 'exact',
            is_geocoded = true,
            updated_at = now(),
            meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
                'geocoded_at', now()::text,
                'geocoded_mode', 'exact',
                'geocoded_lon', $2,
                'geocoded_lat', $3
            )
        WHERE id = $1
        RETURNING id, code, location_mode, is_geocoded
        "#
    )
    .bind(sondage_id)
    .bind(lon)
    .bind(lat)
    .fetch_one(pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (
            StatusCode::NOT_FOUND,
            format!("Sondage {} not found", sondage_id),
        ),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;

    tracing::info!(
        "Sondage {} géocodé par coordonnées ({}, {})",
        sondage_id,
        lon,
        lat
    );

    Ok(Json(GeocodeResponse {
        id: result.0,
        code: result.1,
        location_mode: result.2,
        is_geocoded: result.3,
        adm3_id: None,
        adm3_name: None,
        lon: Some(lon),
        lat: Some(lat),
    }))
}
