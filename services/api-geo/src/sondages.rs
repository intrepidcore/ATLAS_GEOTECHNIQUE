use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::types::Uuid;

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
    pub source: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
    // Champs extraits de meta pour badges AUTO/MANUEL
    pub geocoded_mode: Option<String>,
    pub geocoded_score: Option<f64>,
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
    pub grid_code: Option<String>, // Filtre par code maille
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

    let mut where_clauses: Vec<String> = vec![];
    let has_search = params.search.as_ref().map(|s| !s.is_empty()).unwrap_or(false);
    let has_grid_code = params.grid_code.as_ref().map(|s| !s.is_empty()).unwrap_or(false);

    // Compteur de paramètres pour les bindings dynamiques
    let mut param_idx = 1;

    // Filtre recherche
    if has_search {
        where_clauses.push(format!("(atlas.norm(s.code) LIKE '%' || atlas.norm(${}) || '%' OR atlas.norm(s.localite_base) LIKE '%' || atlas.norm(${}) || '%')", param_idx, param_idx));
        param_idx += 1;
    }

    // Filtre grid_code (maille)
    if has_grid_code {
        where_clauses.push(format!("s.grid_code = ${}", param_idx));
        param_idx += 1;
    }

    // Filtre missing
    match params.missing.as_deref() {
        Some("geom") => where_clauses.push("s.geom IS NULL".to_string()),
        Some("adm3") => where_clauses.push("s.adm3_id IS NULL".to_string()),
        _ => {}
    }

    // Construire la clause WHERE additionnelle
    let additional_where = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("AND {}", where_clauses.join(" AND "))
    };

    // Indices pour limit et offset
    let limit_idx = format!("${}", param_idx);
    let offset_idx = format!("${}", param_idx + 1);

    let query = format!(
        r#"
        SELECT 
            s.id, s.code, s.localite_base AS localite, s.adm3_id, s.adm3_name,
            ST_AsGeoJSON(s.geom)::jsonb as geom,
            s.location_mode::text,
            s.is_geocoded,
            s.source, s.created_at, s.updated_at,
            s.meta->>'geocoded_mode' as geocoded_mode,
            COALESCE(
                (s.meta->>'geocoded_score')::float8,
                gs.top_score::float8
            ) as geocoded_score
        FROM public.sondages s
        LEFT JOIN geocode_suggestions gs ON s.id = gs.entity_id 
            AND s.meta->>'geocoded_mode' = 'suggestion_accepted'
            AND gs.status = 'accepted'
        WHERE s.deleted_at IS NULL {}
        ORDER BY s.created_at DESC
        LIMIT {} OFFSET {}
        "#,
        additional_where,
        limit_idx,
        offset_idx
    );

    let mut q = sqlx::query_as::<_, Sondage>(&query);

    // Bind search si présent
    if has_search {
        q = q.bind(params.search.as_ref().unwrap());
    }

    // Bind grid_code si présent
    if has_grid_code {
        q = q.bind(params.grid_code.as_ref().unwrap());
    }

    // Bind limit et offset
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
            s.id, s.code, s.localite_base AS localite, s.adm3_id, s.adm3_name,
            ST_AsGeoJSON(s.geom)::jsonb as geom,
            s.location_mode::text,
            s.is_geocoded,
            s.source, s.created_at, s.updated_at,
            s.meta->>'geocoded_mode' as geocoded_mode,
            COALESCE(
                (s.meta->>'geocoded_score')::float8,
                gs.top_score::float8
            ) as geocoded_score
        FROM sondages s
        LEFT JOIN geocode_suggestions gs ON s.id = gs.entity_id 
            AND s.meta->>'geocoded_mode' = 'suggestion_accepted'
            AND gs.status = 'accepted'
        WHERE s.id = $1 AND s.deleted_at IS NULL
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

