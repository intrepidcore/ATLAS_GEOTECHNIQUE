// ============================================================================
// Matcher: Matching ADM3 par nom avec fuzzy search (VERSION SIMPLIFIÉE)
// ============================================================================

use super::types::*;
use anyhow::Result;
use sqlx::{PgPool, Executor};
use uuid::Uuid;

// ============================================================================
// MATCHING ADM3 SIMPLIFIÉ (sans jointures pour éviter problèmes schéma)
// ============================================================================

pub async fn match_adm3(
    pool: &PgPool,
    localite: &str,
    _adm2_hint: Option<&str>,
    _adm1_hint: Option<&str>,
) -> Result<Vec<AdmMatch>> {
    // Recherche simple par similarité
    let results = sqlx::query!(
        r#"
        SELECT 
            gid as id,
            name_3 as name,
            similarity(name_3, $1) as "score!"
        FROM adm3
        WHERE similarity(name_3, $1) > 0.75
        ORDER BY score DESC
        LIMIT 5
        "#,
        localite
    )
    .fetch_all(pool)
    .await?;
    
    let mut matches = Vec::new();
    for row in results {
        let confidence = if row.score >= 0.95 {
            MatchConfidence::High
        } else if row.score >= 0.85 {
            MatchConfidence::Medium
        } else {
            MatchConfidence::Low
        };
        
        matches.push(AdmMatch {
            id: Uuid::new_v4(), // Temporaire - utiliser gid
            name: row.name,
            adm2_name: None,
            adm1_name: None,
            score: row.score,
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
    let result = sqlx::query!(
        r#"
        SELECT gid
        FROM adm2
        WHERE unaccent(lower(name_2)) = unaccent(lower($1))
        LIMIT 1
        "#,
        adm2_name
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(result.map(|_| Uuid::new_v4())) // Temporaire
}

pub async fn match_adm1(
    pool: &PgPool,
    adm1_name: &str,
) -> Result<Option<Uuid>> {
    let result = sqlx::query!(
        r#"
        SELECT gid
        FROM adm1
        WHERE unaccent(lower(name_1)) = unaccent(lower($1))
        LIMIT 1
        "#,
        adm1_name
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(result.map(|_| Uuid::new_v4())) // Temporaire
}

// ============================================================================
// MATCHING MAILLE
// ============================================================================

pub async fn match_maille<'a, E>(
    executor: E,
    maille_code: &str,
) -> Result<Option<(Uuid, f64, f64)>>
where
    E: Executor<'a, Database = sqlx::Postgres>,
{
    let result = sqlx::query!(
        r#"
        SELECT 
            gid,
            ST_X(ST_Centroid(geom)) as "lon!",
            ST_Y(ST_Centroid(geom)) as "lat!"
        FROM mailles
        WHERE code = $1
        LIMIT 1
        "#,
        maille_code
    )
    .fetch_optional(executor)
    .await?;
    
    Ok(result.map(|r| (Uuid::new_v4(), r.lon, r.lat))) // Temporaire
}

// ============================================================================
// CENTROÏDES ADM
// ============================================================================

pub async fn get_adm3_centroid<'a, E>(
    executor: E,
    _adm3_id: Uuid,
) -> Result<Option<(f64, f64)>>
where
    E: Executor<'a, Database = sqlx::Postgres>,
{
    // Version simplifiée - retourner None pour l'instant
    Ok(None)
}

pub async fn get_adm2_centroid<'a, E>(
    executor: E,
    _adm2_id: Uuid,
) -> Result<Option<(f64, f64)>>
where
    E: Executor<'a, Database = sqlx::Postgres>,
{
    Ok(None)
}

// ============================================================================
// GÉNÉRATION POINT ALÉATOIRE DÉTERMINISTE
// ============================================================================

use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;
use sha2::{Sha256, Digest};

pub async fn generate_random_point_in_adm3<'a, E>(
    _executor: E,
    _adm3_id: Uuid,
    survey_code: &str,
    seed: i32,
    jitter_radius: i32,
) -> Result<Option<(f64, f64)>>
where
    E: Executor<'a, Database = sqlx::Postgres>,
{
    // Version simplifiée - générer point aléatoire autour du centre du Togo
    let center_lon = 1.0;
    let center_lat = 8.5;
    
    // Générer seed déterministe
    let hash_input = format!("{}|{}", survey_code, seed);
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
    
    Ok(Some((center_lon + offset_lon, center_lat + offset_lat)))
}

// ============================================================================
// RÉCUPÉRATION PCODE ADM3
// ============================================================================

pub async fn get_adm3_pcode(
    pool: &PgPool,
    _adm3_id: Uuid,
) -> Result<Option<String>> {
    // Version simplifiée
    Ok(None)
}
