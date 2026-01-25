use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use num_traits::ToPrimitive;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::{postgres::PgRow, types::Uuid, Row};
use std::str::FromStr;

// ============================================================================
// DTOs
// ============================================================================

// Extended DTOs for v1.2.0
#[derive(Deserialize, Debug)]
pub struct NewSurveyRequest {
    pub commune_id: Option<String>,
    pub location: Option<LocationInput>,
    pub survey: SurveyMetadata,
    pub tests: Vec<TestInput>,
    #[allow(dead_code)]
    pub snap_to_grid: Option<bool>,
    pub use_commune_centroid: Option<bool>,
}

const SURVEY_FIELDS: &str = r#"
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
    adm1_id,
    adm2_id,
    adm3_id,
    localite_base,
    localite_key,
    localite,
    location_mode,
    location_accuracy,
    is_geocoded,
    type_sol,
    meta,
    date,
    date_sondage,
    source,
    operator,
    notes,
    comment,
    import_id,
    import_row_idx,
    loc_mode,
    grid_code,
    created_by_batch,
    updated_by_batch,
    deleted_by_batch,
    deleted_at,
    (SELECT COUNT(*) FROM essais WHERE sondage_id = sondages.id AND deleted_at IS NULL) as n_essais,
    created_at,
    updated_at,
    ST_AsGeoJSON(geom)::jsonb as geom
"#;

fn row_to_survey(r: &PgRow) -> Survey {
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
    let adm1_id: Option<String> = r.try_get("adm1_id").ok();
    let adm2_id: Option<String> = r.try_get("adm2_id").ok();
    let adm3_id: Option<i32> = r.try_get("adm3_id").ok();
    let localite_base: Option<String> = r.try_get("localite_base").ok();
    let localite_key: Option<String> = r.try_get("localite_key").ok();
    let localite: Option<String> = r.try_get("localite").ok();
    let location_mode: Option<String> = r.try_get("location_mode").ok();
    let location_accuracy: String = r
        .try_get("location_accuracy")
        .unwrap_or_else(|_| "exact".to_string());
    let is_geocoded: bool = r.try_get("is_geocoded").unwrap_or(true);
    let type_sol: Option<String> = r.try_get("type_sol").ok();
    let meta: Option<String> = r.try_get("meta").ok();
    let date: Option<String> = r
        .try_get::<Option<time::Date>, _>("date")
        .ok()
        .flatten()
        .map(|d| d.to_string());
    let date_sondage: Option<String> = r.try_get("date_sondage").ok();
    let source: Option<String> = r.try_get("source").ok();
    let operator: Option<String> = r.try_get("operator").ok();
    let notes: Option<String> = r.try_get("notes").ok();
    let comment: Option<String> = r.try_get("comment").ok();
    let import_id: Option<String> = r.try_get("import_id").ok();
    let import_row_idx: Option<String> = r.try_get("import_row_idx").ok();
    let loc_mode: Option<String> = r.try_get("loc_mode").ok();
    let grid_code: Option<String> = r.try_get("grid_code").ok();
    let created_by_batch: Option<String> = r.try_get("created_by_batch").ok();
    let updated_by_batch: Option<String> = r.try_get("updated_by_batch").ok();
    let deleted_by_batch: Option<String> = r.try_get("deleted_by_batch").ok();
    let n_essais: i64 = r.try_get("n_essais").unwrap_or(0);
    let created: Option<time::OffsetDateTime> = r.try_get("created_at").ok();
    let updated: Option<time::OffsetDateTime> = r.try_get("updated_at").ok();
    let deleted: Option<time::OffsetDateTime> = r.try_get("deleted_at").ok();
    let geom: Option<JsonValue> = r.try_get("geom").ok();

    Survey {
        id: id.unwrap_or_default(),
        code,
        lon,
        lat,
        depth_m_min: depth_min.and_then(|v| v.to_f64()),
        depth_m_max: depth_max.and_then(|v| v.to_f64()),
        maille_code: maille,
        adm1_name: adm1,
        adm2_name: adm2,
        adm3_name: adm3,
        adm1_id,
        adm2_id,
        adm3_id,
        localite_base,
        localite_key,
        localite,
        location_mode,
        location_accuracy,
        is_geocoded,
        type_sol,
        meta,
        date,
        date_sondage,
        source,
        operator,
        notes,
        comment,
        import_id,
        import_row_idx,
        loc_mode,
        grid_code,
        created_by_batch,
        updated_by_batch,
        deleted_by_batch,
        n_essais,
        created_at: created
            .map(|t| {
                t.format(&time::format_description::well_known::Rfc3339)
                    .unwrap()
            })
            .unwrap_or_default(),
        updated_at: updated.map(|t| {
            t.format(&time::format_description::well_known::Rfc3339)
                .unwrap()
        }),
        deleted_at: deleted.map(|t| {
            t.format(&time::format_description::well_known::Rfc3339)
                .unwrap()
        }),
        geom,
    }
}

