use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use sqlx::Row;
use uuid::Uuid;
use crate::state::AppState;

use super::types::*;
use super::classifier::*;
use super::colors::*;
use super::statistics::*;

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
    let tolerance = simplify_tolerance(req.zoom);
    
    // Construire la requête SQL dynamiquement
    // Utiliser la MV WGS84 (zéro transform, géométries déjà en 4326)
    let geom_column = if tolerance > 1000.0 {
        "geom_simplified"  // Zoom out : géométrie simplifiée
    } else {
        "geom"  // Zoom in : géométrie complète
    };
    
    let query = if req.include_geometry {
        let geom_select = format!("ST_AsGeoJSON({})::text as geom,", geom_column);
        
        let mut q = format!(
            "SELECT 
                code,
                {}
                CAST({} AS DOUBLE PRECISION) as value,
                n_sondages,
                n_essais_geo
             FROM mailles_geotechnique_stats_wgs84
             WHERE {} IS NOT NULL",
            geom_select, column, column
        );
        
        // Ajouter filtres
        if let Some(min_s) = req.min_sondages {
            q.push_str(&format!(" AND n_sondages >= {}", min_s));
        }
        
        if let Some(bbox) = req.bbox {
            q.push_str(&format!(
                " AND {} && ST_MakeEnvelope({}, {}, {}, {}, 4326)",
                geom_column, bbox[0], bbox[1], bbox[2], bbox[3]
            ));
        }
        
        q.push_str(" ORDER BY code");
        q
    } else {
        // Sans géométrie
        let mut q = format!(
            "SELECT 
                code,
                CAST({} AS DOUBLE PRECISION) as value,
                n_sondages,
                n_essais_geo
             FROM mailles_geotechnique_stats_wgs84
             WHERE {} IS NOT NULL",
            column, column
        );
        
        // Ajouter filtres
        if let Some(min_s) = req.min_sondages {
            q.push_str(&format!(" AND n_sondages >= {}", min_s));
        }
        
        q.push_str(" ORDER BY code");
        q
    };
    
    // Exécuter requête
    eprintln!("🔍 SQL Query: {}", query);
    let rows = sqlx::query(&query)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            eprintln!("❌ Erreur SQL: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Erreur base de données: {}", e))
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
                "n_sondages": row.get::<i64, _>("n_sondages"),
                "n_essais_geo": row.get::<i64, _>("n_essais_geo"),
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
                    },
                    Ok(None) | Err(_) => {
                        // Cas rare : skip silencieusement
                    }
                }
            } else {
                features.push(properties);
            }
        }
    }
    
    // Calculer statistiques
    let stats = calculate_statistics(&values);
    
    // Métadonnées
    let metadata = ResponseMetadata {
        parameter: req.parameter.sql_column().to_string(),
        parameter_label: req.parameter.label().to_string(),
        unit: req.parameter.unit().to_string(),
        category: req.parameter.category().to_string(),
        generated_at: chrono::Utc::now().to_rfc3339(),
        filters_applied: FiltersApplied {
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
        return Err((StatusCode::BAD_REQUEST, "Nombre de classes doit être entre 2 et 10".to_string()));
    }
    
    let breaks = match req.method {
        ClassificationMethod::Quantiles => {
            classify_quantiles(&req.values, req.n_classes)
                .map_err(|e| (StatusCode::BAD_REQUEST, e))?
        }
        ClassificationMethod::EqualInterval => {
            let min = req.values.iter().cloned().fold(f64::INFINITY, f64::min);
            let max = req.values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            classify_equal_interval(min, max, req.n_classes)
                .map_err(|e| (StatusCode::BAD_REQUEST, e))?
        }
        ClassificationMethod::Jenks => {
            classify_jenks(&req.values, req.n_classes)
                .map_err(|e| (StatusCode::BAD_REQUEST, e))?
        }
        ClassificationMethod::Custom => {
            req.custom_breaks.clone().unwrap_or_default()
        }
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
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
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
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Erreur sauvegarde: {}", e))
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
         LIMIT 100"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| {
        eprintln!("❌ Erreur liste configs: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Erreur récupération: {}", e))
    })?;
    
    let mut configs = Vec::new();
    for row in rows {
        let config_json: serde_json::Value = row.get("config");
        
        let classification = config_json.get("classification")
            .and_then(|c| serde_json::from_value(c.clone()).ok());
        
        let style: StyleConfig = config_json.get("style")
            .and_then(|s| serde_json::from_value(s.clone()).ok())
            .unwrap_or(StyleConfig {
                palette: "Blues".to_string(),
                opacity: 0.7,
                stroke_width: 1.0,
                stroke_color: "#333".to_string(),
            });
        
        let filters: FilterConfig = config_json.get("filters")
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
         WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Erreur DB: {}", e)))?
    .ok_or((StatusCode::NOT_FOUND, "Configuration non trouvée".to_string()))?;
    
    let config_json: serde_json::Value = row.get("config");
    
    let classification = config_json.get("classification")
        .and_then(|c| serde_json::from_value(c.clone()).ok());
    
    let style: StyleConfig = config_json.get("style")
        .and_then(|s| serde_json::from_value(s.clone()).ok())
        .unwrap_or(StyleConfig {
            palette: "Blues".to_string(),
            opacity: 0.7,
            stroke_width: 1.0,
            stroke_color: "#333".to_string(),
        });
    
    let filters: FilterConfig = config_json.get("filters")
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
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Erreur suppression: {}", e)))?;
    
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Configuration non trouvée".to_string()));
    }
    
    Ok(StatusCode::NO_CONTENT)
}

/// GET /thematic/palettes - Lister les palettes disponibles
pub async fn list_palettes() -> Json<Vec<String>> {
    Json(super::colors::list_palettes())
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
