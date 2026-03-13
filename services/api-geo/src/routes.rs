use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Serialize)]
pub struct MailleLookupResponse {
    pub id: String,
    pub maille_code: String,
    pub spatial_id: Option<String>,
}

#[derive(Serialize)]
pub struct LegacyLookupItem {
    pub new_code: String,
    pub coverage_pct: f64,
    pub match_type: String,
}

/// GET /mailles/{code}
/// Supporte:
/// - ancien code (ex: TG-0048-0045-01) -> lookup sur maille_code
/// - spatial_id (ex: TG5-XXXXXX) -> lookup sur spatial_id
pub async fn get_maille_lookup(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> impl IntoResponse {
    let pool = &state.pool;
    let c = code.trim();
    if c.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "code requis"})),
        )
            .into_response();
    }

    let is_legacy = c.to_uppercase().starts_with("TG-");
    let (sql, bind_value) = if is_legacy {
        (
            r#"
            SELECT id::text AS id, maille_code, spatial_id
            FROM atlas.mailles_lookup
            WHERE maille_code = $1
            LIMIT 1
            "#,
            c.to_string(),
        )
    } else {
        (
            r#"
            SELECT id::text AS id, maille_code, spatial_id
            FROM atlas.mailles_lookup
            WHERE spatial_id = $1
            LIMIT 1
            "#,
            c.to_string(),
        )
    };

    let row = match sqlx::query(sql)
        .bind(bind_value)
        .fetch_optional(pool)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, code, "get_maille_lookup db error");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "db error"})),
            )
                .into_response();
        }
    };

    let Some(row) = row else {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "maille introuvable", "code": c})),
        )
            .into_response();
    };

    let out = MailleLookupResponse {
        id: row.try_get("id").unwrap_or_default(),
        maille_code: row.try_get("maille_code").unwrap_or_default(),
        spatial_id: row.try_get("spatial_id").ok(),
    };
    (StatusCode::OK, Json(out)).into_response()
}

