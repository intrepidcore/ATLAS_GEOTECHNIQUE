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
    pub id: i64,
    pub entity: String,
    pub entity_id: Uuid,
    pub localite: Option<String>,
    pub adm2_code: Option<String>,
    pub candidates: serde_json::Value,
    pub top_code: Option<String>,
    pub top_score: Option<sqlx::types::BigDecimal>,
    pub top_method: Option<String>,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub decided_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeocodeSuggestion {
    pub id: i64,
    pub entity: String,
    pub entity_id: Uuid,
    pub localite: Option<String>,
    pub adm2_code: Option<String>,
    pub candidates: serde_json::Value,
    pub top_code: Option<String>,
    pub top_score: Option<f64>,
    pub top_method: Option<String>,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub decided_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl From<GeocodeSuggestionRow> for GeocodeSuggestion {
    fn from(row: GeocodeSuggestionRow) -> Self {
        Self {
            id: row.id,
            entity: row.entity,
            entity_id: row.entity_id,
            localite: row.localite,
            adm2_code: row.adm2_code,
            candidates: row.candidates,
            top_code: row.top_code,
            top_score: row.top_score.and_then(|d| d.to_string().parse().ok()),
            top_method: row.top_method,
            status: row.status,
            created_at: row.created_at,
            decided_at: row.decided_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct SuggestionsQuery {
    pub status: Option<String>,
    pub adm2: Option<String>,
    pub q: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSuggestionPayload {
    pub adm3_code: String,
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
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);
    
    let mut query = String::from(
        "SELECT id, entity, entity_id, localite, adm2_code, candidates, \
         top_code, top_score, top_method, status, created_at, decided_at \
         FROM geocode_suggestions \
         WHERE entity = 'sondages'"
    );
    
    // Filtres
    if let Some(status) = &params.status {
        query.push_str(&format!(" AND status = '{}'", status));
    }
    
    if let Some(adm2) = &params.adm2 {
        query.push_str(&format!(" AND adm2_code = '{}'", adm2));
    }
    
    if let Some(q) = &params.q {
        query.push_str(&format!(" AND localite ILIKE '%{}%'", q));
    }
    
    query.push_str(&format!(" ORDER BY status, top_score DESC LIMIT {} OFFSET {}", limit, offset));
    
    let rows = sqlx::query_as::<_, GeocodeSuggestionRow>(
        r#"
        SELECT id, entity, entity_id, localite, adm2_code, candidates, 
               top_code, top_score, top_method, status, created_at, decided_at
        FROM geocode_suggestions
        WHERE entity = 'sondages'
          AND ($1::text IS NULL OR status = $1)
          AND ($2::text IS NULL OR adm2_code = $2)
          AND ($3::text IS NULL OR localite ILIKE '%' || $3 || '%')
        ORDER BY 
          CASE status 
            WHEN 'pending' THEN 1
            WHEN 'accepted' THEN 2
            WHEN 'rejected' THEN 3
          END,
          top_score DESC NULLS LAST
        LIMIT $4 OFFSET $5
        "#
    )
    .bind(&params.status)
    .bind(&params.adm2)
    .bind(&params.q)
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
    Path(id): Path<i64>,
) -> Result<Json<GeocodeSuggestion>, (StatusCode, String)> {
    let pool = &state.pool;
    let row = sqlx::query_as::<_, GeocodeSuggestionRow>(
        r#"
        UPDATE geocode_suggestions
        SET status = 'accepted', decided_at = now()
        WHERE id = $1
        RETURNING id, entity, entity_id, localite, adm2_code, candidates,
                  top_code, top_score, top_method, status, created_at, decided_at
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

/// POST /geocode/suggestions/:id/reject
pub async fn reject_suggestion(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<GeocodeSuggestion>, (StatusCode, String)> {
    let pool = &state.pool;
    let row = sqlx::query_as::<_, GeocodeSuggestionRow>(
        r#"
        UPDATE geocode_suggestions
        SET status = 'rejected', decided_at = now()
        WHERE id = $1
        RETURNING id, entity, entity_id, localite, adm2_code, candidates,
                  top_code, top_score, top_method, status, created_at, decided_at
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

/// POST /geocode/suggestions/:id/update
pub async fn update_suggestion(
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateSuggestionPayload>,
) -> Result<Json<GeocodeSuggestion>, (StatusCode, String)> {
    let pool = &state.pool;
    let row = sqlx::query_as::<_, GeocodeSuggestionRow>(
        r#"
        UPDATE geocode_suggestions
        SET top_code = $2, status = 'accepted', decided_at = now()
        WHERE id = $1
        RETURNING id, entity, entity_id, localite, adm2_code, candidates,
                  top_code, top_score, top_method, status, created_at, decided_at
        "#
    )
    .bind(id)
    .bind(&payload.adm3_code)
    .fetch_one(pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Suggestion not found".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;
    
    Ok(Json(row.into()))
}

/// POST /geocode/apply-accepted
pub async fn apply_accepted(
    State(state): State<AppState>,
) -> Result<Json<ApplyAcceptedResponse>, (StatusCode, String)> {
    let pool = &state.pool;
    // Appliquer les suggestions accepted
    let result = sqlx::query(
        r#"
        WITH accepted AS (
          SELECT entity_id AS id, top_code
          FROM geocode_suggestions
          WHERE entity = 'sondages' 
            AND status = 'accepted'
            AND top_code IS NOT NULL
        )
        UPDATE sondages s
        SET meta = jsonb_set(s.meta, '{adm3_code}', to_jsonb(a.top_code))
        FROM accepted a
        WHERE s.id = a.id
          AND (s.meta->>'adm3_code') IS NULL
        "#
    )
    .execute(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    let applied_count = result.rows_affected() as i64;
    
    // Refresh vue matérialisée
    let refresh_result = sqlx::query(
        "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech"
    )
    .execute(pool)
    .await;
    
    let refreshed = refresh_result.is_ok();
    
    Ok(Json(ApplyAcceptedResponse {
        applied_count,
        refreshed,
    }))
}

/// GET /geocode/stats
pub async fn get_stats(
    State(state): State<AppState>,
) -> Result<Json<GeocodeStats>, (StatusCode, String)> {
    let pool = &state.pool;
    
    #[derive(sqlx::FromRow)]
    struct StatsRow {
        total: Option<i64>,
        accepted: Option<i64>,
        pending: Option<i64>,
        rejected: Option<i64>,
    }
    
    let stats = sqlx::query_as::<_, StatsRow>(
        r#"
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
        FROM geocode_suggestions
        WHERE entity = 'sondages'
        "#
    )
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    // Compter sondages sans suggestion
    #[derive(sqlx::FromRow)]
    struct CountRow {
        count: Option<i64>,
    }
    
    let no_suggestion = sqlx::query_as::<_, CountRow>(
        r#"
        SELECT COUNT(*) AS count
        FROM sondages s
        WHERE (s.meta->>'adm3_code') IS NULL
          AND nullif(s.meta->>'localite','') IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM geocode_suggestions gs 
            WHERE gs.entity_id = s.id AND gs.entity = 'sondages'
          )
        "#
    )
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    Ok(Json(GeocodeStats {
        total: stats.total.unwrap_or(0),
        accepted: stats.accepted.unwrap_or(0),
        pending: stats.pending.unwrap_or(0),
        rejected: stats.rejected.unwrap_or(0),
        no_suggestion: no_suggestion.count.unwrap_or(0),
    }))
}
