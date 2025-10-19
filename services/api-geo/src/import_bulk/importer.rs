// ============================================================================
// Importer: Logique d'import dans la base de données
// ============================================================================

use super::types::*;
use super::matcher::*;
use super::validator::*;
use super::transformer::*;
use anyhow::Result;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

// ============================================================================
// CRÉATION IMPORT JOB
// ============================================================================

pub async fn create_import_job(
    pool: &PgPool,
    filename: String,
    size_bytes: i32,
    content_hash: String,
    mapping: &MappingConfig,
    geoloc: &GeolocationConfig,
    file_blob: Option<Vec<u8>>,
) -> Result<Uuid> {
    let import_id = sqlx::query!(
        r#"
        INSERT INTO imports (
            filename, size_bytes, content_hash,
            mapping_json, geoloc_mode, seed,
            status, file_blob
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
        RETURNING id
        "#,
        filename,
        size_bytes,
        content_hash,
        serde_json::to_value(mapping)?,
        geoloc.mode.to_string(),
        geoloc.seed,
        file_blob
    )
    .fetch_one(pool)
    .await?
    .id;
    
    Ok(import_id)
}

// ============================================================================
// MISE À JOUR STATUT
// ============================================================================

pub async fn update_import_status(
    pool: &PgPool,
    import_id: Uuid,
    status: ImportStatus,
    progress: f32,
    stats: Option<&ImportStats>,
    error_message: Option<&str>,
) -> Result<()> {
    let stats_json = stats.map(|s| serde_json::to_value(s)).transpose()?;
    
    sqlx::query!(
        r#"
        UPDATE imports
        SET status = $2,
            progress = $3,
            stats_json = COALESCE($4, stats_json),
            error_message = $5,
            started_at = COALESCE(started_at, CASE WHEN $2 = 'running' THEN now() ELSE NULL END),
            completed_at = CASE WHEN $2 IN ('succeeded', 'failed', 'partial', 'cancelled') THEN now() ELSE NULL END
        WHERE id = $1
        "#,
        import_id,
        status.to_string(),
        progress as f64,
        stats_json,
        error_message
    )
    .execute(pool)
    .await?;
    
    Ok(())
}

// ============================================================================
// LOGGING
// ============================================================================

pub async fn log_import(
    pool: &PgPool,
    import_id: Uuid,
    level: &str,
    message: &str,
    context: Option<serde_json::Value>,
) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO import_logs (import_id, level, message, context_json)
        VALUES ($1, $2, $3, $4)
        "#,
        import_id,
        level,
        message,
        context
    )
    .execute(pool)
    .await?;
    
    Ok(())
}

// ============================================================================
// VALIDATION COMPLÈTE
// ============================================================================

