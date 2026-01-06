use crate::state::AppState;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;

// ============================================================================
// ADM Neighbors Types
// ============================================================================

#[derive(Deserialize)]
pub struct AdmNeighborsQuery {
    pub level: String,
    pub name: String,
}

#[derive(Serialize)]
pub struct AdmNeighbor {
    pub code: Option<String>,
    pub name: String,
    pub label: String,
    pub neighbor_type: String,
    pub direction: String,
    pub lon: f64,
    pub lat: f64,
}

#[derive(Serialize)]
pub struct AdmNeighborsResponse {
    pub adm_level: String,
    pub adm_name: String,
    pub neighbors: Vec<AdmNeighbor>,
}

#[derive(Serialize)]
pub struct GridResponse {
    pub code: String,
    pub bbox: [f64; 4],
    pub stats: serde_json::Value,
    pub summary: serde_json::Value,
}

pub fn grid_router() -> Router<AppState> {
    Router::new()
        .route("/:code", get(get_grid))
        .route("/:code/shape", get(get_grid_shape))
        .route("/:code/details", get(get_grid_details))
        .route("/:code/neighbors", get(crate::neighbors::get_neighbors))
        .route("/recompute/:code", post(recompute_grid))
}

/// GET /adm/neighbors?level=adm1&name=Maritime
/// Récupère les ADM limitrophes et pays voisins
pub async fn get_adm_neighbors(
    Query(params): Query<AdmNeighborsQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let level = params.level.to_lowercase();
    let name = params.name.clone();
    
    // Déterminer la table et le champ selon le niveau
    // Tables: adm1_tg, adm2_tg, adm3_tg avec champ "name"
    let table = match level.as_str() {
        "adm1" => "adm1_tg",
        "adm2" => "adm2_tg",
        "adm3" => "adm3_tg",
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid level. Use adm1, adm2, or adm3"})),
            ).into_response();
        }
    };
    let name_field = "name"; // Champ commun à toutes les tables
    
    // Récupérer le centroïde de l'ADM cible
    let target_query = format!(
        r#"
        SELECT 
            ST_X(ST_Centroid(geom)) as center_lon,
            ST_Y(ST_Centroid(geom)) as center_lat
        FROM {}
        WHERE {} ILIKE $1
        LIMIT 1
        "#,
        table, name_field
    );
    
    let target_row = sqlx::query(&target_query)
        .bind(&name)
        .fetch_optional(pool)
        .await;
    
    let (center_lon, center_lat) = match target_row {
        Ok(Some(row)) => {
            let lon: f64 = row.try_get("center_lon").unwrap_or(1.2);
            let lat: f64 = row.try_get("center_lat").unwrap_or(7.0);
            (lon, lat)
        }
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": format!("ADM '{}' not found", name)})),
            ).into_response();
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Database error: {}", e)})),
            ).into_response();
        }
    };
    
    let mut neighbors: Vec<AdmNeighbor> = Vec::new();
    
    // Récupérer les ADM voisins du même niveau
    let neighbors_query = format!(
        r#"
        WITH target AS (
            SELECT geom, ST_Centroid(geom) as centroid
            FROM {}
            WHERE {} ILIKE $1
            LIMIT 1
        )
        SELECT 
            n.{} as name,
            ST_X(ST_Centroid(n.geom)) as neighbor_center_lon,
            ST_Y(ST_Centroid(n.geom)) as neighbor_center_lat
        FROM {} n, target t
        WHERE n.{} NOT ILIKE $1
          AND ST_Touches(n.geom, t.geom)
        "#,
        table, name_field, name_field, table, name_field
    );
    
    if let Ok(rows) = sqlx::query(&neighbors_query)
        .bind(&name)
        .fetch_all(pool)
        .await
    {
        for row in rows {
            let neighbor_name: String = row.try_get("name").unwrap_or_default();
            let n_center_lon: f64 = row.try_get("neighbor_center_lon").unwrap_or(0.0);
            let n_center_lat: f64 = row.try_get("neighbor_center_lat").unwrap_or(0.0);
            
            // Calculer la direction
            let dx = n_center_lon - center_lon;
            let dy = n_center_lat - center_lat;
            let direction = if dx.abs() > dy.abs() {
                if dx > 0.0 { "E" } else { "W" }
            } else {
                if dy > 0.0 { "N" } else { "S" }
            };
            
            // Formater le label selon le niveau
            let label = match level.as_str() {
                "adm1" => format!("Région {}", neighbor_name),
                "adm2" => format!("Préf. {}", neighbor_name),
                "adm3" => neighbor_name.clone(),
                _ => neighbor_name.clone(),
            };
            
            neighbors.push(AdmNeighbor {
                code: None,
                name: neighbor_name,
                label,
                neighbor_type: level.clone(),
                direction: direction.to_string(),
                lon: n_center_lon,
                lat: n_center_lat,
            });
        }
    }
    
    // Pour ADM1, ajouter les pays voisins
    if level == "adm1" {
        let country_check_query = r#"
            WITH target AS (
                SELECT geom FROM adm1_togo WHERE adm1_fr ILIKE $1 LIMIT 1
            )
            SELECT 
                ST_XMin(t.geom) as xmin,
                ST_XMax(t.geom) as xmax,
                ST_YMax(t.geom) as ymax
            FROM target t
        "#;
        
        if let Ok(Some(row)) = sqlx::query(country_check_query)
            .bind(&name)
            .fetch_optional(pool)
            .await
        {
            let xmin: f64 = row.try_get("xmin").unwrap_or(1.0);
            let xmax: f64 = row.try_get("xmax").unwrap_or(1.0);
            let ymax: f64 = row.try_get("ymax").unwrap_or(7.0);
            
            // Ghana à l'ouest (si xmin < 0.3)
            if xmin < 0.3 {
                neighbors.push(AdmNeighbor {
                    code: Some("GH".to_string()),
                    name: "Ghana".to_string(),
                    label: "Ghana".to_string(),
                    neighbor_type: "country".to_string(),
                    direction: "W".to_string(),
                    lon: 0.0,
                    lat: center_lat,
                });
            }
            // Bénin à l'est (si xmax > 1.6)
            if xmax > 1.6 {
                neighbors.push(AdmNeighbor {
                    code: Some("BJ".to_string()),
                    name: "Bénin".to_string(),
                    label: "Bénin".to_string(),
                    neighbor_type: "country".to_string(),
                    direction: "E".to_string(),
                    lon: 1.8,
                    lat: center_lat,
                });
            }
            // Burkina Faso au nord (si ymax > 10.5)
            if ymax > 10.5 {
                neighbors.push(AdmNeighbor {
                    code: Some("BF".to_string()),
                    name: "Burkina Faso".to_string(),
                    label: "Burkina Faso".to_string(),
                    neighbor_type: "country".to_string(),
                    direction: "N".to_string(),
                    lon: center_lon,
                    lat: 11.0,
                });
            }
        }
    }
    
    (
        StatusCode::OK,
        Json(AdmNeighborsResponse {
            adm_level: level,
            adm_name: name,
            neighbors,
        }),
    ).into_response()
}