#[derive(Deserialize, Debug)]
pub struct LocationInput {
    pub lon: f64,
    pub lat: f64,
}

#[derive(Deserialize, Debug)]
pub struct SurveyMetadata {
    pub code: Option<String>,
    pub date: Option<String>,
    pub source: Option<String>,
    pub operator: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct TestInput {
    #[serde(rename = "type")]
    pub test_type: String,
    pub value: f64,
    pub depth_m: f64,
}

#[derive(Serialize)]
pub struct CreateSurveyResponse {
    pub sondage_id: String,
    pub maille_code: Option<String>,
    pub essais_count: usize,
    pub location_accuracy: String,
}

// Legacy DTO for backward compatibility
#[derive(Deserialize, Serialize)]
pub struct NewSurvey {
    pub code: Option<String>,
    pub lon: Option<f64>,
    pub lat: Option<f64>,
    pub srid: Option<i32>,
    pub depth_m_min: Option<f64>,
    pub depth_m_max: Option<f64>,
    pub comment: Option<String>,
    pub location_mode: Option<String>,
    pub adm_level: Option<String>,
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
    pub lon: Option<f64>,
    pub lat: Option<f64>,
    pub depth_m_min: Option<f64>,
    pub depth_m_max: Option<f64>,
    pub maille_code: Option<String>,
    pub adm1_name: Option<String>,
    pub adm2_name: Option<String>,
    pub adm3_name: Option<String>,
    pub adm1_id: Option<String>,
    pub adm2_id: Option<String>,
    pub adm3_id: Option<i32>,
    pub localite_base: Option<String>,
    pub localite_key: Option<String>,
    pub localite: Option<String>,
    pub location_mode: Option<String>,
    pub location_accuracy: String,
    pub is_geocoded: bool,
    pub type_sol: Option<String>,
    pub meta: Option<String>,
    pub date: Option<String>,
    pub date_sondage: Option<String>,
    pub source: Option<String>,
    pub operator: Option<String>,
    pub notes: Option<String>,
    pub comment: Option<String>,
    pub import_id: Option<String>,
    pub import_row_idx: Option<String>,
    pub loc_mode: Option<String>,
    pub grid_code: Option<String>,
    pub created_by_batch: Option<String>,
    pub updated_by_batch: Option<String>,
    pub deleted_by_batch: Option<String>,
    pub n_essais: i64,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub deleted_at: Option<String>,
    pub geom: Option<JsonValue>,
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
    pub location_accuracy: Option<String>,
    pub is_geocoded: Option<bool>,
    pub q: Option<String>,
    pub maille_code: Option<String>,
    pub m28: Option<String>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct GeocodeRequest {
    pub lon: Option<f64>,
    pub lat: Option<f64>,
    pub location_mode: Option<String>,
    pub adm_level: Option<String>,
    pub adm_name: Option<String>,
}

// ============================================================================
// Validation helpers
// ============================================================================

pub fn validate_togo_bounds(lon: f64, lat: f64) -> Result<(), String> {
    if !(5.0..=12.0).contains(&lat) {
        return Err(format!("Latitude {} hors limites Togo [5, 12]", lat));
    }
    if !(-1.0..=2.0).contains(&lon) {
        return Err(format!("Longitude {} hors limites Togo [-1, 2]", lon));
    }
    Ok(())
}

fn validate_depth(depth_m: f64) -> Result<(), String> {
    if !(0.5..=60.0).contains(&depth_m) {
        return Err(format!("Profondeur {} hors limites [0.5, 60] m", depth_m));
    }
    Ok(())
}

fn validate_spt_n(value: f64) -> Result<(), String> {
    if !(0.0..=100.0).contains(&value) || value.fract() != 0.0 {
        return Err(format!("SPT_N {} invalide (entier 0-100)", value));
    }
    Ok(())
}

fn validate_qc(value: f64) -> Result<(), String> {
    if !(0.1..=50.0).contains(&value) {
        return Err(format!("qc {} hors limites [0.1, 50] MPa", value));
    }
    Ok(())
}

pub fn validate_test(test: &TestInput) -> Result<(), String> {
    validate_depth(test.depth_m)?;

    match test.test_type.as_str() {
        "SPT_N" => validate_spt_n(test.value)?,
        "qc" => validate_qc(test.value)?,
        _ => {}
    }

    Ok(())
}

pub fn get_test_unit(test_type: &str) -> &'static str {
    match test_type {
        "SPT_N" => "blows/30cm",
        "qc" => "MPa",
        "fs" => "kPa",
        "Cu_VST" | "Cu_triax" => "kPa",
        "phi_prime" => "degrees",
        "gamma_d_max" => "kN/m3",
        "w_opt" | "wL" | "wP" => "%",
        _ => "unit",
    }
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
        "#,
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
            })
            .into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Point outside grid"})),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(?e, "locate_maille error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            )
                .into_response()
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
                Json(serde_json::json!({"error": "depth_m_min must be <= depth_m_max"})),
            )
                .into_response();
        }
    }

    let id = Uuid::new_v4();
    let depth_min_bd = payload
        .depth_m_min
        .map(|v| sqlx::types::BigDecimal::from_str(&v.to_string()).unwrap());
    let depth_max_bd = payload
        .depth_m_max
        .map(|v| sqlx::types::BigDecimal::from_str(&v.to_string()).unwrap());

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
        "#,
    )
    .bind(id)
    .bind(&payload.code)
    .bind(payload.lon)
    .bind(payload.lat)
    .bind(srid)
    .bind(depth_min_bd)
    .bind(depth_max_bd)
    .bind(&payload.comment)
    .execute(pool)
    .await;

    match result {
        Ok(_) => {
            let select_query = format!(
                "SELECT {} FROM sondages WHERE id = $1 AND deleted_at IS NULL",
                SURVEY_FIELDS
            );
            let row = sqlx::query(&select_query).bind(id).fetch_one(pool).await;

            match row {
                Ok(row) => {
                    // Audit log
                    let _ = sqlx::query(
                        "INSERT INTO audit_log (action, entity, entity_id, payload) VALUES ($1, $2, $3, $4)"
                    )
                    .bind("CREATE")
                    .bind("sondage")
                    .bind(id)
                    .bind(serde_json::json!({"code": row.try_get::<Option<String>, _>("code").ok(), "lon": payload.lon, "lat": payload.lat}))
                    .execute(pool)
                    .await;

                    Json(row_to_survey(&row)).into_response()
                }
                Err(e) => {
                    tracing::error!(?e, "create_survey fetch error");
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({"error": "Failed to fetch created survey"})),
                    )
                        .into_response()
                }
            }
        }
        Err(e) => {
            tracing::error!(?e, "create_survey error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("{:?}", e)})),
            )
                .into_response()
        }
    }
}

