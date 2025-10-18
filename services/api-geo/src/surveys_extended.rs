// Extended survey handlers for v1.2.0
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use sqlx::types::Uuid;
use std::str::FromStr;
use crate::state::AppState;
use crate::surveys::{
    NewSurveyRequest, CreateSurveyResponse, GeocodeRequest,
    validate_togo_bounds, validate_test, get_test_unit
};

/// POST /surveys/v2 - Version complète avec transaction atomique
pub async fn create_survey_v2(
    State(state): State<AppState>,
    Json(payload): Json<NewSurveyRequest>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    // Validation: au moins 1 essai
    if payload.tests.is_empty() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({"error": "Au moins 1 essai requis"}))
        ).into_response();
    }
    
    // Validation des essais
    for test in &payload.tests {
        if let Err(e) = validate_test(test) {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(serde_json::json!({"error": e}))
            ).into_response();
        }
    }
    
    // Déterminer le mode de localisation
    let (geom_expr, location_accuracy, is_geocoded) = if let Some(loc) = &payload.location {
        // Mode exact
        if let Err(e) = validate_togo_bounds(loc.lon, loc.lat) {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(serde_json::json!({"error": e}))
            ).into_response();
        }
        
        let expr = format!("ST_Transform(ST_SetSRID(ST_MakePoint({}, {}), 4326), 25231)", loc.lon, loc.lat);
        (Some(expr), "exact".to_string(), true)
        
    } else if payload.use_commune_centroid.unwrap_or(false) && payload.commune_id.is_some() {
        // Mode centroid
        let commune_id = payload.commune_id.as_ref().unwrap();
        let adm_level = if commune_id.starts_with("ADM3-") {
            "ADM3"
        } else if commune_id.starts_with("ADM2-") {
            "ADM2"
        } else {
            "ADM1"
        };
        
        // Récupérer le nom
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
        // Mode unknown
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
    
    // Convertir date vide en None
    let date_opt = payload.survey.date.as_ref()
        .filter(|d| !d.is_empty())
        .map(|d| d.as_str());
    
    let insert_query = if let Some(geom) = geom_expr {
        format!(
            r#"
            INSERT INTO sondages (
                id, code, geom, location_accuracy, is_geocoded,
                date, source, operator, notes, created_at
            )
            VALUES (
                $1, $2, {}, $3, $4,
                $5::date, $6, $7, $8, now()
            )
            "#,
            geom
        )
    } else {
        r#"
        INSERT INTO sondages (
            id, code, geom, location_accuracy, is_geocoded,
            date, source, operator, notes, created_at
        )
        VALUES (
            $1, $2, NULL, $3, $4,
            $5::date, $6, $7, $8, now()
        )
        "#.to_string()
    };
    
    let insert_result = sqlx::query(&insert_query)
        .bind(sondage_id)
        .bind(&code)
        .bind(&location_accuracy)
        .bind(is_geocoded)
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
            Json(serde_json::json!({"error": format!("Insert error: {:?}", e)}))
        ).into_response();
    }
    
    // Insérer essais
    for test in &payload.tests {
        let test_id = Uuid::new_v4();
        let unit = get_test_unit(&test.test_type);
        let value_bd = sqlx::types::BigDecimal::from_str(&test.value.to_string()).unwrap();
        let depth_bd = sqlx::types::BigDecimal::from_str(&test.depth_m.to_string()).unwrap();
        
        let test_result = sqlx::query(
            r#"
            INSERT INTO essais (id, sondage_id, type_essai, valeur_numerique, unit, depth_m, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, now())
            "#
        )
        .bind(test_id)
        .bind(sondage_id)
        .bind(&test.test_type)
        .bind(value_bd)
        .bind(unit)
        .bind(depth_bd)
        .execute(&mut *tx)
        .await;
        
        if let Err(e) = test_result {
            tracing::error!(?e, "insert essai");
            let _ = tx.rollback().await;
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Insert test error: {:?}", e)}))
            ).into_response();
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
        "INSERT INTO audit_log (action, entity, entity_id, payload, location_mode) VALUES ($1, $2, $3, $4, $5)"
    )
    .bind("CREATE")
    .bind("sondage")
    .bind(sondage_id)
    .bind(serde_json::json!({
        "code": code,
        "location_accuracy": location_accuracy,
        "tests_count": payload.tests.len()
    }))
    .bind(&location_accuracy)
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
    
    Json(CreateSurveyResponse {
        sondage_id: sondage_id.to_string(),
        maille_code,
        essais_count: payload.tests.len(),
        location_accuracy,
    }).into_response()
}

/// POST /surveys/:id/geocode
pub async fn geocode_survey(
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<GeocodeRequest>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let uuid = match Uuid::parse_str(&id) {
        Ok(u) => u,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid UUID"}))).into_response(),
    };
    
    // Déterminer le mode
    let (geom_update, location_accuracy) = if let (Some(lon), Some(lat)) = (payload.lon, payload.lat) {
        // Mode exact
        if let Err(e) = validate_togo_bounds(lon, lat) {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(serde_json::json!({"error": e}))
            ).into_response();
        }
        
        let expr = format!("ST_Transform(ST_SetSRID(ST_MakePoint({}, {}), 4326), 25231)", lon, lat);
        (expr, "exact".to_string())
        
    } else if let (Some(mode), Some(level), Some(name)) = (&payload.location_mode, &payload.adm_level, &payload.adm_name) {
        // Mode centroid ou random
        let func = if mode == "centroid" { "place_at_centroid" } else { "place_random_in_adm" };
        let accuracy = format!("{}_{}", mode, level.to_lowercase());
        
        let expr = if mode == "random" {
            format!("{}('{}', '{}', '{}')", func, level, name.replace("'", "''"), uuid.to_string())
        } else {
            format!("{}('{}', '{}')", func, level, name.replace("'", "''"))
        };
        
        (expr, accuracy)
    } else {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "lon/lat ou location_mode+adm_level+adm_name requis"}))
        ).into_response();
    };
    
    // Update
    let query = format!(
        r#"
        UPDATE sondages 
        SET geom = {}, 
            location_accuracy = $1, 
            is_geocoded = TRUE,
            updated_at = now()
        WHERE id = $2 AND deleted_at IS NULL
        RETURNING maille_code
        "#,
        geom_update
    );
    
    let result: Result<Option<String>, _> = sqlx::query_scalar(&query)
        .bind(&location_accuracy)
        .bind(uuid)
        .fetch_optional(pool)
        .await;
    
    match result {
        Ok(Some(maille_code)) => {
            let _ = sqlx::query("INSERT INTO audit_log (action, entity, entity_id, location_mode) VALUES ($1, $2, $3, $4)")
                .bind("GEOCODE")
                .bind("sondage")
                .bind(uuid)
                .bind(&location_accuracy)
                .execute(pool)
                .await;
            
            Json(serde_json::json!({
                "success": true,
                "maille_code": maille_code,
                "location_accuracy": location_accuracy
            })).into_response()
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Survey not found"}))).into_response(),
        Err(e) => {
            tracing::error!(?e, "geocode error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": format!("{:?}", e)}))).into_response()
        }
    }
}