async fn get_grid(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let pool = &state.pool;
    let grid_type = params.get("grid").map(|s| s.as_str()).unwrap_or("2km");
    
    // Déterminer la table selon le type de grille
    let table_name = if grid_type == "28km" {
        "atlas.maille_28km"
    } else {
        "atlas.mailles"
    };
    
    // Maille bbox (4326) + stats
    let query_str = format!(
        r#"
        SELECT id,
               stats,
               ST_XMin(g4326) AS xmin,
               ST_YMin(g4326) AS ymin,
               ST_XMax(g4326) AS xmax,
               ST_YMax(g4326) AS ymax
        FROM (
            SELECT id, stats, ST_Transform(ST_Envelope(geom), 4326) AS g4326
            FROM {} WHERE code = $1
        ) q
        "#,
        table_name
    );
    
    let row_opt = sqlx::query(&query_str)
        .bind(&code)
        .fetch_optional(pool)
        .await;

    let row = match row_opt {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error":"maille introuvable"})),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!(error=?e, "db error get_grid");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let maille_id: uuid::Uuid = match row.try_get("id") {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "decode id");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"decode"})),
            )
                .into_response();
        }
    };
    let stats: serde_json::Value = row.try_get("stats").unwrap_or(serde_json::json!({}));
    let xmin: f64 = row.try_get("xmin").unwrap_or_default();
    let ymin: f64 = row.try_get("ymin").unwrap_or_default();
    let xmax: f64 = row.try_get("xmax").unwrap_or_default();
    let ymax: f64 = row.try_get("ymax").unwrap_or_default();
    let bbox = [xmin, ymin, xmax, ymax];

    // Comptages - adapter selon le type de grille
    let count_query_sondages = format!(
        r#"
        SELECT COUNT(*) FROM atlas.sondages s
        JOIN {} m ON m.id = $1
        WHERE ST_Within(s.geom, m.geom)
        "#,
        table_name
    );
    
    let n_sondages: i64 = sqlx::query_scalar(&count_query_sondages)
        .bind(maille_id)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    let count_query_essais = format!(
        r#"
        SELECT COUNT(*) FROM atlas.essais e
        JOIN atlas.sondages s ON s.id = e.sondage_id
        JOIN {} m ON m.id = $1
        WHERE ST_Within(s.geom, m.geom)
        "#,
        table_name
    );
    
    let n_essais: i64 = sqlx::query_scalar(&count_query_essais)
        .bind(maille_id)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    let by_type_query = format!(
        r#"
        SELECT e.type_essai, COUNT(*)::bigint AS n
        FROM atlas.essais e
        JOIN atlas.sondages s ON s.id = e.sondage_id
        JOIN {} m ON m.id = $1
        WHERE ST_Within(s.geom, m.geom)
        GROUP BY e.type_essai
        "#,
        table_name
    );
    
    let rows = sqlx::query(&by_type_query)
        .bind(maille_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();
    let mut by_type = serde_json::Map::new();
    for r in rows {
        by_type.insert(
            r.get::<String, _>("type_essai"),
            serde_json::json!(r.get::<i64, _>("n")),
        );
    }

    let summary = serde_json::json!({
        "n_sondages": n_sondages,
        "n_essais": n_essais,
        "by_type": by_type,
    });

    Json(GridResponse {
        code,
        bbox,
        stats,
        summary,
    })
    .into_response()
}

