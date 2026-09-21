use anyhow::Context;
use serde::Serialize;
use sqlx::{PgPool, Row};

#[derive(Serialize, Clone)]
pub struct SearchResult {
    pub r#type: String,
    pub id: Option<String>,
    pub code: Option<String>,
    pub label: String,
    pub bbox: Option<[f64; 4]>,
    pub centroid: Option<[f64; 2]>,
    pub has_geom: bool,
}

fn bbox_from_box2d(box2d: Option<String>) -> Option<[f64; 4]> {
    let s = box2d?;
    let s = s.trim().trim_start_matches("BOX(").trim_end_matches(")");
    let mut parts = s.split(",");
    let a = parts.next()?.trim();
    let b = parts.next()?.trim();
    let mut a_it = a.split_whitespace();
    let mut b_it = b.split_whitespace();
    let xmin = a_it.next()?.parse::<f64>().ok()?;
    let ymin = a_it.next()?.parse::<f64>().ok()?;
    let xmax = b_it.next()?.parse::<f64>().ok()?;
    let ymax = b_it.next()?.parse::<f64>().ok()?;
    Some([xmin, ymin, xmax, ymax])
}

pub async fn unified_search(
    pool: &PgPool,
    q_raw: &str,
    limit: i64,
) -> anyhow::Result<Vec<SearchResult>> {
    let q = q_raw.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }

    let q_upper = q.to_uppercase();
    let mut results: Vec<SearchResult> = Vec::new();

    results.extend(
        search_maille_2km(pool, q, &q_upper, limit)
            .await
            .context("search_maille_2km")?,
    );
    results.extend(
        search_maille_28km(pool, q, &q_upper, limit)
            .await
            .context("search_maille_28km")?,
    );
    results.extend(
        search_adm(pool, "adm1", q, &q_upper, limit)
            .await
            .context("search_adm1")?,
    );
    results.extend(
        search_adm(pool, "adm2", q, &q_upper, limit)
            .await
            .context("search_adm2")?,
    );
    results.extend(
        search_adm(pool, "adm3", q, &q_upper, limit)
            .await
            .context("search_adm3")?,
    );
    results.extend(
        search_sondages(pool, q, &q_upper, limit)
            .await
            .context("search_sondages")?,
    );
    results.extend(
        search_operateurs(pool, q, limit)
            .await
            .context("search_operateurs")?,
    );

    Ok(results)
}

