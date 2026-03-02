use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use sqlx::{Postgres, QueryBuilder};
use sqlx::Row;
use num_traits::ToPrimitive;

use crate::state::AppState;

#[derive(sqlx::FromRow)]
struct EchantillonRow {
    id: sqlx::types::Uuid,
    depth_m: Option<sqlx::types::BigDecimal>,
    laboratory: Option<String>,
    norm: Option<String>,
    rho_s_gcm3: Option<sqlx::types::BigDecimal>,
    water_content_w: Option<sqlx::types::BigDecimal>,
    date: Option<chrono::NaiveDate>,
}

#[derive(Serialize)]
pub struct SondagesStatsResponse {
    pub total: i64,
    pub geocoded: i64,
    pub with_geom: i64,
    pub with_adm3: i64,
    pub missing_geom: i64,
    pub missing_adm3: i64,
}

pub async fn get_sondage_details(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let sondage_id = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };

    let sondage_row = match sqlx::query(
        r#"
        SELECT
            id,
            COALESCE(code, '') AS code,
            COALESCE(localite, COALESCE(localite_base, '')) AS localite,
            adm3_id,
            adm3_name,
            is_geocoded,
            COALESCE(location_mode, 'unknown') AS location_mode,
            meta,
            COALESCE(source, '') AS source,
            created_at,
            COALESCE(updated_at, created_at) AS updated_at,
            ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geom_geojson,
            ST_X(ST_Transform(geom, 4326)) AS lon,
            ST_Y(ST_Transform(geom, 4326)) AS lat
        FROM atlas.sondages
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(sondage_id)
    .fetch_optional(pool)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error":"not found"})),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!(?e, "get_sondage_details sondage");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let meta: Option<serde_json::Value> = sondage_row.try_get("meta").ok();
    let geom: Option<serde_json::Value> = sondage_row
        .try_get::<String, _>("geom_geojson")
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok());
    let coordinates = match (
        sondage_row.try_get::<f64, _>("lat").ok(),
        sondage_row.try_get::<f64, _>("lon").ok(),
    ) {
        (Some(lat), Some(lon)) => Some(serde_json::json!({"lat": lat, "lon": lon})),
        _ => None,
    };

    let echantillons: Vec<EchantillonRow> = sqlx::query_as(
        r#"
        SELECT id, depth_m, laboratory, norm, rho_s_gcm3, water_content_w, date
        FROM atlas.echantillons
        WHERE sondage_id = $1
        ORDER BY depth_m NULLS LAST, created_at
        "#,
    )
    .bind(sondage_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Helper map: echantillon_id -> depth_m
    use std::collections::HashMap;
    let mut depth_by_ech: HashMap<sqlx::types::Uuid, f64> = HashMap::new();
    for e in &echantillons {
        if let Some(d) = e.depth_m.as_ref().and_then(|d| d.to_f64()) {
            depth_by_ech.insert(e.id, d);
        }
    }

    // Atterberg
    let atterberg_rows = sqlx::query(
        r#"
        SELECT a.echantillon_id, a.wl, a.wp, a.ip_generated AS ip
        FROM atlas.essais_atterberg a
        JOIN atlas.echantillons e ON e.id = a.echantillon_id
        WHERE e.sondage_id = $1
        "#,
    )
    .bind(sondage_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    let atterberg: Vec<serde_json::Value> = atterberg_rows
        .into_iter()
        .filter_map(|r| {
            let ech_id: sqlx::types::Uuid = r.try_get("echantillon_id").ok()?;
            let depth_m = depth_by_ech.get(&ech_id).copied().unwrap_or(0.0);
            Some(serde_json::json!({
                "depth_m": depth_m,
                "wl": r.try_get::<sqlx::types::BigDecimal,_>("wl").ok().and_then(|v| v.to_f64()),
                "wp": r.try_get::<sqlx::types::BigDecimal,_>("wp").ok().and_then(|v| v.to_f64()),
                "ip": r.try_get::<sqlx::types::BigDecimal,_>("ip").ok().and_then(|v| v.to_f64()),
                "echantillon_id": ech_id.to_string(),
            }))
        })
        .collect();

    // VBS
    let vbs_rows = sqlx::query(
        r#"
        SELECT v.echantillon_id, v.vbs
        FROM atlas.essais_vbs v
        JOIN atlas.echantillons e ON e.id = v.echantillon_id
        WHERE e.sondage_id = $1
        "#,
    )
    .bind(sondage_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    let vbs: Vec<serde_json::Value> = vbs_rows
        .into_iter()
        .filter_map(|r| {
            let ech_id: sqlx::types::Uuid = r.try_get("echantillon_id").ok()?;
            let depth_m = depth_by_ech.get(&ech_id).copied().unwrap_or(0.0);
            Some(serde_json::json!({
                "depth_m": depth_m,
                "vbs": r.try_get::<sqlx::types::BigDecimal,_>("vbs").ok().and_then(|v| v.to_f64()),
                "echantillon_id": ech_id.to_string(),
            }))
        })
        .collect();

    // Classif
    let classif_rows = sqlx::query(
        r#"
        SELECT
            c.id,
            c.depth_m,
            c.systeme,
            c.classe,
            c.hrb,
            c.unified,
            c.class_chassagneux,
            c.class_daksha,
            c.class_seed,
            c.class_vijay,
            c.type_sol,
            c.cg,
            c.cg_qual,
            c.echantillon_id
        FROM atlas.essais_classif c
        WHERE c.deleted_at IS NULL AND c.echantillon_id IN (
            SELECT id FROM atlas.echantillons WHERE sondage_id = $1
        )
        "#,
    )
    .bind(sondage_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    let classif: Vec<serde_json::Value> = classif_rows
        .into_iter()
        .filter_map(|r| {
            let id: sqlx::types::Uuid = r.try_get("id").ok()?;
            let depth_m = r
                .try_get::<sqlx::types::BigDecimal, _>("depth_m")
                .ok()
                .and_then(|v| v.to_f64())
                .unwrap_or(0.0);
            let ech_id: Option<sqlx::types::Uuid> = r.try_get("echantillon_id").ok();
            Some(serde_json::json!({
                "id": id.to_string(),
                "depth_m": depth_m,
                "systeme": r.try_get::<String,_>("systeme").ok(),
                "classe": r.try_get::<String,_>("classe").ok(),
                "hrb": r.try_get::<String,_>("hrb").ok(),
                "unified": r.try_get::<String,_>("unified").ok(),
                "class_chassagneux": r.try_get::<String,_>("class_chassagneux").ok(),
                "class_daksha": r.try_get::<String,_>("class_daksha").ok(),
                "class_seed": r.try_get::<String,_>("class_seed").ok(),
                "class_vijay": r.try_get::<String,_>("class_vijay").ok(),
                "type_sol": r.try_get::<String,_>("type_sol").ok(),
                "cg": r.try_get::<sqlx::types::BigDecimal,_>("cg").ok().and_then(|v| v.to_f64()),
                "cg_qual": r.try_get::<String,_>("cg_qual").ok(),
                "echantillon_id": ech_id.map(|u| u.to_string()),
            }))
        })
        .collect();

    // Gonflement
    let gonf_rows = sqlx::query(
        r#"
        SELECT g.id, g.echantillon_id, g.cg, g.cg_qual, g.type_sol
        FROM atlas.essais_potentiel_gonflement g
        JOIN atlas.echantillons e ON e.id = g.echantillon_id
        WHERE e.sondage_id = $1
        "#,
    )
    .bind(sondage_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    let gonflement: Vec<serde_json::Value> = gonf_rows
        .into_iter()
        .filter_map(|r| {
            let id: sqlx::types::Uuid = r.try_get("id").ok()?;
            let ech_id: sqlx::types::Uuid = r.try_get("echantillon_id").ok()?;
            let depth_m = depth_by_ech.get(&ech_id).copied().unwrap_or(0.0);
            Some(serde_json::json!({
                "id": id.to_string(),
                "depth_m": depth_m,
                "cg": r.try_get::<sqlx::types::BigDecimal,_>("cg").ok().and_then(|v| v.to_f64()),
                "cg_qual": r.try_get::<String,_>("cg_qual").ok(),
                "type_sol": r.try_get::<String,_>("type_sol").ok(),
                "echantillon_id": ech_id.to_string(),
            }))
        })
        .collect();

    // Physiques
    let phys_rows = sqlx::query(
        r#"
        SELECT p.id, p.echantillon_id, p.densite_apparente_gcm3, p.densite_absolue_gcm3, p.teneur_eau_pct, p.w, p.rho_s, p.laboratory, p.measured_at
        FROM atlas.essais_physiques p
        JOIN atlas.echantillons e ON e.id = p.echantillon_id
        WHERE e.sondage_id = $1 AND p.deleted_at IS NULL
        "#,
    )
    .bind(sondage_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    let physiques: Vec<serde_json::Value> = phys_rows
        .into_iter()
        .filter_map(|r| {
            let id: sqlx::types::Uuid = r.try_get("id").ok()?;
            let ech_id: sqlx::types::Uuid = r.try_get("echantillon_id").ok()?;
            let depth_m = depth_by_ech.get(&ech_id).copied().unwrap_or(0.0);
            Some(serde_json::json!({
                "id": id.to_string(),
                "depth_m": depth_m,
                "densite_apparente_gcm3": r.try_get::<sqlx::types::BigDecimal,_>("densite_apparente_gcm3").ok().and_then(|v| v.to_f64()),
                "densite_absolue_gcm3": r.try_get::<sqlx::types::BigDecimal,_>("densite_absolue_gcm3").ok().and_then(|v| v.to_f64()),
                "teneur_eau_pct": r.try_get::<sqlx::types::BigDecimal,_>("teneur_eau_pct").ok().and_then(|v| v.to_f64()),
                "w": r.try_get::<sqlx::types::BigDecimal,_>("w").ok().and_then(|v| v.to_f64()),
                "rho_s": r.try_get::<sqlx::types::BigDecimal,_>("rho_s").ok().and_then(|v| v.to_f64()),
                "laboratory": r.try_get::<String,_>("laboratory").ok(),
                "measured_at": r.try_get::<chrono::NaiveDate,_>("measured_at").ok().map(|d| d.to_string()),
                "echantillon_id": ech_id.to_string(),
            }))
        })
        .collect();

    // Proctor
    let proc_rows = sqlx::query(
        r#"
        SELECT p.id, p.echantillon_id, p.rho_d_max, p.w_opt
        FROM atlas.essais_proctor p
        JOIN atlas.echantillons e ON e.id = p.echantillon_id
        WHERE e.sondage_id = $1
        "#,
    )
    .bind(sondage_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    let proctor: Vec<serde_json::Value> = proc_rows
        .into_iter()
        .filter_map(|r| {
            let id: sqlx::types::Uuid = r.try_get("id").ok()?;
            let ech_id: sqlx::types::Uuid = r.try_get("echantillon_id").ok()?;
            let depth_m = depth_by_ech.get(&ech_id).copied().unwrap_or(0.0);
            Some(serde_json::json!({
                "id": id.to_string(),
                "depth_m": depth_m,
                "rho_d_max": r.try_get::<sqlx::types::BigDecimal,_>("rho_d_max").ok().and_then(|v| v.to_f64()),
                "w_opt": r.try_get::<sqlx::types::BigDecimal,_>("w_opt").ok().and_then(|v| v.to_f64()),
                "echantillon_id": ech_id.to_string(),
            }))
        })
        .collect();

    // Granulometrie (group points by echantillon_id + method)
    let granulo_rows = sqlx::query(
        r#"
        SELECT gp.echantillon_id, gp.method, gp.sieve_mm, gp.passing_pct
        FROM atlas.granulo_points gp
        JOIN atlas.echantillons e ON e.id = gp.echantillon_id
        WHERE e.sondage_id = $1
        ORDER BY gp.echantillon_id, gp.method, gp.sieve_mm
        "#,
    )
    .bind(sondage_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut granulo_map: HashMap<(sqlx::types::Uuid, Option<String>), Vec<serde_json::Value>> = HashMap::new();
    for r in granulo_rows {
        let ech_id: sqlx::types::Uuid = match r.try_get("echantillon_id") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let method: Option<String> = r.try_get("method").ok();
        let sieve_mm = r
            .try_get::<sqlx::types::BigDecimal, _>("sieve_mm")
            .ok()
            .and_then(|v| v.to_f64())
            .unwrap_or(0.0);
        let passing_pct = r
            .try_get::<sqlx::types::BigDecimal, _>("passing_pct")
            .ok()
            .and_then(|v| v.to_f64())
            .unwrap_or(0.0);

        granulo_map
            .entry((ech_id, method.clone()))
            .or_default()
            .push(serde_json::json!({"sieve_mm": sieve_mm, "passing_pct": passing_pct}));
    }

    let granulometrie: Vec<serde_json::Value> = granulo_map
        .into_iter()
        .map(|((ech_id, method), points)| {
            let depth_m = depth_by_ech.get(&ech_id).copied().unwrap_or(0.0);
            serde_json::json!({
                "depth_m": depth_m,
                "method": method,
                "echantillon_id": ech_id.to_string(),
                "points": points,
            })
        })
        .collect();

    let echantillons_out: Vec<serde_json::Value> = echantillons
        .into_iter()
        .map(|e| {
            serde_json::json!({
                "id": e.id.to_string(),
                "depth_m": e.depth_m.and_then(|d| d.to_f64()).unwrap_or(0.0),
                "laboratory": e.laboratory,
                "norm": e.norm,
                "rho_s_gcm3": e.rho_s_gcm3.and_then(|v| v.to_f64()),
                "water_content_w": e.water_content_w.and_then(|v| v.to_f64()),
                "date": e.date.map(|d| d.to_string()),
            })
        })
        .collect();

    let resp = serde_json::json!({
        "id": sondage_row.get::<sqlx::types::Uuid,_>("id").to_string(),
        "code": sondage_row.get::<String,_>("code"),
        "localite": sondage_row.get::<String,_>("localite"),
        "adm3_id": sondage_row.try_get::<i32,_>("adm3_id").ok(),
        "adm3_name": sondage_row.try_get::<String,_>("adm3_name").ok(),
        "is_geocoded": sondage_row.try_get::<bool,_>("is_geocoded").unwrap_or(false),
        "location_mode": sondage_row.get::<String,_>("location_mode"),
        "meta": meta,
        "source": sondage_row.get::<String,_>("source"),
        "created_at": sondage_row.get::<chrono::DateTime<chrono::Utc>,_>("created_at").to_rfc3339(),
        "updated_at": sondage_row.get::<chrono::DateTime<chrono::Utc>,_>("updated_at").to_rfc3339(),
        "coordinates": coordinates,
        "geom": geom,
        "atterberg": atterberg,
        "vbs": vbs,
        "classif": classif,
        "gonflement": gonflement,
        "physiques": physiques,
        "proctor": proctor,
        "granulometrie": granulometrie,
        "echantillons": echantillons_out,
    });

    (StatusCode::OK, Json(resp)).into_response()
}

#[derive(serde::Deserialize)]
pub struct ListSondagesQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub search: Option<String>,
    pub missing: Option<String>,
    pub grid_code: Option<String>,
}

pub async fn get_sondages_stats(State(state): State<AppState>) -> impl IntoResponse {
    let pool = &state.pool;

    let row = match sqlx::query(
        r#"
        SELECT
            COUNT(*)::bigint AS total,
            COUNT(*) FILTER (WHERE is_geocoded)::bigint AS geocoded,
            COUNT(*) FILTER (WHERE geom IS NOT NULL)::bigint AS with_geom,
            COUNT(*) FILTER (WHERE adm3_id IS NOT NULL)::bigint AS with_adm3,
            COUNT(*) FILTER (WHERE geom IS NULL)::bigint AS missing_geom,
            COUNT(*) FILTER (WHERE adm3_id IS NULL)::bigint AS missing_adm3
        FROM atlas.sondages
        WHERE deleted_at IS NULL
        "#,
    )
    .fetch_one(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "sondages stats query");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let resp = SondagesStatsResponse {
        total: row.get("total"),
        geocoded: row.get("geocoded"),
        with_geom: row.get("with_geom"),
        with_adm3: row.get("with_adm3"),
        missing_geom: row.get("missing_geom"),
        missing_adm3: row.get("missing_adm3"),
    };

    (StatusCode::OK, Json(resp)).into_response()
}

pub async fn list_sondages(
    Query(q): Query<ListSondagesQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let limit = q.limit.unwrap_or(500).clamp(1, 2000);
    let offset = q.offset.unwrap_or(0).max(0);

    let mut qb: QueryBuilder<Postgres> = QueryBuilder::new(
        r#"
        SELECT
            s.id,
            COALESCE(s.code, '') AS code,
            ST_X(ST_Transform(s.geom, 4326)) AS lon,
            ST_Y(ST_Transform(s.geom, 4326)) AS lat,
            ST_AsGeoJSON(ST_Transform(s.geom, 4326)) AS geom_geojson,
            NULLIF(s.depth_m_min, '')::double precision AS depth_m_min,
            NULLIF(s.depth_m_max, '')::double precision AS depth_m_max,
            s.maille_code,
            s.adm1_name,
            s.adm2_name,
            s.adm3_name,
            s.adm1_id,
            s.adm2_id,
            s.adm3_id,
            s.localite_base,
            s.localite_key,
            s.localite,
            s.location_mode,
            COALESCE(s.location_accuracy, '') AS location_accuracy,
            s.is_geocoded,
            s.type_sol,
            s.meta,
            s.date,
            s.date_sondage,
            s.source,
            s.operator,
            s.notes,
            s.comment,
            s.import_id,
            s.import_row_idx,
            s.loc_mode,
            s.grid_code,
            s.created_by_batch,
            s.updated_by_batch,
            s.deleted_by_batch,
            s.deleted_at,
            s.created_at,
            s.updated_at,
            (
                SELECT COUNT(*)::bigint
                FROM atlas.essais e
                WHERE e.sondage_id = s.id
            ) AS n_essais
        FROM atlas.sondages s
        WHERE s.deleted_at IS NULL
        "#,
    );

    if let Some(search) = q.search.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        let pat = format!("%{}%", search);
        qb.push(" AND (s.code ILIKE ").push_bind(pat.clone());
        qb.push(" OR s.localite ILIKE ").push_bind(pat.clone());
        qb.push(" OR s.adm3_name ILIKE ").push_bind(pat);
        qb.push(")");
    }

    if let Some(missing) = q.missing.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        if missing == "geom" {
            qb.push(" AND s.geom IS NULL");
        } else if missing == "adm3" {
            qb.push(" AND s.adm3_id IS NULL");
        }
    }

    if let Some(gc) = q.grid_code.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        qb.push(" AND (s.maille_code = ").push_bind(gc);
        qb.push(" OR s.grid_code = ").push_bind(gc);
        qb.push(")");
    }

    qb.push(" ORDER BY s.created_at DESC");
    qb.push(" LIMIT ").push_bind(limit);
    qb.push(" OFFSET ").push_bind(offset);

    let rows = match qb.build().fetch_all(pool).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "list sondages query");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        let meta: Option<serde_json::Value> = r.try_get("meta").ok();
        let (geocoded_mode, geocoded_score) = match meta.as_ref() {
            Some(m) => (
                m.get("geocoded_mode").and_then(|v| v.as_str()).map(|s| s.to_string()),
                m.get("geocoded_score")
                    .and_then(|v| v.as_f64())
                    .map(|v| v * 100.0),
            ),
            None => (None, None),
        };

        let geom_geojson: Option<serde_json::Value> = r
            .try_get::<String, _>("geom_geojson")
            .ok()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok());

        let item = serde_json::json!({
            "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
            "code": r.get::<String,_>("code"),
            "lon": r.try_get::<f64,_>("lon").ok(),
            "lat": r.try_get::<f64,_>("lat").ok(),
            "depth_m_min": r.try_get::<f64,_>("depth_m_min").ok(),
            "depth_m_max": r.try_get::<f64,_>("depth_m_max").ok(),
            "maille_code": r.try_get::<String,_>("maille_code").ok(),
            "adm1_name": r.try_get::<String,_>("adm1_name").ok(),
            "adm2_name": r.try_get::<String,_>("adm2_name").ok(),
            "adm3_name": r.try_get::<String,_>("adm3_name").ok(),
            "adm1_id": r.try_get::<String,_>("adm1_id").ok(),
            "adm2_id": r.try_get::<String,_>("adm2_id").ok(),
            "adm3_id": r.try_get::<i32,_>("adm3_id").ok(),
            "localite_base": r.try_get::<String,_>("localite_base").ok(),
            "localite_key": r.try_get::<String,_>("localite_key").ok(),
            "localite": r.try_get::<String,_>("localite").ok(),
            "location_mode": r.try_get::<String,_>("location_mode").ok(),
            "location_accuracy": r.try_get::<String,_>("location_accuracy").unwrap_or_else(|_| "".to_string()),
            "is_geocoded": r.try_get::<bool,_>("is_geocoded").unwrap_or(false),
            "type_sol": r.try_get::<String,_>("type_sol").ok(),
            "meta": meta,
            "date": r.try_get::<chrono::NaiveDate,_>("date").ok().map(|d| d.to_string()),
            "date_sondage": r.try_get::<String,_>("date_sondage").ok(),
            "source": r.try_get::<String,_>("source").ok(),
            "operator": r.try_get::<String,_>("operator").ok(),
            "notes": r.try_get::<String,_>("notes").ok(),
            "comment": r.try_get::<String,_>("comment").ok(),
            "import_id": r.try_get::<String,_>("import_id").ok(),
            "import_row_idx": r.try_get::<String,_>("import_row_idx").ok(),
            "loc_mode": r.try_get::<String,_>("loc_mode").ok(),
            "grid_code": r.try_get::<String,_>("grid_code").ok(),
            "created_by_batch": r.try_get::<String,_>("created_by_batch").ok(),
            "updated_by_batch": r.try_get::<String,_>("updated_by_batch").ok(),
            "deleted_by_batch": r.try_get::<String,_>("deleted_by_batch").ok(),
            "n_essais": r.try_get::<i64,_>("n_essais").unwrap_or(0),
            "created_at": r.get::<chrono::DateTime<chrono::Utc>,_>("created_at").to_rfc3339(),
            "updated_at": r.try_get::<chrono::DateTime<chrono::Utc>,_>("updated_at").ok().map(|d| d.to_rfc3339()),
            "deleted_at": r.try_get::<chrono::DateTime<chrono::Utc>,_>("deleted_at").ok().map(|d| d.to_rfc3339()),
            "geocoded_mode": geocoded_mode,
            "geocoded_score": geocoded_score,
            "geom": geom_geojson,
        });

        out.push(item);
    }

    (StatusCode::OK, Json(out)).into_response()
}
