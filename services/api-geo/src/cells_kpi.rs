// Module centralisé pour les KPI de mailles
// Source unique de vérité pour /labs et /complete

use crate::state::AppState;
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use sqlx::{FromRow, PgPool};

#[derive(FromRow, Debug, Clone, Serialize)]
pub struct KpiRow {
    pub n_sondages: i64,
    pub n_echantillons: i64,
    pub n_essais: i64,
    pub pct_spread: f64,
    pub depth_max_m: Option<f64>,
}

/// Récupère les KPI d'une maille depuis v_maille_kpi_v2
///
/// # Arguments
/// * `pool` - Pool de connexion PostgreSQL
/// * `code` - Code de la maille (ex: "TG-0807-0159-01")
///
/// # Returns
/// * `Ok(Some(KpiRow))` - KPI trouvés
/// * `Ok(None)` - Maille non trouvée
/// * `Err(_)` - Erreur SQL
pub async fn fetch_kpi_row(pool: &PgPool, code: &str) -> sqlx::Result<Option<KpiRow>> {
    // Utiliser atlas.mv_mailles_geotech avec les vraies colonnes n_sondages, n_echantillons et n_essais_total
    sqlx::query_as::<_, KpiRow>(
        r#"
        SELECT
          COALESCE(n_sondages, 0)::bigint AS n_sondages,
          COALESCE(n_echantillons, 0)::bigint AS n_echantillons,
          COALESCE(n_essais_total, 0)::bigint AS n_essais,
          0.0::float8 AS pct_spread,
          depth_max_m::float8 AS depth_max_m
        FROM atlas.mv_mailles_geotech
        WHERE code = $1
        "#,
    )
    .bind(code.trim())
    .fetch_optional(pool)
    .await
}

/// Endpoint de test pour débugger fetch_kpi_row
pub async fn test_kpi_endpoint(
    Path(code): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let result = fetch_kpi_row(&state.pool, &code).await;

    Json(serde_json::json!({
        "code": code,
        "result": match result {
            Ok(Some(r)) => serde_json::json!({
                "found": true,
                "data": r
            }),
            Ok(None) => serde_json::json!({"found": false}),
            Err(e) => serde_json::json!({"error": format!("{:?}", e)})
        }
    }))
}