// GET /grid/{code}/shape -> GeoJSON Feature (Polygon) EPSG:4326
async fn get_grid_shape(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> impl IntoResponse {
    let pool = &state.pool;
    let row_opt = sqlx::query(
        r#"SELECT ST_AsGeoJSON(ST_Transform(geom,4326)) AS g FROM mailles WHERE code=$1"#,
    )
    .bind(&code)
    .fetch_optional(pool)
    .await;
    let row = match row_opt {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error":"maille introuvable"})),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(?e, "grid shape");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };
    let g: String = match row.try_get("g") {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "decode geojson");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"decode"})),
            )
                .into_response();
        }
    };
    let geom: serde_json::Value = match serde_json::from_str(&g) {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "parse geojson");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"parse"})),
            )
                .into_response();
        }
    };
    let feature = serde_json::json!({
        "type":"Feature",
        "geometry": geom,
        "properties": {"code": code}
    });
    Json(feature).into_response()
}

// GET /coverage/mailles?bbox=west,south,east,north&grid=2km|28km -> FeatureCollection EPSG:4326 avec comptes
pub async fn get_coverage_mailles(
    Query(params): Query<std::collections::HashMap<String, String>>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    let grid_type = params.get("grid").map(|s| s.as_str()).unwrap_or("2km");

    if grid_type == "28km" {
        return get_coverage_mailles_28km(params, state).await.into_response();
    }

    // Construire la requête avec filtre bbox optionnel
    // Utilise mv_mailles_geotech qui inclut le spread ADM3 et les compteurs d'essais par type
    let mut query = r#"
        SELECT code,
               ST_AsGeoJSON(ST_Transform(geom,4326)) AS g,
               adm1_name,
               adm2_name,
               adm3_name,
               COALESCE(n_sondages, 0)::bigint AS n_sondages,
               COALESCE(n_echantillons, 0)::bigint AS n_echantillons,
               COALESCE(n_essais_total, 0)::bigint AS n_essais,
               COALESCE(n_essais_atterberg, 0)::bigint AS n_atterberg,
               COALESCE(n_essais_vbs, 0)::bigint AS n_vbs,
               COALESCE(n_essais_proctor, 0)::bigint AS n_physiques,
               COALESCE(n_essais_classif, 0)::bigint AS n_classif,
               has_data,
               has_exact_location,
               has_random_location
        FROM atlas.mv_mailles_geotech
    "#
    .to_string();

    // Ajouter filtre bbox si présent
    if let Some(bbox_str) = params.get("bbox") {
        let parts: Vec<f64> = bbox_str.split(',').filter_map(|s| s.parse().ok()).collect();
        if parts.len() == 4 {
            query.push_str(&format!(
                " WHERE ST_Intersects(ST_Transform(geom, 4326), ST_MakeEnvelope({}, {}, {}, {}, 4326))",
                parts[0], parts[1], parts[2], parts[3]
            ));
        }
    }

    // Pas besoin de GROUP BY car la vue est déjà agrégée

    let rows = match sqlx::query(&query).fetch_all(pool).await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "coverage query");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"type":"FeatureCollection","features":[]})),
            )
                .into_response();
        }
    };
    let mut features = Vec::new();
    for r in rows {
        let code: String = r.get("code");
        let g: String = r.get("g");
        let adm1_name: Option<String> = r.try_get("adm1_name").ok();
        let adm2_name: Option<String> = r.try_get("adm2_name").ok();
        let adm3_name: Option<String> = r.try_get("adm3_name").ok();
        let n_sondages: i64 = r.get("n_sondages");
        let n_echantillons: i64 = r.try_get("n_echantillons").unwrap_or(0);
        let n_essais: i64 = r.try_get("n_essais").unwrap_or(0);
        let n_atterberg: i64 = r.try_get("n_atterberg").unwrap_or(0);
        let n_vbs: i64 = r.try_get("n_vbs").unwrap_or(0);
        let n_physiques: i64 = r.try_get("n_physiques").unwrap_or(0);
        let n_classif: i64 = r.try_get("n_classif").unwrap_or(0);
        let has_data = n_sondages > 0;
        let has_exact_location: bool = r.try_get("has_exact_location").unwrap_or(false);
        let has_random_location: bool = r.try_get("has_random_location").unwrap_or(false);
        if let Ok(geom) = serde_json::from_str::<serde_json::Value>(&g) {
            let mut props = serde_json::json!({
                "code": code,
                "has_data": has_data,
                "has_exact_location": has_exact_location,
                "has_random_location": has_random_location,
                "n_sondages": n_sondages,
                "n_echantillons": n_echantillons,
                "n_essais": n_essais,
                "n_atterberg": n_atterberg,
                "n_vbs": n_vbs,
                "n_physiques": n_physiques,
                "n_classif": n_classif
            });
            if let Some(adm1) = adm1_name {
                props["adm1_name"] = serde_json::Value::String(adm1);
            }
            if let Some(adm2) = adm2_name {
                props["adm2_name"] = serde_json::Value::String(adm2);
            }
            if let Some(adm3) = adm3_name {
                props["adm3_name"] = serde_json::Value::String(adm3);
            }
            features.push(serde_json::json!({
                "type":"Feature",
                "geometry": geom,
                "properties": props
            }));
        }
    }
    Json(serde_json::json!({"type":"FeatureCollection","features": features})).into_response()
}

