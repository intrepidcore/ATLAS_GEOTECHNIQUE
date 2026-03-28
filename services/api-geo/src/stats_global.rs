// Module pour les statistiques globales agrégées
use crate::state::AppState;
use axum::{
    extract::{Query, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct GlobalStatsQuery {
    pub adm1: Option<String>,
    pub adm2: Option<String>,
    pub adm3: Option<String>,
    pub min_sondages: Option<i32>,
    pub min_essais: Option<i32>,
}

#[derive(Debug, Serialize)]
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
    pub gtr: std::collections::HashMap<String, i64>,
    pub argilosite: ArgilositeStats,
}

#[derive(Debug, Serialize)]
pub struct EssaisParType {
    pub atterberg: i64,
    pub vbs: i64,
    pub classif: i64,
    pub proctor: i64,
    pub granulo: i64,
    pub gonflement: i64,
}

#[derive(Debug, Serialize)]
pub struct ProfondeurStats {
    pub min_m: Option<f64>,
    pub max_m: Option<f64>,
    pub moy_m: Option<f64>,
    pub bins: Vec<ProfondeurBin>,
}

#[derive(Debug, Serialize)]
pub struct ProfondeurBin {
    pub range: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct ArgilositeStats {
    pub vbs_moyen: Option<f64>,
    pub pct_argileux: Option<f64>,  // % échantillons avec VBS > 2.5
    pub ip_moyen: Option<f64>,
}

// ============================================================================
// Handler
// ============================================================================

pub async fn get_global_stats(
    Query(params): Query<GlobalStatsQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    tracing::info!(
        adm1 = ?params.adm1,
        adm2 = ?params.adm2,
        adm3 = ?params.adm3,
        min_sondages = ?params.min_sondages,
        min_essais = ?params.min_essais,
        "stats_global: begin"
    );

    // 1) Compteurs de mailles (depuis mv_mailles_geotech pour les compteurs mailles)
    // Note: On utilise une CTE pour simplifier les filtres
    let mailles_query = r#"
        WITH filtered AS (
            SELECT *
            FROM atlas.mv_mailles_geotech
            WHERE ($1::text IS NULL OR adm1_name = $1)
              AND ($2::text IS NULL OR adm2_name = $2)
              AND ($3::text IS NULL OR adm3_name = $3)
              AND ($4::int IS NULL OR COALESCE(n_sondages, 0) >= $4)
              AND ($5::int IS NULL OR COALESCE(n_essais_total, 0) >= $5)
        )
        SELECT 
            (SELECT COUNT(*) FROM atlas.mv_mailles_geotech)::bigint AS total,
            COUNT(*)::bigint AS filtrees,
            COUNT(*) FILTER (WHERE has_data = true)::bigint AS avec_donnees,
            COALESCE(SUM(n_sondages), 0)::bigint AS sondages,
            COALESCE(SUM(n_echantillons), 0)::bigint AS echantillons,
            COALESCE(SUM(n_essais_total), 0)::bigint AS essais
        FROM filtered
    "#;
    
    // 1b) Compteurs d'essais par type - directement depuis les tables (pas de double comptage)
    let essais_query = r#"
        SELECT
            (SELECT COUNT(DISTINCT echantillon_id) FROM essais_atterberg)::bigint AS n_atterberg,
            (SELECT COUNT(DISTINCT echantillon_id) FROM essais_vbs)::bigint AS n_vbs,
            (SELECT COUNT(DISTINCT echantillon_id) FROM essais_classif WHERE deleted_at IS NULL)::bigint AS n_classif,
            (SELECT COUNT(DISTINCT echantillon_id) FROM essais_proctor)::bigint AS n_proctor,
            (SELECT COUNT(DISTINCT echantillon_id) FROM granulo_points)::bigint AS n_granulo,
            (SELECT COUNT(DISTINCT echantillon_id) FROM essais_potentiel_gonflement)::bigint AS n_gonflement
    "#;

    let mailles_row = sqlx::query(mailles_query)
        .bind(&params.adm1)
        .bind(&params.adm2)
        .bind(&params.adm3)
        .bind(&params.min_sondages)
        .bind(&params.min_essais)
        .fetch_one(pool)
        .await;

    let (mailles_total, mailles_filtrees, mailles_avec_donnees, sondages, echantillons, essais) = match mailles_row {
        Ok(row) => (
            row.try_get::<i64, _>("total").unwrap_or(0),
            row.try_get::<i64, _>("filtrees").unwrap_or(0),
            row.try_get::<i64, _>("avec_donnees").unwrap_or(0),
            row.try_get::<i64, _>("sondages").unwrap_or(0),
            row.try_get::<i64, _>("echantillons").unwrap_or(0),
            row.try_get::<i64, _>("essais").unwrap_or(0),
        ),
        Err(e) => {
            tracing::error!(error=?e, "Failed to fetch mailles stats");
            (0, 0, 0, 0, 0, 0)
        }
    };
    
    // Récupérer les compteurs d'essais par type (COUNT DISTINCT depuis les tables)
    let essais_row = sqlx::query(essais_query)
        .fetch_one(pool)
        .await;
    
    let (n_atterberg, n_vbs, n_classif, n_proctor, n_granulo, n_gonflement) = match essais_row {
        Ok(row) => (
            row.try_get::<i64, _>("n_atterberg").unwrap_or(0),
            row.try_get::<i64, _>("n_vbs").unwrap_or(0),
            row.try_get::<i64, _>("n_classif").unwrap_or(0),
            row.try_get::<i64, _>("n_proctor").unwrap_or(0),
            row.try_get::<i64, _>("n_granulo").unwrap_or(0),
            row.try_get::<i64, _>("n_gonflement").unwrap_or(0),
        ),
        Err(e) => {
            tracing::error!(error=?e, "Failed to fetch essais counts");
            (0, 0, 0, 0, 0, 0)
        }
    };

    // 2) Profondeurs (depuis echantillons avec filtres ADM via jointure spatiale)
    let depth_query = r#"
        WITH filtered_sondages AS (
            SELECT s.id
            FROM mailles m
            JOIN sondages s ON st_contains(m.geom, st_transform(s.geom, 25231)) AND s.deleted_at IS NULL AND s.geom IS NOT NULL
            WHERE ($1::text IS NULL OR s.adm1_name = $1)
              AND ($2::text IS NULL OR s.adm2_name = $2)
              AND ($3::text IS NULL OR s.adm3_name = $3)
        )
        SELECT 
            MIN(e.depth_m)::float8 AS min_m,
            MAX(e.depth_m)::float8 AS max_m,
            AVG(e.depth_m)::float8 AS moy_m,
            COUNT(*) FILTER (WHERE e.depth_m >= 0 AND e.depth_m < 1)::bigint AS bin_0_1,
            COUNT(*) FILTER (WHERE e.depth_m >= 1 AND e.depth_m < 1.5)::bigint AS bin_1_15,
            COUNT(*) FILTER (WHERE e.depth_m >= 1.5 AND e.depth_m < 2)::bigint AS bin_15_2,
            COUNT(*) FILTER (WHERE e.depth_m >= 2)::bigint AS bin_2_plus
        FROM echantillons e
        WHERE e.sondage_id IN (SELECT id FROM filtered_sondages)
    "#;

    let depth_row = sqlx::query(depth_query)
        .bind(&params.adm1)
        .bind(&params.adm2)
        .bind(&params.adm3)
        .fetch_one(pool)
        .await;

    let profondeur = match depth_row {
        Ok(row) => ProfondeurStats {
            min_m: row.try_get("min_m").ok(),
            max_m: row.try_get("max_m").ok(),
            moy_m: row.try_get("moy_m").ok(),
            bins: vec![
                ProfondeurBin { range: "0-1".to_string(), count: row.try_get("bin_0_1").unwrap_or(0) },
                ProfondeurBin { range: "1-1.5".to_string(), count: row.try_get("bin_1_15").unwrap_or(0) },
                ProfondeurBin { range: "1.5-2".to_string(), count: row.try_get("bin_15_2").unwrap_or(0) },
                ProfondeurBin { range: ">2".to_string(), count: row.try_get("bin_2_plus").unwrap_or(0) },
            ],
        },
        Err(e) => {
            tracing::error!(error=?e, "Failed to fetch depth stats");
            ProfondeurStats {
                min_m: None,
                max_m: None,
                moy_m: None,
                bins: vec![],
            }
        }
    };

    // 3) GTR (depuis essais_classif - stats globales)
    // Note: Pour l'instant, on utilise les classifications disponibles sans filtre par maille
    let gtr_query = r#"
        SELECT 
            COALESCE(NULLIF(ec.classe, ''), 'Non classé') AS classe,
            COUNT(*)::bigint AS count
        FROM essais_classif ec
        WHERE ec.deleted_at IS NULL
          AND ec.classe IS NOT NULL
          AND ec.classe != ''
        GROUP BY ec.classe
        ORDER BY count DESC
        LIMIT 10
    "#;

    let gtr_rows = sqlx::query(gtr_query)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    let mut gtr: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for row in gtr_rows {
        let classe: String = row.try_get("classe").unwrap_or_else(|_| "?".to_string());
        let count: i64 = row.try_get("count").unwrap_or(0);
        gtr.insert(classe, count);
    }

    // 4) Argilosité (VBS moyen, IP moyen) - avec filtres ADM
    let argilosite_query = r#"
        WITH filtered_echantillons AS (
            SELECT e.id
            FROM mailles m
            JOIN sondages s ON st_contains(m.geom, st_transform(s.geom, 25231)) AND s.deleted_at IS NULL AND s.geom IS NOT NULL
            JOIN echantillons e ON e.sondage_id = s.id
            WHERE ($1::text IS NULL OR s.adm1_name = $1)
              AND ($2::text IS NULL OR s.adm2_name = $2)
              AND ($3::text IS NULL OR s.adm3_name = $3)
        )
        SELECT 
            (SELECT AVG(vbs)::float8 FROM essais_vbs WHERE vbs IS NOT NULL AND echantillon_id IN (SELECT id FROM filtered_echantillons)) AS vbs_moyen,
            (SELECT (COUNT(*) FILTER (WHERE vbs > 2.5)::float8 / NULLIF(COUNT(*)::float8, 0) * 100) FROM essais_vbs WHERE vbs IS NOT NULL AND echantillon_id IN (SELECT id FROM filtered_echantillons)) AS pct_argileux,
            (SELECT AVG(wl - wp)::float8 FROM essais_atterberg WHERE wl IS NOT NULL AND wp IS NOT NULL AND echantillon_id IN (SELECT id FROM filtered_echantillons)) AS ip_moyen
    "#;

    let argilosite_row = sqlx::query(argilosite_query)
        .bind(&params.adm1)
        .bind(&params.adm2)
        .bind(&params.adm3)
        .fetch_one(pool)
        .await;

    let argilosite = match argilosite_row {
        Ok(row) => ArgilositeStats {
            vbs_moyen: row.try_get("vbs_moyen").ok(),
            pct_argileux: row.try_get("pct_argileux").ok(),
            ip_moyen: row.try_get("ip_moyen").ok(),
        },
        Err(e) => {
            tracing::error!(error=?e, "Failed to fetch argilosite stats");
            ArgilositeStats {
                vbs_moyen: None,
                pct_argileux: None,
                ip_moyen: None,
            }
        }
    };

    // Calcul du taux de couverture
    let taux_couverture_pct = if mailles_filtrees > 0 {
        (mailles_avec_donnees as f64 / mailles_filtrees as f64) * 100.0
    } else {
        0.0
    };

    tracing::info!(
        mailles_total,
        mailles_filtrees,
        mailles_avec_donnees,
        sondages,
        echantillons,
        essais,
        "stats_global: success"
    );

    Json(GlobalStatsResponse {
        mailles_total,
        mailles_filtrees,
        mailles_avec_donnees,
        taux_couverture_pct,
        sondages,
        echantillons,
        essais,
        essais_par_type: EssaisParType {
            atterberg: n_atterberg,
            vbs: n_vbs,
            classif: n_classif,
            proctor: n_proctor,
            granulo: n_granulo,
            gonflement: n_gonflement,
        },
        profondeur,
        gtr,
        argilosite,
    })
    .into_response()
}