/// GET /surveys
pub async fn list_surveys(
    Query(q): Query<ListSurveysQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let mut query = format!(
        "SELECT {} FROM sondages WHERE deleted_at IS NULL",
        SURVEY_FIELDS
    );

    // Filtres
    let mut conditions = Vec::new();

    if let Some(accuracy) = &q.location_accuracy {
        conditions.push(format!(
            "location_accuracy = '{}'",
            accuracy.replace("'", "''")
        ));
    }

    if let Some(geocoded) = q.is_geocoded {
        conditions.push(format!("is_geocoded = {}", geocoded));
    }

    // Recherche par texte (nom, localité, code maille)
    if let Some(search_text) = &q.q {
        let search_safe = search_text.replace("'", "''");
        conditions.push(format!(
            "(LOWER(code) LIKE LOWER('%{}%') OR LOWER(localite) LIKE LOWER('%{}%') OR LOWER(maille_code) LIKE LOWER('%{}%') OR LOWER(id_m28) LIKE LOWER('%{}%'))",
            search_safe, search_safe, search_safe, search_safe
        ));
    }

    // Filtre par code maille 2km
    if let Some(maille) = &q.maille_code {
        conditions.push(format!(
            "maille_code = '{}'",
            maille.replace("'", "''")
        ));
    }

    // Filtre par code maille 28km
    if let Some(m28) = &q.m28 {
        conditions.push(format!(
            "id_m28 = '{}'",
            m28.replace("'", "''")
        ));
    }

    if !conditions.is_empty() {
        query.push_str(" AND ");
        query.push_str(&conditions.join(" AND "));
    }

    if let Some(bbox_str) = &q.bbox {
        let parts: Vec<f64> = bbox_str.split(',').filter_map(|s| s.parse().ok()).collect();
        if parts.len() == 4 {
            query.push_str(&format!(
                " AND ST_Intersects(ST_Transform(geom, 4326), ST_MakeEnvelope({}, {}, {}, {}, 4326))",
                parts[0], parts[1], parts[2], parts[3]
            ));
        }
    }

    query.push_str(" ORDER BY created_at DESC LIMIT 1000");

    let rows = sqlx::query(&query).fetch_all(pool).await;

    match rows {
        Ok(rows) => {
            let surveys: Vec<Survey> = rows.iter().map(row_to_survey).collect();

            Json(surveys).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "list_surveys error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            )
                .into_response()
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
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid UUID"})),
            )
                .into_response()
        }
    };

    let result =
        sqlx::query("UPDATE sondages SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL")
            .bind(uuid)
            .execute(pool)
            .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            let _ = sqlx::query(
                "INSERT INTO audit_log (action, entity, entity_id) VALUES ($1, $2, $3)",
            )
            .bind("DELETE")
            .bind("sondage")
            .bind(uuid)
            .execute(pool)
            .await;

            (StatusCode::NO_CONTENT, Json(serde_json::json!({}))).into_response()
        }
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Survey not found"})),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(?e, "delete_survey error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            )
                .into_response()
        }
    }
}

