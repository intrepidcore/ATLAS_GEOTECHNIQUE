// Surveys canoniques (unifiés)
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, FromRow)]
pub struct SurveyCanon {
    pub id: Uuid,
    pub code: String,
    pub localite_canon: String,
    pub localite: Option<String>,
    pub adm3_id: Option<i32>,
    pub adm3_name: Option<String>,
    pub geom: Option<serde_json::Value>,
    pub location_mode: Option<String>,
    pub is_geocoded: bool,
    pub has_geom: bool,
    pub has_adm3: bool,
    pub date: Option<chrono::NaiveDate>,
    pub nb_sondages_source: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SurveysQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub search: Option<String>,
    pub missing: Option<String>, // "geom" | "adm3"
}

/// GET /surveys - Liste des sondages unifiés
pub async fn list_surveys(
    State(state): State<AppState>,
    Query(params): Query<SurveysQuery>,
) -> Result<Json<Vec<SurveyCanon>>, (StatusCode, String)> {
    let pool = &state.pool;
    let limit = params.limit.unwrap_or(100).min(500);
    let offset = params.offset.unwrap_or(0);

    // Build WHERE clause based on filters
    let mut where_clauses = vec![];

    if params.search.is_some() {
        where_clauses.push(
            "(atlas.norm(code) LIKE '%' || atlas.norm($1) || '%' OR \
             atlas.norm(COALESCE(localite, '')) LIKE '%' || atlas.norm($1) || '%' OR \
             atlas.norm(localite_canon) LIKE '%' || atlas.norm($1) || '%')",
        );
    }

    if let Some(ref missing) = params.missing {
        if missing == "geom" {
            where_clauses.push("geom IS NULL");
        } else if missing == "adm3" {
            where_clauses.push("adm3_id IS NULL");
        }
    }

    let where_sql = if where_clauses.is_empty() {
        String::from("TRUE")
    } else {
        where_clauses.join(" AND ")
    };

    let query = format!(
        r#"
        SELECT 
            id, code, localite_canon, localite, adm3_id, adm3_name,
            ST_AsGeoJSON(geom)::jsonb as geom,
            location_mode::text as location_mode, is_geocoded, has_geom, has_adm3,
            date, nb_sondages_source, created_at, updated_at
        FROM atlas.surveys
        WHERE {}
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        where_sql
    );

    let rows = sqlx::query_as::<_, SurveyCanon>(&query)
        .bind(&params.search)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(rows))
}

