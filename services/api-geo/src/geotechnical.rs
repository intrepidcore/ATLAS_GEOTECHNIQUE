// Module géotechnique enrichi - v1.4.0
// Gestion des essais, classifications et données géotechniques complètes

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{types::Uuid, Row};
use std::str::FromStr;
use crate::state::AppState;
use crate::surveys::validate_togo_bounds;

// ============================================================================
// DTOs enrichis pour saisie géotechnique complète
// ============================================================================

#[derive(Deserialize, Debug)]
pub struct NewSurveyGeotechRequest {
    pub survey: SurveyGeotechMetadata,
    pub location: Option<LocationInput>,
    pub commune_id: Option<String>,
    pub use_commune_centroid: Option<bool>,
    pub essais_par_profondeur: Vec<EssaisProfondeur>,
    pub classifications_par_profondeur: Option<Vec<ClassificationsProfondeur>>,
    #[allow(dead_code)]
    pub snap_to_grid: Option<bool>,
}

#[derive(Deserialize, Debug)]
pub struct LocationInput {
    pub lon: f64,
    pub lat: f64,
}

#[derive(Deserialize, Debug)]
pub struct SurveyGeotechMetadata {
    pub code: Option<String>,
    pub date: Option<String>,
    pub source: Option<String>,
    pub operator: Option<String>,
    pub notes: Option<String>,
    pub type_sol: Option<String>, // Type de sol (ENUM)
}

#[derive(Deserialize, Debug)]
pub struct EssaisProfondeur {
    pub profondeur_m: f64,
    pub mesures: Vec<MesureInput>,
}

#[derive(Deserialize, Debug)]
pub struct MesureInput {
    #[serde(rename = "type")]
    pub type_essai: String,
    pub valeur_numerique: Option<f64>,
    pub valeur_qualitative: Option<String>,
    pub unit: Option<String>,
    pub meta: Option<serde_json::Value>, // Pour granulométrie: {"sieve_mm": 0.08}
}

#[derive(Deserialize, Debug)]
pub struct ClassificationsProfondeur {
    pub profondeur_m: f64,
    pub analyses: Vec<ClassificationInput>,
}

#[derive(Deserialize, Debug)]
pub struct ClassificationInput {
    pub methode: String,
    pub resultat: String,
    pub notes: Option<String>,
}

#[derive(Serialize)]
pub struct CreateSurveyGeotechResponse {
    pub sondage_id: String,
    pub code: String,
    pub maille_code: Option<String>,
    pub location_accuracy: String,
    pub n_essais: usize,
    pub n_classifications: usize,
}

// DTOs pour lecture
#[derive(Serialize)]
pub struct SurveyGeotechDetail {
    pub id: String,
    pub code: String,
    pub type_sol: Option<String>,
    pub location: Option<LocationOutput>,
    pub location_accuracy: String,
    pub date: Option<String>,
    pub source: Option<String>,
    pub operator: Option<String>,
    pub notes: Option<String>,
    pub essais: Vec<EssaiOutput>,
    pub classifications: Vec<ClassificationOutput>,
}

#[derive(Serialize)]
pub struct LocationOutput {
    pub lon: f64,
    pub lat: f64,
    pub maille_code: Option<String>,
    pub adm1_name: Option<String>,
    pub adm2_name: Option<String>,
    pub adm3_name: Option<String>,
}

#[derive(Serialize)]
pub struct EssaiOutput {
    pub id: String,
    pub profondeur_m: f64,
    pub type_essai: String,
    pub valeur_numerique: Option<f64>,
    pub valeur_qualitative: Option<String>,
    pub unit: Option<String>,
    pub meta: Option<serde_json::Value>,
}

#[derive(Serialize)]
pub struct ClassificationOutput {
    pub id: String,
    pub profondeur_m: f64,
    pub methode: String,
    pub resultat: String,
    pub notes: Option<String>,
}

// ============================================================================
// Validation
// ============================================================================

fn validate_type_sol(type_sol: &str) -> Result<(), String> {
    let valid = [
        "Vertisols et Paravertisols",
        "Ferrugineux Tropicaux et Pseudogley",
        "Hydromorphes",
        "Faiblement Ferralitique",
        "Ferralitique Typique ou Modaux",
        "Ferrugineux Tropicaux Lessivés",
        "Autre"
    ];
    
    if valid.contains(&type_sol) {
        Ok(())
    } else {
        Err(format!("Type de sol invalide: {}", type_sol))
    }
}