/// GET /surveys/:id - Get single survey
pub async fn get_survey(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let uuid = match Uuid::parse_str(&id) {
        Ok(u) => u,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid UUID"})),
            )
                .into_response()
        }
    };

    let query = format!(
        "SELECT {} FROM sondages WHERE id = $1 AND deleted_at IS NULL",
        SURVEY_FIELDS
    );
    let row = sqlx::query(&query).bind(uuid).fetch_optional(pool).await;

    match row {
        Ok(Some(r)) => Json(row_to_survey(&r)).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Survey not found"})),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(?e, "get_survey error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            )
                .into_response()
        }
    }
}

/// PUT /surveys/:id - Update survey
pub async fn update_survey(
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<NewSurvey>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let uuid = match Uuid::parse_str(&id) {
        Ok(u) => u,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid UUID"})),
            )
                .into_response()
        }
    };

    // Build dynamic UPDATE query
    let mut updates = Vec::new();

    if let Some(code) = &payload.code {
        updates.push(format!("code = '{}'", code.replace("'", "''")));
    }
    if let Some(date) = &payload.date {
        updates.push(format!("date = '{}'", date.replace("'", "''")));
    }
    if let Some(source) = &payload.source {
        updates.push(format!("source = '{}'", source.replace("'", "''")));
    }
    if let Some(operator) = &payload.operator {
        updates.push(format!("operator = '{}'", operator.replace("'", "''")));
    }
    if let Some(notes) = &payload.notes {
        updates.push(format!("notes = '{}'", notes.replace("'", "''")));
    }
    if let Some(comment) = &payload.comment {
        updates.push(format!("comment = '{}'", comment.replace("'", "''")));
    }
    if let (Some(lon), Some(lat)) = (payload.lon, payload.lat) {
        let srid = payload.srid.unwrap_or(4326);
        updates.push(format!(
            "geom = ST_Transform(ST_SetSRID(ST_MakePoint({}, {}), {}), 25231)",
            lon, lat, srid
        ));
    }
    if let Some(min) = payload.depth_m_min {
        updates.push(format!("depth_m_min = {}", min));
    }
    if let Some(max) = payload.depth_m_max {
        updates.push(format!("depth_m_max = {}", max));
    }

    if updates.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "No fields to update"})),
        )
            .into_response();
    }

    updates.push("updated_at = now()".to_string());

    let query = format!(
        "UPDATE sondages SET {} WHERE id = $1 AND deleted_at IS NULL RETURNING code",
        updates.join(", ")
    );

    let result = sqlx::query(&query).bind(uuid).fetch_optional(pool).await;

    match result {
        Ok(Some(_)) => {
            // Log audit
            let _ = sqlx::query("INSERT INTO audit_log (action, entity, entity_id, payload) VALUES ($1, $2, $3, $4)")
                .bind("UPDATE")
                .bind("sondage")
                .bind(uuid)
                .bind(serde_json::json!(payload))
                .execute(pool)
                .await;

            Json(serde_json::json!({"success": true, "id": id})).into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Survey not found"})),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(?e, "update_survey error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            )
                .into_response()
        }
    }
}

