use axum::{routing::{get, post}, Router, extract::{Path, State}, Json};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde::Serialize;
use sqlx::Row;
use crate::state::AppState;

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
        .route("/recompute/:code", post(recompute_grid))
}

async fn get_grid(State(state): State<AppState>, Path(code): Path<String>) -> impl IntoResponse {
    let pool = &state.pool;
    // Maille bbox (4326) + stats
    let row_opt = sqlx::query(
        r#"
        SELECT id,
               stats,
               ST_XMin(g4326) AS xmin,
               ST_YMin(g4326) AS ymin,
               ST_XMax(g4326) AS xmax,
               ST_YMax(g4326) AS ymax
        FROM (
            SELECT id, stats, ST_Transform(ST_Envelope(geom), 4326) AS g4326
            FROM mailles WHERE code = $1
        ) q
        "#
    ).bind(&code).fetch_optional(pool).await;

    let row = match row_opt {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error":"maille introuvable"}))).into_response();
        }
        Err(e) => {
            tracing::error!(error=?e, "db error get_grid");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"}))).into_response();
        }
    };

    let maille_id: uuid::Uuid = match row.try_get("id") { Ok(v) => v, Err(e) => { tracing::error!(?e, "decode id"); return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"decode"}))).into_response(); } };
    let stats: serde_json::Value = row.try_get("stats").unwrap_or(serde_json::json!({}));
    let xmin: f64 = row.try_get("xmin").unwrap_or_default();
    let ymin: f64 = row.try_get("ymin").unwrap_or_default();
    let xmax: f64 = row.try_get("xmax").unwrap_or_default();
    let ymax: f64 = row.try_get("ymax").unwrap_or_default();
    let bbox = [xmin, ymin, xmax, ymax];

    // Comptages
    let n_sondages: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM sondages s
        JOIN mailles m ON m.id = $1
        WHERE ST_Within(s.geom, m.geom)
        "#
    ).bind(maille_id).fetch_one(pool).await.unwrap_or(0);

    let n_essais: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM essais e
        JOIN sondages s ON s.id = e.sondage_id
        JOIN mailles m ON m.id = $1
        WHERE ST_Within(s.geom, m.geom)
        "#
    ).bind(maille_id).fetch_one(pool).await.unwrap_or(0);

    let rows = sqlx::query(
        r#"
        SELECT e.type, COUNT(*)::bigint AS n
        FROM essais e
        JOIN sondages s ON s.id = e.sondage_id
        JOIN mailles m ON m.id = $1
        WHERE ST_Within(s.geom, m.geom)
        GROUP BY e.type
        "#
    ).bind(maille_id).fetch_all(pool).await.unwrap_or_default();
    let mut by_type = serde_json::Map::new();
    for r in rows { by_type.insert(r.get::<String,_>("type"), serde_json::json!(r.get::<i64,_>("n"))); }

    let summary = serde_json::json!({
        "n_sondages": n_sondages,
        "n_essais": n_essais,
        "by_type": by_type,
    });

    Json(GridResponse { code, bbox, stats, summary }).into_response()
}

// GET /grid/{code}/shape -> GeoJSON Feature (Polygon) EPSG:4326
async fn get_grid_shape(State(state): State<AppState>, Path(code): Path<String>) -> impl IntoResponse {
    let pool = &state.pool;
    let row_opt = sqlx::query(
        r#"SELECT ST_AsGeoJSON(ST_Transform(geom,4326)) AS g FROM mailles WHERE code=$1"#
    ).bind(&code).fetch_optional(pool).await;
    let row = match row_opt {
        Ok(Some(r)) => r,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error":"maille introuvable"}))).into_response(),
        Err(e) => { tracing::error!(?e, "grid shape"); return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"}))).into_response(); }
    };
    let g: String = match row.try_get("g") { Ok(v) => v, Err(e) => { tracing::error!(?e, "decode geojson"); return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"decode"}))).into_response(); } };
    let geom: serde_json::Value = match serde_json::from_str(&g) { Ok(v) => v, Err(e) => { tracing::error!(?e, "parse geojson"); return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"parse"}))).into_response(); } };
    let feature = serde_json::json!({
        "type":"Feature",
        "geometry": geom,
        "properties": {"code": code}
    });
    Json(feature).into_response()
}

