use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use super::classifier::*;
use super::colors::*;
use super::statistics::*;
use super::types::*;

fn is_ai_parameter(column: &str) -> bool {
    matches!(
        column,
        "ai_rga_score_infer"
            | "ai_portance_kpa_infer"
            | "kriging_ip"
            | "kriging_vbs"
            | "ag_safety_factor"
            | "ag_cout_millions"
    )
}

/// Calculer le nombre total de mailles dans l'ADM (sans filtre min_sondages)
async fn calculate_count_total(pool: &PgPool, req: &ThematicDataRequest) -> Option<usize> {
    let grid = req.grid.as_deref().unwrap_or("2km");
    let grid = if grid == "28km" { "28km" } else { "2km" };

    if grid == "28km" {
        // Compter le nombre total de mailles 28km dans la zone (sans filtre min_sondages)
        // Approche robuste: compter les m28 qui intersectent au moins une maille 2km filtrée (ADM) et éventuellement bbox.
        let mut query = String::from(
            "SELECT COUNT(DISTINCT m28.code_m28) as cnt \n             FROM atlas.maille_28km m28 \n             JOIN (\n                 SELECT ST_Transform(geom, 25231) as geom, adm1_name, adm2_name, adm3_name\n                 FROM mailles_geotechnique_stats_wgs84\n             ) m2 ON ST_Intersects(m2.geom, m28.geom)\n             WHERE 1=1",
        );
        let mut param_index = 1;

        if req.bbox.is_some() {
            query.push_str(&format!(
                " AND m28.geom && ST_Transform(ST_MakeEnvelope(${},${},${},${},4326),25231)",
                param_index,
                param_index + 1,
                param_index + 2,
                param_index + 3
            ));
            param_index += 4;
        }

        if req.adm1.is_some() {
            // adm1_name n'est pas forcément rempli dans la MV; déduire l'ADM1 via adm2_tg
            query.push_str(&format!(
                " AND EXISTS (SELECT 1 FROM adm2_tg a2 WHERE a2.name = m2.adm2_name AND a2.adm1_name = ${})",
                param_index
            ));
            param_index += 1;
        }
        if req.adm2.is_some() {
            query.push_str(&format!(" AND m2.adm2_name = ${}", param_index));
            param_index += 1;
        }
        if req.adm3.is_some() {
            query.push_str(&format!(" AND m2.adm3_name = ${}", param_index));
        }

        let mut query_builder = sqlx::query(&query);
        if let Some(bbox) = req.bbox {
            query_builder = query_builder
                .bind(bbox[0])
                .bind(bbox[1])
                .bind(bbox[2])
                .bind(bbox[3]);
        }
        if let Some(adm1) = &req.adm1 {
            query_builder = query_builder.bind(adm1);
        }
        if let Some(adm2) = &req.adm2 {
            query_builder = query_builder.bind(adm2);
        }
        if let Some(adm3) = &req.adm3 {
            query_builder = query_builder.bind(adm3);
        }

        return match query_builder.fetch_one(pool).await {
            Ok(row) => {
                let cnt: i64 = row.get("cnt");
                Some(cnt as usize)
            }
            Err(e) => {
                eprintln!("⚠️ Erreur count_total 28km: {}", e);
                None
            }
        };
    }

    // Construire la requête de comptage sans le filtre min_sondages
    let mut query =
        String::from("SELECT COUNT(*) as cnt FROM mailles_geotechnique_stats_wgs84 WHERE 1=1");
    let mut param_index = 1;

    // Filtres ADM uniquement (pas min_sondages)
    if req.adm1.is_some() {
        // adm1_name peut être NULL dans la MV; on passe par adm2_name -> adm2_tg.adm1_name
        query.push_str(&format!(
            " AND EXISTS (SELECT 1 FROM adm2_tg a2 WHERE a2.name = adm2_name AND a2.adm1_name = ${})",
            param_index
        ));
        param_index += 1;
    }
    if req.adm2.is_some() {
        query.push_str(&format!(" AND adm2_name = ${}", param_index));
        param_index += 1;
    }
    if req.adm3.is_some() {
        query.push_str(&format!(" AND adm3_name = ${}", param_index));
        // param_index += 1; // Unused after this
    }

    let mut query_builder = sqlx::query(&query);
    if let Some(adm1) = &req.adm1 {
        query_builder = query_builder.bind(adm1);
    }
    if let Some(adm2) = &req.adm2 {
        query_builder = query_builder.bind(adm2);
    }
    if let Some(adm3) = &req.adm3 {
        query_builder = query_builder.bind(adm3);
    }

    match query_builder.fetch_one(pool).await {
        Ok(row) => {
            let cnt: i64 = row.get("cnt");
            Some(cnt as usize)
        }
        Err(e) => {
            eprintln!("⚠️ Erreur count_total: {}", e);
            None
        }
    }
}