// Nouvelle fonction pour récupérer la couverture 28km
async fn get_coverage_mailles_28km(
    params: std::collections::HashMap<String, String>,
    state: AppState,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    // Requête sur atlas.v_maille_28km_kpi
    let mut query = r#"
        SELECT code_m28,
               profil_num,
               pk_min_km,
               pk_max_km,
               ST_AsGeoJSON(ST_Transform(geom, 4326)) AS g,
               area_km2,
               COALESCE(n_sondages, 0)::bigint AS n_sondages,
               COALESCE(n_ip, 0)::bigint AS n_ip,
               COALESCE(n_vbs, 0)::bigint AS n_vbs,
               COALESCE(n_eg, 0)::bigint AS n_eg,
               ip_avg,
               vbs_avg,
               eg_avg,
               pct_plastiques_ip17,
               has_data
        FROM atlas.v_maille_28km_kpi
    "#
    .to_string();

    // Filtre bbox
    if let Some(bbox_str) = params.get("bbox") {
        let parts: Vec<f64> = bbox_str.split(',').filter_map(|s| s.parse().ok()).collect();
        if parts.len() == 4 {
            query.push_str(&format!(
                " WHERE ST_Intersects(ST_Transform(geom, 4326), ST_MakeEnvelope({}, {}, {}, {}, 4326))",
                parts[0], parts[1], parts[2], parts[3]
            ));
        }
    }

    let rows = match sqlx::query(&query).fetch_all(pool).await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "coverage 28km query");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"type":"FeatureCollection","features":[]})),
            )
                .into_response();
        }
    };

    let mut features = Vec::new();
    for r in rows {
        let code_m28: i32 = r.try_get("code_m28").unwrap_or(0);
        let profil_num: i32 = r.try_get("profil_num").unwrap_or(0);
        let pk_min_km: f64 = r.try_get("pk_min_km").unwrap_or(0.0);
        let pk_max_km: f64 = r.try_get("pk_max_km").unwrap_or(0.0);
        let g: String = r.get("g");
        let area_km2: f64 = r.try_get("area_km2").unwrap_or(0.0);
        let n_sondages: i64 = r.get("n_sondages");
        let n_ip: i64 = r.try_get("n_ip").unwrap_or(0);
        let n_vbs: i64 = r.try_get("n_vbs").unwrap_or(0);
        let n_eg: i64 = r.try_get("n_eg").unwrap_or(0);
        
        // Optionals
        let ip_avg: Option<f64> = r.try_get("ip_avg").ok();
        let vbs_avg: Option<f64> = r.try_get("vbs_avg").ok();
        let eg_avg: Option<f64> = r.try_get("eg_avg").ok();
        let pct_plastiques_ip17: Option<f64> = r.try_get("pct_plastiques_ip17").ok();
        let has_data: bool = r.try_get("has_data").unwrap_or(false);

        if let Ok(geom) = serde_json::from_str::<serde_json::Value>(&g) {
            let props = serde_json::json!({
                "code_m28": code_m28,
                "code": format!("{}", code_m28), // Alias pour compatibilité UI
                "profil_num": profil_num,
                "pk_min_km": pk_min_km,
                "pk_max_km": pk_max_km,
                "area_km2": area_km2,
                "n_sondages": n_sondages,
                "n_ip": n_ip,
                "n_vbs": n_vbs,
                "n_eg": n_eg,
                "ip_avg": ip_avg,
                "vbs_avg": vbs_avg,
                "eg_avg": eg_avg,
                "pct_plastiques_ip17": pct_plastiques_ip17,
                "has_data": has_data
            });

            features.push(serde_json::json!({
                "type":"Feature",
                "geometry": geom,
                "properties": props
            }));
        }
    }
    
    Json(serde_json::json!({"type":"FeatureCollection","features": features})).into_response()
}

