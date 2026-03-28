use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use sqlx::Row;
use uuid::Uuid;

fn validate_zone_code(code: &str) -> bool {
    let c = code.trim();
    !c.is_empty() && c.len() <= 64 && c.chars().all(|ch| ch.is_ascii_uppercase() || ch.is_ascii_digit() || ch == '_' || ch == '-')
}

#[derive(Serialize)]
pub struct ZoneEtudeListItem {
    pub id: Uuid,
    pub code: String,
    pub nom: String,
    pub description: Option<String>,
    pub type_zone: String,
    pub risque_rga: String,
    pub type_sol_principal: Option<String>,
    pub mineraux_argileux: Option<Vec<String>>,
    pub altitude_moyenne_m: Option<f64>,
    pub source_donnees: Option<String>,
    pub carte_overlay_order: i32,
    pub nb_mailles_total: i64,
    pub nb_mailles_prio1: i64,
    pub nb_sondages_existants: i64,
    pub centroid_lon: f64,
    pub centroid_lat: f64,
}

#[derive(Deserialize)]
pub struct ZoneMaillesQuery {
    pub limit: Option<i64>,
}

#[derive(Serialize)]
pub struct ZoneMailleItem {
    pub id: Uuid,
    pub maille_code: String,
    pub pct_intersection: f64,
    pub priorite_recherche: i32,
    pub geojson: serde_json::Value,

    pub nb_sondages: i64,
    pub nb_essais_vbs: i64,
    pub nb_essais_atterberg: i64,
    pub vbs_moyen: Option<f64>,
    pub statut_donnees: String,
}

#[derive(Serialize)]
pub struct ZoneGeoJsonResponse {
    pub geojson: serde_json::Value,
}

/// GET /api/zones-etude
/// Liste toutes les zones publiées (avec stats mailles/sondages + centroïde pour carte).
pub async fn list_zones_etude(
    State(state): State<AppState>,
) -> impl IntoResponse {
    list_zones_etude_impl(&state.pool).await
}

async fn list_zones_etude_impl(pool: &PgPool) -> impl IntoResponse {
    // Limite défensive (SEC-03)
    let limit: i64 = 200;

    let rows = match sqlx::query(
        r#"
        SELECT
            ze.id,
            ze.code,
            ze.nom,
            ze.description,
            ze.type_zone,
            ze.risque_rga,
            ze.type_sol_principal,
            ze.mineraux_argileux,
            ze.altitude_moyenne_m,
            ze.source_donnees,
            COALESCE(ze.carte_overlay_order, 100)::int AS carte_overlay_order,
            COUNT(DISTINCT mze.maille_id) AS nb_mailles_total,
            COUNT(DISTINCT CASE WHEN mze.priorite_recherche = 1 THEN mze.maille_id END) AS nb_mailles_prio1,
            COUNT(DISTINCT s.id) AS nb_sondages_existants,
            ST_X(ST_Transform(ST_Centroid(ze.geom), 4326)) AS centroid_lon,
            ST_Y(ST_Transform(ST_Centroid(ze.geom), 4326)) AS centroid_lat
        FROM atlas.zones_etude ze
        LEFT JOIN atlas.mailles_zones_etude mze ON mze.zone_id = ze.id
        LEFT JOIN atlas.mailles m ON m.id = mze.maille_id
        LEFT JOIN atlas.sondages s
          ON s.deleted_at IS NULL
         AND (
            (s.geom IS NOT NULL AND ST_Within(s.geom, ST_Transform(m.geom, 4326)))
            OR
            (s.geom IS NULL AND s.maille_code = m.code)
         )
        WHERE ze.is_published = TRUE
        GROUP BY
            ze.id, ze.code, ze.nom, ze.description, ze.type_zone, ze.risque_rga,
            ze.type_sol_principal, ze.mineraux_argileux, ze.altitude_moyenne_m, ze.source_donnees,
            ze.carte_overlay_order, ze.geom
        ORDER BY COALESCE(ze.carte_overlay_order, 100) ASC, ze.risque_rga DESC, ze.nom
        LIMIT $1
        "#
    )
    .bind(limit)
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "db error", "details": e.to_string()})),
            )
                .into_response();
        }
    };

    let mut out: Vec<ZoneEtudeListItem> = Vec::with_capacity(rows.len());
    for row in rows {
        let mineraux: Option<Vec<String>> = row.try_get("mineraux_argileux").ok();
        let altitude_moyenne_m: Option<f64> = row.try_get("altitude_moyenne_m").ok().flatten();

        out.push(ZoneEtudeListItem {
            id: row.get("id"),
            code: row.get("code"),
            nom: row.get("nom"),
            description: row.try_get("description").ok(),
            type_zone: row.get("type_zone"),
            risque_rga: row.get("risque_rga"),
            type_sol_principal: row.try_get("type_sol_principal").ok(),
            mineraux_argileux: mineraux,
            altitude_moyenne_m,
            source_donnees: row.try_get("source_donnees").ok(),
            carte_overlay_order: row
                .try_get::<i32, _>("carte_overlay_order")
                .unwrap_or(100),
            nb_mailles_total: row.get::<i64, _>("nb_mailles_total"),
            nb_mailles_prio1: row.get::<i64, _>("nb_mailles_prio1"),
            nb_sondages_existants: row.get::<i64, _>("nb_sondages_existants"),
            centroid_lon: row.get::<f64, _>("centroid_lon"),
            centroid_lat: row.get::<f64, _>("centroid_lat"),
        });
    }

    Json(out).into_response()
}

