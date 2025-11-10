// ============================================================================
// Matcher: Matching ADM3 par nom avec fuzzy search (VERSION CORRIGÉE)
// ============================================================================

#![allow(dead_code)]

use super::types::*;
use anyhow::Result;
use sqlx::{Executor, PgPool, Row};
use uuid::Uuid;

// ============================================================================
// MATCHING ADM3 SIMPLIFIÉ
// ============================================================================

pub async fn match_adm3(
    pool: &PgPool,
    localite: &str,
    _adm2_hint: Option<&str>,
    _adm1_hint: Option<&str>,
) -> Result<Vec<AdmMatch>> {
    // Utiliser requête dynamique pour éviter problèmes sqlx::query!
    let rows = sqlx::query(
        r#"
        SELECT 
            id::text as id_str,
            name,
            similarity(name, $1) as score
        FROM adm3
        WHERE similarity(name, $1) > 0.75
        ORDER BY score DESC
        LIMIT 5
        "#,
    )
    .bind(localite)
    .fetch_all(pool)
    .await?;

    let mut matches = Vec::new();
    for row in rows {
        let id_str: String = row.try_get("id_str")?;
        let id = Uuid::parse_str(&id_str).unwrap_or_else(|_| Uuid::new_v4());
        let name: String = row.try_get("name")?;
        let score: f32 = row.try_get("score")?;

        let confidence = if score >= 0.95 {
            MatchConfidence::High
        } else if score >= 0.85 {
            MatchConfidence::Medium
        } else {
            MatchConfidence::Low
        };

        matches.push(AdmMatch {
            id,
            name,
            adm2_name: None,
            adm1_name: None,
            score,
            confidence,
        });
    }

    Ok(matches)
}

// ============================================================================
// MATCHING ADM2/ADM1 SIMPLIFIÉS
// ============================================================================

pub async fn match_adm2(
    pool: &PgPool,
    adm2_name: &str,
    _adm1_hint: Option<&str>,
) -> Result<Option<Uuid>> {
    let row = sqlx::query(
        r#"
        SELECT id::text as id_str
        FROM adm2
        WHERE unaccent(lower(name)) = unaccent(lower($1))
        LIMIT 1
        "#,
    )
    .bind(adm2_name)
    .fetch_optional(pool)
    .await?;

    if let Some(r) = row {
        let id_str: String = r.try_get("id_str")?;
        Ok(Some(
            Uuid::parse_str(&id_str).unwrap_or_else(|_| Uuid::new_v4()),
        ))
    } else {
        Ok(None)
    }
}

pub async fn match_adm1(pool: &PgPool, adm1_name: &str) -> Result<Option<Uuid>> {
    let row = sqlx::query(
        r#"
        SELECT id::text as id_str
        FROM adm1
        WHERE unaccent(lower(name)) = unaccent(lower($1))
        LIMIT 1
        "#,
    )
    .bind(adm1_name)
    .fetch_optional(pool)
    .await?;

    if let Some(r) = row {
        let id_str: String = r.try_get("id_str")?;
        Ok(Some(
            Uuid::parse_str(&id_str).unwrap_or_else(|_| Uuid::new_v4()),
        ))
    } else {
        Ok(None)
    }
}

// ============================================================================
// MATCHING MAILLE
// ============================================================================

pub async fn match_maille<'a, E>(executor: E, maille_code: &str) -> Result<Option<(Uuid, f64, f64)>>
where
    E: Executor<'a, Database = sqlx::Postgres>,
{
    let row = sqlx::query(
        r#"
        SELECT 
            id::text as id_str,
            ST_X(ST_Centroid(geom)) as lon,
            ST_Y(ST_Centroid(geom)) as lat
        FROM mailles
        WHERE code = $1
        LIMIT 1
        "#,
    )
    .bind(maille_code)
    .fetch_optional(executor)
    .await?;

    if let Some(r) = row {
        let id_str: String = r.try_get("id_str")?;
        let id = Uuid::parse_str(&id_str).unwrap_or_else(|_| Uuid::new_v4());
        let lon: f64 = r.try_get("lon")?;
        let lat: f64 = r.try_get("lat")?;
        Ok(Some((id, lon, lat)))
    } else {
        Ok(None)
    }
}