/// Calculer le contexte parent pour comparaisons multi-niveaux
async fn calculate_parent_context(
    pool: &PgPool,
    req: &ThematicDataRequest,
) -> Option<ParentContext> {
    let grid = req.grid.as_deref().unwrap_or("2km");
    let grid = if grid == "28km" { "28km" } else { "2km" };
    if grid == "28km" {
        return None;
    }

    let column = req.parameter.sql_column();

    // Déterminer le niveau parent
    let (parent_level, parent_name, parent_filter) = if req.adm3.is_some() {
        // ADM3 → parent = ADM2
        if let Some(adm2) = &req.adm2 {
            (
                "adm2",
                adm2.clone(),
                format!("adm2_name = '{}'", adm2.replace("'", "''")),
            )
        } else {
            return None;
        }
    } else if req.adm2.is_some() {
        // ADM2 → parent = ADM1
        if let Some(adm1) = &req.adm1 {
            (
                "adm1",
                adm1.clone(),
                format!(
                    "EXISTS (SELECT 1 FROM adm2_tg a2 WHERE a2.name = adm2_name AND a2.adm1_name = '{}')",
                    adm1.replace("'", "''")
                ),
            )
        } else {
            return None;
        }
    } else if req.adm1.is_some() {
        // ADM1 → parent = Togo (tout le pays)
        ("adm0", "Togo".to_string(), "1=1".to_string())
    } else {
        // Pas de filtre ADM → pas de contexte parent
        return None;
    };

    // Requête pour le parent
    let query = format!(
        "SELECT COALESCE(SUM({}), 0) as parent_sum, COUNT(*) as parent_cells 
         FROM mailles_geotechnique_stats_wgs84 
         WHERE {} IS NOT NULL AND {}",
        column, column, parent_filter
    );

    match sqlx::query(&query).fetch_one(pool).await {
        Ok(row) => {
            let parent_sum: f64 = row.try_get("parent_sum").unwrap_or(0.0);
            let parent_cells: i64 = row.try_get("parent_cells").unwrap_or(0);

            Some(ParentContext {
                level: parent_level.to_string(),
                parent_name,
                parent_sum,
                parent_cells: parent_cells as usize,
            })
        }
        Err(e) => {
            eprintln!("⚠️ Erreur parent_context: {}", e);
            None
        }
    }
}

/// Calculer la tolérance de simplification selon le zoom
fn simplify_tolerance(zoom: Option<u8>) -> f64 {
    match zoom {
        Some(z) if z >= 12 => 50.0,
        Some(z) if z >= 10 => 200.0,
        Some(z) if z >= 8 => 1000.0,
        Some(z) if z >= 6 => 2000.0,
        _ => 2000.0, // Par défaut
    }
}