/// GET /api/zones-etude/:code/mailles
/// Mailles d'une zone avec stats géotechniques & geojson.
pub async fn get_zone_mailles(
    Path(code): Path<String>,
    Query(q): Query<ZoneMaillesQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let code_trim = code.trim().to_string();
    if !validate_zone_code(&code_trim) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "zone_code invalide", "error_code": "INVALID_ZONE_CODE"})),
        )
            .into_response();
    }

    let limit = q.limit.unwrap_or(1000).clamp(1, 5000);

    let rows = match sqlx::query(
        r#"
        SELECT
            m.id AS maille_id,
            m.code AS maille_code,
            mze.pct_intersection::float8 AS pct_intersection,
            mze.priorite_recherche::int AS priorite_recherche,
            ST_AsGeoJSON(ST_Transform(m.geom, 4326))::jsonb AS geojson,

            COALESCE(COUNT(DISTINCT s.id), 0)::bigint AS nb_sondages,
            COALESCE(COUNT(DISTINCT ev.id), 0)::bigint AS nb_essais_vbs,
            COALESCE(COUNT(DISTINCT ea.id), 0)::bigint AS nb_essais_atterberg,
            AVG(ev.vbs)::float8 AS vbs_moyen,

            CASE
              WHEN COUNT(DISTINCT s.id) = 0 THEN 'aucune_donnee'
              WHEN COUNT(DISTINCT ev.id) > 0 AND COUNT(DISTINCT ea.id) > 0 THEN 'bien_documente'
              WHEN COUNT(DISTINCT s.id) > 0 THEN 'partiellement_documente'
              ELSE 'non_documente'
            END AS statut_donnees
        FROM atlas.mailles m
        JOIN atlas.mailles_zones_etude mze ON mze.maille_id = m.id
        JOIN atlas.zones_etude ze ON ze.id = mze.zone_id
        LEFT JOIN atlas.sondages s
          ON s.deleted_at IS NULL
         AND (
            (s.geom IS NOT NULL AND ST_Within(s.geom, ST_Transform(m.geom, 4326)))
            OR
            (s.geom IS NULL AND s.maille_code = m.code)
         )
        LEFT JOIN atlas.echantillons e ON e.sondage_id = s.id
        LEFT JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id
        LEFT JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id
        WHERE ze.code = $1 AND ze.is_published = TRUE
        GROUP BY m.id, m.code, m.geom, mze.pct_intersection, mze.priorite_recherche
        ORDER BY mze.priorite_recherche, mze.pct_intersection DESC
        LIMIT $2
        "#
    )
    .bind(&code_trim)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "db error", "details": e.to_string()})),
            )
                .into_response();
        }
    };

    // Si aucun résultat, renvoyer 404 pour faciliter le debug UI
    if rows.is_empty() {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "zone ou mailles introuvables", "error_code": "ZONE_MAILLES_NOT_FOUND"})),
        )
            .into_response();
    }

    let mut out: Vec<ZoneMailleItem> = Vec::with_capacity(rows.len());
    for row in rows {
        let geojson: serde_json::Value = row.get("geojson");
        let vbs_moyen: Option<f64> = row.try_get("vbs_moyen").ok().flatten();
        out.push(ZoneMailleItem {
            id: row.get("maille_id"),
            maille_code: row.get("maille_code"),
            pct_intersection: row.get::<f64, _>("pct_intersection"),
            priorite_recherche: row.get::<i32, _>("priorite_recherche"),
            geojson,
            nb_sondages: row.get::<i64, _>("nb_sondages"),
            nb_essais_vbs: row.get::<i64, _>("nb_essais_vbs"),
            nb_essais_atterberg: row.get::<i64, _>("nb_essais_atterberg"),
            vbs_moyen,
            statut_donnees: row.get("statut_donnees"),
        });
    }

    Json(out).into_response()
}

/// GET /api/zones-etude/:code/geojson
/// GeoJSON de la zone pour affichage carte.
pub async fn get_zone_geojson(
    Path(code): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let code_trim = code.trim().to_string();
    if !validate_zone_code(&code_trim) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "zone_code invalide", "error_code": "INVALID_ZONE_CODE"})),
        )
            .into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT ST_AsGeoJSON(ST_Transform(COALESCE(geom_display, geom), 4326))::jsonb AS geojson
        FROM atlas.zones_etude
        WHERE code = $1 AND is_published = TRUE
        LIMIT 1
        "#
    )
    .bind(&code_trim)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "db error", "details": e.to_string()})),
            )
                .into_response();
        }
    };

    let Some(row) = row else {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "zone introuvable", "error_code": "ZONE_NOT_FOUND"})),
        )
            .into_response();
    };

    let geojson: serde_json::Value = row.get("geojson");
    Json(ZoneGeoJsonResponse { geojson }).into_response()
}

