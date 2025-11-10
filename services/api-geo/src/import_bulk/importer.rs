// ============================================================================
// Importer: Logique d'import dans la base de données (VERSION CORRIGÉE)
// ============================================================================

#![allow(dead_code)]

use super::matcher::*;
use super::transformer::*;
use super::types::*;
use super::validator::*;
use anyhow::Result;
use sqlx::{PgPool, Postgres, Row, Transaction};
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
    let row = sqlx::query(
        r#"
        INSERT INTO imports (
            filename, size_bytes, content_hash,
            mapping_json, geoloc_mode, seed,
            status, file_blob
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
        RETURNING id
        "#,
    )
    .bind(filename)
    .bind(size_bytes)
    .bind(content_hash)
    .bind(serde_json::to_value(mapping)?)
    .bind(geoloc.mode.to_string())
    .bind(geoloc.seed)
    .bind(file_blob)
    .fetch_one(pool)
    .await?;

    Ok(row.try_get("id")?)
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
    let stats_json = stats.map(serde_json::to_value).transpose()?;

    sqlx::query(
        r#"
        UPDATE imports
        SET status = $2,
            progress = $3,
            stats_json = COALESCE($4, stats_json),
            error_message = $5,
            started_at = COALESCE(started_at, CASE WHEN $2 = 'running' THEN now() ELSE NULL END),
            completed_at = CASE WHEN $2 IN ('succeeded', 'failed', 'partial', 'cancelled') THEN now() ELSE NULL END
        WHERE id = $1
        "#
    )
    .bind(import_id)
    .bind(status.to_string())
    .bind(progress as f64)
    .bind(stats_json)
    .bind(error_message)
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
    sqlx::query(
        r#"
        INSERT INTO import_logs (import_id, level, message, context_json)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(import_id)
    .bind(level)
    .bind(message)
    .bind(context)
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
            let matches =
                match_adm3(pool, localite, row.adm2.as_deref(), row.adm1.as_deref()).await?;

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
            GeolocationMode::Exact => (survey.lon, survey.lat, "exact"),

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
                    )
                    .await?;
                    (point.map(|p| p.0), point.map(|p| p.1), "random")
                } else {
                    (None, None, "unknown")
                }
            }

            GeolocationMode::Unknown => (None, None, "unknown"),

            GeolocationMode::Maille => {
                if let Some(ref maille_code) = survey.maille_code {
                    let maille = match_maille(&mut **tx, maille_code).await?;
                    (maille.map(|m| m.1), maille.map(|m| m.2), "maille")
                } else {
                    (None, None, "unknown")
                }
            }
        };

        // Créer le sondage avec les VRAIS noms de colonnes
        let geom_expr = if let (Some(lon), Some(lat)) = (lon, lat) {
            format!(
                "ST_Transform(ST_SetSRID(ST_MakePoint({}, {}), 4326), 25231)",
                lon, lat
            )
        } else {
            "NULL".to_string()
        };

        let query = format!(
            r#"
            INSERT INTO sondages (
                id, code, geom, date, source, operator,
                location_mode, is_geocoded,
                adm1_id, adm2_id, adm3_id, maille_code,
                import_id, import_row_idx
            )
            VALUES (
                gen_random_uuid(), $1, {}, $2, $3, $4,
                $5, $6,
                $7, $8, $9, $10,
                $11, $12
            )
            RETURNING id
            "#,
            geom_expr
        );

        let row = sqlx::query(&query)
            .bind(&survey.code)
            .bind(survey.date)
            .bind(&survey.source)
            .bind(&survey.operator)
            .bind(location_mode)
            .bind(lon.is_some() && lat.is_some())
            .bind(survey.adm1_id)
            .bind(survey.adm2_id)
            .bind(survey.adm3_id)
            .bind(&survey.maille_code)
            .bind(import_id)
            .bind(idx as i32)
            .fetch_one(&mut **tx)
            .await?;

        let survey_id: Uuid = row.try_get("id")?;
        stats.sondages += 1;

        // Créer les essais avec les VRAIS noms de colonnes
        for test in &survey.tests {
            sqlx::query(
                r#"
                INSERT INTO essais (
                    id, sondage_id, type, depth_m,
                    value, unit, analyse_qualitative,
                    is_from_import, import_id
                )
                VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    true, $7
                )
                "#,
            )
            .bind(survey_id)
            .bind(&test.parsed.type_essai)
            .bind(test.parsed.profondeur_m)
            .bind(test.parsed.valeur)
            .bind(&test.parsed.unite)
            .bind(&test.parsed.analyse_qualitative)
            .bind(import_id)
            .execute(&mut **tx)
            .await?;

            stats.essais += 1;

            // Créer import_item
            sqlx::query(
                r#"
                INSERT INTO import_items (
                    import_id, row_idx, status,
                    created_survey_id, created_tests_count,
                    fingerprint, raw_json,
                    warning_msg
                )
                VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
                "#,
            )
            .bind(import_id)
            .bind(test.parsed.row_idx)
            .bind(if test.validation_errors.is_empty() {
                if test.validation_warnings.is_empty() {
                    "ok"
                } else {
                    "warning"
                }
            } else {
                "error"
            })
            .bind(survey_id)
            .bind(&test.fingerprint)
            .bind(serde_json::to_value(&test.parsed).ok())
            .bind(if test.validation_warnings.is_empty() {
                None
            } else {
                Some(test.validation_warnings.join("; "))
            })
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
    _mapping: &MappingConfig,
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
    )
    .await?;

    Ok(stats)
}
