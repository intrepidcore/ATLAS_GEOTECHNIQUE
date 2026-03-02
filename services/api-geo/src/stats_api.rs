use axum::{extract::{Query, State}, http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;
use sqlx::Row;

use crate::state::AppState;

#[derive(Serialize)]
pub struct GlobalStatsResponse {
    pub mailles_total: i64,
    pub mailles_filtrees: i64,
    pub mailles_avec_donnees: i64,
    pub taux_couverture_pct: f64,
    pub sondages: i64,
    pub echantillons: i64,
    pub essais: i64,
    pub essais_par_type: EssaisParType,
    pub profondeur: ProfondeurStats,
    pub gtr: serde_json::Value,
    pub argilosite: ArgilositeStats,
}

#[derive(Serialize)]
pub struct EssaisParType {
    pub atterberg: i64,
    pub vbs: i64,
    pub classif: i64,
    pub proctor: i64,
    pub granulo: i64,
    pub gonflement: i64,
}

#[derive(Serialize)]
pub struct ProfondeurStats {
    pub min_m: Option<f64>,
    pub max_m: Option<f64>,
    pub moy_m: Option<f64>,
    pub bins: Vec<serde_json::Value>,
}

#[derive(Serialize)]
pub struct ArgilositeStats {
    pub vbs_moyen: Option<f64>,
    pub pct_argileux: Option<f64>,
    pub ip_moyen: Option<f64>,
}

pub async fn get_global_stats(
    Query(_params): Query<std::collections::HashMap<String, String>>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let mailles_total: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.mailles")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    let mailles_avec_donnees: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM atlas.mv_mailles_geotech WHERE COALESCE(n_sondages,0) > 0",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let sondages: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.sondages WHERE deleted_at IS NULL")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    let echantillons: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.echantillons")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    let essais: i64 = sqlx::query_scalar(
        r#"
        SELECT (
            (SELECT COUNT(*)::bigint FROM atlas.essais_atterberg) +
            (SELECT COUNT(*)::bigint FROM atlas.essais_vbs) +
            (SELECT COUNT(*)::bigint FROM atlas.essais_classif) +
            (SELECT COUNT(*)::bigint FROM atlas.essais_physiques) +
            (SELECT COUNT(*)::bigint FROM atlas.essais_proctor) +
            (SELECT COUNT(*)::bigint FROM atlas.essais_potentiel_gonflement) +
            (SELECT COUNT(*)::bigint FROM atlas.granulo_points)
        )::bigint
        "#,
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // Counts by table (robuste vs mapping type codes)
    let atterberg: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.essais_atterberg")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let vbs: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.essais_vbs")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let classif: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.essais_classif")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let proctor: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.essais_proctor")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let granulo: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.granulo_points")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let gonflement: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.essais_potentiel_gonflement")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    let taux_couverture_pct = if mailles_total > 0 {
        (mailles_avec_donnees as f64) * 100.0 / (mailles_total as f64)
    } else {
        0.0
    };

    // Protéger contre des impls de profondeur non uniformes: on retourne un objet stable.
    let profondeur_row = sqlx::query(
        r#"
        SELECT
            MIN(NULLIF(e.depth_m, 'NaN'::numeric)) AS min_m,
            MAX(NULLIF(e.depth_m, 'NaN'::numeric)) AS max_m,
            AVG(NULLIF(e.depth_m, 'NaN'::numeric)) AS moy_m
        FROM atlas.essais e
        "#,
    )
    .fetch_one(pool)
    .await;

    let (min_m, max_m, moy_m) = match profondeur_row {
        Ok(r) => {
            let min_bd: Option<sqlx::types::BigDecimal> = r.try_get("min_m").ok().flatten();
            let max_bd: Option<sqlx::types::BigDecimal> = r.try_get("max_m").ok().flatten();
            let moy_bd: Option<sqlx::types::BigDecimal> = r.try_get("moy_m").ok().flatten();
            (
                min_bd.and_then(|v| v.to_string().parse::<f64>().ok()),
                max_bd.and_then(|v| v.to_string().parse::<f64>().ok()),
                moy_bd.and_then(|v| v.to_string().parse::<f64>().ok()),
            )
        }
        Err(_) => (None, None, None),
    };

    let resp = GlobalStatsResponse {
        mailles_total,
        mailles_filtrees: mailles_total,
        mailles_avec_donnees,
        taux_couverture_pct,
        sondages,
        echantillons,
        essais,
        essais_par_type: EssaisParType {
            atterberg,
            vbs,
            classif,
            proctor,
            granulo,
            gonflement,
        },
        profondeur: ProfondeurStats {
            min_m,
            max_m,
            moy_m,
            bins: Vec::new(),
        },
        gtr: serde_json::json!({}),
        argilosite: ArgilositeStats {
            vbs_moyen: None,
            pct_argileux: None,
            ip_moyen: None,
        },
    };

    (StatusCode::OK, Json(resp)).into_response()
}