/// GET /thematic/data - Récupérer les données pour une carte thématique
pub async fn get_thematic_data(
    State(state): State<AppState>,
    Query(req): Query<ThematicDataRequest>,
) -> Result<Json<ThematicDataResponse>, (StatusCode, String)> {
    let pool = &state.pool;
    let column = req.parameter.sql_column();
    let ai_parameter = is_ai_parameter(column);
    let tolerance = simplify_tolerance(req.zoom);

    let grid = req.grid.as_deref().unwrap_or("2km");
    let grid = if grid == "28km" { "28km" } else { "2km" };

    // Construire la requête SQL dynamiquement
    // 2km: MV WGS84 (géométries déjà en 4326)
    // 28km: agrégation PostGIS (aires en EPSG:25231), géométries retournées en 4326
    let geom_column = if tolerance > 1000.0 {
        "geom_simplified" // Zoom out : géométrie simplifiée
    } else {
        "geom" // Zoom in : géométrie complète
    };

    // Construire la requête avec paramètres sécurisés
    let mut param_index = 1;

    // Cas spécial pour altitude_mean : utiliser les vues DSM
    let base_query = if ai_parameter {
        if req.include_geometry {
            format!(
                "SELECT
                    code,
                    ST_AsGeoJSON(geom)::text as geom,
                    CAST({} AS DOUBLE PRECISION) as value,
                    CAST(n_sondages AS INTEGER) as n_sondages,
                    CAST(n_essais_geo AS INTEGER) as n_essais_geo,
                    adm1_name,
                    adm2_name,
                    adm3_name
                 FROM atlas.v_thematic_ai_geotech
                 WHERE {} IS NOT NULL",
                column, column
            )
        } else {
            format!(
                "SELECT
                    code,
                    CAST({} AS DOUBLE PRECISION) as value,
                    CAST(n_sondages AS INTEGER) as n_sondages,
                    CAST(n_essais_geo AS INTEGER) as n_essais_geo,
                    adm1_name,
                    adm2_name,
                    adm3_name
                 FROM atlas.v_thematic_ai_geotech
                 WHERE {} IS NOT NULL",
                column, column
            )
        }
    } else if column == "altitude_mean" {
        if req.include_geometry {
            format!(
                "SELECT 
                    m.code,
                    ST_AsGeoJSON(ST_Transform(m.geom, 4326))::text as geom,
                    CAST(d.altitude_mean AS DOUBLE PRECISION) as value,
                    0 as n_sondages,
                    0 as n_essais_geo,
                    NULL::text as adm1_name,
                    m.adm2_name,
                    NULL::text as adm3_name
                 FROM atlas.mailles m
                 JOIN atlas.v_maille_dsm_2km_flat d ON d.code = m.code
                 WHERE d.altitude_mean IS NOT NULL"
            )
        } else {
            format!(
                "SELECT 
                    m.code,
                    CAST(d.altitude_mean AS DOUBLE PRECISION) as value,
                    0 as n_sondages,
                    0 as n_essais_geo,
                    NULL::text as adm1_name,
                    m.adm2_name,
                    NULL::text as adm3_name
                 FROM atlas.mailles m
                 JOIN atlas.v_maille_dsm_2km_flat d ON d.code = m.code
                 WHERE d.altitude_mean IS NOT NULL"
            )
        }
    } else if grid == "28km" {
        // Agrégation 28km : moyenne pondérée par aire d'intersection (EPSG:25231)
        // Notes:
        // - On agrège sur la grille 28km (atlas.maille_28km)
        // - On intersecte avec les mailles 2km stats (MV WGS84 transformée en 25231)
        // - Les filtres (adm/bbox/min_sondages) doivent s'appliquer AVANT l'agrégation
        let geom_expr = if req.include_geometry {
            if tolerance > 1000.0 {
                "ST_AsGeoJSON(ST_SimplifyPreserveTopology(ST_Transform(m28.geom, 4326), 0.001))::text as geom"
            } else {
                "ST_AsGeoJSON(ST_Transform(m28.geom, 4326))::text as geom"
            }
        } else {
            "NULL::text as geom"
        };

        // On prépare la requête jusqu'au WHERE afin que les filtres puissent être ajoutés ensuite
        format!(
            "WITH base AS (
                SELECT
                    ('TG-28KM-' || LPAD(m28.code_m28::text, 3, '0')) as code,
                    {},
                    (
                        SUM(CAST(m2.metric_value AS DOUBLE PRECISION) * ST_Area(ST_Intersection(m2.geom, m28.geom)))
                        / NULLIF(SUM(ST_Area(ST_Intersection(m2.geom, m28.geom))), 0)
                    ) as value,
                    CAST(SUM(m2.n_sondages) AS INTEGER) as n_sondages,
                    CAST(SUM(m2.n_essais_geo) AS INTEGER) as n_essais_geo,
                    NULL::text as adm1_name,
                    NULL::text as adm2_name,
                    NULL::text as adm3_name
                FROM atlas.maille_28km m28
                JOIN (
                    SELECT
                        code,
                        n_sondages,
                        n_essais_geo,
                        adm1_name,
                        adm2_name,
                        adm3_name,
                        ST_Transform(geom, 25231) as geom,
                        {} as metric_value
                    FROM mailles_geotechnique_stats_wgs84
                ) m2
                  ON ST_Intersects(m2.geom, m28.geom)
                WHERE m2.metric_value IS NOT NULL",
            geom_expr,
            column
        )
    } else if req.include_geometry {
        format!(
            "SELECT 
                code,
                ST_AsGeoJSON({})::text as geom,
                CAST({} AS DOUBLE PRECISION) as value,
                CAST(n_sondages AS INTEGER) as n_sondages,
                CAST(n_essais_geo AS INTEGER) as n_essais_geo,
                adm1_name,
                adm2_name,
                adm3_name
             FROM mailles_geotechnique_stats_wgs84
             WHERE {} IS NOT NULL",
            geom_column, column, column
        )
    } else {
        format!(
            "SELECT 
                code,
                CAST({} AS DOUBLE PRECISION) as value,
                CAST(n_sondages AS INTEGER) as n_sondages,
                CAST(n_essais_geo AS INTEGER) as n_essais_geo,
                adm1_name,
                adm2_name,
                adm3_name
             FROM mailles_geotechnique_stats_wgs84
             WHERE {} IS NOT NULL",
            column, column
        )
    };

    let mut query = base_query;

    // Filtre min_sondages
    // Important: pour les paramètres IA/Interpolation/AG, les valeurs sont déjà
    // pré-calculées pour toutes les mailles; on ne doit pas exclure les mailles
    // sur un critère de sondages.
    if req.min_sondages.is_some() && !ai_parameter {
        if grid == "28km" {
            query.push_str(&format!(" AND m2.n_sondages >= ${}", param_index));
        } else {
            query.push_str(&format!(" AND n_sondages >= ${}", param_index));
        }
        param_index += 1;
    }

    // Filtre bbox (WGS84)
    if req.bbox.is_some() {
        // 2km MV en 4326 direct via geom/geom_simplified
        // 28km : on filtre sur la geom 28km (table atlas.maille_28km en 25231) en transformant l'enveloppe 4326 -> 25231
        if grid == "28km" {
            query.push_str(&format!(
                " AND m28.geom && ST_Transform(ST_MakeEnvelope(${},${},${},${},4326),25231)",
                param_index,
                param_index + 1,
                param_index + 2,
                param_index + 3
            ));
        } else {
            query.push_str(&format!(
                " AND {} && ST_MakeEnvelope(${},${},${},${},4326)",
                geom_column,
                param_index,
                param_index + 1,
                param_index + 2,
                param_index + 3
            ));
        }
        param_index += 4;
    }

    // Filtres ADM (paramétrés - colonnes maintenant dans la MV)
    if req.adm1.is_some() {
        if grid == "28km" {
            // adm1_name pas forcément rempli; utiliser adm2_name -> adm2_tg
            query.push_str(&format!(
                " AND EXISTS (SELECT 1 FROM adm2_tg a2 WHERE a2.name = m2.adm2_name AND a2.adm1_name = ${})",
                param_index
            ));
        } else {
            query.push_str(&format!(
                " AND EXISTS (SELECT 1 FROM adm2_tg a2 WHERE a2.name = adm2_name AND a2.adm1_name = ${})",
                param_index
            ));
        }
        param_index += 1;
    }
    if req.adm2.is_some() {
        if grid == "28km" {
            query.push_str(&format!(" AND m2.adm2_name = ${}", param_index));
        } else {
            query.push_str(&format!(" AND adm2_name = ${}", param_index));
        }
        param_index += 1;
    }
    if req.adm3.is_some() {
        if grid == "28km" {
            query.push_str(&format!(" AND m2.adm3_name = ${}", param_index));
        } else {
            query.push_str(&format!(" AND adm3_name = ${}", param_index));
        }
        param_index += 1;
    }

    if grid == "28km" {
        query.push_str(
            " GROUP BY m28.code_m28, m28.geom
            )
            SELECT code, geom, CAST(value AS DOUBLE PRECISION) as value, n_sondages, n_essais_geo, adm1_name, adm2_name, adm3_name
            FROM base
            WHERE value IS NOT NULL"
        );
    }

    query.push_str(" ORDER BY code");

    // Exécuter requête avec paramètres
    eprintln!("🔍 SQL Query: {}", query);
    eprintln!(
        "🔒 Params: min_sondages={:?}, adm1={:?}, adm2={:?}, adm3={:?}",
        req.min_sondages, req.adm1, req.adm2, req.adm3
    );

    let mut query_builder = sqlx::query(&query);

    // Bind parameters
    if let Some(min_s) = req.min_sondages {
        query_builder = query_builder.bind(min_s);
    }

    if let Some(bbox) = req.bbox {
        query_builder = query_builder
            .bind(bbox[0])
            .bind(bbox[1])
            .bind(bbox[2])
            .bind(bbox[3]);
    }
    if let Some(adm1) = &req.adm1 {
        query_builder = query_builder.bind(adm1);
    }
    if let Some(adm2) = &req.adm2 {
        query_builder = query_builder.bind(adm2);
    }
    if let Some(adm3) = &req.adm3 {
        query_builder = query_builder.bind(adm3);
    }

    let rows = query_builder.fetch_all(pool).await.map_err(|e| {
        eprintln!("❌ Erreur SQL: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Erreur base de données: {}", e),
        )
    })?;

    eprintln!("✅ Rows fetched: {}", rows.len());

    // Construire GeoJSON et collecter valeurs
    let mut features = Vec::new();
    let mut values = Vec::new();

    for row in rows {
        let value: Option<f64> = match row.try_get("value") {
            Ok(v) => v,
            Err(e) => {
                eprintln!("⚠️  Erreur try_get value: {}", e);
                None
            }
        };

        if let Some(v) = value {
            values.push(v);

            let properties = serde_json::json!({
                "code": row.get::<String, _>("code"),
                "value": v,
                // Dans la vue `atlas.v_thematic_ai_geotech`, ces compteurs sont typés en INT4 (integer).
                // Utiliser i32 évite les panics sqlx sur mismatch de type.
                "n_sondages": row.get::<i32, _>("n_sondages"),
                "n_essais_geo": row.get::<i32, _>("n_essais_geo"),
            });

            if req.include_geometry {
                // Géométries toujours présentes dans la MV WGS84
                match row.try_get::<Option<String>, _>("geom") {
                    Ok(Some(geom_str)) => {
                        let feature = serde_json::json!({
                            "type": "Feature",
                            "geometry": serde_json::from_str::<serde_json::Value>(&geom_str)
                                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Erreur parsing GeoJSON: {}", e)))?,
                            "properties": properties
                        });
                        features.push(feature);
                    }
                    Ok(None) | Err(_) => {
                        // Cas rare : skip silencieusement
                    }
                }
            } else {
                let feature = serde_json::json!({
                    "type": "Feature",
                    "geometry": serde_json::Value::Null,
                    "properties": properties
                });
                features.push(feature);
            }
        }
    }

    // Calculer count_total (toutes les mailles de l'ADM, sans filtre min_sondages)
    let count_total = calculate_count_total(pool, &req).await;

    // Calculer parent_context pour comparaisons multi-niveaux
    let parent_context = calculate_parent_context(pool, &req).await;

    // Calculer statistiques enrichies
    let stats = calculate_statistics_extended(&values, count_total, parent_context);

    // Métadonnées
    let metadata = ResponseMetadata {
        parameter: req.parameter.sql_column().to_string(),
        parameter_label: req.parameter.label().to_string(),
        unit: req.parameter.unit().to_string(),
        category: req.parameter.category().to_string(),
        generated_at: chrono::Utc::now().to_rfc3339(),
        filters_applied: FiltersApplied {
            grid: req.grid,
            bbox: req.bbox,
            adm1: req.adm1,
            adm2: req.adm2,
            adm3: req.adm3,
            min_sondages: req.min_sondages,
        },
    };

    Ok(Json(ThematicDataResponse {
        feature_type: "FeatureCollection".to_string(),
        features,
        statistics: stats,
        metadata,
    }))
}

