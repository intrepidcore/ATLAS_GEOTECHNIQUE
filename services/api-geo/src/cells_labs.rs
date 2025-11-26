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
                n_echantillons: r.n_echantillons,
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

    // 2) Overview - utilise jointure spatiale maille -> sondages -> echantillons
    // Note: On utilise st_contains pour lier les sondages aux mailles (même logique que mv_mailles_geotech)
    let atterberg = sqlx::query_as::<_, AtterbergPoint>(
        r#"
        SELECT e.depth_m::float8, ea.wl::float8, ea.wp::float8
        FROM mailles m
        JOIN sondages s ON st_contains(m.geom, st_transform(s.geom, 25231)) AND s.deleted_at IS NULL AND s.geom IS NOT NULL
        JOIN echantillons e ON e.sondage_id = s.id
        JOIN essais_atterberg ea ON ea.echantillon_id = e.id
        WHERE m.code = $1 AND ea.wl IS NOT NULL
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
        FROM mailles m
        JOIN sondages s ON st_contains(m.geom, st_transform(s.geom, 25231)) AND s.deleted_at IS NULL AND s.geom IS NOT NULL
        JOIN echantillons e ON e.sondage_id = s.id
        JOIN essais_vbs ev ON ev.echantillon_id = e.id
        WHERE m.code = $1 AND ev.vbs IS NOT NULL
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
        FROM mailles m
        JOIN sondages s ON st_contains(m.geom, st_transform(s.geom, 25231)) AND s.deleted_at IS NULL AND s.geom IS NOT NULL
        JOIN echantillons e ON e.sondage_id = s.id
        WHERE m.code = $1
        GROUP BY bin
        ORDER BY bin
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // 3) Échantillons complets avec tous les essais
    let samples_rows = sqlx::query(
        r#"
        SELECT 
            e.id,
            e.depth_m::float8 AS depth_m,
            ea.wl::float8 AS att_wl,
            ea.wp::float8 AS att_wp,
            CASE WHEN ea.wl IS NOT NULL AND ea.wp IS NOT NULL THEN (ea.wl - ea.wp)::float8 ELSE NULL END AS att_ip,
            ev.vbs::float8 AS vbs_val,
            ep.densite_absolue_gcm3::float8 AS phys_densite,
            ep.teneur_eau_pct::float8 AS phys_teneur_eau,
            ec.systeme AS classif_systeme,
            ec.classe AS classif_classe,
            epr.id IS NOT NULL AS has_proctor,
            gp.id IS NOT NULL AS has_granulo,
            epg.id IS NOT NULL AS has_gonflement
        FROM mailles m
        JOIN sondages s ON st_contains(m.geom, st_transform(s.geom, 25231)) AND s.deleted_at IS NULL AND s.geom IS NOT NULL
        JOIN echantillons e ON e.sondage_id = s.id
        LEFT JOIN essais_atterberg ea ON ea.echantillon_id = e.id
        LEFT JOIN essais_vbs ev ON ev.echantillon_id = e.id
        LEFT JOIN essais_physiques ep ON ep.echantillon_id = e.id
        LEFT JOIN essais_classif ec ON ec.echantillon_id = e.id AND ec.deleted_at IS NULL
        LEFT JOIN essais_proctor epr ON epr.echantillon_id = e.id
        LEFT JOIN granulo_points gp ON gp.echantillon_id = e.id
        LEFT JOIN essais_potentiel_gonflement epg ON epg.echantillon_id = e.id
        WHERE m.code = $1
        ORDER BY e.depth_m
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await;

    let samples_rows = match samples_rows {
        Ok(rows) => {
            tracing::debug!(code=%code, count=rows.len(), "Fetched samples rows");
            rows
        }
        Err(e) => {
            tracing::error!(code=%code, error=?e, "Failed to fetch samples");
            vec![]
        }
    };

    let samples: Vec<SampleComplete> = samples_rows
        .into_iter()
        .map(|row| {
            let att_wl: Option<f64> = row.try_get("att_wl").ok();
            let att_wp: Option<f64> = row.try_get("att_wp").ok();
            let att_ip: Option<f64> = row.try_get("att_ip").ok();
            let vbs_val: Option<f64> = row.try_get("vbs_val").ok();
            let phys_densite: Option<f64> = row.try_get("phys_densite").ok();
            let phys_teneur_eau: Option<f64> = row.try_get("phys_teneur_eau").ok();
            let classif_systeme: Option<String> = row.try_get("classif_systeme").ok();
            let classif_classe: Option<String> = row.try_get("classif_classe").ok();
            let has_proctor: bool = row.try_get("has_proctor").unwrap_or(false);
            let has_granulo: bool = row.try_get("has_granulo").unwrap_or(false);
            let has_gonflement: bool = row.try_get("has_gonflement").unwrap_or(false);

            let atterberg = if att_wl.is_some() || att_wp.is_some() {
                Some(serde_json::json!({
                    "wl": att_wl,
                    "wp": att_wp,
                    "ip": att_ip
                }))
            } else {
                None
            };

            let vbs = vbs_val.map(|v| serde_json::json!({ "vbs": v }));

            let physiques = if phys_densite.is_some() || phys_teneur_eau.is_some() {
                Some(Physiques {
                    densite_absolue_gcm3: phys_densite,
                    teneur_eau_pct: phys_teneur_eau,
                    source: None,
                })
            } else {
                None
            };

            let classif = if classif_systeme.is_some() || classif_classe.is_some() {
                let item = ClassifItem {
                    class: classif_classe.unwrap_or_default(),
                    reason: None,
                };
                let mut c = Classif {
                    aashto: None,
                    uscs: None,
                    gtr: None,
                };
                match classif_systeme.as_deref() {
                    Some("GTR") => c.gtr = Some(vec![item]),
                    Some("USCS") => c.uscs = Some(vec![item]),
                    Some("AASHTO") => c.aashto = Some(vec![item]),
                    _ => c.gtr = Some(vec![item]), // default
                }
                Some(c)
            } else {
                None
            };

            // Flags pour proctor/granulo/gonflement (présence d'essai)
            let proctor = if has_proctor { Some(serde_json::json!({"present": true})) } else { None };
            let granulo = if has_granulo { Some(serde_json::json!({"present": true})) } else { None };
            let swelling = if has_gonflement { Some(serde_json::json!({"present": true})) } else { None };

            SampleComplete {
                id: row.try_get("id").unwrap(),
                depth_m: row.try_get("depth_m").unwrap_or(0.0),
                atterberg,
                vbs,
                physiques,
                granulo,
                proctor,
                swelling,
                classif,
            }
        })
        .collect();

    // 4) Sondages (avec badge ADM random cell) - jointure spatiale
    let survey_rows = sqlx::query(
        r#"
        SELECT 
          s.id,
          s.code AS code_site,
          s.location_mode AS mode,
          s.date::text AS date_str,
          a3.adm3_fr AS adm3_name,
          COUNT(DISTINCT e.id)::bigint AS samples,
          (
            SELECT COUNT(DISTINCT ea.echantillon_id) FROM echantillons e2
            JOIN essais_atterberg ea ON ea.echantillon_id = e2.id
            WHERE e2.sondage_id = s.id
          ) + (
            SELECT COUNT(DISTINCT ev.echantillon_id) FROM echantillons e2
            JOIN essais_vbs ev ON ev.echantillon_id = e2.id
            WHERE e2.sondage_id = s.id
          ) + (
            SELECT COUNT(DISTINCT ec.echantillon_id) FROM echantillons e2
            JOIN essais_classif ec ON ec.echantillon_id = e2.id
            WHERE e2.sondage_id = s.id
          ) + (
            SELECT COALESCE(COUNT(DISTINCT ep.echantillon_id), 0) FROM echantillons e2
            JOIN essais_proctor ep ON ep.echantillon_id = e2.id
            WHERE e2.sondage_id = s.id
          ) + (
            SELECT COALESCE(COUNT(DISTINCT gp.echantillon_id), 0) FROM echantillons e2
            JOIN granulo_points gp ON gp.echantillon_id = e2.id
            WHERE e2.sondage_id = s.id
          ) + (
            SELECT COALESCE(COUNT(DISTINCT epg.echantillon_id), 0) FROM echantillons e2
            JOIN essais_potentiel_gonflement epg ON epg.echantillon_id = e2.id
            WHERE e2.sondage_id = s.id
          ) AS tests
        FROM mailles m
        JOIN sondages s ON st_contains(m.geom, st_transform(s.geom, 25231)) AND s.deleted_at IS NULL AND s.geom IS NOT NULL
        LEFT JOIN echantillons e ON e.sondage_id = s.id
        LEFT JOIN adm3 a3 ON a3.gid = s.adm3_id
        WHERE m.code = $1
        GROUP BY s.id, s.code, s.location_mode, s.date, a3.adm3_fr
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await;

    let survey_rows = match survey_rows {
        Ok(rows) => {
            tracing::debug!(code=%code, count=rows.len(), "Fetched survey rows");
            rows
        }
        Err(e) => {
            tracing::error!(code=%code, error=?e, "Failed to fetch surveys");
            vec![]
        }
    };

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
                date: row.try_get("date_str").ok(),
                adm3_code: row.try_get("adm3_name").ok(),
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