// GET /coverage/mailles -> FeatureCollection EPSG:4326 avec comptes
pub async fn get_coverage_mailles(State(state): State<AppState>) -> impl IntoResponse {
    let pool = &state.pool;
    let rows = match sqlx::query(
        r#"
        SELECT m.code,
               ST_AsGeoJSON(ST_Transform(m.geom,4326)) AS g,
               m.adm1_name,
               m.adm2_name,
               m.adm3_name,
               COALESCE(COUNT(DISTINCT s.id),0)::bigint AS n_sondages,
               COALESCE(COUNT(e.id),0)::bigint AS n_essais
        FROM mailles m
        LEFT JOIN sondages s ON ST_Within(s.geom, m.geom)
        LEFT JOIN essais e ON e.sondage_id = s.id
        GROUP BY m.code, m.geom, m.adm1_name, m.adm2_name, m.adm3_name
        "#
    ).fetch_all(pool).await {
        Ok(v) => v,
        Err(e) => { tracing::error!(?e, "coverage query"); return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"type":"FeatureCollection","features":[]}))).into_response(); }
    };
    let mut features = Vec::new();
    for r in rows {
        let code: String = r.get("code");
        let g: String = r.get("g");
        let adm1_name: Option<String> = r.try_get("adm1_name").ok();
        let adm2_name: Option<String> = r.try_get("adm2_name").ok();
        let adm3_name: Option<String> = r.try_get("adm3_name").ok();
        let n_sondages: i64 = r.get("n_sondages");
        let n_essais: i64 = r.get("n_essais");
        let has_data = n_sondages > 0;
        if let Ok(geom) = serde_json::from_str::<serde_json::Value>(&g) {
            let mut props = serde_json::json!({
                "code": code,
                "has_data": has_data,
                "n_sondages": n_sondages,
                "n_essais": n_essais
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

async fn recompute_grid(State(state): State<AppState>, Path(code): Path<String>) -> impl IntoResponse {
    let pool = &state.pool;
    // Récupérer maille id/geom
    let row_opt = sqlx::query(
        r#"SELECT id, geom, stats FROM mailles WHERE code=$1"#
    ).bind(&code).fetch_optional(pool).await;
    let row = match row_opt {
        Ok(Some(r)) => r,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error":"maille introuvable"}))).into_response(),
        Err(e) => { tracing::error!(?e, "db error load maille"); return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"}))).into_response(); }
    };
    let maille_id: uuid::Uuid = match row.try_get("id") { Ok(v) => v, Err(e) => { tracing::error!(?e, "decode id"); return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"decode"}))).into_response(); } };
    let _stats0: serde_json::Value = row.try_get("stats").unwrap_or(serde_json::json!({"samples":0}));

    // Points SPT_N à l'intérieur (coords 25231 en mètres)
    let pts = sqlx::query(
        r#"
        SELECT ST_X(s.geom) AS x, ST_Y(s.geom) AS y, e.value::double precision AS value
        FROM essais e
        JOIN sondages s ON s.id = e.sondage_id
        JOIN mailles m ON m.id = $1
        WHERE e.type = 'SPT_N' AND ST_Within(s.geom, m.geom)
        "#
    ).bind(maille_id).fetch_all(pool).await.unwrap_or_default();

    let mut samples = Vec::new();
    for r in pts {
        let x: f64 = match r.try_get("x") { Ok(v) => v, Err(e) => { tracing::error!(?e, "decode x"); continue; } };
        let y: f64 = match r.try_get("y") { Ok(v) => v, Err(e) => { tracing::error!(?e, "decode y"); continue; } };
        let v: f64 = match r.try_get("value") { Ok(v) => v, Err(e) => { tracing::error!(?e, "decode value"); continue; } };
        samples.push((x,y,v));
    }
    let n = samples.len() as i64;

    // Centroid
    let c = match sqlx::query(
        r#"SELECT ST_X(c) AS cx, ST_Y(c) AS cy FROM (SELECT ST_Centroid(geom) AS c FROM mailles WHERE id=$1) t"#
    ).bind(maille_id).fetch_one(pool).await {
        Ok(r) => r,
        Err(e) => { tracing::error!(?e, "centroid query"); return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"}))).into_response(); }
    };
    let cx: f64 = match c.try_get("cx") { Ok(v) => v, Err(e) => { tracing::error!(?e, "decode cx"); return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"decode"}))).into_response(); } };
    let cy: f64 = match c.try_get("cy") { Ok(v) => v, Err(e) => { tracing::error!(?e, "decode cy"); return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"decode"}))).into_response(); } };

    // IDW p=2 (en Rust)
    let p = 2.0;
    let eps = 1e-9f64;
    let v_hat = compute_idw(cx, cy, &samples, p, eps);

    // Minimum d'échantillons
    if samples.len() < 3 {
        return (StatusCode::UNPROCESSABLE_ENTITY, Json(serde_json::json!({"error":"insufficient samples"}))).into_response();
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
        "#
    ).bind(maille_id).bind(&new_stats).fetch_one(pool).await {
        Ok(v) => v,
        Err(e) => { tracing::error!(?e, "update stats"); return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"}))).into_response(); }
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
        "#
    ).bind(maille_id).fetch_one(pool).await {
        Ok(r) => r,
        Err(e) => { tracing::error!(?e, "bbox recompute"); return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"}))).into_response(); }
    };
    let bbox = [row2.get("xmin"), row2.get("ymin"), row2.get("xmax"), row2.get("ymax")];

    let n_sondages: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM sondages s
        JOIN mailles m ON m.id = $1
        WHERE ST_Within(s.geom, m.geom)
        "#
    ).bind(maille_id).fetch_one(pool).await.unwrap_or(0);
    let n_essais: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM essais e
        JOIN sondages s ON s.id = e.sondage_id
        JOIN mailles m ON m.id = $1
        WHERE ST_Within(s.geom, m.geom)
        "#
    ).bind(maille_id).fetch_one(pool).await.unwrap_or(0);
    let rows = sqlx::query(
        r#"
        SELECT e.type, COUNT(*)::bigint AS n
        FROM essais e
        JOIN sondages s ON s.id = e.sondage_id
        JOIN mailles m ON m.id = $1
        WHERE ST_Within(s.geom, m.geom)
        GROUP BY e.type
        "#
    ).bind(maille_id).fetch_all(pool).await.unwrap_or_default();
    let mut by_type = serde_json::Map::new();
    for r in rows { by_type.insert(r.get::<String,_>("type"), serde_json::json!(r.get::<i64,_>("n"))); }
    let summary = serde_json::json!({
        "n_sondages": n_sondages,
        "n_essais": n_essais,
        "by_type": by_type,
    });

    let resp = GridResponse { code, bbox, stats: updated, summary };
    Json(resp).into_response()
}