/// POST /thematic/classify - Classifier des données
pub async fn classify_data(
    Json(req): Json<ClassifyRequest>,
) -> Result<Json<ClassifyResponse>, (StatusCode, String)> {
    if req.values.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Aucune valeur fournie".to_string()));
    }

    if req.n_classes < 2 || req.n_classes > 10 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Nombre de classes doit être entre 2 et 10".to_string(),
        ));
    }

    let breaks = match req.method {
        ClassificationMethod::Quantiles => classify_quantiles(&req.values, req.n_classes)
            .map_err(|e| (StatusCode::BAD_REQUEST, e))?,
        ClassificationMethod::EqualInterval => {
            let min = req.values.iter().cloned().fold(f64::INFINITY, f64::min);
            let max = req.values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            classify_equal_interval(min, max, req.n_classes)
                .map_err(|e| (StatusCode::BAD_REQUEST, e))?
        }
        ClassificationMethod::Jenks => {
            classify_jenks(&req.values, req.n_classes).map_err(|e| (StatusCode::BAD_REQUEST, e))?
        }
        ClassificationMethod::Custom => req.custom_breaks.clone().unwrap_or_default(),
    };

    let palette_name = req.palette.as_deref().unwrap_or("Blues");
    let colors = select_colors(palette_name, req.n_classes);
    let labels = generate_labels(&breaks, 1);

    Ok(Json(ClassifyResponse {
        breaks,
        colors,
        labels,
        method: format!("{:?}", req.method),
        n_classes: req.n_classes,
    }))
}

