// Module de géocodage - Gestion des suggestions ADM3
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sqlx::FromRow;
use crate::state::AppState;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, FromRow)]
pub struct GeocodeSuggestionRow {
    pub id: Uuid,
    pub sondage_id: Uuid,
    pub reason: String,
    pub status: String,
    pub payload: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeocodeSuggestion {
    pub id: Uuid,
    pub sondage_id: Uuid,
    pub reason: String,
    pub status: String,
    pub payload: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<GeocodeSuggestionRow> for GeocodeSuggestion {
    fn from(row: GeocodeSuggestionRow) -> Self {
        Self {
            id: row.id,
            sondage_id: row.sondage_id,
            reason: row.reason,
            status: row.status,
            payload: row.payload,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct SuggestionsQuery {
    pub status: Option<String>,
    pub reason: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct AcceptSuggestionPayload {
    pub adm3_id: Option<Uuid>,
    pub lon: Option<f64>,
    pub lat: Option<f64>,
    pub location_mode: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ApplyAcceptedResponse {
    pub applied_count: i64,
    pub refreshed: bool,
}

#[derive(Debug, Serialize)]
pub struct GeocodeStats {
    pub total: i64,
    pub accepted: i64,
    pub pending: i64,
    pub rejected: i64,
    pub no_suggestion: i64,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /geocode/suggestions
pub async fn list_suggestions(
    State(state): State<AppState>,
    Query(params): Query<SuggestionsQuery>,
) -> Result<Json<Vec<GeocodeSuggestion>>, (StatusCode, String)> {
    let pool = &state.pool;
    let limit = params.limit.unwrap_or(100).min(500);
    let offset = params.offset.unwrap_or(0);
    
    let rows = sqlx::query_as::<_, GeocodeSuggestionRow>(
        r#"
        SELECT id, sondage_id, reason, status, payload, created_at, updated_at
        FROM atlas.geocode_suggestions
        WHERE ($1::text IS NULL OR status = $1)
          AND ($2::text IS NULL OR reason = $2)
        ORDER BY 
          CASE status 
            WHEN 'pending' THEN 1
            WHEN 'done' THEN 2
            WHEN 'rejected' THEN 3
          END,
          created_at DESC
        LIMIT $3 OFFSET $4
        "#
    )
    .bind(&params.status)
    .bind(&params.reason)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    let suggestions: Vec<GeocodeSuggestion> = rows.into_iter().map(Into::into).collect();
    Ok(Json(suggestions))
}

/// POST /geocode/suggestions/:id/accept
pub async fn accept_suggestion(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AcceptSuggestionPayload>,
) -> Result<Json<GeocodeSuggestion>, (StatusCode, String)> {
    let pool = &state.pool;
    
    // 1. Récupérer la suggestion
    let suggestion = sqlx::query_as::<_, GeocodeSuggestionRow>(
        "SELECT id, sondage_id, reason, status, payload, created_at, updated_at 
         FROM atlas.geocode_suggestions WHERE id = $1"
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Suggestion not found".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;
    
    // 2. Mettre à jour le sondage avec les nouvelles coordonnées/ADM
    if let (Some(lon), Some(lat)) = (payload.lon, payload.lat) {
        // Géocodage par coordonnées exactes
        sqlx::query(
            r#"
            UPDATE sondages 
            SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326),
                location_mode = 'exact',
                location_accuracy = 'exact',
                is_geocoded = true
            WHERE id = $3
            "#
        )
        .bind(lon)
        .bind(lat)
        .bind(suggestion.sondage_id)
        .execute(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    } else if let Some(adm3_id) = payload.adm3_id {
        // Géocodage par ADM3
        sqlx::query(
            r#"
            UPDATE sondages s
            SET adm3_id = $1,
                adm3_name = a.name,
                location_mode = 'centroid',
                location_accuracy = 'centroid_adm3',
                is_geocoded = true,
                geom = ST_Centroid(a.geom)
            FROM adm3 a
            WHERE a.id = $1 AND s.id = $2
            "#
        )
        .bind(adm3_id)
        .bind(suggestion.sondage_id)
        .execute(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
    
    // 3. Marquer la suggestion comme 'done'
    let updated_row = sqlx::query_as::<_, GeocodeSuggestionRow>(
        r#"
        UPDATE atlas.geocode_suggestions
        SET status = 'done', updated_at = now()
        WHERE id = $1
        RETURNING id, sondage_id, reason, status, payload, created_at, updated_at
        "#
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    Ok(Json(updated_row.into()))
}

/// POST /geocode/suggestions/:id/reject
pub async fn reject_suggestion(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<GeocodeSuggestion>, (StatusCode, String)> {
    let pool = &state.pool;
    let row = sqlx::query_as::<_, GeocodeSuggestionRow>(
        r#"
        UPDATE atlas.geocode_suggestions
        SET status = 'rejected', updated_at = now()
        WHERE id = $1
        RETURNING id, sondage_id, reason, status, payload, created_at, updated_at
        "#
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Suggestion not found".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;
    
    Ok(Json(row.into()))
}

/// GET /geocode/stats
pub async fn get_stats(
    State(state): State<AppState>,
) -> Result<Json<GeocodeStats>, (StatusCode, String)> {
    let pool = &state.pool;
    
    let stats = sqlx::query_as::<_, (i64, i64, i64, i64)>(
        r#"
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'done') as done,
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'rejected') as rejected
        FROM atlas.geocode_suggestions
        "#
    )
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    // Compter les sondages sans suggestion
    let no_suggestion: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM sondages s
        WHERE s.deleted_at IS NULL
          AND s.location_mode = 'unknown'
          AND NOT EXISTS (
            SELECT 1 FROM atlas.geocode_suggestions g 
            WHERE g.sondage_id = s.id AND g.status = 'pending'
          )
        "#
    )
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    Ok(Json(GeocodeStats {
        total: stats.0,
        accepted: stats.1,
        pending: stats.2,
        rejected: stats.3,
        no_suggestion,
    }))
}

/// POST /geocode/apply-accepted - Refresh vue unifiée
pub async fn apply_accepted(
    State(state): State<AppState>,
) -> Result<Json<ApplyAcceptedResponse>, (StatusCode, String)> {
    let pool = &state.pool;
    
    // Compter les suggestions 'done'
    let done_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM atlas.geocode_suggestions WHERE status = 'done'"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    // Refresh vue matérialisée unifiée
    let refresh_result = sqlx::query(
        "SELECT atlas.refresh_sondages_unifies()"
    )
    .execute(pool)
    .await;
    
    let refreshed = refresh_result.is_ok();
    
    Ok(Json(ApplyAcceptedResponse {
        applied_count: done_count,
        refreshed,
    }))
}
