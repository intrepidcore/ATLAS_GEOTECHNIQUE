use crate::state::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Deserialize)]
pub struct AdmNeighborsQuery {
    pub level: String,  // "adm1", "adm2", "adm3"
    pub name: String,   // Nom de l'ADM (ex: "Maritime")
}

#[derive(Serialize)]
pub struct AdmNeighbor {
    pub code: Option<String>,
    pub name: String,
    pub label: String,
    pub neighbor_type: String,  // "adm1", "adm2", "adm3", "country"
    pub direction: String,      // "N", "S", "E", "W"
    pub lon: f64,
    pub lat: f64,
}

#[derive(Serialize)]
pub struct AdmNeighborsResponse {
    pub adm_level: String,
    pub adm_name: String,
    pub neighbors: Vec<AdmNeighbor>,
}

/// GET /adm-neighbors?level=adm1&name=Maritime
/// Récupère les ADM limitrophes et pays voisins
pub async fn get_adm_neighbors(
    Query(params): Query<AdmNeighborsQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let level = params.level.to_lowercase();
    let name = params.name.clone();
    
    // Déterminer la table et le champ selon le niveau
    let (table, name_field) = match level.as_str() {
        "adm1" => ("adm1_togo", "adm1_fr"),
        "adm2" => ("adm2_togo", "adm2_fr"),
        "adm3" => ("adm3_togo", "adm3_fr"),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid level. Use adm1, adm2, or adm3"})),
            ).into_response();
        }
    };
    
    // Récupérer la géométrie et le centroïde de l'ADM cible
    let target_query = format!(
        r#"
        SELECT 
            ST_AsText(geom) as geom_wkt,
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
            ST_X(ST_PointOnSurface(ST_Intersection(n.geom, t.geom))) as label_lon,
            ST_Y(ST_PointOnSurface(ST_Intersection(n.geom, t.geom))) as label_lat,
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
            let label_lon: f64 = row.try_get("label_lon").unwrap_or(0.0);
            let label_lat: f64 = row.try_get("label_lat").unwrap_or(0.0);
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
                "adm2" => format!("Préfecture de {}", neighbor_name),
                "adm3" => format!("Commune de {}", neighbor_name),
                _ => neighbor_name.clone(),
            };
            
            neighbors.push(AdmNeighbor {
                code: None,
                name: neighbor_name,
                label,
                neighbor_type: level.clone(),
                direction: direction.to_string(),
                lon: if label_lon != 0.0 { label_lon } else { n_center_lon },
                lat: if label_lat != 0.0 { label_lat } else { n_center_lat },
            });
        }
    }
    
    // Pour ADM1, ajouter aussi les pays voisins
    if level == "adm1" {
        // Ghana à l'ouest, Bénin à l'est, Burkina Faso au nord
        let countries = vec![
            ("Ghana", "W", 0.0, 7.5),
            ("Bénin", "E", 1.8, 7.5),
            ("Burkina Faso", "N", 0.5, 11.0),
        ];
        
        // Vérifier quels pays touchent réellement cette région
        let country_check_query = r#"
            WITH target AS (
                SELECT geom FROM adm1_togo WHERE adm1_fr ILIKE $1 LIMIT 1
            )
            SELECT 
                CASE 
                    WHEN ST_XMin(t.geom) < 0.3 THEN true
                    ELSE false
                END as touches_ghana,
                CASE 
                    WHEN ST_XMax(t.geom) > 1.6 THEN true
                    ELSE false
                END as touches_benin,
                CASE 
                    WHEN ST_YMax(t.geom) > 10.5 THEN true
                    ELSE false
                END as touches_burkina
            FROM target t
        "#;
        
        if let Ok(Some(row)) = sqlx::query(country_check_query)
            .bind(&name)
            .fetch_optional(pool)
            .await
        {
            let touches_ghana: bool = row.try_get("touches_ghana").unwrap_or(false);
            let touches_benin: bool = row.try_get("touches_benin").unwrap_or(false);
            let touches_burkina: bool = row.try_get("touches_burkina").unwrap_or(false);
            
            if touches_ghana {
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
            if touches_benin {
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
            if touches_burkina {
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