/// POST /thematic/configs - Créer une configuration
pub async fn create_config(
    State(state): State<AppState>,
    Json(config): Json<ThematicConfig>,
) -> Result<Json<ThematicConfig>, (StatusCode, String)> {
    let pool = &state.pool;
    let id = Uuid::new_v4();
    let config_json = serde_json::json!({
        "classification": config.classification,
        "style": config.style,
        "filters": config.filters,
    });

    let map_type_str = format!("{:?}", config.map_type).to_lowercase();

    sqlx::query(
        "INSERT INTO thematic_configs 
         (id, name, description, map_type, parameter, config, is_public, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(id)
    .bind(&config.name)
    .bind(&config.description)
    .bind(&map_type_str)
    .bind(&config.parameter)
    .bind(&config_json)
    .bind(config.is_public)
    .bind(&config.created_by)
    .execute(pool)
    .await
    .map_err(|e| {
        eprintln!("❌ Erreur création config: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Erreur sauvegarde: {}", e),
        )
    })?;

    Ok(Json(ThematicConfig {
        id: Some(id),
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
        ..config
    }))
}

/// GET /thematic/configs - Lister les configurations
pub async fn list_configs(
    State(state): State<AppState>,
) -> Result<Json<Vec<ThematicConfig>>, (StatusCode, String)> {
    let pool = &state.pool;
    let rows = sqlx::query(
        "SELECT id, name, description, map_type, parameter, config, is_public, 
                created_by, created_at, updated_at
         FROM thematic_configs
         WHERE is_public = true
         ORDER BY created_at DESC
         LIMIT 100",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| {
        eprintln!("❌ Erreur liste configs: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Erreur récupération: {}", e),
        )
    })?;

    let mut configs = Vec::new();
    for row in rows {
        let config_json: serde_json::Value = row.get("config");

        let classification = config_json
            .get("classification")
            .and_then(|c| serde_json::from_value(c.clone()).ok());

        let style: StyleConfig = config_json
            .get("style")
            .and_then(|s| serde_json::from_value(s.clone()).ok())
            .unwrap_or(StyleConfig {
                palette: "Blues".to_string(),
                opacity: 0.7,
                stroke_width: 0.1, // v4.5.1: Réduit pour export discret
                stroke_color: "#F0F0F0".to_string(),
            });

        let filters: FilterConfig = config_json
            .get("filters")
            .and_then(|f| serde_json::from_value(f.clone()).ok())
            .unwrap_or(FilterConfig {
                bbox: None,
                adm1: None,
                adm2: None,
                adm3: None,
                min_sondages: None,
            });

        let map_type_str: String = row.get("map_type");
        let map_type = match map_type_str.as_str() {
            "choropleth" => MapType::Choropleth,
            "proportional" => MapType::Proportional,
            "comparative" => MapType::Comparative,
            _ => MapType::Choropleth,
        };

        configs.push(ThematicConfig {
            id: Some(row.get("id")),
            name: row.get("name"),
            description: row.get("description"),
            map_type,
            parameter: row.get("parameter"),
            classification,
            style,
            filters,
            is_public: row.get("is_public"),
            created_by: row.get("created_by"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        });
    }

    Ok(Json(configs))
}