async fn recompute_grid(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> impl IntoResponse {
    let pool = &state.pool;
    // Récupérer maille id/geom
    let row_opt = sqlx::query(r#"SELECT id, geom, stats FROM mailles WHERE code=$1"#)
        .bind(&code)
        .fetch_optional(pool)
        .await;
    let row = match row_opt {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error":"maille introuvable"})),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(?e, "db error load maille");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };
    let maille_id: uuid::Uuid = match row.try_get("id") {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "decode id");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"decode"})),
            )
                .into_response();
        }
    };
    let _stats0: serde_json::Value = row
        .try_get("stats")
        .unwrap_or(serde_json::json!({"samples":0}));

    // Points SPT_N à l'intérieur (coords 25231 en mètres)
    let pts = sqlx::query(
        r#"
        SELECT ST_X(s.geom) AS x, ST_Y(s.geom) AS y, e.valeur_numerique::double precision AS value
        FROM essais e
        JOIN sondages s ON s.id = e.sondage_id
        JOIN mailles m ON m.id = $1
        WHERE e.type_essai = 'SPT_N' AND ST_Within(s.geom, m.geom)
        "#,
    )
    .bind(maille_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut samples = Vec::new();
    for r in pts {
        let x: f64 = match r.try_get("x") {
            Ok(v) => v,
            Err(e) => {
                tracing::error!(?e, "decode x");
                continue;
            }
        };
        let y: f64 = match r.try_get("y") {
            Ok(v) => v,
            Err(e) => {
                tracing::error!(?e, "decode y");
                continue;
            }
        };
        let v: f64 = match r.try_get("value") {
            Ok(v) => v,
            Err(e) => {
                tracing::error!(?e, "decode value");
                continue;
            }
        };
        samples.push((x, y, v));
    }
    let n = samples.len() as i64;

    // Centroid
    let c = match sqlx::query(
        r#"SELECT ST_X(c) AS cx, ST_Y(c) AS cy FROM (SELECT ST_Centroid(geom) AS c FROM mailles WHERE id=$1) t"#
    ).bind(maille_id).fetch_one(pool).await {
        Ok(r) => r,
        Err(e) => { tracing::error!(?e, "centroid query"); return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"}))).into_response(); }
    };
    let cx: f64 = match c.try_get("cx") {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "decode cx");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"decode"})),
            )
                .into_response();
        }
    };
    let cy: f64 = match c.try_get("cy") {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "decode cy");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"decode"})),
            )
                .into_response();
        }
    };

    // IDW p=2 (en Rust)
    let p = 2.0;
    let eps = 1e-9f64;
    let v_hat = compute_idw(cx, cy, &samples, p, eps);

    // Minimum d'échantillons
    if samples.len() < 3 {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({"error":"insufficient samples"})),
        )
            .into_response();
    }

    // Update stats
    let new_stats = serde_json::json!({
        "samples": n,
        "idw": {"type":"SPT_N","p":2,"value": v_hat}
    });
    let updated: serde_json::Value = match sqlx::query_scalar(
        r#"
        UPDATE mailles SET stats = COALESCE(stats,'{}'::jsonb) || $2::jsonb, updated_at = now()
        WHERE id=$1 RETURNING stats
        "#,
    )
    .bind(maille_id)
    .bind(&new_stats)
    .fetch_one(pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "update stats");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    // Recalculer bbox (4326) et summary comme dans get_grid
    let row2 = match sqlx::query(
        r#"
        SELECT ST_XMin(g4326) AS xmin,
               ST_YMin(g4326) AS ymin,
               ST_XMax(g4326) AS xmax,
               ST_YMax(g4326) AS ymax
        FROM (
            SELECT ST_Transform(ST_Envelope(geom), 4326) AS g4326 FROM mailles WHERE id=$1
        ) q
        "#,
    )
    .bind(maille_id)
    .fetch_one(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "bbox recompute");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };
    let bbox = [
        row2.get("xmin"),
        row2.get("ymin"),
        row2.get("xmax"),
        row2.get("ymax"),
    ];

    let n_sondages: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM sondages s
        JOIN mailles m ON m.id = $1
        WHERE ST_Within(s.geom, m.geom)
        "#,
    )
    .bind(maille_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);
    let n_essais: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM essais e
        JOIN sondages s ON s.id = e.sondage_id
        JOIN mailles m ON m.id = $1
        WHERE ST_Within(s.geom, m.geom)
        "#,
    )
    .bind(maille_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);
    let rows = sqlx::query(
        r#"
        SELECT e.type_essai, COUNT(*)::bigint AS n
        FROM essais e
        JOIN sondages s ON s.id = e.sondage_id
        JOIN mailles m ON m.id = $1
        WHERE ST_Within(s.geom, m.geom)
        GROUP BY e.type_essai
        "#,
    )
    .bind(maille_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    let mut by_type = serde_json::Map::new();
    for r in rows {
        by_type.insert(
            r.get::<String, _>("type_essai"),
            serde_json::json!(r.get::<i64, _>("n")),
        );
    }
    let summary = serde_json::json!({
        "n_sondages": n_sondages,
        "n_essais": n_essais,
        "by_type": by_type,
    });

    let resp = GridResponse {
        code,
        bbox,
        stats: updated,
        summary,
    };
    Json(resp).into_response()
}

