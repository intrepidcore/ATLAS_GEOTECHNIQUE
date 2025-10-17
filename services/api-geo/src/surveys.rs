use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{types::Uuid, Row};
use num_traits::ToPrimitive;
use std::str::FromStr;
use crate::state::AppState;

// ============================================================================
// DTOs
// ============================================================================

#[derive(Deserialize)]
pub struct NewSurvey {
    pub code: Option<String>,
    pub lon: Option<f64>,
    pub lat: Option<f64>,
    pub srid: Option<i32>,
    pub depth_m_min: Option<f64>,
    pub depth_m_max: Option<f64>,
    pub comment: Option<String>,
    pub location_mode: Option<String>, // "exact", "centroid", "random", "unknown"
    pub adm_level: Option<String>,     // "ADM1", "ADM2", "ADM3"
    pub adm_name: Option<String>,
    pub date: Option<String>,
    pub source: Option<String>,
    pub operator: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize)]
pub struct AdmZone {
    pub name: String,
    pub code: Option<String>,
    pub bbox: Option<Vec<f64>>,
}

#[derive(Serialize)]
pub struct Survey {
    pub id: String,
    pub code: String,
    pub lon: f64,
    pub lat: f64,
    pub depth_m_min: Option<f64>,
    pub depth_m_max: Option<f64>,
    pub maille_code: Option<String>,
    pub adm1_name: Option<String>,
    pub adm2_name: Option<String>,
    pub adm3_name: Option<String>,
    pub comment: Option<String>,
    pub n_essais: i64,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct NewTest {
    pub sondage_id: String,
    pub test_type: String,
    pub value: f64,
    pub unit: String,
    pub depth_m: f64,
}

#[derive(Serialize)]
pub struct Test {
    pub id: String,
    pub sondage_id: String,
    pub test_type: String,
    pub value: f64,
    pub unit: String,
    pub depth_m: f64,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct LocateQuery {
    pub lon: f64,
    pub lat: f64,
}

#[derive(Serialize)]
pub struct LocateResponse {
    pub code: String,
    pub adm1_name: Option<String>,
    pub adm2_name: Option<String>,
    pub adm3_name: Option<String>,
}

#[derive(Deserialize)]
pub struct ListSurveysQuery {
    pub bbox: Option<String>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /grid/locate?lon=...&lat=...
pub async fn locate_maille(
    Query(q): Query<LocateQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let result = sqlx::query(
        r#"
        SELECT code, adm1_name, adm2_name, adm3_name
        FROM mailles
        WHERE ST_Contains(
            geom,
            ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 25231)
        )
        LIMIT 1
        "#
    )
    .bind(q.lon)
    .bind(q.lat)
    .fetch_optional(pool)
    .await;
    
    match result {
        Ok(Some(row)) => {
            let code: String = row.try_get("code").unwrap_or_default();
            let adm1: Option<String> = row.try_get("adm1_name").ok();
            let adm2: Option<String> = row.try_get("adm2_name").ok();
            let adm3: Option<String> = row.try_get("adm3_name").ok();
            
            Json(LocateResponse {
                code,
                adm1_name: adm1,
                adm2_name: adm2,
                adm3_name: adm3,
            }).into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Point outside grid"}))
        ).into_response(),
        Err(e) => {
            tracing::error!(?e, "locate_maille error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))).into_response()
        }
    }
}

/// POST /surveys
pub async fn create_survey(
    State(state): State<AppState>,
    Json(payload): Json<NewSurvey>,
) -> impl IntoResponse {
    let pool = &state.pool;
    let srid = payload.srid.unwrap_or(4326);
    
    if let (Some(min), Some(max)) = (payload.depth_m_min, payload.depth_m_max) {
        if min > max {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "depth_m_min must be <= depth_m_max"}))
            ).into_response();
        }
    }
    
    let id = Uuid::new_v4();
    let depth_min_bd = payload.depth_m_min.map(|v| sqlx::types::BigDecimal::from_str(&v.to_string()).unwrap());
    let depth_max_bd = payload.depth_m_max.map(|v| sqlx::types::BigDecimal::from_str(&v.to_string()).unwrap());
    
    let result = sqlx::query(
        r#"
        INSERT INTO sondages (
            id, code, geom, depth_m_min, depth_m_max, comment, source
        )
        VALUES (
            $1, $2,
            ST_Transform(ST_SetSRID(ST_MakePoint($3, $4), $5), 25231),
            $6, $7, $8, 'UI-v1.1'
        )
        RETURNING 
            code, maille_code, adm1_name, adm2_name, adm3_name,
            ST_X(ST_Transform(geom, 4326)) as lon,
            ST_Y(ST_Transform(geom, 4326)) as lat,
            created_at
        "#
    )
    .bind(id)
    .bind(&payload.code)
    .bind(payload.lon)
    .bind(payload.lat)
    .bind(srid)
    .bind(depth_min_bd)
    .bind(depth_max_bd)
    .bind(&payload.comment)
    .fetch_one(pool)
    .await;
    
    match result {
        Ok(row) => {
            let code: Option<String> = row.try_get("code").ok();
            let maille_code: Option<String> = row.try_get("maille_code").ok();
            let adm1: Option<String> = row.try_get("adm1_name").ok();
            let adm2: Option<String> = row.try_get("adm2_name").ok();
            let adm3: Option<String> = row.try_get("adm3_name").ok();
            let lon: Option<f64> = row.try_get("lon").ok();
            let lat: Option<f64> = row.try_get("lat").ok();
            let created_at: Option<time::OffsetDateTime> = row.try_get("created_at").ok();
            
            // Audit log
            let _ = sqlx::query("INSERT INTO audit_log (action, entity, entity_id, payload) VALUES ($1, $2, $3, $4)")
                .bind("CREATE")
                .bind("sondage")
                .bind(id)
                .bind(serde_json::json!({"code": code, "lon": payload.lon, "lat": payload.lat}))
                .execute(pool)
                .await;
            
            Json(Survey {
                id: id.to_string(),
                code: code.unwrap_or_else(|| id.to_string()),
                lon: lon.unwrap_or(0.0),
                lat: lat.unwrap_or(0.0),
                depth_m_min: payload.depth_m_min,
                depth_m_max: payload.depth_m_max,
                maille_code,
                adm1_name: adm1,
                adm2_name: adm2,
                adm3_name: adm3,
                comment: payload.comment,
                n_essais: 0,
                created_at: created_at.map(|t| t.format(&time::format_description::well_known::Rfc3339).unwrap()).unwrap_or_default(),
            }).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "create_survey error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": format!("{:?}", e)}))).into_response()
        }
    }
}