/// Opérateurs Colab ayant une mission active, recherchés par nom ou email.
///
/// Le résultat porte la géométrie de LEUR maille : sélectionner un opérateur
/// dans la barre de recherche doit pouvoir cadrer la carte sur sa zone sans
/// second appel.
async fn search_operateurs(
    pool: &PgPool,
    q: &str,
    limit: i64,
) -> Result<Vec<SearchResult>, sqlx::Error> {
    let pattern = format!("%{}%", q);
    let rows = sqlx::query(
        r#"
        SELECT DISTINCT ON (cs.id)
          cs.id::text AS student_id,
          TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS nom,
          u.email,
          -- Toutes les mailles de la mission, pas seulement la principale :
          -- isoler un opérateur doit montrer l'intégralité de sa zone.
          (SELECT string_agg(v.maille_code, ',' ORDER BY v.maille_code)
             FROM atlas.v_mission_mailles v WHERE v.mission_id = m.id) AS maille_code,
          (SELECT CASE WHEN ST_Collect(mc2.geom) IS NULL THEN NULL ELSE format(
              'BOX(%s %s,%s %s)',
              ST_XMin(ST_Transform(ST_Collect(mc2.geom), 4326)),
              ST_YMin(ST_Transform(ST_Collect(mc2.geom), 4326)),
              ST_XMax(ST_Transform(ST_Collect(mc2.geom), 4326)),
              ST_YMax(ST_Transform(ST_Collect(mc2.geom), 4326))
            ) END
             FROM atlas.v_mission_mailles v
             JOIN atlas.mailles mc2 ON mc2.id = v.maille_id
            WHERE v.mission_id = m.id) AS bbox,
          (SELECT ST_X(ST_Centroid(ST_Transform(ST_Collect(mc2.geom), 4326)))::float8
             FROM atlas.v_mission_mailles v
             JOIN atlas.mailles mc2 ON mc2.id = v.maille_id
            WHERE v.mission_id = m.id) AS lon,
          (SELECT ST_Y(ST_Centroid(ST_Transform(ST_Collect(mc2.geom), 4326)))::float8
             FROM atlas.v_mission_mailles v
             JOIN atlas.mailles mc2 ON mc2.id = v.maille_id
            WHERE v.mission_id = m.id) AS lat
        FROM atlas.colab_students cs
        JOIN atlas.users u ON u.id = cs.user_id AND u.deleted_at IS NULL
        JOIN atlas.colab_mission_assignments a
          ON a.student_id = cs.id AND a.unassigned_at IS NULL
        JOIN atlas.colab_missions m
          ON m.id = a.mission_id AND m.deleted_at IS NULL
        WHERE cs.deleted_at IS NULL
          AND (
            u.first_name ILIKE $1
            OR u.last_name ILIKE $1
            OR u.email ILIKE $1
            OR TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) ILIKE $1
          )
        ORDER BY cs.id, a.assigned_at DESC
        LIMIT $2
        "#,
    )
    .bind(&pattern)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| {
            let nom: Option<String> = r.try_get("nom").ok();
            let email: String = r.get("email");
            let maille_code: Option<String> = r.try_get("maille_code").ok().flatten();
            let nom = nom
                .map(|n| n.trim().to_string())
                .filter(|n| !n.is_empty())
                .unwrap_or_else(|| email.clone());
            // Une mission multi-mailles alignerait sinon trois codes de
            // quinze caractères dans une liste déroulante étroite.
            let label = match &maille_code {
                Some(codes) => {
                    let n = codes.split(',').filter(|c| !c.trim().is_empty()).count();
                    if n > 1 {
                        format!("{nom} — {n} mailles")
                    } else {
                        format!("{nom} — {codes}")
                    }
                }
                None => format!("{nom} — aucune maille"),
            };
            let lon: Option<f64> = r.try_get("lon").ok().flatten();
            let lat: Option<f64> = r.try_get("lat").ok().flatten();
            let bbox = bbox_from_box2d(r.try_get("bbox").ok().flatten());
            SearchResult {
                r#type: "operateur".to_string(),
                id: r.try_get("student_id").ok(),
                code: maille_code,
                label,
                bbox,
                centroid: match (lon, lat) {
                    (Some(x), Some(y)) => Some([x, y]),
                    _ => None,
                },
                has_geom: bbox.is_some(),
            }
        })
        .collect())
}

async fn search_maille_2km(
    pool: &PgPool,
    q: &str,
    q_upper: &str,
    limit: i64,
) -> Result<Vec<SearchResult>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
          code,
          adm1_name,
          adm2_name,
          adm3_name,
          CASE
            WHEN geom IS NULL THEN NULL
            ELSE format(
              'BOX(%s %s,%s %s)',
              ST_XMin(ST_Transform(geom, 4326)),
              ST_YMin(ST_Transform(geom, 4326)),
              ST_XMax(ST_Transform(geom, 4326)),
              ST_YMax(ST_Transform(geom, 4326))
            )
          END AS bbox,
          ST_X(ST_Centroid(ST_Transform(geom, 4326)))::float8 AS lon,
          ST_Y(ST_Centroid(ST_Transform(geom, 4326)))::float8 AS lat
        FROM public.mailles
        WHERE code ILIKE $1
        ORDER BY
          CASE
            WHEN UPPER(code) = $2 THEN 1
            WHEN UPPER(code) LIKE $2 || '%' THEN 2
            ELSE 3
          END,
          code
        LIMIT $3
        "#,
    )
    .bind(format!("%{}%", q))
    .bind(q_upper)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let mut out: Vec<SearchResult> = Vec::with_capacity(rows.len());
    for r in rows {
        let code: String = r.try_get("code").unwrap_or_default();
        let adm1: Option<String> = r.try_get("adm1_name").ok();
        let adm2: Option<String> = r.try_get("adm2_name").ok();
        let adm3: Option<String> = r.try_get("adm3_name").ok();
        let bbox = bbox_from_box2d(r.try_get::<Option<String>, _>("bbox").ok().flatten());
        let lon: Option<f64> = r.try_get("lon").ok();
        let lat: Option<f64> = r.try_get("lat").ok();

        let mut adm_parts: Vec<String> = Vec::new();
        if let Some(v) = adm1.clone() {
            if !v.trim().is_empty() {
                adm_parts.push(v);
            }
        }
        if let Some(v) = adm2.clone() {
            if !v.trim().is_empty() {
                adm_parts.push(v);
            }
        }
        if let Some(v) = adm3.clone() {
            if !v.trim().is_empty() {
                adm_parts.push(v);
            }
        }

        let label = if adm_parts.is_empty() {
            format!("Maille 2km · {}", code)
        } else {
            format!("Maille 2km · {} · {}", code, adm_parts.join(" › "))
        };

        out.push(SearchResult {
            r#type: "maille_2km".to_string(),
            id: None,
            code: Some(code),
            label,
            bbox,
            centroid: match (lon, lat) {
                (Some(x), Some(y)) => Some([x, y]),
                _ => None,
            },
            has_geom: true,
        });
    }
    Ok(out)
}