// Placeholder traits for future interpolation modules (IDW, Krigeage)
#[allow(dead_code)]
pub mod interp {
    pub trait Interpolator {
        fn name(&self) -> &'static str;
        fn fit(&mut self, _x: &[(f64, f64)], _y: &[f64]) { /* TODO */
        }
        fn predict(&self, _xq: &[(f64, f64)]) -> Vec<f64> {
            vec![]
        }
    }

    pub struct Idw {
        pub power: f64,
    }
    impl Interpolator for Idw {
        fn name(&self) -> &'static str {
            "idw"
        }
    }

    pub struct Kriging {}
    impl Interpolator for Kriging {
        fn name(&self) -> &'static str {
            "kriging"
        }
    }
}

// --- IDW util & tests ---
fn compute_idw(cx: f64, cy: f64, samples: &[(f64, f64, f64)], p: f64, eps: f64) -> f64 {
    let mut num = 0.0f64;
    let mut den = 0.0f64;
    for (x, y, v) in samples.iter() {
        let dx = x - cx;
        let dy = y - cy;
        let d2 = dx * dx + dy * dy;
        if d2 < eps {
            return *v;
        }
        let w = 1.0 / (d2.powf(p / 2.0) + eps);
        num += w * *v;
        den += w;
    }
    if den > 0.0 {
        num / den
    } else {
        f64::NAN
    }
}