/// GET /surveys/nearby?lat=...&lon=...&radius=... - Find nearby surveys
pub async fn get_nearby_surveys(
    Query(q): Query<std::collections::HashMap<String, String>>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let lat: f64 = match q.get("lat").and_then(|s| s.parse().ok()) {
        Some(v) => v,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Missing or invalid lat"})),
            )
                .into_response()
        }
    };

    let lon: f64 = match q.get("lon").and_then(|s| s.parse().ok()) {
        Some(v) => v,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Missing or invalid lon"})),
            )
                .into_response()
        }
    };

    let radius: f64 = q
        .get("radius")
        .and_then(|s| s.parse().ok())
        .unwrap_or(1000.0); // Default 1km

    let rows = sqlx::query(
        r#"
        SELECT 
            id::text,
            code,
            ST_X(ST_Transform(geom, 4326)) as lon,
            ST_Y(ST_Transform(geom, 4326)) as lat,
            ST_Distance(
                geom::geography,
                ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 25231)::geography
            ) as distance_m
        FROM sondages
        WHERE deleted_at IS NULL
          AND ST_DWithin(
                geom::geography,
                ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 25231)::geography,
                $3
              )
        ORDER BY distance_m ASC
        LIMIT 20
        "#,
    )
    .bind(lon)
    .bind(lat)
    .bind(radius)
    .fetch_all(pool)
    .await;

    match rows {
        Ok(rows) => {
            let surveys: Vec<serde_json::Value> = rows.iter().map(|r| {
                serde_json::json!({
                    "id": r.try_get::<String, _>("id").ok(),
                    "code": r.try_get::<String, _>("code").ok(),
                    "lon": r.try_get::<f64, _>("lon").ok(),
                    "lat": r.try_get::<f64, _>("lat").ok(),
                    "distance_m": r.try_get::<f64, _>("distance_m").ok().map(|d| (d * 10.0).round() / 10.0),
                })
            }).collect();

            Json(surveys).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "get_nearby_surveys error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            )
                .into_response()
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
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid sondage_id"})),
            )
                .into_response()
        }
    };

    // Validate depth bounds
    let sondage = sqlx::query(
        "SELECT depth_m_min, depth_m_max FROM sondages WHERE id = $1 AND deleted_at IS NULL",
    )
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
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Survey not found"})),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(?e, "validate sondage error");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            )
                .into_response();
        }
    }

    let id = Uuid::new_v4();
    let value_bd = sqlx::types::BigDecimal::from_str(&payload.value.to_string()).unwrap();
    let depth_bd = sqlx::types::BigDecimal::from_str(&payload.depth_m.to_string()).unwrap();

    let result = sqlx::query(
        "INSERT INTO essais (id, sondage_id, type_essai, valeur_numerique, unit, depth_m) VALUES ($1, $2, $3, $4, $5, $6) RETURNING created_at"
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
                created_at: created
                    .map(|t| {
                        t.format(&time::format_description::well_known::Rfc3339)
                            .unwrap()
                    })
                    .unwrap_or_default(),
            })
            .into_response()
        }
        Err(e) => {
            tracing::error!(?e, "create_test error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("{:?}", e)})),
            )
                .into_response()
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
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid UUID"})),
            )
                .into_response()
        }
    };

    let rows = sqlx::query(
        "SELECT id::text, type, value, unit, depth_m, created_at FROM essais WHERE sondage_id = $1 AND deleted_at IS NULL ORDER BY depth_m ASC"
    )
    .bind(sondage_id)
    .fetch_all(pool)
    .await;

    match rows {
        Ok(rows) => {
            let tests: Vec<Test> = rows
                .iter()
                .map(|r| {
                    let test_id: Option<String> = r.try_get("id").ok();
                    let test_type: String = r.try_get("type").unwrap_or_default();
                    let value: Option<sqlx::types::BigDecimal> = r.try_get("value").ok().flatten();
                    let unit: Option<String> = r.try_get("unit").ok();
                    let depth: Option<sqlx::types::BigDecimal> =
                        r.try_get("depth_m").ok().flatten();
                    let created: Option<time::OffsetDateTime> = r.try_get("created_at").ok();

                    Test {
                        id: test_id.unwrap_or_default(),
                        sondage_id: id.clone(),
                        test_type,
                        value: value.and_then(|v| v.to_f64()).unwrap_or(0.0),
                        unit: unit.unwrap_or_default(),
                        depth_m: depth.and_then(|v| v.to_f64()).unwrap_or(0.0),
                        created_at: created
                            .map(|t| {
                                t.format(&time::format_description::well_known::Rfc3339)
                                    .unwrap()
                            })
                            .unwrap_or_default(),
                    }
                })
                .collect();

            Json(tests).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "list_tests error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            )
                .into_response()
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
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid UUID"})),
            )
                .into_response()
        }
    };

    let result =
        sqlx::query("UPDATE essais SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL")
            .bind(uuid)
            .execute(pool)
            .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            let _ = sqlx::query(
                "INSERT INTO audit_log (action, entity, entity_id) VALUES ($1, $2, $3)",
            )
            .bind("DELETE")
            .bind("essai")
            .bind(uuid)
            .execute(pool)
            .await;

            (StatusCode::NO_CONTENT, Json(serde_json::json!({}))).into_response()
        }
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Test not found"})),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(?e, "delete_test error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            )
                .into_response()
        }
    }
}