/// GET /surveys/resolve?code=XXX - Résoudre un alias vers le survey canonique
pub async fn resolve_alias(
    State(state): State<AppState>,
    Query(params): Query<SurveysQuery>,
) -> Result<Json<SurveyCanon>, (StatusCode, String)> {
    let pool = &state.pool;

    let code = params.search.ok_or((
        StatusCode::BAD_REQUEST,
        "Missing 'search' parameter".to_string(),
    ))?;

    let row = sqlx::query_as::<_, SurveyCanon>(
        r#"
        SELECT 
            s.id, s.code, s.localite_canon, s.localite, s.adm3_id, s.adm3_name,
            ST_AsGeoJSON(s.geom)::jsonb as geom,
            s.location_mode::text as location_mode, s.is_geocoded, s.has_geom, s.has_adm3,
            s.date, s.nb_sondages_source, s.created_at, s.updated_at
        FROM atlas.survey_aliases a
        JOIN atlas.surveys s ON s.id = a.survey_id
        WHERE a.alias_code = $1
        LIMIT 1
        "#,
    )
    .bind(&code)
    .fetch_one(pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (
            StatusCode::NOT_FOUND,
            format!("No survey found for alias '{}'", code),
        ),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;

    Ok(Json(row))
}

/// GET /surveys/:id - Détails d'un sondage unifié
pub async fn get_survey(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<SurveyCanon>, (StatusCode, String)> {
    let pool = &state.pool;

    let row = sqlx::query_as::<_, SurveyCanon>(
        r#"
        SELECT 
            id, code, localite_canon, localite, adm3_id, adm3_name,
            ST_AsGeoJSON(geom)::jsonb as geom,
            location_mode::text as location_mode, is_geocoded, has_geom, has_adm3,
            date, nb_sondages_source, created_at, updated_at
        FROM atlas.surveys
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Survey not found".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;

    Ok(Json(row))
}

#[derive(Debug, Serialize)]
pub struct SurveysStats {
    pub total: i64,
    pub geocoded: i64,
    pub with_geom: i64,
    pub with_adm3: i64,
}

/// GET /surveys/stats - Statistiques des sondages unifiés
pub async fn get_surveys_stats(
    State(state): State<AppState>,
) -> Result<Json<SurveysStats>, (StatusCode, String)> {
    let pool = &state.pool;

    let (total, geocoded, with_geom, with_adm3): (i64, i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_geocoded) as geocoded,
            COUNT(*) FILTER (WHERE geom IS NOT NULL) as with_geom,
            COUNT(*) FILTER (WHERE adm3_id IS NOT NULL) as with_adm3
        FROM atlas.surveys
        "#,
    )
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(SurveysStats {
        total,
        geocoded,
        with_geom,
        with_adm3,
    }))
}

// ============================================================================
// ENDPOINTS D'ÉCRITURE - Géocodage
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct UpdateGeometryPayload {
    pub mode: String,                    // "exact" | "adm"
    pub geom: Option<serde_json::Value>, // GeoJSON Point si mode=exact
    pub adm3_id: Option<i32>,            // ADM3 ID si mode=adm
}

/// PATCH /surveys-canon/:id/geometry - Mettre à jour la géométrie
pub async fn update_geometry(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateGeometryPayload>,
) -> Result<Json<SurveyCanon>, (StatusCode, String)> {
    let pool = &state.pool;

    // Validation
    if payload.mode == "exact" && payload.geom.is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Mode 'exact' requires 'geom'".to_string(),
        ));
    }
    if payload.mode == "adm" && payload.adm3_id.is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Mode 'adm' requires 'adm3_id'".to_string(),
        ));
    }

    // Trouver le sondage source (premier de la liste des alias)
    let source_id: Uuid = sqlx::query_scalar("SELECT id FROM atlas.surveys WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Survey not found".to_string()))?;

    // Mettre à jour le sondage source dans la table sondages
    if payload.mode == "exact" {
        let geom_json = payload.geom.as_ref().unwrap();
        sqlx::query(
            r#"
            UPDATE sondages 
            SET geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
                location_mode = 'exact',
                updated_at = NOW()
            WHERE id = $2
            "#,
        )
        .bind(geom_json)
        .bind(source_id)
        .execute(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    } else if payload.mode == "adm" {
        sqlx::query(
            r#"
            UPDATE sondages 
            SET adm3_id = $1,
                location_mode = 'adm',
                updated_at = NOW()
            WHERE id = $2
            "#,
        )
        .bind(payload.adm3_id)
        .bind(source_id)
        .execute(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // Rafraîchir les vues canoniques
    sqlx::query("SELECT atlas.refresh_surveys()")
        .execute(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Retourner le survey mis à jour
    let updated = sqlx::query_as::<_, SurveyCanon>(
        r#"
        SELECT 
            id, code, localite_canon, localite, adm3_id, adm3_name,
            ST_AsGeoJSON(geom)::jsonb as geom,
            location_mode::text as location_mode, is_geocoded, has_geom, has_adm3,
            date, nb_sondages_source, created_at, updated_at
        FROM atlas.surveys
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
}

// ============================================================================
// CANDIDATS ADM3 - Suggestions basées sur similarité
// ============================================================================

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Adm3Candidate {
    pub adm3_id: i32,
    pub gid: i32,
    pub name: String,
    pub code: Option<String>,
    pub adm2_name: Option<String>,
    pub score: f32, // similarity() returns FLOAT4
}

#[derive(Debug, Serialize)]
pub struct Adm3CandidatesResponse {
    pub survey_id: Uuid,
    pub localite: String,
    pub candidates: Vec<Adm3Candidate>,
}

/// GET /surveys-canon/:id/adm3-candidates - Obtenir les candidats ADM3 suggérés
pub async fn get_adm3_candidates(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Adm3CandidatesResponse>, (StatusCode, String)> {
    let pool = &state.pool;

    // Récupérer le survey
    let survey: SurveyCanon = sqlx::query_as(
        r#"
        SELECT 
            id, code, localite_canon, localite, adm3_id, adm3_name,
            ST_AsGeoJSON(geom)::jsonb as geom,
            location_mode::text as location_mode, is_geocoded, has_geom, has_adm3,
            date, nb_sondages_source, created_at, updated_at
        FROM atlas.surveys
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, "Survey not found".to_string()),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;

    let search_term = survey
        .localite
        .as_ref()
        .unwrap_or(&survey.localite_canon);

    // Rechercher les candidats avec similarité
    let candidates: Vec<Adm3Candidate> = sqlx::query_as(
        r#"
        SELECT 
            gid as adm3_id,
            gid,
            adm3_fr as name,
            adm3_pcode as code,
            adm2_fr as adm2_name,
            similarity(atlas.norm(adm3_fr), atlas.norm($1)) as score
        FROM adm3
        WHERE similarity(atlas.norm(adm3_fr), atlas.norm($1)) > 0.3
        ORDER BY score DESC
        LIMIT 5
        "#,
    )
    .bind(search_term)
    .fetch_all(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(Adm3CandidatesResponse {
        survey_id: survey.id,
        localite: search_term.clone(),
        candidates,
    }))
}
