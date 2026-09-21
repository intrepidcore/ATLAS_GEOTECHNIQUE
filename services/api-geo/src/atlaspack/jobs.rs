//! File de génération asynchrone des `.atlaspack` — même pattern que
//! `colab::email_worker` (poll DB avec `FOR UPDATE SKIP LOCKED`, backoff
//! exponentiel), pas un nouveau système de jobs.

use std::time::Duration as StdDuration;

use anyhow::Context;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use super::builder::build_atlaspack;
use super::config::AtlasPackState;

/// Crée (ou réutilise) le paquet "courant" d'un opérateur et enfile un job de
/// génération. Appelé après toute création/modification/clôture
/// d'affectation (`colab::routes`) — c'est ce qui détecte et propage
/// l'obsolescence d'un paquet déjà généré (exigence #12).
///
/// Idempotent vis-à-vis des jobs déjà en cours : si un paquet est déjà en
/// statut `preparing`, on ne le duplique pas.
pub async fn enqueue_or_refresh_package_for_student(
    pool: &PgPool,
    student_id: Uuid,
    created_by: Option<Uuid>,
) -> anyhow::Result<Uuid> {
    let operator_user_id: Uuid = sqlx::query_scalar(
        "SELECT user_id FROM atlas.colab_students WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(student_id)
    .fetch_one(pool)
    .await
    .context("résolution opérateur pour rafraîchissement paquet")?;

    let mut tx = pool.begin().await?;

    let existing: Option<(Uuid, String)> = sqlx::query_as(
        r#"SELECT id, status FROM atlas.atlaspack_packages
           WHERE operator_user_id = $1 AND status IN ('not_prepared','preparing','ready')
           FOR UPDATE"#,
    )
    .bind(operator_user_id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some((existing_id, status)) = &existing {
        if status == "preparing" {
            // Génération déjà en cours — elle reflétera l'état courant des
            // missions au moment où elle termine (lu en base, pas en cache).
            tx.commit().await?;
            return Ok(*existing_id);
        }
    }

    // Résoudre l'ancienne ligne AVANT d'insérer la nouvelle : l'index unique
    // partiel (un seul paquet not_prepared/preparing/ready par opérateur)
    // rejetterait sinon l'INSERT tant que l'ancienne ligne 'ready' est
    // encore dans cet état. `superseded_by` est renseigné dans un second
    // temps, une fois le nouvel id connu.
    let was_ready = if let Some((existing_id, status)) = &existing {
        if status == "ready" {
            sqlx::query(
                "UPDATE atlas.atlaspack_packages SET status = 'stale', obsolete_reason = 'missions ou affectations modifiées', updated_at = NOW() WHERE id = $1",
            )
            .bind(existing_id)
            .execute(&mut *tx)
            .await?;
            true
        } else {
            // not_prepared (jamais généré) : pas la peine de garder l'ancienne ligne.
            sqlx::query("DELETE FROM atlas.atlaspack_generation_jobs WHERE package_id = $1")
                .bind(existing_id)
                .execute(&mut *tx)
                .await?;
            sqlx::query("DELETE FROM atlas.atlaspack_packages WHERE id = $1")
                .bind(existing_id)
                .execute(&mut *tx)
                .await?;
            false
        }
    } else {
        false
    };

    let new_id: Uuid = sqlx::query_scalar(
        r#"INSERT INTO atlas.atlaspack_packages
           (operator_user_id, student_id, status, format_version, schema_version, created_by)
           VALUES ($1, $2, 'not_prepared', $3, $4, $5)
           RETURNING id"#,
    )
    .bind(operator_user_id)
    .bind(student_id)
    .bind(super::format::FORMAT_VERSION)
    .bind(super::format::SCHEMA_VERSION)
    .bind(created_by)
    .fetch_one(&mut *tx)
    .await
    .context("création ligne paquet")?;

    if was_ready {
        let existing_id = existing.expect("was_ready implique existing.is_some()").0;
        sqlx::query("UPDATE atlas.atlaspack_packages SET superseded_by = $2 WHERE id = $1")
            .bind(existing_id)
            .bind(new_id)
            .execute(&mut *tx)
            .await?;
    }

    sqlx::query(
        "INSERT INTO atlas.atlaspack_generation_jobs (package_id, status) VALUES ($1, 'pending')",
    )
    .bind(new_id)
    .execute(&mut *tx)
    .await
    .context("création job de génération")?;

    tx.commit().await?;
    Ok(new_id)
}

/// Durée au-delà de laquelle un job « running » est considéré abandonné.
///
/// Une génération dépasse rarement quelques minutes ; au-delà, c'est que le
/// processus qui la portait a disparu.
const STALE_JOB_AFTER: &str = "30 minutes";

/// Remet en file les générations interrompues par un arrêt du serveur.
///
/// Un job passe en `running` et son paquet en `preparing` avant le travail
/// lui-même. Si l'API redémarre entre les deux, plus personne ne les reprend :
/// des paquets sont restés `preparing` pendant trois jours, et l'envoi des
/// identifiants qui les attendait ne partait jamais. Rien n'est perdu, la
/// génération est idempotente — il suffit de la relancer.
async fn requeue_stale_jobs(pool: &PgPool) -> anyhow::Result<u64> {
    let jobs = sqlx::query(&format!(
        "UPDATE atlas.atlaspack_generation_jobs
         SET status = 'pending', started_at = NULL
         WHERE status = 'running'
           AND COALESCE(started_at, created_at) < NOW() - INTERVAL '{STALE_JOB_AFTER}'
         RETURNING package_id"
    ))
    .fetch_all(pool)
    .await?;

    if jobs.is_empty() {
        return Ok(0);
    }
    let package_ids: Vec<Uuid> = jobs
        .iter()
        .filter_map(|r| r.try_get::<Uuid, _>("package_id").ok())
        .collect();
    sqlx::query(
        "UPDATE atlas.atlaspack_packages SET status = 'not_prepared', updated_at = NOW()
         WHERE id = ANY($1) AND status = 'preparing'",
    )
    .bind(&package_ids)
    .execute(pool)
    .await?;

    tracing::warn!(
        count = package_ids.len(),
        "générations .atlaspack interrompues remises en file"
    );
    Ok(package_ids.len() as u64)
}

pub fn spawn_atlaspack_worker(pool: PgPool, state: AtlasPackState) {
    tokio::spawn(async move {
        tracing::info!(key_id = %state.signing_key.key_id, "atlaspack generation worker démarré");
        if let Err(e) = requeue_stale_jobs(&pool).await {
            tracing::error!(error = %format!("{e:#}"), "reprise des générations interrompues");
        }
        let mut backoff_ms: u64 = 2_000;
        let mut ticks: u32 = 0;
        loop {
            match process_one_job(&pool, &state).await {
                Ok(true) => backoff_ms = 1_000,
                Ok(false) => backoff_ms = (backoff_ms * 2).min(30_000),
                Err(e) => {
                    tracing::error!(error = %e, "atlaspack worker error");
                    backoff_ms = (backoff_ms * 2).min(30_000);
                }
            }
            // Balayage périodique : un arrêt brutal en cours d'exécution ne doit
            // pas attendre le prochain redémarrage pour être rattrapé.
            ticks += 1;
            if ticks % 60 == 0 {
                if let Err(e) = requeue_stale_jobs(&pool).await {
                    tracing::error!(error = %format!("{e:#}"), "balayage des générations interrompues");
                }
            }
            tokio::time::sleep(StdDuration::from_millis(backoff_ms)).await;
        }
    });
}

async fn process_one_job(pool: &PgPool, state: &AtlasPackState) -> anyhow::Result<bool> {
    let mut tx = pool.begin().await?;
    let job = sqlx::query(
        r#"SELECT j.id AS job_id, j.package_id, p.student_id
           FROM atlas.atlaspack_generation_jobs j
           JOIN atlas.atlaspack_packages p ON p.id = j.package_id
           WHERE j.status = 'pending'
           ORDER BY j.created_at ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 1"#,
    )
    .fetch_optional(&mut *tx)
    .await?;

    let Some(job) = job else {
        tx.rollback().await?;
        return Ok(false);
    };

    let job_id: Uuid = job.try_get("job_id")?;
    let package_id: Uuid = job.try_get("package_id")?;
    let student_id: Option<Uuid> = job.try_get("student_id")?;

    sqlx::query(
        "UPDATE atlas.atlaspack_generation_jobs SET status = 'running', started_at = NOW(), attempts = attempts + 1 WHERE id = $1",
    )
    .bind(job_id)
    .execute(&mut *tx)
    .await?;
    sqlx::query("UPDATE atlas.atlaspack_packages SET status = 'preparing', updated_at = NOW() WHERE id = $1")
        .bind(package_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    let Some(student_id) = student_id else {
        finish_job_failed(pool, job_id, package_id, "paquet sans opérateur associé").await?;
        return Ok(true);
    };

    match build_atlaspack(pool, state, package_id, student_id).await {
        Ok(outcome) => {
            sqlx::query(
                r#"UPDATE atlas.atlaspack_packages SET
                    status = 'ready',
                    mission_ids = $2,
                    mission_snapshot_hash = $3,
                    generated_at = $4,
                    expires_at = $5,
                    signing_key_id = $6,
                    package_sha256 = $7,
                    file_path = $8,
                    file_size_bytes = $9,
                    tile_count = $10,
                    tile_zoom_min = $11,
                    tile_zoom_max = $12,
                    tiles_truncated = $13,
                    tiles_truncation_reason = $14,
                    error = NULL,
                    updated_at = NOW()
                   WHERE id = $1"#,
            )
            .bind(package_id)
            .bind(&outcome.mission_ids)
            .bind(&outcome.mission_snapshot_hash)
            .bind(outcome.generated_at)
            .bind(outcome.expires_at)
            .bind(&outcome.signing_key_id)
            .bind(&outcome.package_sha256)
            .bind(outcome.file_path.to_string_lossy().to_string())
            .bind(outcome.file_size_bytes)
            .bind(outcome.tile_count)
            .bind(outcome.tile_zoom_min)
            .bind(outcome.tile_zoom_max)
            .bind(outcome.tiles_truncated)
            .bind(&outcome.tiles_truncation_reason)
            .execute(pool)
            .await
            .context("mise à jour paquet prêt")?;

            sqlx::query(
                "UPDATE atlas.atlaspack_generation_jobs SET status = 'completed', finished_at = NOW() WHERE id = $1",
            )
            .bind(job_id)
            .execute(pool)
            .await?;
            tracing::info!(package_id = %package_id, tiles = outcome.tile_count, "atlaspack généré");
        }
        Err(e) => {
            // `{:#}` et non `{}` : anyhow n'affiche par défaut que le contexte
            // le plus externe. On perdait ainsi la cause réelle ("au moins une
            // bbox est requise", erreur réseau…) et il ne restait qu'un
            // libellé générique impossible à diagnostiquer.
            let detail = format!("{e:#}");
            finish_job_failed(pool, job_id, package_id, &detail).await?;
            tracing::error!(package_id = %package_id, error = %detail, "échec génération atlaspack");
        }
    }

    Ok(true)
}

async fn finish_job_failed(
    pool: &PgPool,
    job_id: Uuid,
    package_id: Uuid,
    error: &str,
) -> anyhow::Result<()> {
    sqlx::query(
        "UPDATE atlas.atlaspack_generation_jobs SET status = 'failed', finished_at = NOW(), last_error = $2 WHERE id = $1",
    )
    .bind(job_id)
    .bind(error)
    .execute(pool)
    .await?;
    sqlx::query("UPDATE atlas.atlaspack_packages SET status = 'failed', error = $2, updated_at = NOW() WHERE id = $1")
        .bind(package_id)
        .bind(error)
        .execute(pool)
        .await?;
    Ok(())
}

/// Rafraîchit le paquet d'un opérateur après un changement de mot de passe.
///
/// Le `.atlaspack` est chiffré à partir du hash Argon2id du compte : son sel et
/// ses paramètres sont figés dans le manifeste au moment de la génération. Un
/// mot de passe changé sans régénération laisse donc un paquet qui s'ouvre
/// encore avec l'ANCIEN mot de passe et refuse le nouveau — l'opérateur se
/// retrouve avec deux secrets différents selon qu'il est en ligne ou non.
///
/// N'échoue jamais : un compte qui n'est pas opérateur, ou qui n'a pas encore
/// de paquet, n'a simplement rien à rafraîchir. Le changement de mot de passe
/// ne doit pas être annulé pour autant.
pub async fn refresh_package_after_password_change(pool: &PgPool, user_id: Uuid) {
    let student_id: Option<Uuid> = match sqlx::query_scalar(
        "SELECT id FROM atlas.colab_students WHERE user_id = $1 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!(error = %e, %user_id, "résolution opérateur après changement de mot de passe");
            return;
        }
    };

    let Some(student_id) = student_id else {
        return;
    };

    match enqueue_or_refresh_package_for_student(pool, student_id, None).await {
        Ok(package_id) => tracing::info!(
            %user_id, %student_id, %package_id,
            "mot de passe changé — régénération du .atlaspack demandée"
        ),
        Err(e) => tracing::error!(
            error = %format!("{e:#}"), %user_id, %student_id,
            "mot de passe changé mais régénération du .atlaspack impossible"
        ),
    }
}