// ============================================================================
// CENTROÏDES ADM
// ============================================================================

pub async fn get_adm3_centroid<'a, E>(executor: E, adm3_id: Uuid) -> Result<Option<(f64, f64)>>
where
    E: Executor<'a, Database = sqlx::Postgres>,
{
    let row = sqlx::query(
        r#"
        SELECT 
            ST_X(ST_Centroid(ST_Transform(geom, 25231))) as lon,
            ST_Y(ST_Centroid(ST_Transform(geom, 25231))) as lat
        FROM adm3
        WHERE id = $1
        "#,
    )
    .bind(adm3_id)
    .fetch_optional(executor)
    .await?;

    if let Some(r) = row {
        let lon: f64 = r.try_get("lon")?;
        let lat: f64 = r.try_get("lat")?;
        Ok(Some((lon, lat)))
    } else {
        Ok(None)
    }
}

pub async fn get_adm2_centroid<'a, E>(executor: E, adm2_id: Uuid) -> Result<Option<(f64, f64)>>
where
    E: Executor<'a, Database = sqlx::Postgres>,
{
    let row = sqlx::query(
        r#"
        SELECT 
            ST_X(ST_Centroid(ST_Transform(geom, 25231))) as lon,
            ST_Y(ST_Centroid(ST_Transform(geom, 25231))) as lat
        FROM adm2
        WHERE id = $1
        "#,
    )
    .bind(adm2_id)
    .fetch_optional(executor)
    .await?;

    if let Some(r) = row {
        let lon: f64 = r.try_get("lon")?;
        let lat: f64 = r.try_get("lat")?;
        Ok(Some((lon, lat)))
    } else {
        Ok(None)
    }
}

// ============================================================================
// GÉNÉRATION POINT ALÉATOIRE DÉTERMINISTE
// ============================================================================

use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;
use sha2::{Digest, Sha256};

pub async fn generate_random_point_in_adm3<'a, E>(
    executor: E,
    adm3_id: Uuid,
    survey_code: &str,
    seed: i32,
    jitter_radius: i32,
) -> Result<Option<(f64, f64)>>
where
    E: Executor<'a, Database = sqlx::Postgres>,
{
    // Récupérer le centroïde
    let centroid = get_adm3_centroid(executor, adm3_id).await?;

    if let Some((lon, lat)) = centroid {
        // Générer seed déterministe
        let hash_input = format!("{}|{}|{}", survey_code, seed, adm3_id);
        let mut hasher = Sha256::new();
        hasher.update(hash_input.as_bytes());
        let hash_result = hasher.finalize();

        // Convertir hash en seed u64
        let seed_bytes = &hash_result[..8];
        let seed_u64 = u64::from_le_bytes(seed_bytes.try_into().unwrap());

        // Créer RNG déterministe
        let mut rng = ChaCha8Rng::seed_from_u64(seed_u64);

        // Générer offset aléatoire dans le rayon
        let radius_deg = (jitter_radius as f64) / 111_000.0; // ~111km par degré
        let angle = rng.gen::<f64>() * 2.0 * std::f64::consts::PI;
        let distance = rng.gen::<f64>() * radius_deg;

        let offset_lon = distance * angle.cos();
        let offset_lat = distance * angle.sin();

        Ok(Some((lon + offset_lon, lat + offset_lat)))
    } else {
        Ok(None)
    }
}

// ============================================================================
// RÉCUPÉRATION PCODE ADM3
// ============================================================================

pub async fn get_adm3_pcode(pool: &PgPool, adm3_id: Uuid) -> Result<Option<String>> {
    let row = sqlx::query(
        r#"
        SELECT code
        FROM adm3
        WHERE id = $1
        "#,
    )
    .bind(adm3_id)
    .fetch_optional(pool)
    .await?;

    if let Some(r) = row {
        Ok(r.try_get("code").ok())
    } else {
        Ok(None)
    }
}
