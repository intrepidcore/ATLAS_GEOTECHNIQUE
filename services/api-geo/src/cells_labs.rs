// Module pour les données de laboratoire par maille
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use crate::state::AppState;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct CellLabsResponse {
    pub kpi: KpiData,
    pub atterberg: Vec<AtterbergPoint>,
    pub vbs: Vec<VbsPoint>,
    pub depth_hist: Vec<DepthBin>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct KpiData {
    pub n_sondages: i64,
    pub n_essais: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AtterbergPoint {
    pub depth_m: f64,
    pub wl: Option<f64>,
    pub wp: Option<f64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VbsPoint {
    pub depth_m: f64,
    pub vbs: Option<f64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DepthBin {
    pub bin: i32,
    pub n: i64,
}

// ============================================================================
// Handler
// ============================================================================

pub async fn get_cell_labs(
    Path(code): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;

    // 1) KPI
    let kpi = sqlx::query_as::<_, KpiData>(
        r#"
        SELECT
          COUNT(DISTINCT v.sondage_id) AS n_sondages,
          (COUNT(DISTINCT a.id) + COUNT(DISTINCT vbs.id)) AS n_essais
        FROM v_maille_sondages_all v
        LEFT JOIN echantillons e ON e.sondage_id = v.sondage_id
        LEFT JOIN essais_atterberg a ON a.echantillon_id = e.id
        LEFT JOIN essais_vbs vbs ON vbs.echantillon_id = e.id
        WHERE v.maille_code = $1
        "#,
    )
    .bind(&code)
    .fetch_one(pool)
    .await
    .unwrap_or(KpiData {
        n_sondages: 0,
        n_essais: 0,
    });

    // 2) Atterberg
    let atterberg = sqlx::query_as::<_, AtterbergPoint>(
        r#"
        SELECT e.depth_m, a.wl, a.wp
        FROM v_maille_sondages_all v
        JOIN echantillons e ON e.sondage_id = v.sondage_id
        JOIN essais_atterberg a ON a.echantillon_id = e.id
        WHERE v.maille_code = $1
        ORDER BY e.depth_m
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // 3) VBS
    let vbs = sqlx::query_as::<_, VbsPoint>(
        r#"
        SELECT e.depth_m, vbs.vbs
        FROM v_maille_sondages_all v
        JOIN echantillons e ON e.sondage_id = v.sondage_id
        JOIN essais_vbs vbs ON vbs.echantillon_id = e.id
        WHERE v.maille_code = $1
        ORDER BY e.depth_m
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // 4) Histogramme profondeurs
    let depth_hist = sqlx::query_as::<_, DepthBin>(
        r#"
        SELECT width_bucket(e.depth_m, 0, 30, 6) AS bin, COUNT(*)::bigint AS n
        FROM v_maille_sondages_all v
        JOIN echantillons e ON e.sondage_id = v.sondage_id
        WHERE v.maille_code = $1
        GROUP BY bin
        ORDER BY bin
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    Json(CellLabsResponse {
        kpi,
        atterberg,
        vbs,
        depth_hist,
    })
    .into_response()
}

// ============================================================================
// Complete Cell Data (pour panneau gauche v2.0)
// ============================================================================

#[derive(Debug, Serialize)]
pub struct CellCompleteResponse {
    pub kpi: CompleteKpi,
    pub overview: OverviewData,
    pub samples: Vec<SampleComplete>,
    pub surveys: Vec<SurveyInfo>,
    pub source_surveys: Vec<SurveyInfo>,
}

#[derive(Debug, Serialize)]
pub struct CompleteKpi {
    pub n_sondages: i64,
    pub n_echantillons: i64,
    pub n_essais: i64,
    pub pct_spread: f64,
    pub depth_max_m: Option<f64>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OverviewData {
    pub atterberg: Vec<AtterbergPoint>,
    pub vbs: Vec<VbsPoint>,
    pub granulo: Vec<serde_json::Value>,
    pub depth_hist: Vec<DepthBin>,
}

#[derive(Debug, Serialize)]
pub struct SampleComplete {
    pub id: uuid::Uuid,
    pub depth_m: f64,
    pub atterberg: Option<serde_json::Value>,
    pub vbs: Option<serde_json::Value>,
    pub granulo: Option<serde_json::Value>,
    pub proctor: Option<serde_json::Value>,
    pub swelling: Option<serde_json::Value>,
    pub classif: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SurveyInfo {
    pub id: uuid::Uuid,
    pub code_site: Option<String>,
    pub mode: String,
    pub date: Option<String>,
    pub adm3_code: Option<String>,
    pub samples: i64,
    pub tests: i64,
}

pub async fn get_cell_complete(
    Path(code): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;

    // 1) KPI complets
    let kpi_row = sqlx::query(
        r#"
        SELECT
          COUNT(DISTINCT v.sondage_id)::bigint AS n_sondages,
          COUNT(DISTINCT e.id)::bigint AS n_echantillons,
          (COUNT(DISTINCT a.id) + COUNT(DISTINCT vbs.id) + COUNT(DISTINCT p.id) + COUNT(DISTINCT g.id))::bigint AS n_essais,
          COALESCE(
            100.0 * COUNT(DISTINCT CASE WHEN s.loc_mode = 'spread' THEN s.id END)::numeric / 
            NULLIF(COUNT(DISTINCT s.id), 0),
            0
          ) AS pct_spread,
          MAX(e.depth_m) AS depth_max_m
        FROM v_maille_sondages_all v
        JOIN sondages s ON s.id = v.sondage_id
        LEFT JOIN echantillons e ON e.sondage_id = v.sondage_id
        LEFT JOIN essais_atterberg a ON a.echantillon_id = e.id
        LEFT JOIN essais_vbs vbs ON vbs.echantillon_id = e.id
        LEFT JOIN essais_proctor p ON p.echantillon_id = e.id
        LEFT JOIN essais_gonflement g ON g.echantillon_id = e.id
        WHERE v.maille_code = $1
        "#,
    )
    .bind(&code)
    .fetch_one(pool)
    .await;

    let kpi = match kpi_row {
        Ok(row) => CompleteKpi {
            n_sondages: row.try_get("n_sondages").unwrap_or(0),
            n_echantillons: row.try_get("n_echantillons").unwrap_or(0),
            n_essais: row.try_get("n_essais").unwrap_or(0),
            pct_spread: row.try_get::<f64, _>("pct_spread").unwrap_or(0.0),
            depth_max_m: row.try_get("depth_max_m").ok(),
            updated_at: Some(chrono::Utc::now().to_rfc3339()),
        },
        Err(_) => CompleteKpi {
            n_sondages: 0,
            n_echantillons: 0,
            n_essais: 0,
            pct_spread: 0.0,
            depth_max_m: None,
            updated_at: Some(chrono::Utc::now().to_rfc3339()),
        },
    };

    // 2) Overview (réutilise les requêtes existantes)
    let atterberg = sqlx::query_as::<_, AtterbergPoint>(
        r#"
        SELECT e.depth_m, a.wl, a.wp
        FROM v_maille_sondages_all v
        JOIN echantillons e ON e.sondage_id = v.sondage_id
        JOIN essais_atterberg a ON a.echantillon_id = e.id
        WHERE v.maille_code = $1
        ORDER BY e.depth_m
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let vbs = sqlx::query_as::<_, VbsPoint>(
        r#"
        SELECT e.depth_m, vbs.vbs
        FROM v_maille_sondages_all v
        JOIN echantillons e ON e.sondage_id = v.sondage_id
        JOIN essais_vbs vbs ON vbs.echantillon_id = e.id
        WHERE v.maille_code = $1
        ORDER BY e.depth_m
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let depth_hist = sqlx::query_as::<_, DepthBin>(
        r#"
        SELECT width_bucket(e.depth_m, 0, 30, 6) AS bin, COUNT(*)::bigint AS n
        FROM v_maille_sondages_all v
        JOIN echantillons e ON e.sondage_id = v.sondage_id
        WHERE v.maille_code = $1
        GROUP BY bin
        ORDER BY bin
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // 3) Échantillons complets (utilise v_samples_complete)
    let samples = sqlx::query(
        r#"
        SELECT 
          sc.id,
          sc.depth_m,
          sc.atterberg,
          sc.vbs,
          sc.granulo,
          sc.proctor,
          sc.swelling,
          sc.classif
        FROM v_samples_complete sc
        JOIN v_maille_sondages_all v ON v.sondage_id = sc.sondage_id
        WHERE v.maille_code = $1
        ORDER BY sc.depth_m
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|row| SampleComplete {
        id: row.try_get("id").unwrap(),
        depth_m: row.try_get("depth_m").unwrap_or(0.0),
        atterberg: row.try_get("atterberg").ok(),
        vbs: row.try_get("vbs").ok(),
        granulo: row.try_get("granulo").ok(),
        proctor: row.try_get("proctor").ok(),
        swelling: row.try_get("swelling").ok(),
        classif: row.try_get("classif").ok(),
    })
    .collect();

    // 4) Sondages
    let surveys = sqlx::query_as::<_, SurveyInfo>(
        r#"
        SELECT 
          s.id,
          s.meta->>'code' AS code_site,
          s.loc_mode AS mode,
          s.meta->>'date' AS date,
          s.adm3_code,
          COUNT(DISTINCT e.id)::bigint AS samples,
          (COUNT(DISTINCT a.id) + COUNT(DISTINCT vbs.id) + COUNT(DISTINCT p.id))::bigint AS tests
        FROM v_maille_sondages_all v
        JOIN sondages s ON s.id = v.sondage_id
        LEFT JOIN echantillons e ON e.sondage_id = s.id
        LEFT JOIN essais_atterberg a ON a.echantillon_id = e.id
        LEFT JOIN essais_vbs vbs ON vbs.echantillon_id = e.id
        LEFT JOIN essais_proctor p ON p.echantillon_id = e.id
        WHERE v.maille_code = $1
        GROUP BY s.id, s.meta, s.loc_mode, s.adm3_code
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // 5) Sondages sources (si spread-only)
    let source_surveys = if kpi.pct_spread > 99.0 && !surveys.is_empty() {
        // Récupérer les sondages sources depuis les ADM3
        sqlx::query_as::<_, SurveyInfo>(
            r#"
            SELECT DISTINCT
              s.id,
              s.meta->>'code' AS code_site,
              s.loc_mode AS mode,
              s.meta->>'date' AS date,
              s.adm3_code,
              0::bigint AS samples,
              0::bigint AS tests
            FROM sondages s
            WHERE s.adm3_code IN (
              SELECT DISTINCT s2.adm3_code
              FROM v_maille_sondages_all v
              JOIN sondages s2 ON s2.id = v.sondage_id
              WHERE v.maille_code = $1 AND s2.loc_mode = 'spread'
            )
            AND s.loc_mode = 'real'
            "#,
        )
        .bind(&code)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    } else {
        vec![]
    };

    Json(CellCompleteResponse {
        kpi,
        overview: OverviewData {
            atterberg,
            vbs,
            granulo: vec![], // TODO: ajouter si disponible
            depth_hist,
        },
        samples,
        surveys,
        source_surveys,
    })
    .into_response()
}