// ============================================================================
// ADM Endpoints
// ============================================================================

/// GET /adm1 - Liste des régions
pub async fn list_adm1(State(state): State<AppState>) -> impl IntoResponse {
    let pool = &state.pool;

    let rows = sqlx::query(
        r#"
        SELECT name, code,
               ST_XMin(geom) as xmin, ST_YMin(geom) as ymin,
               ST_XMax(geom) as xmax, ST_YMax(geom) as ymax
        FROM public.adm1_tg
        ORDER BY name
        "#,
    )
    .fetch_all(pool)
    .await;

    match rows {
        Ok(rows) => {
            let zones: Vec<AdmZone> = rows
                .iter()
                .map(|r| {
                    let xmin: Option<f64> = r.try_get("xmin").ok();
                    let ymin: Option<f64> = r.try_get("ymin").ok();
                    let xmax: Option<f64> = r.try_get("xmax").ok();
                    let ymax: Option<f64> = r.try_get("ymax").ok();
                    let bbox = if let (Some(xmin), Some(ymin), Some(xmax), Some(ymax)) =
                        (xmin, ymin, xmax, ymax)
                    {
                        Some(vec![xmin, ymin, xmax, ymax])
                    } else {
                        None
                    };

                    AdmZone {
                        name: r.try_get("name").unwrap_or_default(),
                        code: r.try_get("code").ok(),
                        bbox,
                    }
                })
                .collect();
            Json(zones).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "list_adm1 error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error", "details": e.to_string()})),
            )
                .into_response()
        }
    }
}

/// GET /adm2?adm1=... - Liste des préfectures
pub async fn list_adm2(
    Query(q): Query<std::collections::HashMap<String, String>>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let adm1 = q.get("adm1").cloned();
    let rows = sqlx::query(
        r#"
        SELECT name, code,
               ST_XMin(geom) as xmin, ST_YMin(geom) as ymin,
               ST_XMax(geom) as xmax, ST_YMax(geom) as ymax
        FROM public.adm2_tg
        WHERE ($1::text IS NULL OR adm1_name = $1)
        ORDER BY name
        "#,
    )
    .bind(adm1)
    .fetch_all(pool)
    .await;

    match rows {
        Ok(rows) => {
            let zones: Vec<AdmZone> = rows
                .iter()
                .map(|r| {
                    let xmin: Option<f64> = r.try_get("xmin").ok();
                    let ymin: Option<f64> = r.try_get("ymin").ok();
                    let xmax: Option<f64> = r.try_get("xmax").ok();
                    let ymax: Option<f64> = r.try_get("ymax").ok();
                    let bbox = if let (Some(xmin), Some(ymin), Some(xmax), Some(ymax)) =
                        (xmin, ymin, xmax, ymax)
                    {
                        Some(vec![xmin, ymin, xmax, ymax])
                    } else {
                        None
                    };

                    AdmZone {
                        name: r.try_get("name").unwrap_or_default(),
                        code: r.try_get("code").ok(),
                        bbox,
                    }
                })
                .collect();
            Json(zones).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "list_adm2 error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error", "details": e.to_string()})),
            )
                .into_response()
        }
    }
}