fn validate_methode_classification(methode: &str) -> Result<(), String> {
    let valid = [
        "CHASSAGNEUX D. et al. ;1996",
        "Dakshanamurthy et Raman (1973)",
        "SEED H. (1962)",
        "VIJAYVERGIYA et GHAZZALY 1973",
        "Williams et Donaldson (1980)",
        "Chen (1988)",
        "Autre"
    ];
    
    if valid.contains(&methode) {
        Ok(())
    } else {
        Err(format!("Méthode de classification invalide: {}", methode))
    }
}

fn validate_analyse_qualitative(valeur: &str) -> Result<(), String> {
    let valid = [
        "Faible", "Moyen", "Moyenne", "Fort", "Forte", "Très forte",
        "Elevé", "Très élevé", "Non gonflant", "Gonflant",
        "Peu gonflant", "Moyennement gonflant", "Très gonflant"
    ];
    
    if valid.contains(&valeur) {
        Ok(())
    } else {
        Err(format!("Valeur qualitative invalide: {}", valeur))
    }
}

fn get_default_unit(type_essai: &str) -> &'static str {
    match type_essai {
        "Granulometrie" => "%",
        "BleuMethylene_VBS" => "g/100g",
        "Atterberg_WL" | "Atterberg_WP" | "Atterberg_IP" => "%",
        "PotentielGonflement_eg" => "%",
        _ => ""
    }
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /surveys/geotech - Création complète avec essais + classifications
pub async fn create_survey_geotech(
    State(state): State<AppState>,
    Json(payload): Json<NewSurveyGeotechRequest>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    // Validation: au moins 1 essai
    if payload.essais_par_profondeur.is_empty() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({"error": "Au moins 1 profondeur avec essais requise"}))
        ).into_response();
    }
    
    // Validation type_sol
    if let Some(ref type_sol) = payload.survey.type_sol {
        if let Err(e) = validate_type_sol(type_sol) {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(serde_json::json!({"error": e}))
            ).into_response();
        }
    }
    
    // Validation classifications
    if let Some(ref classifs) = payload.classifications_par_profondeur {
        for classif_prof in classifs {
            for analyse in &classif_prof.analyses {
                if let Err(e) = validate_methode_classification(&analyse.methode) {
                    return (
                        StatusCode::UNPROCESSABLE_ENTITY,
                        Json(serde_json::json!({"error": e}))
                    ).into_response();
                }
                if let Err(e) = validate_analyse_qualitative(&analyse.resultat) {
                    return (
                        StatusCode::UNPROCESSABLE_ENTITY,
                        Json(serde_json::json!({"error": e}))
                    ).into_response();
                }
            }
        }
    }
    
    // Validation valeurs qualitatives dans essais
    for essai_prof in &payload.essais_par_profondeur {
        for mesure in &essai_prof.mesures {
            if let Some(ref val_qual) = mesure.valeur_qualitative {
                if let Err(e) = validate_analyse_qualitative(val_qual) {
                    return (
                        StatusCode::UNPROCESSABLE_ENTITY,
                        Json(serde_json::json!({"error": e}))
                    ).into_response();
                }
            }
            // Au moins une valeur (numérique ou qualitative)
            if mesure.valeur_numerique.is_none() && mesure.valeur_qualitative.is_none() {
                return (
                    StatusCode::UNPROCESSABLE_ENTITY,
                    Json(serde_json::json!({"error": "Chaque mesure doit avoir valeur_numerique ou valeur_qualitative"}))
                ).into_response();
            }
        }
    }
    
    // Déterminer localisation
    let (geom_expr, location_accuracy, is_geocoded) = if let Some(loc) = &payload.location {
        if let Err(e) = validate_togo_bounds(loc.lon, loc.lat) {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(serde_json::json!({"error": e}))
            ).into_response();
        }
        
        let expr = format!("ST_Transform(ST_SetSRID(ST_MakePoint({}, {}), 4326), 25231)", loc.lon, loc.lat);
        (Some(expr), "exact".to_string(), true)
        
    } else if payload.use_commune_centroid.unwrap_or(false) && payload.commune_id.is_some() {
        let commune_id = payload.commune_id.as_ref().unwrap();
        let adm_level = if commune_id.starts_with("ADM3-") {
            "ADM3"
        } else if commune_id.starts_with("ADM2-") {
            "ADM2"
        } else {
            "ADM1"
        };
        
        let table = format!("{}_tg", adm_level.to_lowercase());
        let name_query = format!("SELECT name FROM {} WHERE code = $1 LIMIT 1", table);
        let name_result: Result<Option<String>, _> = sqlx::query_scalar(&name_query)
            .bind(commune_id)
            .fetch_optional(pool)
            .await;
        
        match name_result {
            Ok(Some(name)) => {
                let expr = format!("place_at_centroid('{}', '{}')", adm_level, name.replace("'", "''"));
                let accuracy = format!("centroid_{}", adm_level.to_lowercase());
                (Some(expr), accuracy, true)
            }
            Ok(None) => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({"error": format!("Zone ADM {} introuvable", commune_id)}))
                ).into_response();
            }
            Err(e) => {
                tracing::error!(?e, "commune lookup error");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Database error"}))
                ).into_response();
            }
        }
    } else {
        (None, "unknown".to_string(), false)
    };
    
    // Transaction
    let mut tx = match pool.begin().await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!(?e, "begin transaction");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Transaction error"}))
            ).into_response();
        }
    };
    
    // Créer sondage
    let sondage_id = Uuid::new_v4();
    let code = payload.survey.code.clone()
        .unwrap_or_else(|| format!("S-{}", &sondage_id.to_string()[..8]));
    
    let date_opt = payload.survey.date.as_ref()
        .filter(|d| !d.is_empty())
        .map(|d| d.as_str());
    
    let insert_query = if let Some(geom) = geom_expr {
        format!(
            r#"
            INSERT INTO sondages (
                id, code, geom, location_accuracy, is_geocoded,
                type_sol, date, source, operator, notes, created_at
            )
            VALUES (
                $1, $2, {}, $3, $4,
                $5::type_sol_enum, $6::date, $7, $8, $9, now()
            )
            "#,
            geom
        )
    } else {
        r#"
        INSERT INTO sondages (
            id, code, geom, location_accuracy, is_geocoded,
            type_sol, date, source, operator, notes, created_at
        )
        VALUES (
            $1, $2, NULL, $3, $4,
            $5::type_sol_enum, $6::date, $7, $8, $9, now()
        )
        "#.to_string()
    };
    
    let insert_result = sqlx::query(&insert_query)
        .bind(sondage_id)
        .bind(&code)
        .bind(&location_accuracy)
        .bind(is_geocoded)
        .bind(&payload.survey.type_sol)
        .bind(date_opt)
        .bind(&payload.survey.source)
        .bind(&payload.survey.operator)
        .bind(&payload.survey.notes)
        .execute(&mut *tx)
        .await;
    
    if let Err(e) = insert_result {
        tracing::error!(?e, "insert sondage");
        let _ = tx.rollback().await;
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("Insert sondage error: {:?}", e)}))
        ).into_response();
    }
    
    // Insérer essais
    let mut essais_count = 0;
    for essai_prof in &payload.essais_par_profondeur {
        let profondeur_bd = sqlx::types::BigDecimal::from_str(&essai_prof.profondeur_m.to_string()).unwrap();
        
        for mesure in &essai_prof.mesures {
            let essai_id = Uuid::new_v4();
            let unit = mesure.unit.as_deref().unwrap_or_else(|| get_default_unit(&mesure.type_essai));
            
            let valeur_num_bd = mesure.valeur_numerique
                .map(|v| sqlx::types::BigDecimal::from_str(&v.to_string()).unwrap());
            
            // Gérer meta JSON (pour granulométrie notamment)
            let meta_json = if let Some(ref meta) = mesure.meta {
                meta.clone()
            } else if mesure.type_essai == "Granulometrie" {
                serde_json::json!({"sieve_mm": 0.08})
            } else {
                serde_json::json!({})
            };
            
            let essai_result = sqlx::query(
                r#"
                INSERT INTO essais (
                    id, sondage_id, depth_m, type_essai, 
                    valeur_numerique, valeur_qualitative, unit, meta, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6::analyse_qualitative_enum, $7, $8, now())
                "#
            )
            .bind(essai_id)
            .bind(sondage_id)
            .bind(&profondeur_bd)
            .bind(&mesure.type_essai)
            .bind(valeur_num_bd)
            .bind(&mesure.valeur_qualitative)
            .bind(unit)
            .bind(&meta_json)
            .execute(&mut *tx)
            .await;
            
            if let Err(e) = essai_result {
                tracing::error!(?e, "insert essai");
                let _ = tx.rollback().await;
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": format!("Insert essai error: {:?}", e)}))
                ).into_response();
            }
            
            essais_count += 1;
        }
    }
    
    // Insérer classifications
    let mut classif_count = 0;
    if let Some(ref classifs) = payload.classifications_par_profondeur {
        for classif_prof in classifs {
            let profondeur_bd = sqlx::types::BigDecimal::from_str(&classif_prof.profondeur_m.to_string()).unwrap();
            
            for analyse in &classif_prof.analyses {
                let classif_id = Uuid::new_v4();
                
                let classif_result = sqlx::query(
                    r#"
                    INSERT INTO classifications (
                        id, sondage_id, profondeur_m, methode, resultat, notes, created_at
                    )
                    VALUES ($1, $2, $3, $4::methode_classification_enum, $5::analyse_qualitative_enum, $6, now())
                    "#
                )
                .bind(classif_id)
                .bind(sondage_id)
                .bind(&profondeur_bd)
                .bind(&analyse.methode)
                .bind(&analyse.resultat)
                .bind(&analyse.notes)
                .execute(&mut *tx)
                .await;
                
                if let Err(e) = classif_result {
                    tracing::error!(?e, "insert classification");
                    let _ = tx.rollback().await;
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({"error": format!("Insert classification error: {:?}", e)}))
                    ).into_response();
                }
                
                classif_count += 1;
            }
        }
    }
    
    // Récupérer maille_code
    let maille_code: Option<String> = sqlx::query_scalar(
        "SELECT maille_code FROM sondages WHERE id = $1"
    )
    .bind(sondage_id)
    .fetch_one(&mut *tx)
    .await
    .ok();
    
    // Audit log
    let _ = sqlx::query(
        "INSERT INTO audit_log (action, entity, entity_id, payload) VALUES ($1, $2, $3, $4)"
    )
    .bind("CREATE_GEOTECH")
    .bind("sondage")
    .bind(sondage_id)
    .bind(serde_json::json!({
        "code": code,
        "type_sol": payload.survey.type_sol,
        "n_essais": essais_count,
        "n_classifications": classif_count
    }))
    .execute(&mut *tx)
    .await;
    
    // Commit
    if let Err(e) = tx.commit().await {
        tracing::error!(?e, "commit");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Commit error"}))
        ).into_response();
    }
    
    Json(CreateSurveyGeotechResponse {
        sondage_id: sondage_id.to_string(),
        code,
        maille_code,
        location_accuracy,
        n_essais: essais_count,
        n_classifications: classif_count,
    }).into_response()
}