async fn search_maille_28km(
    pool: &PgPool,
    q: &str,
    q_upper: &str,
    limit: i64,
) -> Result<Vec<SearchResult>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
          id_m28::text as id,
          COALESCE(code_lisible, code_m28::text) as code,
          CASE
            WHEN geom IS NULL THEN NULL
            ELSE format(
              'BOX(%s %s,%s %s)',
              ST_XMin(ST_Transform(geom, 4326)),
              ST_YMin(ST_Transform(geom, 4326)),
              ST_XMax(ST_Transform(geom, 4326)),
              ST_YMax(ST_Transform(geom, 4326))
            )
          END AS bbox,
          ST_X(ST_Centroid(ST_Transform(geom, 4326)))::float8 AS lon,
          ST_Y(ST_Centroid(ST_Transform(geom, 4326)))::float8 AS lat
        FROM atlas.maille_28km
        WHERE COALESCE(code_lisible, code_m28::text) ILIKE $1
        ORDER BY
          CASE
            WHEN UPPER(COALESCE(code_lisible, code_m28::text)) = $2 THEN 1
            WHEN UPPER(COALESCE(code_lisible, code_m28::text)) LIKE $2 || '%' THEN 2
            ELSE 3
          END,
          code
        LIMIT $3
        "#,
    )
    .bind(format!("%{}%", q))
    .bind(q_upper)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let mut out: Vec<SearchResult> = Vec::with_capacity(rows.len());
    for r in rows {
        let id: String = r.try_get("id").unwrap_or_default();
        let code: String = r.try_get("code").unwrap_or_default();
        let bbox = bbox_from_box2d(r.try_get::<Option<String>, _>("bbox").ok().flatten());
        let lon: Option<f64> = r.try_get("lon").ok();
        let lat: Option<f64> = r.try_get("lat").ok();

        out.push(SearchResult {
            r#type: "maille_28km".to_string(),
            id: Some(id),
            code: Some(code.clone()),
            label: format!("Maille 28km · {}", code),
            bbox,
            centroid: match (lon, lat) {
                (Some(x), Some(y)) => Some([x, y]),
                _ => None,
            },
            has_geom: true,
        });
    }
    Ok(out)
}