// GET /grid/{code}/details -> Fiche complète de la maille
#[derive(Serialize)]
struct GridDetails {
    code: String,
    adm: AdmInfo,
    kpi: KpiInfo,
    sondages: Vec<SondageDetail>,
}

#[derive(Serialize)]
struct AdmInfo {
    adm1: Option<String>,
    adm2: Option<String>,
    adm3: Option<String>,
}

#[derive(Serialize)]
struct KpiInfo {
    sondages: i64,
    essais: i64,
    idw_spt_n: Option<f64>,
    zmin: Option<f64>,
    zmax: Option<f64>,
    updated_at: Option<String>,
}

#[derive(Serialize)]
struct SondageDetail {
    id: String,
    code: Option<String>,
    has_coords: bool,
    lon: Option<f64>,
    lat: Option<f64>,
    source: Option<String>,
    date: Option<String>,
    essais: Vec<EssaiDetail>,
}

#[derive(Serialize)]
struct EssaiDetail {
    #[serde(rename = "type")]
    test_type: String,
    value: f64,
    unit: String,
    depth_m: f64,
    date: Option<String>,
}

async fn get_grid_details(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let pool = &state.pool;
    let grid_type = params.get("grid").map(|s| s.as_str()).unwrap_or("2km");
    
    // Déterminer la table selon le type de grille
    let table_name = if grid_type == "28km" {
        "atlas.maille_28km"
    } else {
        "atlas.mailles"
    };

    // 1. Récupérer les infos de la maille
    let query_str = format!(
        r#"
        SELECT id, adm1_name, adm2_name, adm3_name, stats, updated_at
        FROM {}
        WHERE code = $1
        "#,
        table_name
    );
    
    let maille_row = match sqlx::query(&query_str)
        .bind(&code)
        .fetch_optional(pool)
        .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "maille introuvable"})),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(?e, "get_grid_details maille");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "db error"})),
            )
                .into_response();
        }
    };

    let maille_id: uuid::Uuid = maille_row.get("id");
    let adm = AdmInfo {
        adm1: maille_row.get("adm1_name"),
        adm2: maille_row.get("adm2_name"),
        adm3: maille_row.get("adm3_name"),
    };

    let stats: serde_json::Value = maille_row.try_get("stats").unwrap_or(serde_json::json!({}));
    let idw_spt_n = stats.get("idw_spt_n").and_then(|v| v.as_f64());
    let updated_at: Option<chrono::DateTime<chrono::Utc>> = maille_row.get("updated_at");

    // 2. Récupérer les KPIs
    let kpi_query = format!(
        r#"
        SELECT 
            COUNT(DISTINCT s.id)::bigint AS n_sondages,
            COUNT(e.id)::bigint AS n_essais,
            MIN(e.depth_m) AS zmin,
            MAX(e.depth_m) AS zmax
        FROM {} m
        LEFT JOIN atlas.sondages s ON ST_Within(s.geom, m.geom) AND s.deleted_at IS NULL
        LEFT JOIN atlas.essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
        WHERE m.id = $1
        "#,
        table_name
    );
    
    let kpi_row = match sqlx::query(&kpi_query)
        .bind(maille_id)
        .fetch_one(pool)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "get_grid_details kpi");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "db error"})),
            )
                .into_response();
        }
    };

    let zmin: Option<sqlx::types::BigDecimal> = kpi_row.try_get("zmin").ok().flatten();
    let zmax: Option<sqlx::types::BigDecimal> = kpi_row.try_get("zmax").ok().flatten();

    let kpi = KpiInfo {
        sondages: kpi_row.get("n_sondages"),
        essais: kpi_row.get("n_essais"),
        idw_spt_n,
        zmin: zmin.and_then(|v| v.to_string().parse().ok()),
        zmax: zmax.and_then(|v| v.to_string().parse().ok()),
        updated_at: updated_at.map(|dt| dt.format("%Y-%m-%d %H:%M").to_string()),
    };

    // 3. Récupérer les sondages avec leurs essais
    let sondages_query = format!(
        r#"
        SELECT
            s.id,
            s.code,
            ST_X(ST_Transform(s.geom, 4326)) AS lon,
            ST_Y(ST_Transform(s.geom, 4326)) AS lat,
            s.source,
            s.date,
            s.location_accuracy,
            s.is_geocoded
        FROM atlas.sondages s
        JOIN {} m ON m.id = $1
        WHERE (
            (s.geom IS NOT NULL AND ST_Within(s.geom, m.geom))
            OR (s.geom IS NULL AND s.maille_code = m.code)
        )
        AND s.deleted_at IS NULL
        ORDER BY s.created_at DESC
        "#,
        table_name
    );
    
    let sondages_rows = match sqlx::query(&sondages_query)
        .bind(maille_id)
        .fetch_all(pool)
        .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!(?e, "get_grid_details sondages");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "db error"})),
            )
                .into_response();
        }
    };

    let mut sondages = Vec::new();

    for sondage_row in sondages_rows {
        let sondage_id: uuid::Uuid = sondage_row.get("id");
        let is_geocoded: bool = sondage_row.try_get("is_geocoded").unwrap_or(true);
        let has_coords = is_geocoded;

        // Récupérer les essais de ce sondage
        let essais_rows = match sqlx::query(
            r#"
            SELECT type_essai, valeur_numerique, unit, depth_m
            FROM atlas.essais
            WHERE sondage_id = $1 AND deleted_at IS NULL AND valeur_numerique IS NOT NULL
            ORDER BY depth_m ASC
            "#,
        )
        .bind(sondage_id)
        .fetch_all(pool)
        .await
        {
            Ok(rows) => rows,
            Err(e) => {
                tracing::error!(?e, "get_grid_details essais");
                continue;
            }
        };

        let essais: Vec<EssaiDetail> = essais_rows
            .iter()
            .map(|row| {
                let depth: sqlx::types::BigDecimal = row.get("depth_m");
                EssaiDetail {
                    test_type: row.get("type_essai"),
                    value: row
                        .get::<sqlx::types::BigDecimal, _>("valeur_numerique")
                        .to_string()
                        .parse()
                        .unwrap_or(0.0),
                    unit: row.get("unit"),
                    depth_m: depth.to_string().parse().unwrap_or(0.0),
                    date: None,
                }
            })
            .collect();

        sondages.push(SondageDetail {
            id: sondage_id.to_string(),
            code: sondage_row.get("code"),
            has_coords,
            lon: if has_coords {
                sondage_row.get("lon")
            } else {
                None
            },
            lat: if has_coords {
                sondage_row.get("lat")
            } else {
                None
            },
            source: sondage_row.get("source"),
            date: sondage_row.get("date"),
            essais,
        });
    }

    Json(GridDetails {
        code,
        adm,
        kpi,
        sondages,
    })
    .into_response()
}