/// GET /surveys/:id/geotech - Récupérer détails complets
pub async fn get_survey_geotech(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let uuid = match Uuid::parse_str(&id) {
        Ok(u) => u,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid UUID"}))).into_response(),
    };
    
    // Récupérer sondage
    let sondage_row = sqlx::query(
        r#"
        SELECT 
            id::text, code, type_sol::text,
            ST_X(ST_Transform(geom, 4326)) as lon,
            ST_Y(ST_Transform(geom, 4326)) as lat,
            maille_code, adm1_name, adm2_name, adm3_name,
            location_accuracy, date, source, operator, notes
        FROM sondages
        WHERE id = $1 AND deleted_at IS NULL
        "#
    )
    .bind(uuid)
    .fetch_optional(pool)
    .await;
    
    let sondage = match sondage_row {
        Ok(Some(row)) => row,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Survey not found"}))).into_response(),
        Err(e) => {
            tracing::error!(?e, "get sondage error");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))).into_response();
        }
    };
    
    let code: String = sondage.try_get("code").unwrap_or_default();
    let type_sol: Option<String> = sondage.try_get("type_sol").ok();
    let lon: Option<f64> = sondage.try_get("lon").ok();
    let lat: Option<f64> = sondage.try_get("lat").ok();
    let maille_code: Option<String> = sondage.try_get("maille_code").ok();
    let adm1: Option<String> = sondage.try_get("adm1_name").ok();
    let adm2: Option<String> = sondage.try_get("adm2_name").ok();
    let adm3: Option<String> = sondage.try_get("adm3_name").ok();
    let location_accuracy: String = sondage.try_get("location_accuracy").unwrap_or_else(|_| "exact".to_string());
    let date: Option<String> = sondage.try_get::<Option<time::Date>, _>("date").ok().flatten().map(|d| d.to_string());
    let source: Option<String> = sondage.try_get("source").ok();
    let operator: Option<String> = sondage.try_get("operator").ok();
    let notes: Option<String> = sondage.try_get("notes").ok();
    
    let location = if let (Some(lon_val), Some(lat_val)) = (lon, lat) {
        Some(LocationOutput {
            lon: lon_val,
            lat: lat_val,
            maille_code,
            adm1_name: adm1,
            adm2_name: adm2,
            adm3_name: adm3,
        })
    } else {
        None
    };
    
    // Récupérer essais
    let essais_rows = sqlx::query(
        r#"
        SELECT 
            id::text, depth_m, type_essai, 
            valeur_numerique, valeur_qualitative::text, unit, meta
        FROM essais
        WHERE sondage_id = $1 AND deleted_at IS NULL
        ORDER BY depth_m, type_essai
        "#
    )
    .bind(uuid)
    .fetch_all(pool)
    .await;
    
    let essais: Vec<EssaiOutput> = match essais_rows {
        Ok(rows) => rows.iter().map(|r| {
            let depth_bd: Option<sqlx::types::BigDecimal> = r.try_get("depth_m").ok();
            let val_num_bd: Option<sqlx::types::BigDecimal> = r.try_get("valeur_numerique").ok().flatten();
            
            EssaiOutput {
                id: r.try_get("id").unwrap_or_default(),
                profondeur_m: depth_bd.and_then(|v| v.to_string().parse().ok()).unwrap_or(0.0),
                type_essai: r.try_get("type_essai").unwrap_or_default(),
                valeur_numerique: val_num_bd.and_then(|v| v.to_string().parse().ok()),
                valeur_qualitative: r.try_get("valeur_qualitative").ok(),
                unit: r.try_get("unit").ok(),
                meta: r.try_get("meta").ok(),
            }
        }).collect(),
        Err(e) => {
            tracing::error!(?e, "get essais error");
            Vec::new()
        }
    };
    
    // Récupérer classifications
    let classif_rows = sqlx::query(
        r#"
        SELECT 
            id::text, profondeur_m, methode::text, resultat::text, notes
        FROM classifications
        WHERE sondage_id = $1 AND deleted_at IS NULL
        ORDER BY profondeur_m, methode
        "#
    )
    .bind(uuid)
    .fetch_all(pool)
    .await;
    
    let classifications: Vec<ClassificationOutput> = match classif_rows {
        Ok(rows) => rows.iter().map(|r| {
            let prof_bd: Option<sqlx::types::BigDecimal> = r.try_get("profondeur_m").ok();
            
            ClassificationOutput {
                id: r.try_get("id").unwrap_or_default(),
                profondeur_m: prof_bd.and_then(|v| v.to_string().parse().ok()).unwrap_or(0.0),
                methode: r.try_get("methode").unwrap_or_default(),
                resultat: r.try_get("resultat").unwrap_or_default(),
                notes: r.try_get("notes").ok(),
            }
        }).collect(),
        Err(e) => {
            tracing::error!(?e, "get classifications error");
            Vec::new()
        }
    };
    
    Json(SurveyGeotechDetail {
        id: id.clone(),
        code,
        type_sol,
        location,
        location_accuracy,
        date,
        source,
        operator,
        notes,
        essais,
        classifications,
    }).into_response()
}

