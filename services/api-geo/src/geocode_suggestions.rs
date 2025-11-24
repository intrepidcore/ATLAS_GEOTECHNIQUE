// Module de gestion des suggestions de géocodage
// Adapté à la structure public.geocode_suggestions

use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
// use sqlx::PgPool; // Unused import

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Suggestion {
    pub id: String,
    pub entity: Option<String>,
    pub entity_id: Option<String>,
    pub localite: Option<String>,
    pub adm2_code: Option<String>,
    pub candidates: Option<String>,
    pub top_code: Option<String>,
    pub top_score: Option<String>,
    pub top_method: Option<String>,
    pub status: Option<String>,
    pub created_at: Option<String>,
    pub decided_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SuggestionsQuery {
    pub sondage_id: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct AcceptPayload {
    pub adm3_pcode: String,
}

#[derive(Debug, Serialize)]
pub struct AcceptResponse {
    pub success: bool,
    pub sondage_id: String,
    pub adm3_pcode: String,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /geocode/suggestions?sondage_id=...
pub async fn list_suggestions(
    State(state): State<AppState>,
    Query(params): Query<SuggestionsQuery>,
) -> Result<Json<Vec<Suggestion>>, (StatusCode, String)> {
    let pool = &state.pool;
    let limit = params.limit.unwrap_or(50).min(200);
    
    let mut query = String::from(
        "SELECT * FROM public.geocode_suggestions WHERE 1=1"
    );
    
    if let Some(sondage_id) = &params.sondage_id {
        query.push_str(&format!(" AND entity_id = '{}'", sondage_id));
    }
    
    if let Some(status) = &params.status {
        query.push_str(&format!(" AND status = '{}'", status));
    }
    
    query.push_str(&format!(" ORDER BY created_at DESC LIMIT {}", limit));
    
    let suggestions = sqlx::query_as::<_, Suggestion>(&query)
        .fetch_all(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    Ok(Json(suggestions))
}

/// POST /geocode/suggestions/:id/accept
pub async fn accept_suggestion(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<AcceptResponse>, (StatusCode, String)> {
    let pool = &state.pool;
    
    // Récupérer la suggestion
    let suggestion = sqlx::query_as::<_, Suggestion>(
        "SELECT * FROM public.geocode_suggestions WHERE id = $1"
    )
    .bind(&id)
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::NOT_FOUND, format!("Suggestion not found: {}", e)))?;
    
    let sondage_id = suggestion.entity_id.ok_or((
        StatusCode::BAD_REQUEST,
        "Missing entity_id".to_string(),
    ))?;
    
    let adm3_pcode = suggestion.top_code.ok_or((
        StatusCode::BAD_REQUEST,
        "Missing top_code".to_string(),
    ))?;
    
    // Récupérer l'ADM3
    let adm3_gid: i32 = sqlx::query_scalar(
        "SELECT gid FROM adm3 WHERE adm3_pcode = $1"
    )
    .bind(&adm3_pcode)
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::NOT_FOUND, format!("ADM3 not found: {}", e)))?;
    
    // Récupérer les anciennes valeurs pour audit
    let sondage_uuid = sondage_id.parse::<uuid::Uuid>()
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid UUID: {}", e)))?;
    
    let old_values = sqlx::query!(
        "SELECT location_mode, adm3_name, ST_AsText(geom) as geom_wkt FROM public.sondages WHERE id = $1",
        sondage_uuid
    )
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch old values: {}", e)))?;

    // Géocoder le sondage avec audit des anciennes valeurs
    sqlx::query(
        r#"
        UPDATE public.sondages s
        SET 
            geom = public.random_point_in_polygon(a.geom),
            adm3_id = $2,
            adm3_name = a.adm3_fr,
            location_mode = 'adm_random_cell',
            updated_at = now(),
            meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
                'geocoded_at', now()::text,
                'geocoded_mode', 'suggestion_accepted',
                'geocoded_placement', 'adm_random_cell',
                'geocoded_adm3_pcode', $3,
                'suggestion_id', $4,
                'old_location_mode', $5,
                'old_adm3_name', $6,
                'old_geom_wkt', $7
            )
        FROM adm3 a
        WHERE a.gid = $2 AND s.id = $1
        "#
    )
    .bind(sondage_uuid)
    .bind(adm3_gid)
    .bind(&adm3_pcode)
    .bind(&id)
    .bind(&old_values.location_mode)
    .bind(&old_values.adm3_name)
    .bind(&old_values.geom_wkt)
    .execute(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to geocode: {}", e)))?;
    
    // Marquer la suggestion comme acceptée et rejeter les autres pour ce sondage
    let now = chrono::Utc::now().to_rfc3339();
    
    // Accepter celle-ci
    sqlx::query(
        "UPDATE public.geocode_suggestions SET status = 'accepted', decided_at = $1 WHERE id = $2"
    )
    .bind(&now)
    .bind(&id)
    .execute(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to update suggestion: {}", e)))?;
    
    // Rejeter les autres suggestions pending pour ce sondage
    sqlx::query(
        "UPDATE public.geocode_suggestions SET status = 'rejected', decided_at = $1 WHERE entity_id = $2 AND id != $3 AND status = 'pending'"
    )
    .bind(&now)
    .bind(&sondage_id)
    .bind(&id)
    .execute(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to reject other suggestions: {}", e)))?;
    
    tracing::info!(
        "Suggestion {} acceptée : sondage {} géocodé avec ADM3 {}",
        id, sondage_id, adm3_pcode
    );
    
    // Broadcaster l'événement WebSocket
    crate::websocket::broadcast_event(
        &state.ws_tx,
        crate::events::WsEvent::SuggestionAccepted {
            suggestion_id: id.clone(),
            sondage_id: sondage_id.clone(),
            adm3_pcode: adm3_pcode.clone(),
        },
    );
    
    Ok(Json(AcceptResponse {
        success: true,
        sondage_id,
        adm3_pcode,
    }))
}

/// POST /geocode/suggestions/:id/reject
pub async fn reject_suggestion(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pool;
    
    sqlx::query(
        "UPDATE public.geocode_suggestions SET status = 'rejected', decided_at = $1 WHERE id = $2"
    )
    .bind(chrono::Utc::now().to_rfc3339())
    .bind(&id)
    .execute(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    tracing::info!("Suggestion {} rejetée", id);
    
    // Broadcaster l'événement WebSocket
    crate::websocket::broadcast_event(
        &state.ws_tx,
        crate::events::WsEvent::SuggestionRejected {
            suggestion_id: id.clone(),
        },
    );
    
    Ok(Json(serde_json::json!({
        "success": true,
        "id": id,
        "status": "rejected"
    })))
}

/// GET /geocode/suggestions/stats
pub async fn get_suggestions_stats(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pool;
    
    let stats = sqlx::query!(
        r#"
        SELECT 
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
            COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
            COUNT(*) as total
        FROM public.geocode_suggestions
        "#
    )
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    Ok(Json(serde_json::json!({
        "total": stats.total.unwrap_or(0),
        "pending": stats.pending.unwrap_or(0),
        "accepted": stats.accepted.unwrap_or(0),
        "rejected": stats.rejected.unwrap_or(0)
    })))
}

#[derive(Debug, Deserialize)]
pub struct AutoGeocodeParams {
    #[serde(default = "default_threshold")]
    threshold: f64,
}

fn default_threshold() -> f64 {
    0.90
}

/// POST /suggestions/auto-geocode?threshold=0.90
/// Déclenche l'auto-géocodage des suggestions avec score >= seuil
pub async fn auto_geocode_suggestions(
    State(state): State<AppState>,
    Query(params): Query<AutoGeocodeParams>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pool;
    
    let threshold = params.threshold;
    
    if threshold < 0.0 || threshold > 1.0 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Threshold must be between 0 and 1".to_string(),
        ));
    }
    
    tracing::info!("Starting auto-geocode batch with threshold {}", threshold);
    
    // Appeler la fonction SQL
    let result: serde_json::Value = sqlx::query_scalar(
        "SELECT public.run_auto_geocode_batch($1)"
    )
    .bind(threshold)
    .fetch_one(pool)
    .await
    .map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        format!("Auto-geocode failed: {}", e),
    ))?;
    
    tracing::info!("Auto-geocode batch completed: {:?}", result);
    
    // Broadcaster l'événement WebSocket
    crate::websocket::broadcast_event(
        &state.ws_tx,
        crate::events::WsEvent::RefreshStats,
    );
    
    Ok(Json(result))
}