// GET /adm/:level -> Liste des zones ADM (pour le formulaire)
pub async fn list_adm_zones(
    State(state): State<AppState>,
    Path(level): Path<String>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let table = match level.as_str() {
        "adm1" => "adm1",
        "adm2" => "adm2",
        "adm3" => "adm3",
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "invalid level, must be adm1, adm2, or adm3"})),
            )
                .into_response();
        }
    };

    let query = format!(
        "SELECT gid, adm{}_fr AS name FROM {} ORDER BY name",
        match level.as_str() {
            "adm1" => "1",
            "adm2" => "2",
            "adm3" => "3",
            _ => unreachable!(),
        },
        table
    );

    let zones: Vec<(i32, String)> = match sqlx::query_as(&query).fetch_all(pool).await {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!(?e, "Failed to fetch ADM zones");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "database error"})),
            )
                .into_response();
        }
    };

    let result: Vec<serde_json::Value> = zones
        .into_iter()
        .map(|(gid, name)| serde_json::json!({"id": gid, "name": name}))
        .collect();

    (StatusCode::OK, Json(result)).into_response()
}

#[cfg(test)]
mod tests {
    use super::compute_idw;

    #[test]
    fn idw_zero_distance() {
        let v = compute_idw(0.0, 0.0, &[(0.0, 0.0, 42.0), (1.0, 0.0, 10.0)], 2.0, 1e-9);
        assert!((v - 42.0).abs() < 1e-9);
    }

    #[test]
    fn idw_simple_weighted() {
        // Deux points symétriques autour de (0,0), valeurs 10 et 30 -> moyenne 20
        let v = compute_idw(0.0, 0.0, &[(-1.0, 0.0, 10.0), (1.0, 0.0, 30.0)], 2.0, 1e-9);
        assert!((v - 20.0).abs() < 1e-6);
    }
}
