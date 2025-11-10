use crate::state::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use sqlx::Row;

#[derive(Serialize)]
pub struct NeighborMaille {
    pub code: String,
    pub direction: String,
    pub n_sondages: i64,
    pub n_essais: i64,
    pub spt_n_avg: Option<f64>,
    pub qc_avg: Option<f64>,
    pub distance_m: Option<f64>,
}

/// GET /grid/:code/neighbors - Récupère les 4 mailles voisines (N, S, E, O)
pub async fn get_neighbors(
    Path(code): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;

    // Récupérer le centroïde de la maille actuelle
    let maille_row = sqlx::query(
        r#"
        SELECT ST_X(ST_Transform(ST_Centroid(geom), 4326)) as lon,
               ST_Y(ST_Transform(ST_Centroid(geom), 4326)) as lat
        FROM mailles
        WHERE code = $1
        "#,
    )
    .bind(&code)
    .fetch_optional(pool)
    .await;

    let (lon, lat) = match maille_row {
        Ok(Some(row)) => {
            let lon: f64 = row.try_get("lon").unwrap_or(0.0);
            let lat: f64 = row.try_get("lat").unwrap_or(0.0);
            (lon, lat)
        }
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Maille not found"})),
            )
                .into_response();
        }
    };

    // Récupérer les 4 mailles les plus proches dans chaque direction
    let neighbors_query = r#"
        WITH current_maille AS (
            SELECT geom, ST_Transform(ST_Centroid(geom), 4326) as centroid
            FROM mailles
            WHERE code = $1
        ),
        neighbor_stats AS (
            SELECT 
                m.code,
                ST_X(ST_Transform(ST_Centroid(m.geom), 4326)) as m_lon,
                ST_Y(ST_Transform(ST_Centroid(m.geom), 4326)) as m_lat,
                COALESCE(COUNT(DISTINCT s.id), 0)::bigint AS n_sondages,
                COALESCE(COUNT(e.id), 0)::bigint AS n_essais,
                AVG(CASE WHEN e.type_essai = 'SPT_N' THEN e.valeur_numerique::numeric ELSE NULL END) AS spt_n_avg,
                AVG(CASE WHEN e.type_essai = 'qc' THEN e.valeur_numerique::numeric ELSE NULL END) AS qc_avg,
                ST_Distance(
                    ST_Transform(ST_Centroid(m.geom), 4326)::geography,
                    (SELECT centroid::geography FROM current_maille)
                ) as distance_m
            FROM mailles m
            CROSS JOIN current_maille cm
            LEFT JOIN sondages s ON ST_Within(s.geom, m.geom)
            LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
            WHERE m.code != $1
              AND ST_DWithin(
                    ST_Transform(m.geom, 4326)::geography,
                    (SELECT centroid::geography FROM current_maille),
                    5000
                  )
            GROUP BY m.code, m.geom
        )
        SELECT 
            code,
            CASE 
                WHEN m_lat > $3 AND ABS(m_lon - $2) < ABS(m_lat - $3) THEN 'Nord'
                WHEN m_lat < $3 AND ABS(m_lon - $2) < ABS(m_lat - $3) THEN 'Sud'
                WHEN m_lon > $2 THEN 'Est'
                ELSE 'Ouest'
            END as direction,
            n_sondages,
            n_essais,
            spt_n_avg,
            qc_avg,
            distance_m
        FROM neighbor_stats
        ORDER BY distance_m ASC
        LIMIT 8
    "#;

    let rows = sqlx::query(neighbors_query)
        .bind(&code)
        .bind(lon)
        .bind(lat)
        .fetch_all(pool)
        .await;

    match rows {
        Ok(rows) => {
            let mut neighbors: Vec<NeighborMaille> = Vec::new();
            let mut seen_directions = std::collections::HashSet::new();

            for row in rows {
                let direction: String = row.try_get("direction").unwrap_or_default();

                // Prendre seulement la première maille de chaque direction
                if seen_directions.contains(&direction) {
                    continue;
                }
                seen_directions.insert(direction.clone());

                let spt_avg: Option<sqlx::types::BigDecimal> =
                    row.try_get("spt_n_avg").ok().flatten();
                let qc_avg: Option<sqlx::types::BigDecimal> = row.try_get("qc_avg").ok().flatten();

                neighbors.push(NeighborMaille {
                    code: row.try_get("code").unwrap_or_default(),
                    direction,
                    n_sondages: row.try_get("n_sondages").unwrap_or(0),
                    n_essais: row.try_get("n_essais").unwrap_or(0),
                    spt_n_avg: spt_avg.and_then(|v| v.to_string().parse().ok()),
                    qc_avg: qc_avg.and_then(|v| v.to_string().parse().ok()),
                    distance_m: row.try_get("distance_m").ok(),
                });

                if neighbors.len() >= 4 {
                    break;
                }
            }

            Json(neighbors).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "get_neighbors error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            )
                .into_response()
        }
    }
}
