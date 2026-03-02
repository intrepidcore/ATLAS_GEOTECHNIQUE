// Module de géocodage - Gestion des suggestions ADM3
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sqlx::FromRow;
use sqlx::Row;
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

    // Current desktop DB does not ship atlas.geocode_suggestions. We expose
    // a compatible list from atlas.sondages_non_geocodes.
    let rows = sqlx::query(
        r#"
        SELECT
            id,
            code,
            localite,
            metadata,
            created_at,
            updated_at
        FROM atlas.sondages_non_geocodes
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let suggestions: Vec<GeocodeSuggestion> = rows
        .into_iter()
        .map(|r| {
            let id: Uuid = r.get("id");
            let code: String = r.try_get("code").unwrap_or_default();
            let localite: Option<String> = r.try_get("localite").ok();
            let metadata: serde_json::Value = r.try_get("metadata").unwrap_or_else(|_| serde_json::json!({}));
            let created_at: chrono::DateTime<chrono::Utc> = r.get("created_at");
            let updated_at: chrono::DateTime<chrono::Utc> = r.get("updated_at");

            GeocodeSuggestion {
                id,
                sondage_id: id,
                reason: params.reason.clone().unwrap_or_else(|| "non_geocode".to_string()),
                status: params.status.clone().unwrap_or_else(|| "pending".to_string()),
                payload: serde_json::json!({
                    "code": code,
                    "localite": localite,
                    "metadata": metadata
                }),
                created_at,
                updated_at,
            }
        })
        .collect();

    Ok(Json(suggestions))
}

/// POST /geocode/suggestions/:id/accept
pub async fn accept_suggestion(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AcceptSuggestionPayload>,
) -> Result<Json<GeocodeSuggestion>, (StatusCode, String)> {
    let _pool = &state.pool;

    // Not supported in this DB snapshot (no atlas.geocode_suggestions backing table).
    let _ = (id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "geocode suggestions accept not available".to_string()))
}

/// POST /geocode/suggestions/:id/reject
pub async fn reject_suggestion(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<GeocodeSuggestion>, (StatusCode, String)> {
    let _ = (&state, id);
    Err((StatusCode::NOT_IMPLEMENTED, "geocode suggestions reject not available".to_string()))
}

/// POST /geocode/apply-accepted - Refresh vue unifiée
pub async fn apply_accepted(
    State(state): State<AppState>,
) -> Result<Json<ApplyAcceptedResponse>, (StatusCode, String)> {
    let _ = state;
    Ok(Json(ApplyAcceptedResponse {
        applied_count: 0,
        refreshed: false,
    }))
}

/// GET /geocode/stats
pub async fn get_stats(
    State(state): State<AppState>,
) -> Result<Json<GeocodeStats>, (StatusCode, String)> {
    let pool = &state.pool;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.sondages_non_geocodes")
        .fetch_one(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(GeocodeStats {
        total,
        accepted: 0,
        pending: total,
        rejected: 0,
        no_suggestion: 0,
    }))
}
