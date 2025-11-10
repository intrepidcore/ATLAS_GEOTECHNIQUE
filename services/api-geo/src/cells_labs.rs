// Module pour les données de laboratoire par maille
use crate::cells_kpi::fetch_kpi_row;
use crate::state::AppState;
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;

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

#[derive(Debug, Serialize, Deserialize)]
pub struct Physiques {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub densite_absolue_gcm3: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub teneur_eau_pct: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClassifItem {
    pub class: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Classif {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aashto: Option<Vec<ClassifItem>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uscs: Option<Vec<ClassifItem>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gtr: Option<Vec<ClassifItem>>,
}

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
    #[serde(skip_serializing_if = "Option::is_none")]
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub physiques: Option<Physiques>,
    pub granulo: Option<serde_json::Value>,
    pub proctor: Option<serde_json::Value>,
    pub swelling: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub classif: Option<Classif>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub badge: Option<String>,
}

pub async fn get_cell_complete(
    Path(code): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;

    // 1) KPI complets (v2 - source unique via fetch_kpi_row)
    let kpi_row = fetch_kpi_row(pool, &code).await;

    let kpi = match kpi_row {
        Ok(Some(r)) => {
            CompleteKpi {
                n_sondages: r.n_sondages,
                n_echantillons: r.n_essais, // Compat
                n_essais: r.n_essais,
                pct_spread: r.pct_spread,
                depth_max_m: r.depth_max_m,
                updated_at: Some(chrono::Utc::now().to_rfc3339()),
            }
        }
        Ok(None) => CompleteKpi {
            n_sondages: 0,
            n_echantillons: 0,
            n_essais: 0,
            pct_spread: 0.0,
            depth_max_m: None,
            updated_at: Some(chrono::Utc::now().to_rfc3339()),
        },
        Err(e) => {
            eprintln!("[ERROR] KPI v2 query failed for code={}: {:?}", code, e);
            CompleteKpi {
                n_sondages: 0,
                n_echantillons: 0,
                n_essais: 0,
                pct_spread: 0.0,
                depth_max_m: None,
                updated_at: Some(chrono::Utc::now().to_rfc3339()),
            }
        }
    };

    // 2) Overview - utilise echantillons + essais_atterberg
    let atterberg = sqlx::query_as::<_, AtterbergPoint>(
        r#"
        SELECT e.depth_m::float8, ea.wl::float8, ea.wp::float8
        FROM echantillons e
        JOIN sondages s ON s.id = e.sondage_id
        JOIN essais_atterberg ea ON ea.echantillon_id = e.id::text
        WHERE s.grid_code = $1 AND ea.wl IS NOT NULL
        ORDER BY e.depth_m
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let vbs = sqlx::query_as::<_, VbsPoint>(
        r#"
        SELECT e.depth_m::float8, ev.vbs::float8
        FROM echantillons e
        JOIN sondages s ON s.id = e.sondage_id
        JOIN essais_vbs ev ON ev.echantillon_id = e.id::text
        WHERE s.grid_code = $1 AND ev.vbs IS NOT NULL
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
        FROM echantillons e
        JOIN sondages s ON s.id = e.sondage_id
        WHERE s.grid_code = $1
        GROUP BY bin
        ORDER BY bin
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // 3) Échantillons complets - utilise echantillons + essais
    let samples: Vec<SampleComplete> = vec![]; // Simplifié pour l'instant - retourne vide

    // 4) Sondages (avec badge ADM random cell)
    let survey_rows = sqlx::query(
        r#"
        SELECT 
          s.id,
          s.code AS code_site,
          s.location_mode AS mode,
          s.grid_code,
          COUNT(DISTINCT e.id)::bigint AS samples,
          COUNT(DISTINCT e.id)::bigint AS tests
        FROM sondages s
        LEFT JOIN echantillons e ON e.sondage_id = s.id
        WHERE s.grid_code = $1
        GROUP BY s.id, s.code, s.location_mode, s.grid_code
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let surveys: Vec<SurveyInfo> = survey_rows
        .into_iter()
        .map(|row| {
            let mode: String = row
                .try_get("mode")
                .unwrap_or_else(|_| "unknown".to_string());
            let badge = if mode == "adm_random_cell" {
                Some("ADM random cell".to_string())
            } else {
                None
            };

            SurveyInfo {
                id: row.try_get("id").unwrap(),
                code_site: row.try_get("code_site").ok(),
                mode,
                date: None,
                adm3_code: None,
                samples: row.try_get("samples").unwrap_or(0),
                tests: row.try_get("tests").unwrap_or(0),
                badge,
            }
        })
        .collect();

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
