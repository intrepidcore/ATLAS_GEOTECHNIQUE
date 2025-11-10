use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::types::Uuid;
use crate::AppState;

// ============================================================================
// TYPES
// ============================================================================

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Sondage {
    pub id: Uuid,
    pub code: String,
    pub localite: Option<String>,
    pub adm3_id: Option<i32>,
    pub adm3_name: Option<String>,
    pub geom: Option<serde_json::Value>,
    pub location_mode: Option<String>,
    pub is_geocoded: bool,
    pub date: Option<chrono::NaiveDate>,
    pub source: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
pub struct SondagesStats {
    pub total: i64,
    pub geocoded: i64,
    pub with_geom: i64,
    pub with_adm3: i64,
    pub missing_geom: i64,
    pub missing_adm3: i64,
}

#[derive(Debug, Deserialize)]
pub struct ListSondagesQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub search: Option<String>,
    pub missing: Option<String>, // "geom" | "adm3"
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Adm3Candidate {
    pub adm3_id: i32,
    pub gid: i32,
    pub name: String,
    pub code: String,
    pub adm2_name: String,
    pub score: f32,
}

#[derive(Debug, Serialize)]
pub struct Adm3CandidatesResponse {
    pub survey_id: Uuid,
    pub localite: Option<String>,
    pub candidates: Vec<Adm3Candidate>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateGeometryPayload {
    pub mode: String, // "exact" | "adm"
    pub geom: Option<serde_json::Value>,
    pub adm3_id: Option<i32>,
}

// ============================================================================
// HANDLERS
// ============================================================================

/// GET /sondages - Liste paginée des sondages
pub async fn list_sondages(
    State(state): State<AppState>,
    Query(params): Query<ListSondagesQuery>,
) -> Result<Json<Vec<Sondage>>, (StatusCode, String)> {
    let pool = &state.pool;
    let limit = params.limit.unwrap_or(100).min(500);
    let offset = params.offset.unwrap_or(0);

    let mut where_clauses: Vec<String> = vec!["deleted_at IS NULL".to_string()];

    // Filtre recherche
    if params.search.is_some() {
        where_clauses.push("(atlas.norm(code) LIKE '%' || atlas.norm($1) || '%' OR atlas.norm(localite) LIKE '%' || atlas.norm($1) || '%')".to_string());
    }

    // Filtre missing
    match params.missing.as_deref() {
        Some("geom") => where_clauses.push("geom IS NULL".to_string()),
        Some("adm3") => where_clauses.push("adm3_id IS NULL".to_string()),
        _ => {}
    }

    let where_sql = where_clauses.join(" AND ");

    let query = format!(
        r#"
        SELECT 
            id, code, localite, adm3_id, adm3_name,
            ST_AsGeoJSON(geom)::jsonb as geom,
            location_mode::text,
            is_geocoded,
            date, source, created_at, updated_at
        FROM sondages
        WHERE {}
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        where_sql
    );

    let mut q = sqlx::query_as::<_, Sondage>(&query);

    if let Some(ref search) = params.search {
        q = q.bind(search);
    } else {
        q = q.bind(""); // Bind vide si pas de recherche
    }

    let rows = q
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            eprintln!("Error listing sondages: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

    Ok(Json(rows))
}

/// GET /sondages/stats - Statistiques globales
pub async fn get_sondages_stats(
    State(state): State<AppState>,
) -> Result<Json<SondagesStats>, (StatusCode, String)> {
    let pool = &state.pool;

    let stats: (i64, i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_geocoded) as geocoded,
            COUNT(*) FILTER (WHERE geom IS NOT NULL) as with_geom,
            COUNT(*) FILTER (WHERE adm3_id IS NOT NULL) as with_adm3
        FROM sondages
        WHERE deleted_at IS NULL
        "#,
    )
    .fetch_one(pool)
    .await
    .map_err(|e| {
        eprintln!("Error getting sondages stats: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    Ok(Json(SondagesStats {
        total: stats.0,
        geocoded: stats.1,
        with_geom: stats.2,
        with_adm3: stats.3,
        missing_geom: stats.0 - stats.2,
        missing_adm3: stats.0 - stats.3,
    }))
}

/// GET /sondages/:id - Détails d'un sondage
pub async fn get_sondage(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Sondage>, (StatusCode, String)> {
    let pool = &state.pool;

    let sondage = sqlx::query_as::<_, Sondage>(
        r#"
        SELECT 
            id, code, localite, adm3_id, adm3_name,
            ST_AsGeoJSON(geom)::jsonb as geom,
            location_mode::text,
            is_geocoded,
            date, source, created_at, updated_at
        FROM sondages
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        eprintln!("Error getting sondage: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, "Sondage not found".to_string()))?;

    Ok(Json(sondage))
}

/// GET /sondages/:id/adm3-candidates - Candidats ADM3 pour un sondage
pub async fn get_adm3_candidates(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Adm3CandidatesResponse>, (StatusCode, String)> {
    let pool = &state.pool;

    // Récupérer le sondage
    let sondage: (Uuid, Option<String>) = sqlx::query_as(
        r#"
        SELECT id, localite
        FROM sondages
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        eprintln!("Error fetching sondage: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, "Sondage not found".to_string()))?;

    let localite = sondage.1.clone();

    // Si pas de localite, retourner vide
    if localite.is_none() {
        return Ok(Json(Adm3CandidatesResponse {
            survey_id: id,
            localite: None,
            candidates: vec![],
        }));
    }

    let localite_str = localite.as_ref().unwrap();

    // Rechercher candidats ADM3 par similarité
    let candidates = sqlx::query_as::<_, Adm3Candidate>(
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
    .bind(localite_str)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        eprintln!("Error fetching ADM3 candidates: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    Ok(Json(Adm3CandidatesResponse {
        survey_id: id,
        localite,
        candidates,
    }))
}

/// PATCH /sondages/:id/geometry - Mettre à jour la géométrie d'un sondage
pub async fn update_sondage_geometry(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateGeometryPayload>,
) -> Result<Json<Sondage>, (StatusCode, String)> {
    let pool = &state.pool;

    // Validation
    if payload.mode == "exact" && payload.geom.is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Mode 'exact' requires 'geom' field".to_string(),
        ));
    }
    if payload.mode == "adm" && payload.adm3_id.is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Mode 'adm' requires 'adm3_id' field".to_string(),
        ));
    }

    // Update selon le mode
    if payload.mode == "exact" {
        let geom_json = payload.geom.as_ref().unwrap();

        // Mettre à jour la géométrie ET calculer l'ADM3 par intersection spatiale
        sqlx::query(
            r#"
            UPDATE sondages 
            SET geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 25231),
                location_mode = 'exact',
                adm3_id = (
                    SELECT gid 
                    FROM adm3 
                    WHERE ST_Contains(geom, ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 25231), 4326))
                    LIMIT 1
                ),
                adm3_name = (
                    SELECT adm3_fr 
                    FROM adm3 
                    WHERE ST_Contains(geom, ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 25231), 4326))
                    LIMIT 1
                ),
                updated_at = NOW()
            WHERE id = $2 AND deleted_at IS NULL
            "#,
        )
        .bind(geom_json)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| {
            eprintln!("Error updating sondage geometry (exact): {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;
    } else if payload.mode == "adm" {
        let adm3_id = payload.adm3_id.unwrap();
        eprintln!("DEBUG: adm3_id = {} (type: i32)", adm3_id);

        // Récupérer le code du sondage pour le seed
        let sondage_code: String = sqlx::query_scalar(
            r#"
            SELECT code FROM sondages WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            eprintln!("Error fetching sondage code: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

        // Récupérer le nom ADM3
        let adm3_name: Option<String> = sqlx::query_scalar(
            r#"
            SELECT adm3_fr FROM adm3 WHERE gid = $1
            "#,
        )
        .bind(adm3_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            eprintln!("Error fetching ADM3 name: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

        // Mettre à jour avec génération d'un point aléatoire dans l'ADM3
        sqlx::query(
            r#"
            UPDATE sondages 
            SET adm3_id = $1,
                adm3_name = $2,
                geom = get_adm_random_point('ADM3', $1, $3),
                location_mode = 'adm_random_cell',
                updated_at = NOW()
            WHERE id = $4 AND deleted_at IS NULL
            "#,
        )
        .bind(adm3_id)
        .bind(adm3_name)
        .bind(&sondage_code)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| {
            eprintln!("Error updating sondage geometry (adm): {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;
    } else {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("Invalid mode: {}", payload.mode),
        ));
    }

    // Retourner le sondage mis à jour
    let updated = sqlx::query_as::<_, Sondage>(
        r#"
        SELECT 
            id, code, localite, adm3_id, adm3_name,
            ST_AsGeoJSON(geom)::jsonb as geom,
            location_mode::text,
            is_geocoded,
            date, source, created_at, updated_at
        FROM sondages
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        eprintln!("Error fetching updated sondage: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    Ok(Json(updated))
}