/// GET /thematic/configs/:id - Récupérer une configuration
pub async fn get_config(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ThematicConfig>, (StatusCode, String)> {
    let pool = &state.pool;
    let row = sqlx::query(
        "SELECT id, name, description, map_type, parameter, config, is_public,
                created_by, created_at, updated_at
         FROM thematic_configs
         WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Erreur DB: {}", e),
        )
    })?
    .ok_or((
        StatusCode::NOT_FOUND,
        "Configuration non trouvée".to_string(),
    ))?;

    let config_json: serde_json::Value = row.get("config");

    let classification = config_json
        .get("classification")
        .and_then(|c| serde_json::from_value(c.clone()).ok());

    let style: StyleConfig = config_json
        .get("style")
        .and_then(|s| serde_json::from_value(s.clone()).ok())
        .unwrap_or(StyleConfig {
            palette: "Blues".to_string(),
            opacity: 0.7,
            stroke_width: 0.1, // v4.5.1: Réduit pour export discret
            stroke_color: "#F0F0F0".to_string(),
        });

    let filters: FilterConfig = config_json
        .get("filters")
        .and_then(|f| serde_json::from_value(f.clone()).ok())
        .unwrap_or_default();

    let map_type_str: String = row.get("map_type");
    let map_type = match map_type_str.as_str() {
        "choropleth" => MapType::Choropleth,
        "proportional" => MapType::Proportional,
        "comparative" => MapType::Comparative,
        _ => MapType::Choropleth,
    };

    Ok(Json(ThematicConfig {
        id: Some(row.get("id")),
        name: row.get("name"),
        description: row.get("description"),
        map_type,
        parameter: row.get("parameter"),
        classification,
        style,
        filters,
        is_public: row.get("is_public"),
        created_by: row.get("created_by"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }))
}

