// ============================================================================
// Matcher: Matching ADM3 par nom avec fuzzy search
// ============================================================================

use super::types::*;
use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

// ============================================================================
// MATCHING ADM3
// ============================================================================

pub async fn match_adm3(
    pool: &PgPool,
    localite: &str,
    adm2_hint: Option<&str>,
    adm1_hint: Option<&str>,
) -> Result<Vec<AdmMatch>> {
    // 1. Recherche exacte (case-insensitive, sans accents)
    let exact_matches = sqlx::query!(
        r#"
        SELECT 
            a3.id,
            a3.name,
            a2.name as adm2_name,
            a1.name as adm1_name
        FROM adm3 a3
        LEFT JOIN adm2 a2 ON a3.adm2_id = a2.id
        LEFT JOIN adm1 a1 ON a2.adm1_id = a1.id
        WHERE unaccent(lower(a3.name)) = unaccent(lower($1))
        "#,
        localite
    )
    .fetch_all(pool)
    .await?;
    
    if !exact_matches.is_empty() {
        let mut results = Vec::new();
        for row in exact_matches {
            // Filtrer par ADM2/ADM1 si fourni
            if let Some(adm2) = adm2_hint {
                if let Some(ref row_adm2) = row.adm2_name {
                    if !adm2.eq_ignore_ascii_case(row_adm2) {
                        continue;
                    }
                }
            }
            if let Some(adm1) = adm1_hint {
                if let Some(ref row_adm1) = row.adm1_name {
                    if !adm1.eq_ignore_ascii_case(row_adm1) {
                        continue;
                    }
                }
            }
            
            results.push(AdmMatch {
                id: row.id,
                name: row.name,
                adm2_name: row.adm2_name,
                adm1_name: row.adm1_name,
                score: 1.0,
                confidence: MatchConfidence::High,
            });
        }
        
        if !results.is_empty() {
            return Ok(results);
        }
    }
    
    // 2. Fuzzy search avec pg_trgm (similarity)
    let fuzzy_query = if let Some(adm2) = adm2_hint {
        sqlx::query!(
            r#"
            SELECT 
                a3.id,
                a3.name,
                a2.name as adm2_name,
                a1.name as adm1_name,
                similarity(a3.name, $1) as "score!"
            FROM adm3 a3
            LEFT JOIN adm2 a2 ON a3.adm2_id = a2.id
            LEFT JOIN adm1 a1 ON a2.adm1_id = a1.id
            WHERE similarity(a3.name, $1) > 0.75
                AND unaccent(lower(a2.name)) = unaccent(lower($2))
            ORDER BY score DESC
            LIMIT 5
            "#,
            localite,
            adm2
        )
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query!(
            r#"
            SELECT 
                a3.id,
                a3.name,
                a2.name as adm2_name,
                a1.name as adm1_name,
                similarity(a3.name, $1) as "score!"
            FROM adm3 a3
            LEFT JOIN adm2 a2 ON a3.adm2_id = a2.id
            LEFT JOIN adm1 a1 ON a2.adm1_id = a1.id
            WHERE similarity(a3.name, $1) > 0.75
            ORDER BY score DESC
            LIMIT 5
            "#,
            localite
        )
        .fetch_all(pool)
        .await?
    };
    
    let mut results = Vec::new();
    for row in fuzzy_query {
        let confidence = if row.score >= 0.95 {
            MatchConfidence::High
        } else if row.score >= 0.85 {
            MatchConfidence::Medium
        } else {
            MatchConfidence::Low
        };
        
        results.push(AdmMatch {
            id: row.id,
            name: row.name,
            adm2_name: row.adm2_name,
            adm1_name: row.adm1_name,
            score: row.score,
            confidence,
        });
    }
    
    Ok(results)
}

// ============================================================================
// MATCHING ADM2
// ============================================================================