// Placeholder traits for future interpolation modules (IDW, Krigeage)
#[allow(dead_code)]
pub mod interp {
    pub trait Interpolator {
        fn name(&self) -> &'static str;
        fn fit(&mut self, _x: &[(f64, f64)], _y: &[f64]) { /* TODO */ }
        fn predict(&self, _xq: &[(f64, f64)]) -> Vec<f64> { vec![] }
    }

    pub struct Idw { pub power: f64 }
    impl Interpolator for Idw {
        fn name(&self) -> &'static str { "idw" }
    }

    pub struct Kriging {}
    impl Interpolator for Kriging {
        fn name(&self) -> &'static str { "kriging" }
    }
}

// --- IDW util & tests ---
fn compute_idw(cx: f64, cy: f64, samples: &[(f64,f64,f64)], p: f64, eps: f64) -> f64 {
    let mut num = 0.0f64;
    let mut den = 0.0f64;
    for (x, y, v) in samples.iter() {
        let dx = x - cx; let dy = y - cy; let d2 = dx*dx + dy*dy;
        if d2 < eps { return *v; }
        let w = 1.0 / (d2.powf(p/2.0) + eps);
        num += w * *v; den += w;
    }
    if den > 0.0 { num/den } else { f64::NAN }
}

#[cfg(test)]
mod tests {
    use super::compute_idw;

    #[test]
    fn idw_zero_distance() {
        let v = compute_idw(0.0, 0.0, &[(0.0,0.0,42.0), (1.0,0.0,10.0)], 2.0, 1e-9);
        assert!((v - 42.0).abs() < 1e-9);
    }

    #[test]
    fn idw_simple_weighted() {
        // Deux points symétriques autour de (0,0), valeurs 10 et 30 -> moyenne 20
        let v = compute_idw(0.0, 0.0, &[(-1.0,0.0,10.0), (1.0,0.0,30.0)], 2.0, 1e-9);
        assert!((v - 20.0).abs() < 1e-6);
    }
}