/// GET /surveys
pub async fn list_surveys(
    Query(q): Query<ListSurveysQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let base_query = r#"
        SELECT 
            id::text,
            code,
            ST_X(ST_Transform(geom, 4326)) as lon,
            ST_Y(ST_Transform(geom, 4326)) as lat,
            depth_m_min,
            depth_m_max,
            maille_code,
            adm1_name,
            adm2_name,
            adm3_name,
            comment,
            (SELECT COUNT(*) FROM essais WHERE sondage_id = sondages.id AND deleted_at IS NULL) as n_essais,
            created_at
        FROM sondages
        WHERE deleted_at IS NULL
    "#;
    
    let rows = if let Some(bbox_str) = q.bbox {
        let parts: Vec<f64> = bbox_str.split(',').filter_map(|s| s.parse().ok()).collect();
        if parts.len() != 4 {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid bbox format"}))).into_response();
        }
        
        let query = format!("{} AND ST_Intersects(ST_Transform(geom, 4326), ST_MakeEnvelope($1, $2, $3, $4, 4326)) ORDER BY created_at DESC", base_query);
        
        sqlx::query(&query)
            .bind(parts[0])
            .bind(parts[1])
            .bind(parts[2])
            .bind(parts[3])
            .fetch_all(pool)
            .await
    } else {
        let query = format!("{} ORDER BY created_at DESC LIMIT 1000", base_query);
        sqlx::query(&query).fetch_all(pool).await
    };
    
    match rows {
        Ok(rows) => {
            let surveys: Vec<Survey> = rows.iter().map(|r| {
                let id: Option<String> = r.try_get("id").ok();
                let code: String = r.try_get("code").unwrap_or_default();
                let lon: Option<f64> = r.try_get("lon").ok();
                let lat: Option<f64> = r.try_get("lat").ok();
                let depth_min: Option<sqlx::types::BigDecimal> = r.try_get("depth_m_min").ok().flatten();
                let depth_max: Option<sqlx::types::BigDecimal> = r.try_get("depth_m_max").ok().flatten();
                let maille: Option<String> = r.try_get("maille_code").ok();
                let adm1: Option<String> = r.try_get("adm1_name").ok();
                let adm2: Option<String> = r.try_get("adm2_name").ok();
                let adm3: Option<String> = r.try_get("adm3_name").ok();
                let comment: Option<String> = r.try_get("comment").ok();
                let n_essais: i64 = r.try_get("n_essais").unwrap_or(0);
                let created: Option<time::OffsetDateTime> = r.try_get("created_at").ok();
                
                Survey {
                    id: id.unwrap_or_default(),
                    code,
                    lon: lon.unwrap_or(0.0),
                    lat: lat.unwrap_or(0.0),
                    depth_m_min: depth_min.and_then(|v| v.to_f64()),
                    depth_m_max: depth_max.and_then(|v| v.to_f64()),
                    maille_code: maille,
                    adm1_name: adm1,
                    adm2_name: adm2,
                    adm3_name: adm3,
                    comment,
                    n_essais,
                    created_at: created.map(|t| t.format(&time::format_description::well_known::Rfc3339).unwrap()).unwrap_or_default(),
                }
            }).collect();
            
            Json(surveys).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "list_surveys error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))).into_response()
        }
    }
}