pub async fn match_adm2(
    pool: &PgPool,
    adm2_name: &str,
    adm1_hint: Option<&str>,
) -> Result<Option<Uuid>> {
    let result = if let Some(adm1) = adm1_hint {
        sqlx::query!(
            r#"
            SELECT a2.id
            FROM adm2 a2
            LEFT JOIN adm1 a1 ON a2.adm1_id = a1.id
            WHERE unaccent(lower(a2.name)) = unaccent(lower($1))
                AND unaccent(lower(a1.name)) = unaccent(lower($2))
            LIMIT 1
            "#,
            adm2_name,
            adm1
        )
        .fetch_optional(pool)
        .await?
    } else {
        sqlx::query!(
            r#"
            SELECT id
            FROM adm2
            WHERE unaccent(lower(name)) = unaccent(lower($1))
            LIMIT 1
            "#,
            adm2_name
        )
        .fetch_optional(pool)
        .await?
    };
    
    Ok(result.map(|r| r.id))
}

// ============================================================================
// MATCHING ADM1
// ============================================================================

pub async fn match_adm1(
    pool: &PgPool,
    adm1_name: &str,
) -> Result<Option<Uuid>> {
    let result = sqlx::query!(
        r#"
        SELECT id
        FROM adm1
        WHERE unaccent(lower(name)) = unaccent(lower($1))
        LIMIT 1
        "#,
        adm1_name
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(result.map(|r| r.id))
}

// ============================================================================
// MATCHING MAILLE
// ============================================================================

pub async fn match_maille(
    pool: &PgPool,
    maille_code: &str,
) -> Result<Option<(Uuid, f64, f64)>> {
    let result = sqlx::query!(
        r#"
        SELECT 
            id,
            ST_X(ST_Centroid(geom)) as "lon!",
            ST_Y(ST_Centroid(geom)) as "lat!"
        FROM mailles
        WHERE code = $1
        LIMIT 1
        "#,
        maille_code
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(result.map(|r| (r.id, r.lon, r.lat)))
}

// ============================================================================
// RÉCUPÉRATION CENTROÏDE ADM
// ============================================================================

pub async fn get_adm3_centroid(
    pool: &PgPool,
    adm3_id: Uuid,
) -> Result<Option<(f64, f64)>> {
    let result = sqlx::query!(
        r#"
        SELECT 
            ST_X(ST_Centroid(geom)) as "lon!",
            ST_Y(ST_Centroid(geom)) as "lat!"
        FROM adm3
        WHERE id = $1
        "#,
        adm3_id
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(result.map(|r| (r.lon, r.lat)))
}

pub async fn get_adm2_centroid(
    pool: &PgPool,
    adm2_id: Uuid,
) -> Result<Option<(f64, f64)>> {
    let result = sqlx::query!(
        r#"
        SELECT 
            ST_X(ST_Centroid(geom)) as "lon!",
            ST_Y(ST_Centroid(geom)) as "lat!"
        FROM adm2
        WHERE id = $1
        "#,
        adm2_id
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(result.map(|r| (r.lon, r.lat)))
}

// ============================================================================
// GÉNÉRATION POINT ALÉATOIRE DÉTERMINISTE
// ============================================================================

use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;
use sha2::{Sha256, Digest};

pub async fn generate_random_point_in_adm3(
    pool: &PgPool,
    adm3_id: Uuid,
    survey_code: &str,
    seed: i32,
    jitter_radius: i32,
) -> Result<Option<(f64, f64)>> {
    // Récupérer le centroïde
    let centroid = get_adm3_centroid(pool, adm3_id).await?;
    
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

pub async fn get_adm3_pcode(
    pool: &PgPool,
    adm3_id: Uuid,
) -> Result<Option<String>> {
    let result = sqlx::query!(
        r#"
        SELECT adm3_pcode
        FROM adm3
        WHERE id = $1
        "#,
        adm3_id
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(result.and_then(|r| r.adm3_pcode))
}