pub async fn get_coverage_adm_boundaries(
    Query(params): Query<std::collections::HashMap<String, String>>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let level = match params.get("level").map(|s| s.to_lowercase()) {
        Some(v) => v,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "missing level (adm1|adm2|adm3)"})),
            )
                .into_response();
        }
    };

    let adm1 = params.get("adm1").cloned();
    let adm2 = params.get("adm2").cloned();
    let adm3 = params.get("adm3").cloned();

    let candidates: Vec<(&'static str, &'static str, &'static str)> = match level.as_str() {
        "adm1" => vec![
            ("atlas.adm1", "gid", "adm1_fr"),
            ("public.adm1", "gid", "adm1_fr"),
            ("adm1", "gid", "adm1_fr"),
            ("adm1_tg", "gid", "name"),
            ("adm1_togo", "gid", "adm1_fr"),
        ],
        "adm2" => vec![
            ("atlas.adm2", "gid", "adm2_fr"),
            ("public.adm2", "gid", "adm2_fr"),
            ("adm2", "gid", "adm2_fr"),
            ("adm2_tg", "gid", "name"),
            ("adm2_togo", "gid", "adm2_fr"),
        ],
        "adm3" => vec![
            ("atlas.adm3", "gid", "adm3_fr"),
            ("public.adm3", "gid", "adm3_fr"),
            ("adm3", "gid", "adm3_fr"),
            ("adm3_tg", "gid", "name"),
            ("adm3_togo", "gid", "adm3_fr"),
        ],
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "invalid level, must be adm1, adm2, or adm3"})),
            )
                .into_response();
        }
    };

    let mut last_error: Option<String> = None;

    for (table, gid_col, name_col) in candidates {
        // Déterminer les filtres voulus (un seul filtre parent principal)
        let (parent_value, parent_cols): (Option<String>, Vec<&'static str>) = match level.as_str() {
            "adm2" => (
                adm1.clone(),
                vec![
                    "adm1_fr",
                    "adm1_name",
                    "adm1",
                    "adm1_code",
                    "adm1_nom",
                    "adm1_label",
                ],
            ),
            "adm3" => {
                if adm2.is_some() {
                    (
                        adm2.clone(),
                        vec![
                            "adm2_fr",
                            "adm2_name",
                            "adm2",
                            "adm2_code",
                            "adm2_nom",
                            "adm2_label",
                        ],
                    )
                } else {
                    (
                        adm1.clone(),
                        vec![
                            "adm1_fr",
                            "adm1_name",
                            "adm1",
                            "adm1_code",
                            "adm1_nom",
                            "adm1_label",
                        ],
                    )
                }
            }
            _ => (None, vec![]),
        };

        // Si aucun filtre, on tente une requête simple.
        let parent_cols_to_try: Vec<Option<&'static str>> = if parent_value.is_some() {
            parent_cols.into_iter().map(Some).collect()
        } else {
            vec![None]
        };

        for parent_col in parent_cols_to_try {
            let mut where_parts: Vec<String> = vec![];
            let mut bind_values: Vec<String> = vec![];

            if let (Some(v), Some(col)) = (&parent_value, parent_col) {
                where_parts.push(format!("{} ILIKE ${}", col, bind_values.len() + 1));
                bind_values.push(format!("%{}%", v.trim()));
            }

            // Si un caller envoie adm3 par erreur, on le supporte sans casser.
            // On tente un filtre additionnel (si possible) en réutilisant le même pattern.
            if let Some(v) = &adm3 {
                // Essayer une colonne plausible. Si la colonne n'existe pas, la requête échouera et on réessaiera via d'autres tables.
                where_parts.push(format!("{} ILIKE ${}", "adm3_fr", bind_values.len() + 1));
                bind_values.push(format!("%{}%", v.trim()));
            }

            let mut query = format!(
                r#"
            SELECT
              {gid_col}::bigint AS gid,
              {name_col}::text AS name,
              ST_AsGeoJSON(ST_Transform(geom, 4326)) AS g
            FROM {table}
            "#,
                gid_col = gid_col,
                name_col = name_col,
                table = table
            );

            if !where_parts.is_empty() {
                query.push_str(" WHERE ");
                query.push_str(&where_parts.join(" AND "));
            }

            query.push_str(" ORDER BY name ");

            let mut q = sqlx::query(&query);
            for v in &bind_values {
                q = q.bind(v);
            }

            let rows = match q.fetch_all(pool).await {
                Ok(r) => r,
                Err(e) => {
                    tracing::warn!(?e, table, level, "adm-boundaries query failed (trying next candidate)");
                    last_error = Some(format!("{}", e));
                    continue;
                }
            };

            let mut features: Vec<serde_json::Value> = Vec::with_capacity(rows.len());
            for row in rows {
                let gid: i64 = match row.try_get("gid") {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                let name: String = row.try_get("name").unwrap_or_else(|_| "".to_string());
                let g: String = match row.try_get("g") {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let geom: serde_json::Value = match serde_json::from_str(&g) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                features.push(serde_json::json!({
                    "type": "Feature",
                    "properties": {
                        "level": level,
                        "gid": gid,
                        "name": name
                    },
                    "geometry": geom
                }));
            }

            let fc = serde_json::json!({
                "type": "FeatureCollection",
                "features": features
            });

            return (StatusCode::OK, Json(fc)).into_response();
        }
    }

    // Aucun candidat n'a fonctionné -> retourner collection vide, mais loggable côté serveur.
    tracing::warn!(level, ?adm1, ?adm2, ?adm3, ?last_error, "adm-boundaries: no candidate table/columns matched");
    let fc = serde_json::json!({
        "type": "FeatureCollection",
        "features": []
    });
    (StatusCode::OK, Json(fc)).into_response()
}

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