/// GET /classifications/:sondage_id - Liste classifications pour un sondage
pub async fn list_classifications(
    Path(sondage_id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let uuid = match Uuid::parse_str(&sondage_id) {
        Ok(u) => u,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid UUID"}))).into_response(),
    };
    
    let rows = sqlx::query(
        r#"
        SELECT 
            id::text, profondeur_m, methode::text, resultat::text, notes, created_at
        FROM classifications
        WHERE sondage_id = $1 AND deleted_at IS NULL
        ORDER BY profondeur_m, methode
        "#
    )
    .bind(uuid)
    .fetch_all(pool)
    .await;
    
    match rows {
        Ok(rows) => {
            let classifications: Vec<serde_json::Value> = rows.iter().map(|r| {
                let prof_bd: Option<sqlx::types::BigDecimal> = r.try_get("profondeur_m").ok();
                let created: Option<time::OffsetDateTime> = r.try_get("created_at").ok();
                
                serde_json::json!({
                    "id": r.try_get::<String, _>("id").ok(),
                    "profondeur_m": prof_bd.and_then(|v| v.to_string().parse::<f64>().ok()),
                    "methode": r.try_get::<String, _>("methode").ok(),
                    "resultat": r.try_get::<String, _>("resultat").ok(),
                    "notes": r.try_get::<Option<String>, _>("notes").ok().flatten(),
                    "created_at": created.map(|t| t.format(&time::format_description::well_known::Rfc3339).unwrap())
                })
            }).collect();
            
            Json(classifications).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "list classifications error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))).into_response()
        }
    }
}