/// GET /adm3?adm2=... - Liste des communes
pub async fn list_adm3(
    Query(q): Query<std::collections::HashMap<String, String>>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;

    #[derive(sqlx::FromRow, serde::Serialize)]
    struct Adm3Row {
        gid: i32,
        name: String,
        code: String,
    }

    let query = if let Some(adm2) = q.get("adm2") {
        format!(
            r#"SELECT gid, adm3_fr as name, adm3_pcode as code
               FROM atlas.adm3 WHERE adm2_fr = '{}' ORDER BY adm3_fr"#,
            adm2.replace("'", "''")
        )
    } else {
        r#"SELECT gid, adm3_fr as name, adm3_pcode as code
           FROM atlas.adm3 WHERE adm3_fr IS NOT NULL ORDER BY adm3_fr"#
            .to_string()
    };

    match sqlx::query_as::<_, Adm3Row>(&query).fetch_all(pool).await {
        Ok(rows) => Json(rows).into_response(),
        Err(e) => {
            tracing::error!(?e, "list_adm3 error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            )
                .into_response()
        }
    }
}

/// GET /adm0/geojson - Contour du pays (Togo) en GeoJSON
pub async fn get_adm0_geojson(State(state): State<AppState>) -> impl IntoResponse {
    let pool = &state.pool;

    let result = sqlx::query_scalar::<_, serde_json::Value>(
        r#"
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', json_agg(
                json_build_object(
                    'type', 'Feature',
                    'properties', json_build_object(
                        'name', adm0_fr,
                        'code', adm0_pcode
                    ),
                    'geometry', ST_AsGeoJSON(geom)::json
                )
            )
        )
        FROM public.adm0_raw
        "#,
    )
    .fetch_one(pool)
    .await;

    match result {
        Ok(geojson) => Json(geojson).into_response(),
        Err(e) => {
            tracing::error!(?e, "get_adm0_geojson error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            )
                .into_response()
        }
    }
}

/// GET /adm-geojson?level=adm1&name=... - Contour d'une zone ADM en GeoJSON
pub async fn get_adm_geojson(
    Query(q): Query<std::collections::HashMap<String, String>>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let level = q.get("level").map(|s| s.as_str()).unwrap_or("adm1");
    let name = match q.get("name") {
        Some(n) if !n.is_empty() => n,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Parameter 'name' is required"})),
            ).into_response();
        }
    };
    
    // Construire la requête selon le niveau ADM
    let query = match level {
        "adm1" => format!(
            r#"
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'properties', json_build_object(
                            'name', name,
                            'code', code,
                            'level', 'adm1'
                        ),
                        'geometry', ST_AsGeoJSON(geom)::json
                    )
                )
            )
            FROM adm1_tg
            WHERE name = '{}'
            "#,
            name.replace("'", "''")
        ),
        "adm2" => format!(
            r#"
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'properties', json_build_object(
                            'name', name,
                            'code', code,
                            'adm1', adm1_name,
                            'level', 'adm2'
                        ),
                        'geometry', ST_AsGeoJSON(geom)::json
                    )
                )
            )
            FROM adm2_tg
            WHERE name = '{}'
            "#,
            name.replace("'", "''")
        ),
        "adm3" => format!(
            r#"
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'properties', json_build_object(
                            'name', adm3_fr,
                            'code', adm3_pcode,
                            'adm2', adm2_fr,
                            'adm1', adm1_fr,
                            'level', 'adm3'
                        ),
                        'geometry', ST_AsGeoJSON(geom)::json
                    )
                )
            )
            FROM adm3
            WHERE adm3_fr = '{}'
            "#,
            name.replace("'", "''")
        ),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid level. Use adm1, adm2, or adm3"})),
            ).into_response();
        }
    };
    
    let result = sqlx::query_scalar::<_, serde_json::Value>(&query)
        .fetch_one(pool)
        .await;

    match result {
        Ok(geojson) => Json(geojson).into_response(),
        Err(e) => {
            tracing::error!(?e, level, name, "get_adm_geojson error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            )
                .into_response()
        }
    }
}