/// DELETE /thematic/configs/:id - Supprimer une configuration
pub async fn delete_config(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let pool = &state.pool;
    let result = sqlx::query("DELETE FROM thematic_configs WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur suppression: {}", e),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            "Configuration non trouvée".to_string(),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}

/// GET /thematic/palettes - Lister les palettes disponibles
pub async fn list_palettes() -> Json<Vec<String>> {
    Json(super::colors::list_palettes())
}

/// GET /thematic/cells/adm - Récupérer toutes les mailles d'un ADM (y compris vides)
/// Utilisé pour l'export avec affichage des mailles sans données
pub async fn get_adm_cells(
    State(state): State<AppState>,
    Query(params): Query<AdmCellsRequest>,
) -> Result<Json<AdmCellsResponse>, (StatusCode, String)> {
    let pool = &state.pool;

    // Construire la requête pour récupérer toutes les mailles de l'ADM
    let mut query = String::from(
        "SELECT 
            code as cell_id,
            ST_AsGeoJSON(geom)::json as geometry,
            n_sondages,
            adm1_name, adm2_name, adm3_name
         FROM mailles_geotechnique_stats_wgs84 
         WHERE 1=1",
    );

    let mut param_index = 1;

    if params.adm1.is_some() {
        query.push_str(&format!(" AND adm1_name = ${}", param_index));
        param_index += 1;
    }
    if params.adm2.is_some() {
        query.push_str(&format!(" AND adm2_name = ${}", param_index));
        param_index += 1;
    }
    if params.adm3.is_some() {
        query.push_str(&format!(" AND adm3_name = ${}", param_index));
        // param_index += 1;
    }

    let mut query_builder = sqlx::query(&query);
    if let Some(adm1) = &params.adm1 {
        query_builder = query_builder.bind(adm1);
    }
    if let Some(adm2) = &params.adm2 {
        query_builder = query_builder.bind(adm2);
    }
    if let Some(adm3) = &params.adm3 {
        query_builder = query_builder.bind(adm3);
    }

    let rows = query_builder.fetch_all(pool).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Erreur DB: {}", e),
        )
    })?;

    let mut cells: Vec<AdmCell> = Vec::new();
    let mut total_count = 0;
    let mut with_data_count = 0;

    for row in rows {
        let cell_id: String = row.get("cell_id");
        let geometry: serde_json::Value = row.get("geometry");
        let n_sondages: Option<i32> = row.try_get("n_sondages").ok();

        let has_data = n_sondages.map(|n| n > 0).unwrap_or(false);
        if has_data {
            with_data_count += 1;
        }
        total_count += 1;

        cells.push(AdmCell {
            cell_id,
            geometry,
            has_data,
            n_sondages,
        });
    }

    Ok(Json(AdmCellsResponse {
        cells,
        total_count,
        with_data_count,
        without_data_count: total_count - with_data_count,
    }))
}

impl Default for FilterConfig {
    fn default() -> Self {
        Self {
            bbox: None,
            adm1: None,
            adm2: None,
            adm3: None,
            min_sondages: None,
        }
    }
}