pub async fn legacy_lookup(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let rows = sqlx::query(
        r#"
        SELECT new_code, coverage_pct::float8 AS coverage_pct, match_type
        FROM atlas.v_api_legacy_lookup
        WHERE legacy_code = $1
        ORDER BY rank ASC
        LIMIT 5
        "#,
    )
    .bind(&code)
    .fetch_all(pool)
    .await;

    match rows {
        Ok(rows) => {
            if rows.is_empty() {
                return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "legacy code introuvable"})))
                    .into_response();
            }

            let mut out: Vec<LegacyLookupItem> = Vec::with_capacity(rows.len());
            for row in rows {
                out.push(LegacyLookupItem {
                    new_code: row.try_get("new_code").unwrap_or_default(),
                    coverage_pct: row.try_get("coverage_pct").unwrap_or(0.0),
                    match_type: row.try_get("match_type").unwrap_or_else(|_| "".to_string()),
                });
            }

            (StatusCode::OK, Json(out)).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "legacy_lookup db error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "db error"})))
                .into_response()
        }
    }
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
        WHERE ST_Within(s.geom, ST_Transform(m.geom, 4326))
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
        WHERE ST_Within(s.geom, ST_Transform(m.geom, 4326))
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
        WHERE ST_Within(s.geom, ST_Transform(m.geom, 4326))
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