/// DELETE /surveys/:id
pub async fn delete_survey(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let uuid = match Uuid::parse_str(&id) {
        Ok(u) => u,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid UUID"}))).into_response(),
    };
    
    let result = sqlx::query("UPDATE sondages SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL")
        .bind(uuid)
        .execute(pool)
        .await;
    
    match result {
        Ok(r) if r.rows_affected() > 0 => {
            let _ = sqlx::query("INSERT INTO audit_log (action, entity, entity_id) VALUES ($1, $2, $3)")
                .bind("DELETE")
                .bind("sondage")
                .bind(uuid)
                .execute(pool)
                .await;
            
            (StatusCode::NO_CONTENT, Json(serde_json::json!({}))).into_response()
        }
        Ok(_) => (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Survey not found"}))).into_response(),
        Err(e) => {
            tracing::error!(?e, "delete_survey error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))).into_response()
        }
    }
}

/// POST /tests
pub async fn create_test(
    State(state): State<AppState>,
    Json(payload): Json<NewTest>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let sondage_id = match Uuid::parse_str(&payload.sondage_id) {
        Ok(u) => u,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid sondage_id"}))).into_response(),
    };
    
    // Validate depth bounds
    let sondage = sqlx::query("SELECT depth_m_min, depth_m_max FROM sondages WHERE id = $1 AND deleted_at IS NULL")
        .bind(sondage_id)
        .fetch_optional(pool)
        .await;
    
    match sondage {
        Ok(Some(s)) => {
            let min: Option<sqlx::types::BigDecimal> = s.try_get("depth_m_min").ok().flatten();
            let max: Option<sqlx::types::BigDecimal> = s.try_get("depth_m_max").ok().flatten();
            
            if let (Some(min_bd), Some(max_bd)) = (min, max) {
                let min_f = min_bd.to_f64().unwrap_or(0.0);
                let max_f = max_bd.to_f64().unwrap_or(999.0);
                if payload.depth_m < min_f || payload.depth_m > max_f {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({"error": format!("depth_m must be between {} and {}", min_f, max_f)}))
                    ).into_response();
                }
            }
        }
        Ok(None) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Survey not found"}))).into_response(),
        Err(e) => {
            tracing::error!(?e, "validate sondage error");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))).into_response();
        }
    }
    
    let id = Uuid::new_v4();
    let value_bd = sqlx::types::BigDecimal::from_str(&payload.value.to_string()).unwrap();
    let depth_bd = sqlx::types::BigDecimal::from_str(&payload.depth_m.to_string()).unwrap();
    
    let result = sqlx::query(
        "INSERT INTO essais (id, sondage_id, type, value, unit, depth_m) VALUES ($1, $2, $3, $4, $5, $6) RETURNING created_at"
    )
    .bind(id)
    .bind(sondage_id)
    .bind(&payload.test_type)
    .bind(value_bd)
    .bind(&payload.unit)
    .bind(depth_bd)
    .fetch_one(pool)
    .await;
    
    match result {
        Ok(row) => {
            let created: Option<time::OffsetDateTime> = row.try_get("created_at").ok();
            
            let _ = sqlx::query("INSERT INTO audit_log (action, entity, entity_id, payload) VALUES ($1, $2, $3, $4)")
                .bind("CREATE")
                .bind("essai")
                .bind(id)
                .bind(serde_json::json!({"sondage_id": payload.sondage_id, "type": payload.test_type, "depth_m": payload.depth_m}))
                .execute(pool)
                .await;
            
            Json(Test {
                id: id.to_string(),
                sondage_id: payload.sondage_id,
                test_type: payload.test_type,
                value: payload.value,
                unit: payload.unit,
                depth_m: payload.depth_m,
                created_at: created.map(|t| t.format(&time::format_description::well_known::Rfc3339).unwrap()).unwrap_or_default(),
            }).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "create_test error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": format!("{:?}", e)}))).into_response()
        }
    }
}