async fn search_adm(
    pool: &PgPool,
    level: &str,
    q: &str,
    q_upper: &str,
    limit: i64,
) -> Result<Vec<SearchResult>, sqlx::Error> {
    let query = match level {
        "adm1" => {
            r#"
        SELECT
          id::text as id,
          name::text as name,
          CASE
            WHEN geom IS NULL THEN NULL
            ELSE format(
              'BOX(%s %s,%s %s)',
              ST_XMin(ST_Transform(geom, 4326)),
              ST_YMin(ST_Transform(geom, 4326)),
              ST_XMax(ST_Transform(geom, 4326)),
              ST_YMax(ST_Transform(geom, 4326))
            )
          END AS bbox,
          ST_X(ST_Centroid(ST_Transform(geom, 4326)))::float8 AS lon,
          ST_Y(ST_Centroid(ST_Transform(geom, 4326)))::float8 AS lat
        FROM public.adm1_tg
        WHERE name ILIKE $1 OR id::text ILIKE $1
        ORDER BY
          CASE
            WHEN UPPER(name) = $2 THEN 1
            WHEN UPPER(name) LIKE $2 || '%' THEN 2
            ELSE 3
          END,
          name
        LIMIT $3
        "#
        }
        "adm2" => {
            r#"
        SELECT
          id::text as id,
          name::text as name,
          CASE
            WHEN geom IS NULL THEN NULL
            ELSE format(
              'BOX(%s %s,%s %s)',
              ST_XMin(ST_Transform(geom, 4326)),
              ST_YMin(ST_Transform(geom, 4326)),
              ST_XMax(ST_Transform(geom, 4326)),
              ST_YMax(ST_Transform(geom, 4326))
            )
          END AS bbox,
          ST_X(ST_Centroid(ST_Transform(geom, 4326)))::float8 AS lon,
          ST_Y(ST_Centroid(ST_Transform(geom, 4326)))::float8 AS lat
        FROM public.adm2_tg
        WHERE name ILIKE $1 OR id::text ILIKE $1
        ORDER BY
          CASE
            WHEN UPPER(name) = $2 THEN 1
            WHEN UPPER(name) LIKE $2 || '%' THEN 2
            ELSE 3
          END,
          name
        LIMIT $3
        "#
        }
        _ => {
            r#"
        SELECT
          id::text as id,
          name::text as name,
          CASE
            WHEN geom IS NULL THEN NULL
            ELSE format(
              'BOX(%s %s,%s %s)',
              ST_XMin(ST_Transform(geom, 4326)),
              ST_YMin(ST_Transform(geom, 4326)),
              ST_XMax(ST_Transform(geom, 4326)),
              ST_YMax(ST_Transform(geom, 4326))
            )
          END AS bbox,
          ST_X(ST_Centroid(ST_Transform(geom, 4326)))::float8 AS lon,
          ST_Y(ST_Centroid(ST_Transform(geom, 4326)))::float8 AS lat
        FROM public.adm3_tg
        WHERE name ILIKE $1 OR id::text ILIKE $1
        ORDER BY
          CASE
            WHEN UPPER(name) = $2 THEN 1
            WHEN UPPER(name) LIKE $2 || '%' THEN 2
            ELSE 3
          END,
          name
        LIMIT $3
        "#
        }
    };

    let rows = sqlx::query(query)
        .bind(format!("%{}%", q))
        .bind(q_upper)
        .bind(limit)
        .fetch_all(pool)
        .await?;

    let mut out: Vec<SearchResult> = Vec::with_capacity(rows.len());
    for r in rows {
        let id: String = r.try_get("id").unwrap_or_default();
        let name: String = r.try_get("name").unwrap_or_default();
        let bbox = bbox_from_box2d(r.try_get::<Option<String>, _>("bbox").ok().flatten());
        let lon: Option<f64> = r.try_get("lon").ok();
        let lat: Option<f64> = r.try_get("lat").ok();

        out.push(SearchResult {
            r#type: level.to_string(),
            id: Some(id),
            code: None,
            label: format!("{} · {}", level.to_uppercase(), name),
            bbox,
            centroid: match (lon, lat) {
                (Some(x), Some(y)) => Some([x, y]),
                _ => None,
            },
            has_geom: bbox.is_some(),
        });
    }
    Ok(out)
}

async fn search_sondages(
    pool: &PgPool,
    q: &str,
    q_upper: &str,
    limit: i64,
) -> Result<Vec<SearchResult>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
          id::text as id,
          code,
          localite,
          localite_base,
          ST_X(ST_Transform(geom, 4326))::float8 AS lon,
          ST_Y(ST_Transform(geom, 4326))::float8 AS lat,
          (geom IS NOT NULL) as has_geom
        FROM atlas.sondages
        WHERE deleted_at IS NULL
          AND (code ILIKE $1 OR localite ILIKE $1 OR localite_base ILIKE $1)
        ORDER BY
          CASE
            WHEN UPPER(code) = $2 THEN 1
            WHEN UPPER(code) LIKE $2 || '%' THEN 2
            ELSE 3
          END,
          code
        LIMIT $3
        "#,
    )
    .bind(format!("%{}%", q))
    .bind(q_upper)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let mut out: Vec<SearchResult> = Vec::with_capacity(rows.len());
    for r in rows {
        let id: String = r.try_get("id").unwrap_or_default();
        let code: String = r.try_get("code").unwrap_or_default();
        let localite: Option<String> = r.try_get("localite").ok();
        let localite_base: Option<String> = r.try_get("localite_base").ok();
        let lon: Option<f64> = r.try_get("lon").ok();
        let lat: Option<f64> = r.try_get("lat").ok();
        let has_geom: bool = r.try_get("has_geom").unwrap_or(false);

        let loc = localite
            .clone()
            .filter(|s| !s.trim().is_empty())
            .or_else(|| localite_base.clone().filter(|s| !s.trim().is_empty()));

        let label = match loc {
            Some(l) => format!("Sondage · {} · {}", code, l),
            None => format!("Sondage · {}", code),
        };

        out.push(SearchResult {
            r#type: "sondage".to_string(),
            id: Some(id),
            code: Some(code),
            label,
            bbox: None,
            centroid: match (lon, lat) {
                (Some(x), Some(y)) => Some([x, y]),
                _ => None,
            },
            has_geom,
        });
    }
    Ok(out)
}