// GET /maille/{code}?grid=2km|28km -> GeoJSON Feature avec propriétés complètes
pub async fn get_maille_by_code(
    Path(code): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    let grid_type = params.get("grid").map(|s| s.as_str()).unwrap_or("2km");

    // Utiliser les vues de couverture créées dans migration 100
    let query = if grid_type == "28km" {
        r#"
        SELECT 
            code_m28::text AS code,
            ST_AsGeoJSON(geom) AS g,
            n_sondages,
            n_sondages_exact,
            n_sondages_random,
            n_echantillons,
            n_mailles_2km,
            n_mailles_2km_with_data
        FROM atlas.v_coverage_mailles_28km
        WHERE code_m28::text = $1
        LIMIT 1
        "#
    } else {
        r#"
        SELECT 
            code,
            ST_AsGeoJSON(geom) AS g,
            n_sondages,
            n_sondages_exact,
            n_sondages_random,
            n_echantillons,
            pref_name,
            adm2_name
        FROM atlas.v_coverage_mailles_2km
        WHERE code = $1
        LIMIT 1
        "#
    };

    let row = match sqlx::query(query).bind(&code).fetch_optional(pool).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Maille introuvable", "code": code, "grid": grid_type})),
            ).into_response();
        }
        Err(e) => {
            tracing::error!(?e, code, grid_type, "get_maille_by_code query error");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error", "details": e.to_string()})),
            ).into_response();
        }
    };

    let geojson_str: String = row.try_get("g").unwrap_or_default();
    let geom: serde_json::Value = serde_json::from_str(&geojson_str).unwrap_or(serde_json::json!({}));
    
    let mut properties = serde_json::json!({
        "code": row.try_get::<String, _>("code").unwrap_or_default(),
        "n_sondages": row.try_get::<i64, _>("n_sondages").unwrap_or(0),
        "n_sondages_exact": row.try_get::<i64, _>("n_sondages_exact").unwrap_or(0),
        "n_sondages_random": row.try_get::<i64, _>("n_sondages_random").unwrap_or(0),
        "n_echantillons": row.try_get::<i64, _>("n_echantillons").unwrap_or(0),
    });

    // Ajouter propriétés spécifiques selon le type de grille
    if grid_type == "28km" {
        properties["n_mailles_2km"] = serde_json::json!(row.try_get::<i64, _>("n_mailles_2km").unwrap_or(0));
        properties["n_mailles_2km_with_data"] = serde_json::json!(row.try_get::<i64, _>("n_mailles_2km_with_data").unwrap_or(0));
    } else {
        properties["pref_name"] = serde_json::json!(row.try_get::<Option<String>, _>("pref_name").unwrap_or(None));
        properties["adm2_name"] = serde_json::json!(row.try_get::<Option<String>, _>("adm2_name").unwrap_or(None));
    }
    
    let feature = serde_json::json!({
        "type": "Feature",
        "geometry": geom,
        "properties": properties
    });
 
    Json(feature).into_response()
}

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
        SELECT
            mv.code,
            ST_AsGeoJSON(ST_Transform(mv.geom,4326)) AS g,
            COALESCE(mv.adm1_name, a2.adm1_name) AS adm1_name,
            COALESCE(mv.adm2_name, m.adm2_name) AS adm2_name,
            mv.adm3_name AS adm3_name,
            COALESCE(mv.n_sondages, 0)::bigint AS n_sondages,
            COALESCE(mv.n_echantillons, 0)::bigint AS n_echantillons,
            COALESCE(mv.n_essais_total, 0)::bigint AS n_essais,
            COALESCE(mv.n_essais_atterberg, 0)::bigint AS n_atterberg,
            COALESCE(mv.n_essais_vbs, 0)::bigint AS n_vbs,
            COALESCE(mv.n_essais_proctor, 0)::bigint AS n_physiques,
            COALESCE(mv.n_essais_classif, 0)::bigint AS n_classif,
            mv.has_data,
            mv.has_exact_location,
            mv.has_random_location,
            COALESCE(ma.student_id::text, ca.student_id::text) AS assigned_student_id,
            COALESCE(ma.full_name, ca_user.full_name) AS assigned_student_name,
            COALESCE(ma.assigned_at::text, ca.assigned_at::text) AS assigned_at
        FROM atlas.mv_mailles_geotech mv
        LEFT JOIN atlas.mailles m ON m.code = mv.code
        LEFT JOIN public.adm2_tg a2 ON a2.name = COALESCE(mv.adm2_name, m.adm2_name)
        LEFT JOIN atlas.colab_maille_assignments ca ON ca.maille_id = m.id
        LEFT JOIN LATERAL (
            SELECT
                COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.username) AS full_name
            FROM atlas.colab_students cs
            JOIN atlas.users u
                ON u.id = cs.user_id
                AND u.deleted_at IS NULL
            WHERE cs.id::text = ca.student_id::text
            LIMIT 1
        ) ca_user ON TRUE
        LEFT JOIN LATERAL (
            SELECT
                cma.student_id,
                cma.assigned_at,
                COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.username) AS full_name
            FROM atlas.colab_missions cm
            JOIN atlas.colab_mission_assignments cma
                ON cma.mission_id = cm.id
                AND cma.unassigned_at IS NULL
            JOIN atlas.colab_students cs
                ON cs.id::text = cma.student_id::text
            JOIN atlas.users u
                ON u.id = cs.user_id
                AND u.deleted_at IS NULL
            WHERE cm.maille_id = m.id
            ORDER BY cma.assigned_at DESC
            LIMIT 1
        ) ma ON TRUE
    "#
    .to_string();

    // Ajouter filtre bbox si présent
    if let Some(bbox_str) = params.get("bbox") {
        let parts: Vec<f64> = bbox_str.split(',').filter_map(|s| s.parse().ok()).collect();
        if parts.len() == 4 {
            query.push_str(&format!(
                " WHERE ST_Intersects(ST_Transform(mv.geom, 4326), ST_MakeEnvelope({}, {}, {}, {}, 4326))",
                parts[0], parts[1], parts[2], parts[3]
            ));
        }
    }

    // Pas besoin de GROUP BY car la vue est déjà agrégée

    let rows = match sqlx::query(&query).fetch_all(pool).await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, query = %query, "coverage query");
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
        let assigned_student_id: Option<String> = r.try_get("assigned_student_id").ok();
        let assigned_student_name: Option<String> = r.try_get("assigned_student_name").ok();
        let assigned_at: Option<String> = r.try_get("assigned_at").ok();
        let is_assigned = assigned_student_id.is_some();
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
                "n_classif": n_classif,
                "is_assigned": is_assigned,
                "assigned_student_id": assigned_student_id,
                "assigned_student_name": assigned_student_name,
                "assigned_at": assigned_at
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
    
    // Requête sur atlas.v_coverage_mailles_28km_clip (geom clipée ADM0 + colonnes compatibles)
    let mut query = r#"
        SELECT code_m28,
               COALESCE(code_lisible, 'TG-28KM-' || LPAD(code_m28::text, 3, '0')) AS code_lisible,
               profil_num,
               ST_AsGeoJSON(ST_Transform(geom, 4326)) AS g,
               COALESCE(n_sondages, 0)::bigint AS n_sondages,
               COALESCE(n_sondages_exact, 0)::bigint AS n_sondages_exact,
               COALESCE(n_sondages_random, 0)::bigint AS n_sondages_random,
               COALESCE(n_echantillons, 0)::bigint AS n_echantillons,
               COALESCE(n_essais, 0)::bigint AS n_essais,
               COALESCE(n_mailles_2km, 0)::bigint AS n_mailles_2km,
               COALESCE(n_mailles_2km_with_data, 0)::bigint AS n_mailles_2km_with_data,
               (n_sondages > 0) AS has_data
        FROM atlas.v_coverage_mailles_28km_clip
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
        let code_lisible: String = r.try_get("code_lisible").unwrap_or_else(|_| format!("TG-28KM-{:03}", code_m28));
        let profil_num: i32 = r.try_get("profil_num").unwrap_or(0);
        let g: String = r.get("g");
        let n_sondages: i64 = r.try_get("n_sondages").unwrap_or(0);
        let n_sondages_exact: i64 = r.try_get("n_sondages_exact").unwrap_or(0);
        let n_sondages_random: i64 = r.try_get("n_sondages_random").unwrap_or(0);
        let n_echantillons: i64 = r.try_get("n_echantillons").unwrap_or(0);
        let n_essais: i64 = r.try_get("n_essais").unwrap_or(0);
        let n_mailles_2km: i64 = r.try_get("n_mailles_2km").unwrap_or(0);
        let n_mailles_2km_with_data: i64 = r.try_get("n_mailles_2km_with_data").unwrap_or(0);
        let has_data: bool = n_sondages > 0;
        
        // Calculer has_exact_location et has_random_location pour compatibilité avec style UI
        let has_exact_location = n_sondages_exact > 0;
        let has_random_location = n_sondages_random > 0;

        if let Ok(geom) = serde_json::from_str::<serde_json::Value>(&g) {
            let props = serde_json::json!({
                "code_m28": code_m28,
                "code": code_lisible.clone(), // Code lisible (ex: TG-28KM-030)
                "profil_num": profil_num,
                "n_sondages": n_sondages,
                "n_sondages_exact": n_sondages_exact,
                "n_sondages_random": n_sondages_random,
                "has_exact_location": has_exact_location,
                "has_random_location": has_random_location,
                "n_echantillons": n_echantillons,
                "n_essais": n_essais,
                "n_mailles_2km": n_mailles_2km,
                "n_mailles_2km_with_data": n_mailles_2km_with_data,
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
    spatial: Option<SpatialInfo>,
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
struct SpatialInfo {
    srid: i32,
    xmin: f64,
    xmax: f64,
    ymin: f64,
    ymax: f64,
    xc: f64,
    yc: f64,
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

    // 1. Récupérer les infos de la maille avec coordonnées UTM31
    let query_str = if grid_type == "28km" {
        // Mailles 28km n'ont pas encore les colonnes UTM31
        format!(
            r#"
            SELECT id, adm1_name, adm2_name, adm3_name, stats, updated_at,
                   NULL::double precision as xmin_utm31,
                   NULL::double precision as xmax_utm31,
                   NULL::double precision as ymin_utm31,
                   NULL::double precision as ymax_utm31,
                   NULL::double precision as xc_utm31,
                   NULL::double precision as yc_utm31
            FROM {}
            WHERE code = $1
            "#,
            table_name
        )
    } else {
        // Mailles 2km ont les colonnes UTM31 mais seulement adm2_name
        format!(
            r#"
            SELECT id, 
                   NULL::text as adm1_name,
                   adm2_name, 
                   NULL::text as adm3_name,
                   stats, updated_at,
                   xmin_utm31, xmax_utm31, ymin_utm31, ymax_utm31, xc_utm31, yc_utm31
            FROM {}
            WHERE code = $1
            "#,
            table_name
        )
    };
    
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

    // Construire SpatialInfo si les coordonnées UTM31 sont disponibles
    let spatial = if let (Some(xmin), Some(xmax), Some(ymin), Some(ymax), Some(xc), Some(yc)) = (
        maille_row.get::<Option<f64>, _>("xmin_utm31"),
        maille_row.get::<Option<f64>, _>("xmax_utm31"),
        maille_row.get::<Option<f64>, _>("ymin_utm31"),
        maille_row.get::<Option<f64>, _>("ymax_utm31"),
        maille_row.get::<Option<f64>, _>("xc_utm31"),
        maille_row.get::<Option<f64>, _>("yc_utm31"),
    ) {
        Some(SpatialInfo {
            srid: 32631,
            xmin,
            xmax,
            ymin,
            ymax,
            xc,
            yc,
        })
    } else {
        None
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
        LEFT JOIN atlas.sondages s ON ST_Within(s.geom, ST_Transform(m.geom, 4326)) AND s.deleted_at IS NULL
        LEFT JOIN atlas.essais e ON e.sondage_id = s.id
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
            s.date::text AS date,
            s.location_accuracy,
            s.is_geocoded
        FROM atlas.sondages s
        JOIN {} m ON m.id = $1
        WHERE (
            (s.geom IS NOT NULL AND ST_Within(s.geom, ST_Transform(m.geom, 4326)))
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
            date: sondage_row.try_get("date").ok(),
            essais,
        });
    }

    Json(GridDetails {
        code,
        adm,
        kpi,
        spatial,
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

// GET /adm/{level}/{id} -> GeoJSON Feature (4326) du contour ADM
pub async fn get_adm_boundary_geojson(
    State(state): State<AppState>,
    Path((level, id)): Path<(String, String)>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let candidates: Vec<(&'static str, &'static str, &'static str)> = match level.as_str() {
        // Plusieurs schémas existent selon les environnements (adm1/adm1_tg/adm1_togo)
        "adm1" => vec![("adm1", "gid", "adm1_fr"), ("adm1_tg", "gid", "name"), ("adm1_togo", "gid", "adm1_fr")],
        "adm2" => vec![("adm2", "gid", "adm2_fr"), ("adm2_tg", "gid", "name"), ("adm2_togo", "gid", "adm2_fr")],
        "adm3" => vec![("adm3", "gid", "adm3_fr"), ("adm3_tg", "gid", "name"), ("adm3_togo", "gid", "adm3_fr")],
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "invalid level, must be adm1, adm2, or adm3"})),
            )
                .into_response();
        }
    };

    let id_as_i32 = id.parse::<i32>().ok();

    let mut row: Option<sqlx::postgres::PgRow> = None;
    for (table, gid_col, name_col) in candidates {
        let query = if id_as_i32.is_some() {
            format!(
                r#"
                SELECT ST_AsGeoJSON(ST_Transform(geom, 4326)) AS g
                FROM {}
                WHERE {} = $1
                LIMIT 1
                "#,
                table, gid_col
            )
        } else {
            format!(
                r#"
                SELECT ST_AsGeoJSON(ST_Transform(geom, 4326)) AS g
                FROM {}
                WHERE {} ILIKE $1
                LIMIT 1
                "#,
                table, name_col
            )
        };

        let mut q = sqlx::query(&query);
        if let Some(v) = id_as_i32 {
            q = q.bind(v);
        } else {
            let pattern = format!("%{}%", id.trim());
            q = q.bind(pattern);
        }

        match q.fetch_optional(pool).await {
            Ok(Some(r)) => {
                row = Some(r);
                break;
            }
            Ok(None) => continue,
            Err(e) => {
                tracing::warn!(?e, table, level, id, "ADM boundary query failed (trying next candidate)");
                continue;
            }
        }
    }

    let row = match row {
        Some(r) => r,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "adm not found"})),
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
                Json(serde_json::json!({"error": "decode error"})),
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
                Json(serde_json::json!({"error": "parse error"})),
            )
                .into_response();
        }
    };

    let feature = serde_json::json!({
        "type": "Feature",
        "properties": {
            "level": level,
            "id": id,
        },
        "geometry": geom
    });

    (StatusCode::OK, Json(feature)).into_response()
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