/// GET /sondages/:id/details - Détails enrichis d'un sondage (avec essais géotechniques)
pub async fn get_sondage_details(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pool;

    // Récupérer le sondage de base
    let sondage: serde_json::Value = sqlx::query_scalar(
        r#"
        SELECT jsonb_build_object(
            'id', s.id,
            'code', s.code,
            'localite', s.localite_base,
            'localite_key', s.localite_key,
            'adm3_id', s.adm3_id,
            'adm3_name', s.adm3_name,
            'adm1_name', s.adm1_name,
            'adm2_name', s.adm2_name,
            'geom', ST_AsGeoJSON(s.geom)::jsonb,
            'location_mode', s.location_mode::text,
            'is_geocoded', s.is_geocoded,
            'grid_code', s.grid_code,
            'source', s.source,
            'import_id', s.import_id,
            'import_row_idx', s.import_row_idx,
            'created_at', s.created_at,
            'updated_at', s.updated_at,
            'meta', s.meta,
            'geocoded_mode', s.meta->>'geocoded_mode',
            'geocoded_score', COALESCE(
                (s.meta->>'geocoded_score')::float8,
                gs.top_score::float8
            ),
            'coordinates', CASE 
                WHEN s.geom IS NOT NULL THEN jsonb_build_object(
                    'lat', ST_Y(s.geom),
                    'lon', ST_X(s.geom)
                )
                ELSE NULL
            END
        )
        FROM sondages s
        LEFT JOIN geocode_suggestions gs ON s.id = gs.entity_id 
            AND s.meta->>'geocoded_mode' = 'suggestion_accepted'
            AND gs.status = 'accepted'
        WHERE s.id = $1 AND s.deleted_at IS NULL
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or_else(|| (StatusCode::NOT_FOUND, "Sondage not found".to_string()))?;

    // Récupérer les essais Atterberg via échantillons
    let atterberg: Vec<serde_json::Value> = sqlx::query_scalar(
        r#"
        SELECT jsonb_build_object(
            'id', ea.id,
            'depth_m', e.depth_m,
            'wl', ea.wl,
            'wp', ea.wp,
            'ip', ea.ip_generated,
            'echantillon_id', e.id
        )
        FROM essais_atterberg ea
        INNER JOIN echantillons e ON ea.echantillon_id = e.id
        WHERE e.sondage_id = $1
        ORDER BY e.depth_m
        "#,
    )
    .bind(id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Récupérer les essais VBS via échantillons
    let vbs: Vec<serde_json::Value> = sqlx::query_scalar(
        r#"
        SELECT jsonb_build_object(
            'id', ev.id,
            'depth_m', e.depth_m,
            'vbs', ev.vbs,
            'commentaire', ev.commentaire,
            'echantillon_id', e.id
        )
        FROM essais_vbs ev
        INNER JOIN echantillons e ON ev.echantillon_id = e.id
        WHERE e.sondage_id = $1
        ORDER BY e.depth_m
        "#,
    )
    .bind(id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Récupérer les essais de classification via échantillons
    let classif: Vec<serde_json::Value> = sqlx::query_scalar(
        r#"
        SELECT jsonb_build_object(
            'id', ec.id,
            'depth_m', e.depth_m,
            'systeme', ec.systeme,
            'classe', ec.classe,
            'hrb', ec.hrb,
            'unified', ec.unified,
            'class_chassagneux', ec.class_chassagneux,
            'class_daksha', ec.class_daksha,
            'class_seed', ec.class_seed,
            'class_vijay', ec.class_vijay,
            'type_sol', ec.type_sol,
            'cg', ec.cg,
            'cg_qual', ec.cg_qual,
            'echantillon_id', e.id
        )
        FROM essais_classif ec
        INNER JOIN echantillons e ON ec.echantillon_id = e.id
        WHERE e.sondage_id = $1 AND ec.deleted_at IS NULL
        ORDER BY e.depth_m
        "#,
    )
    .bind(id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Récupérer les essais de potentiel de gonflement via échantillons
    let gonflement: Vec<serde_json::Value> = sqlx::query_scalar(
        r#"
        SELECT jsonb_build_object(
            'id', epg.id,
            'depth_m', e.depth_m,
            'cg', epg.cg,
            'cg_qual', epg.cg_qual,
            'type_sol', epg.type_sol,
            'echantillon_id', e.id
        )
        FROM essais_potentiel_gonflement epg
        INNER JOIN echantillons e ON epg.echantillon_id = e.id
        WHERE e.sondage_id = $1
        ORDER BY e.depth_m
        "#,
    )
    .bind(id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Récupérer les essais physiques via échantillons
    let physiques: Vec<serde_json::Value> = sqlx::query_scalar(
        r#"
        SELECT jsonb_build_object(
            'id', ep.id,
            'depth_m', e.depth_m,
            'densite_apparente_gcm3', ep.densite_apparente_gcm3,
            'densite_absolue_gcm3', ep.densite_absolue_gcm3,
            'teneur_eau_pct', ep.teneur_eau_pct,
            'w', ep.w,
            'rho_s', ep.rho_s,
            'laboratory', ep.laboratory,
            'measured_at', ep.measured_at,
            'echantillon_id', e.id
        )
        FROM essais_physiques ep
        INNER JOIN echantillons e ON ep.echantillon_id = e.id
        WHERE e.sondage_id = $1 AND ep.deleted_at IS NULL
        ORDER BY e.depth_m
        "#,
    )
    .bind(id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Récupérer les essais Proctor via échantillons
    let proctor: Vec<serde_json::Value> = sqlx::query_scalar(
        r#"
        SELECT jsonb_build_object(
            'id', epr.id,
            'depth_m', e.depth_m,
            'rho_d_max', epr.rho_d_max,
            'w_opt', epr.w_opt,
            'laboratory', epr.laboratory,
            'test_date', epr.test_date,
            'echantillon_id', e.id
        )
        FROM essais_proctor epr
        INNER JOIN echantillons e ON epr.echantillon_id = e.id
        WHERE e.sondage_id = $1
        ORDER BY e.depth_m
        "#,
    )
    .bind(id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Récupérer les points de granulométrie via échantillons (agrégés par échantillon)
    let granulo: Vec<serde_json::Value> = sqlx::query_scalar(
        r#"
        SELECT jsonb_build_object(
            'echantillon_id', e.id,
            'depth_m', e.depth_m,
            'method', gp.method,
            'points', jsonb_agg(
                jsonb_build_object(
                    'sieve_mm', gp.sieve_mm,
                    'passing_pct', gp.passing_pct
                ) ORDER BY gp.sieve_mm
            )
        )
        FROM granulo_points gp
        INNER JOIN echantillons e ON gp.echantillon_id = e.id
        WHERE e.sondage_id = $1
        GROUP BY e.id, e.depth_m, gp.method
        ORDER BY e.depth_m, gp.method
        "#,
    )
    .bind(id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Récupérer les échantillons
    let echantillons: Vec<serde_json::Value> = sqlx::query_scalar(
        r#"
        SELECT jsonb_build_object(
            'id', id,
            'depth_m', depth_m,
            'laboratory', laboratory,
            'norm', norm,
            'rho_s_gcm3', rho_s_gcm3,
            'water_content_w', water_content_w,
            'date', date
        )
        FROM echantillons
        WHERE sondage_id = $1
        ORDER BY depth_m
        "#,
    )
    .bind(id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Construire la réponse enrichie
    let mut result = sondage.as_object().unwrap().clone();
    result.insert("atterberg".to_string(), serde_json::json!(atterberg));
    result.insert("vbs".to_string(), serde_json::json!(vbs));
    result.insert("classif".to_string(), serde_json::json!(classif));
    result.insert("gonflement".to_string(), serde_json::json!(gonflement));
    result.insert("physiques".to_string(), serde_json::json!(physiques));
    result.insert("proctor".to_string(), serde_json::json!(proctor));
    result.insert("granulometrie".to_string(), serde_json::json!(granulo));
    result.insert("echantillons".to_string(), serde_json::json!(echantillons));

    Ok(Json(serde_json::Value::Object(result)))
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
        SELECT id, localite_base AS localite
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