/// GET /surveys/:id/tests
pub async fn list_tests(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let sondage_id = match Uuid::parse_str(&id) {
        Ok(u) => u,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid UUID"}))).into_response(),
    };
    
    let rows = sqlx::query(
        "SELECT id::text, type, value, unit, depth_m, created_at FROM essais WHERE sondage_id = $1 AND deleted_at IS NULL ORDER BY depth_m ASC"
    )
    .bind(sondage_id)
    .fetch_all(pool)
    .await;
    
    match rows {
        Ok(rows) => {
            let tests: Vec<Test> = rows.iter().map(|r| {
                let test_id: Option<String> = r.try_get("id").ok();
                let test_type: String = r.try_get("type").unwrap_or_default();
                let value: Option<sqlx::types::BigDecimal> = r.try_get("value").ok().flatten();
                let unit: Option<String> = r.try_get("unit").ok();
                let depth: Option<sqlx::types::BigDecimal> = r.try_get("depth_m").ok().flatten();
                let created: Option<time::OffsetDateTime> = r.try_get("created_at").ok();
                
                Test {
                    id: test_id.unwrap_or_default(),
                    sondage_id: id.clone(),
                    test_type,
                    value: value.and_then(|v| v.to_f64()).unwrap_or(0.0),
                    unit: unit.unwrap_or_default(),
                    depth_m: depth.and_then(|v| v.to_f64()).unwrap_or(0.0),
                    created_at: created.map(|t| t.format(&time::format_description::well_known::Rfc3339).unwrap()).unwrap_or_default(),
                }
            }).collect();
            
            Json(tests).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "list_tests error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))).into_response()
        }
    }
}

/// DELETE /tests/:id
pub async fn delete_test(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let uuid = match Uuid::parse_str(&id) {
        Ok(u) => u,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid UUID"}))).into_response(),
    };
    
    let result = sqlx::query("UPDATE essais SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL")
        .bind(uuid)
        .execute(pool)
        .await;
    
    match result {
        Ok(r) if r.rows_affected() > 0 => {
            let _ = sqlx::query("INSERT INTO audit_log (action, entity, entity_id) VALUES ($1, $2, $3)")
                .bind("DELETE")
                .bind("essai")
                .bind(uuid)
                .execute(pool)
                .await;
            
            (StatusCode::NO_CONTENT, Json(serde_json::json!({}))).into_response()
        }
        Ok(_) => (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Test not found"}))).into_response(),
        Err(e) => {
            tracing::error!(?e, "delete_test error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))).into_response()
        }
    }
}

// ============================================================================
// ADM Endpoints
// ============================================================================

/// GET /adm1 - Liste des régions
pub async fn list_adm1(State(state): State<AppState>) -> impl IntoResponse {
    let pool = &state.pool;
    
    let rows = sqlx::query("SELECT DISTINCT name FROM adm1_tg ORDER BY name")
        .fetch_all(pool)
        .await;
    
    match rows {
        Ok(rows) => {
            let zones: Vec<AdmZone> = rows.iter().map(|r| {
                AdmZone {
                    name: r.try_get("name").unwrap_or_default(),
                    code: None,
                    bbox: None,
                }
            }).collect();
            Json(zones).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "list_adm1 error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))).into_response()
        }
    }
}

/// GET /adm2?adm1=... - Liste des préfectures
pub async fn list_adm2(
    Query(q): Query<std::collections::HashMap<String, String>>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let query = if let Some(adm1) = q.get("adm1") {
        format!("SELECT DISTINCT name FROM adm2_tg WHERE adm1_name = '{}' ORDER BY name", adm1.replace("'", "''"))
    } else {
        "SELECT DISTINCT name FROM adm2_tg ORDER BY name".to_string()
    };
    
    let rows = sqlx::query(&query).fetch_all(pool).await;
    
    match rows {
        Ok(rows) => {
            let zones: Vec<AdmZone> = rows.iter().map(|r| {
                AdmZone {
                    name: r.try_get("name").unwrap_or_default(),
                    code: None,
                    bbox: None,
                }
            }).collect();
            Json(zones).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "list_adm2 error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))).into_response()
        }
    }
}

/// GET /adm3?adm2=... - Liste des communes
pub async fn list_adm3(
    Query(q): Query<std::collections::HashMap<String, String>>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let query = if let Some(adm2) = q.get("adm2") {
        format!("SELECT DISTINCT name FROM adm3_tg WHERE adm2_name = '{}' ORDER BY name", adm2.replace("'", "''"))
    } else {
        "SELECT DISTINCT name FROM adm3_tg ORDER BY name".to_string()
    };
    
    let rows = sqlx::query(&query).fetch_all(pool).await;
    
    match rows {
        Ok(rows) => {
            let zones: Vec<AdmZone> = rows.iter().map(|r| {
                AdmZone {
                    name: r.try_get("name").unwrap_or_default(),
                    code: None,
                    bbox: None,
                }
            }).collect();
            Json(zones).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "list_adm3 error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))).into_response()
        }
    }
}
