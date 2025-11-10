// Module pour la vue unifiée des sondages par localité
use crate::state::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, FromRow, Serialize)]
pub struct UnifiedSurvey {
    pub localite_key: String,
    pub localite: String,
    pub survey_ids: Vec<Uuid>,
    pub survey_codes: Vec<String>,
    pub has_bleu: bool,
    pub has_limite: bool,
    pub has_granulo: bool,
    pub has_vbs: bool,
    pub variants: i64,
    pub adm3_id: Option<Uuid>,
    pub adm3_name: Option<String>,
    pub has_geometry: bool,
    pub latest_date: Option<chrono::NaiveDate>,
    pub atterberg_count: i64,
    pub granulo_count: i64,
    pub vbs_count: i64,
    pub echantillons_count: i64,
    pub total_essais: i64,
}

#[derive(Debug, Deserialize)]
pub struct UnifiedSurveysQuery {
    pub q: Option<String>,          // Recherche floue sur localite
    pub adm3_id: Option<Uuid>,      // Filtrer par ADM3
    pub has_geometry: Option<bool>, // Filtrer par présence de géométrie
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /surveys/unified - Liste unifiée des sondages par localité
pub async fn list_unified_surveys(
    State(state): State<AppState>,
    Query(params): Query<UnifiedSurveysQuery>,
) -> Result<Json<Vec<UnifiedSurvey>>, (StatusCode, String)> {
    let pool = &state.pool;
    let limit = params.limit.unwrap_or(100).min(500);
    let offset = params.offset.unwrap_or(0);

    let rows = sqlx::query_as::<_, UnifiedSurvey>(
        r#"
        SELECT 
            localite_key,
            localite,
            survey_ids,
            survey_codes,
            has_bleu,
            has_limite,
            has_granulo,
            has_vbs,
            variants,
            adm3_id,
            adm3_name,
            has_geometry,
            latest_date,
            atterberg_count,
            granulo_count,
            vbs_count,
            echantillons_count,
            total_essais
        FROM atlas.mv_sondages_unifies
        WHERE ($1::text IS NULL OR atlas.norm_key(localite) LIKE atlas.norm_key($1) || '%')
          AND ($2::uuid IS NULL OR adm3_id = $2)
          AND ($3::boolean IS NULL OR has_geometry = $3)
        ORDER BY localite
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(&params.q)
    .bind(params.adm3_id)
    .bind(params.has_geometry)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(rows))
}

/// GET /surveys/unified/stats - Statistiques de la vue unifiée
#[derive(Debug, Serialize)]
pub struct UnifiedStats {
    pub total_localites: i64,
    pub total_sondages: i64,
    pub localites_avec_doublons: i64,
    pub total_essais: i64,
    pub sondages_sans_geom: i64,
}

pub async fn get_unified_stats(
    State(state): State<AppState>,
) -> Result<Json<UnifiedStats>, (StatusCode, String)> {
    let pool = &state.pool;

    let stats = sqlx::query_as::<_, (i64, i64, i64, i64)>(
        r#"
        SELECT 
            COUNT(*)::bigint as total_localites,
            COALESCE(SUM(variants), 0)::bigint as total_sondages,
            COALESCE(SUM(CASE WHEN variants > 1 THEN 1 ELSE 0 END), 0)::bigint as avec_doublons,
            COALESCE(SUM(total_essais), 0)::bigint as total_essais
        FROM atlas.mv_sondages_unifies
        "#,
    )
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let sans_geom: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM atlas.mv_sondages_unifies WHERE has_geometry = false",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(UnifiedStats {
        total_localites: stats.0,
        total_sondages: stats.1,
        localites_avec_doublons: stats.2,
        total_essais: stats.3,
        sondages_sans_geom: sans_geom,
    }))
}

/// POST /surveys/unified/refresh - Refresh la vue matérialisée
#[derive(Debug, Serialize)]
pub struct RefreshResponse {
    pub success: bool,
    pub message: String,
}

pub async fn refresh_unified_view(
    State(state): State<AppState>,
) -> Result<Json<RefreshResponse>, (StatusCode, String)> {
    let pool = &state.pool;

    let result = sqlx::query("SELECT atlas.refresh_sondages_unifies()")
        .execute(pool)
        .await;

    match result {
        Ok(_) => Ok(Json(RefreshResponse {
            success: true,
            message: "Vue unifiée rafraîchie avec succès".to_string(),
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}