pub async fn validate_rows(
    pool: &PgPool,
    rows: &[ParsedRow],
    geoloc_mode: &GeolocationMode,
) -> Result<Vec<ValidatedRow>> {
    let mut validated = Vec::new();
    
    for row in rows {
        // Validation
        let (errors, warnings) = validate_row(pool, row, geoloc_mode).await;
        
        // Matching ADM3 si nécessaire
        let (adm3_id, match_score) = if let Some(ref localite) = row.adm3 {
            let matches = match_adm3(
                pool,
                localite,
                row.adm2.as_deref(),
                row.adm1.as_deref(),
            ).await?;
            
            if let Some(best_match) = matches.first() {
                (Some(best_match.id), Some(best_match.score))
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };
        
        // Fingerprint
        let fingerprint = compute_fingerprint(row);
        
        validated.push(ValidatedRow {
            parsed: row.clone(),
            adm3_id,
            adm3_match_score: match_score,
            validation_errors: errors,
            validation_warnings: warnings,
            fingerprint,
        });
    }
    
    Ok(validated)
}

// ============================================================================
// IMPORT SONDAGES
// ============================================================================

pub async fn import_surveys(
    tx: &mut Transaction<'_, Postgres>,
    import_id: Uuid,
    surveys: Vec<GroupedSurvey>,
    geoloc_config: &GeolocationConfig,
) -> Result<ImportStats> {
    let mut stats = ImportStats::default();
    
    for (idx, survey) in surveys.iter().enumerate() {
        // Déterminer coordonnées selon mode
        let (lon, lat, location_mode) = match &geoloc_config.mode {
            GeolocationMode::Exact => {
                (survey.lon, survey.lat, "exact")
            }
            
            GeolocationMode::Centroid => {
                if let Some(adm3_id) = survey.adm3_id {
                    let centroid = get_adm3_centroid(&mut **tx, adm3_id).await?;
                    (centroid.map(|c| c.0), centroid.map(|c| c.1), "centroid")
                } else if let Some(adm2_id) = survey.adm2_id {
                    let centroid = get_adm2_centroid(&mut **tx, adm2_id).await?;
                    (centroid.map(|c| c.0), centroid.map(|c| c.1), "centroid")
                } else {
                    (None, None, "unknown")
                }
            }
            
            GeolocationMode::Random => {
                if let Some(adm3_id) = survey.adm3_id {
                    let point = generate_random_point_in_adm3(
                        &mut **tx,
                        adm3_id,
                        &survey.code,
                        geoloc_config.seed.unwrap_or(42),
                        geoloc_config.jitter_radius.unwrap_or(400),
                    ).await?;
                    (point.map(|p| p.0), point.map(|p| p.1), "random")
                } else {
                    (None, None, "unknown")
                }
            }
            
            GeolocationMode::Unknown => {
                (None, None, "unknown")
            }
            
            GeolocationMode::Maille => {
                if let Some(ref maille_code) = survey.maille_code {
                    let maille = match_maille(&mut **tx, maille_code).await?;
                    (maille.map(|m| m.1), maille.map(|m| m.2), "maille")
                } else {
                    (None, None, "unknown")
                }
            }
        };
        
        // Créer le sondage (colonnes simplifiées)
        let survey_id = sqlx::query!(
            r#"
            INSERT INTO sondages (
                code, date_sondage, source, operator,
                lon, lat, location_mode,
                import_id, import_row_idx
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING gid as id
            "#,
            survey.code,
            survey.date,
            survey.source,
            survey.operator,
            lon,
            lat,
            location_mode,
            import_id,
            idx as i32
        )
        .fetch_one(&mut **tx)
        .await?
        .id;
        
        stats.sondages += 1;
        
        // Créer les essais
        for test in &survey.tests {
            let _test_id = sqlx::query!(
                r#"
                INSERT INTO essais (
                    sondage_id, type_essai, depth_m,
                    valeur, unit, analyse_qualitative,
                    is_from_import, import_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, true, $7)
                RETURNING gid as id
                "#,
                survey_id,
                test.parsed.type_essai,
                test.parsed.profondeur_m,
                test.parsed.valeur,
                test.parsed.unite,
                test.parsed.analyse_qualitative,
                import_id
            )
            .fetch_one(&mut **tx)
            .await?
            .id;
            
            stats.essais += 1;
            
            // Créer import_item
            sqlx::query!(
                r#"
                INSERT INTO import_items (
                    import_id, row_idx, status,
                    created_survey_id, created_tests_count,
                    fingerprint, raw_json,
                    warning_msg
                )
                VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
                "#,
                import_id,
                test.parsed.row_idx,
                if test.validation_errors.is_empty() {
                    if test.validation_warnings.is_empty() { "ok" } else { "warning" }
                } else {
                    "error"
                },
                survey_id,
                test.fingerprint,
                serde_json::to_value(&test.parsed).ok(),
                if test.validation_warnings.is_empty() {
                    None
                } else {
                    Some(test.validation_warnings.join("; "))
                }
            )
            .execute(&mut **tx)
            .await?;
            
            if !test.validation_warnings.is_empty() {
                stats.warnings += 1;
            }
        }
    }
    
    stats.total_rows = surveys.len() as i32;
    stats.valid_rows = stats.sondages;
    
    Ok(stats)
}

// ============================================================================
// PROCESS COMPLET
// ============================================================================

pub async fn process_import(
    pool: &PgPool,
    import_id: Uuid,
    rows: Vec<ParsedRow>,
    mapping: &MappingConfig,
    geoloc: &GeolocationConfig,
) -> Result<ImportStats> {
    // 1. Validation
    let validated = validate_rows(pool, &rows, &geoloc.mode).await?;
    
    // 2. Grouper par sondage
    let surveys = group_by_survey(validated.into_iter().map(|v| v.parsed).collect());
    
    // 3. Import dans transaction
    let mut tx = pool.begin().await?;
    
    let stats = import_surveys(&mut tx, import_id, surveys, geoloc).await?;
    
    tx.commit().await?;
    
    // 4. Mise à jour statut (après commit)
    update_import_status(
        pool,
        import_id,
        ImportStatus::Succeeded,
        100.0,
        Some(&stats),
        None,
    ).await?;
    
    Ok(stats)
}
