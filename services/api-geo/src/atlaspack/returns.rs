//! Réimport d'un `.atlasreturn` (export terrain) dans Atlas Colab.
//!
//! Tout-ou-rien : la vérification d'intégrité (HMAC + sha256 par fichier)
//! est faite AVANT toute écriture, et l'application des données se fait dans
//! une unique transaction. Idempotent par construction : `export_id` est la
//! clé primaire de `atlas.atlaspack_returns`, ré-importer deux fois le même
//! fichier ne duplique rien.

use std::io::Read as _;

use anyhow::{anyhow, Context};
use argon2::PasswordHash;
use sqlx::PgPool;
use uuid::Uuid;
use zip::read::ZipArchive;

use super::crypto;
use super::format::ReturnData;

pub struct ImportSummary {
    pub export_id: Uuid,
    pub already_imported: bool,
    pub missions_count: i32,
    pub sondages_count: i32,
    pub essais_count: i32,
    pub resultats_count: i32,
    pub attachments_count: i32,
    pub warnings: Vec<String>,
}

const MANIFEST_ENTRY: &str = "manifest.json";
const MAC_ENTRY: &str = "manifest.mac";
const DATA_ENTRY: &str = "data.json";

fn read_zip_entry(archive: &mut ZipArchive<std::io::Cursor<&[u8]>>, name: &str) -> anyhow::Result<Vec<u8>> {
    let mut file = archive
        .by_name(name)
        .map_err(|_| anyhow!("entrée manquante dans l'archive .atlasreturn: {name}"))?;
    let mut buf = Vec::with_capacity(file.size() as usize);
    file.read_to_end(&mut buf)?;
    Ok(buf)
}

async fn fetch_current_raw_argon2_output(pool: &PgPool, user_id: Uuid) -> anyhow::Result<Vec<u8>> {
    let password_hash: String =
        sqlx::query_scalar("SELECT password_hash FROM atlas.users WHERE id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await
            .context("lecture hash opérateur pour contrôle d'intégrité du retour")?;
    let parsed = PasswordHash::new(&password_hash)
        .map_err(|e| anyhow!("hash de mot de passe illisible: {e}"))?;
    let raw = parsed
        .hash
        .ok_or_else(|| anyhow!("hash sans sortie brute"))?;
    Ok(raw.as_bytes().to_vec())
}

/// Importe un `.atlasreturn`. `zip_bytes` = contenu brut du fichier uploadé.
/// Ne fait AUCUNE hypothèse de confiance sur son contenu : toute
/// incohérence (fichier manquant, hash différent, HMAC invalide, version
/// incompatible) est rejetée AVANT toute écriture en base.
pub async fn import_atlasreturn(
    pool: &PgPool,
    zip_bytes: &[u8],
    imported_by: Uuid,
) -> anyhow::Result<ImportSummary> {
    let cursor = std::io::Cursor::new(zip_bytes);
    let mut archive = ZipArchive::new(cursor).context("archive .atlasreturn illisible (pas un ZIP valide)")?;

    let manifest_bytes = read_zip_entry(&mut archive, MANIFEST_ENTRY)?;
    let mac_bytes = read_zip_entry(&mut archive, MAC_ENTRY)?;
    let data_bytes = read_zip_entry(&mut archive, DATA_ENTRY)?;

    let manifest: super::format::ReturnManifest = serde_json::from_slice(&manifest_bytes)
        .context("manifest.json illisible")?;

    if manifest.format_version != super::format::FORMAT_VERSION {
        return Err(anyhow!(
            "version de format incompatible : paquet v{}, serveur attend v{}",
            manifest.format_version,
            super::format::FORMAT_VERSION
        ));
    }

    // ── Intégrité par fichier ────────────────────────────────────────────
    let data_entry = manifest
        .files
        .get(DATA_ENTRY)
        .ok_or_else(|| anyhow!("manifeste sans entrée pour data.json"))?;
    if crypto::sha256_hex(&data_bytes) != data_entry.sha256 {
        return Err(anyhow!("data.json altéré : empreinte SHA-256 ne correspond pas au manifeste"));
    }
    if data_bytes.len() as u64 != data_entry.size_bytes {
        return Err(anyhow!("data.json altéré : taille ne correspond pas au manifeste"));
    }
    if manifest.compute_root_hash() != manifest.sha256 {
        return Err(anyhow!(
            "manifeste incohérent : l'empreinte racine ne correspond pas aux fichiers déclarés"
        ));
    }

    let data: ReturnData = serde_json::from_slice(&data_bytes).context("data.json illisible")?;

    let mut attachment_bytes: std::collections::HashMap<String, Vec<u8>> = std::collections::HashMap::new();
    for att in &data.attachments {
        let entry = manifest
            .files
            .get(&att.archive_path)
            .ok_or_else(|| anyhow!("manifeste sans entrée pour {}", att.archive_path))?;
        let bytes = read_zip_entry(&mut archive, &att.archive_path)?;
        if crypto::sha256_hex(&bytes) != entry.sha256 {
            return Err(anyhow!("pièce jointe altérée : {}", att.archive_path));
        }
        if bytes.len() as u64 != entry.size_bytes {
            return Err(anyhow!("pièce jointe de taille incohérente : {}", att.archive_path));
        }
        attachment_bytes.insert(att.archive_path.clone(), bytes);
    }

    // ── Contrôle HMAC (détecte une altération intentionnelle du manifeste
    //    lui-même, pas seulement des fichiers qu'il référence) ────────────
    let raw_output = fetch_current_raw_argon2_output(pool, manifest.operator_user_id).await?;
    let mac_key = crypto::derive_return_mac_key(&raw_output, &manifest.export_id);
    let mac_ok = crypto::verify_hmac_sha256(&mac_key, &manifest.canonical_bytes(), &mac_bytes);

    if !mac_ok {
        // On trace quand même la tentative (idempotent sur export_id) pour
        // que l'échec soit auditable — mais on n'applique RIEN.
        sqlx::query(
            r#"INSERT INTO atlas.atlaspack_returns
               (id, package_id, operator_user_id, generated_at, format_version, sha256, manifest, status, rejection_reason, imported_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,'rejected',$8,$9)
               ON CONFLICT (id) DO UPDATE SET status = 'rejected', rejection_reason = EXCLUDED.rejection_reason, imported_by = EXCLUDED.imported_by"#,
        )
        .bind(manifest.export_id)
        .bind(manifest.package_id)
        .bind(manifest.operator_user_id)
        .bind(chrono::DateTime::parse_from_rfc3339(&manifest.generated_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()))
        .bind(manifest.format_version)
        .bind(&manifest.sha256)
        .bind(serde_json::to_value(&manifest).unwrap_or_default())
        .bind("contrôle d'intégrité HMAC invalide — fichier altéré ou mot de passe opérateur changé depuis l'émission du paquet")
        .bind(imported_by)
        .execute(pool)
        .await
        .ok();
        return Err(anyhow!(
            "contrôle d'intégrité invalide (HMAC) — import refusé. Le fichier a peut-être été modifié, ou le mot de passe de l'opérateur a changé depuis l'émission du paquet."
        ));
    }

    // ── Idempotence : déjà importé ? ─────────────────────────────────────
    let generated_at = chrono::DateTime::parse_from_rfc3339(&manifest.generated_at)
        .map(|d| d.with_timezone(&chrono::Utc))
        .unwrap_or_else(|_| chrono::Utc::now());

    let mut tx = pool.begin().await?;
    let inserted = sqlx::query(
        r#"INSERT INTO atlas.atlaspack_returns
           (id, package_id, operator_user_id, generated_at, format_version,
            missions_count, sondages_count, essais_count, resultats_count, attachments_count,
            size_bytes, sha256, manifest, status, imported_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'received',$14)
           ON CONFLICT (id) DO NOTHING"#,
    )
    .bind(manifest.export_id)
    .bind(manifest.package_id)
    .bind(manifest.operator_user_id)
    .bind(generated_at)
    .bind(manifest.format_version)
    .bind(manifest.missions_count)
    .bind(manifest.sondages_count)
    .bind(manifest.essais_count)
    .bind(manifest.resultats_count)
    .bind(manifest.attachments_count)
    .bind(manifest.size_bytes as i64)
    .bind(&manifest.sha256)
    .bind(serde_json::to_value(&manifest).unwrap_or_default())
    .bind(imported_by)
    .execute(&mut *tx)
    .await
    .context("enregistrement du retour")?;

    if inserted.rows_affected() == 0 {
        tx.rollback().await?;
        return Ok(ImportSummary {
            export_id: manifest.export_id,
            already_imported: true,
            missions_count: manifest.missions_count,
            sondages_count: manifest.sondages_count,
            essais_count: manifest.essais_count,
            resultats_count: manifest.resultats_count,
            attachments_count: manifest.attachments_count,
            warnings: vec!["cet export a déjà été importé précédemment — aucune donnée dupliquée".to_string()],
        });
    }

    let mut warnings = Vec::new();

    for s in &data.sondages {
        sqlx::query(
            r#"INSERT INTO atlas.sondages
               (id, code, geom, depth_m_max, notes, validation_status, location_mode, location_accuracy_m, mission_id, meta)
               VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3,$4), 4326), $5, $6, 'draft_field', 'gps_field', $7, $8, $9)
               ON CONFLICT (id) DO NOTHING"#,
        )
        .bind(s.id)
        .bind(&s.code)
        .bind(s.longitude)
        .bind(s.latitude)
        .bind(s.depth_m.map(|d| d.to_string()))
        .bind(&s.notes)
        .bind(s.location_accuracy_m)
        .bind(s.mission_id)
        .bind(serde_json::json!({
            "created_by": manifest.operator_user_id,
            "imported_from_atlasreturn": manifest.export_id,
            "planned_point_id": s.planned_point_id,
            "point_name": s.point_name,
            "relocation_reason": s.relocation_reason,
            "layers_count": s.layers_count,
            "profile_description": s.profile_description,
        }))
        .execute(&mut *tx)
        .await
        .context("insertion sondage réimporté")?;

        sqlx::query(
            "INSERT INTO atlas.colab_mission_sondages (mission_id, sondage_id) VALUES ($1, $2) ON CONFLICT (mission_id, sondage_id) DO NOTHING",
        )
        .bind(s.mission_id)
        .bind(s.id)
        .execute(&mut *tx)
        .await
        .ok();

        if let Some(point_id) = s.planned_point_id {
            sqlx::query(
                "UPDATE atlas.colab_mission_sondage_points SET confirmed_sondage_id = $1, confirmed_at = COALESCE(confirmed_at, NOW()), confirmed_by = COALESCE(confirmed_by, $2) WHERE id = $3 AND confirmed_sondage_id IS NULL",
            )
            .bind(s.id)
            .bind(manifest.operator_user_id)
            .bind(point_id)
            .execute(&mut *tx)
            .await
            .ok();
        }
    }

    for lr in &data.lab_results {
        let exists_sondage: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM atlas.sondages WHERE id = $1)")
            .bind(lr.sondage_id)
            .fetch_one(&mut *tx)
            .await
            .unwrap_or(false);
        if !exists_sondage {
            warnings.push(format!(
                "résultat labo {} ignoré : sondage {} introuvable",
                lr.id, lr.sondage_id
            ));
            continue;
        }
        sqlx::query(
            r#"INSERT INTO atlas.colab_lab_results
               (id, mission_id, sondage_id, sample_code, depth_top_m, depth_bottom_m, sample, tests, status, created_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               ON CONFLICT (id) DO NOTHING"#,
        )
        .bind(lr.id)
        .bind(lr.mission_id)
        .bind(lr.sondage_id)
        .bind(&lr.sample_code)
        .bind(lr.depth_top_m)
        .bind(lr.depth_bottom_m)
        .bind(&lr.sample)
        .bind(&lr.tests)
        .bind(&lr.status)
        .bind(manifest.operator_user_id)
        .execute(&mut *tx)
        .await
        .context("insertion résultat labo réimporté")?;
    }

    for log in &data.field_logs {
        sqlx::query(
            r#"INSERT INTO atlas.colab_field_logs (id, mission_id, author_id, log_type, content, longitude, latitude)
               VALUES ($1,$2,$3,$4::atlas.field_log_type,$5,$6,$7)
               ON CONFLICT (id) DO NOTHING"#,
        )
        .bind(log.id)
        .bind(log.mission_id)
        .bind(manifest.operator_user_id)
        .bind(&log.log_type)
        .bind(&log.content)
        .bind(log.longitude)
        .bind(log.latitude)
        .execute(&mut *tx)
        .await
        .context("insertion journal terrain réimporté")?;
    }

    let attachments_dir = super::config::AtlasPackConfig::from_env()
        .storage_dir
        .join("attachments");
    std::fs::create_dir_all(&attachments_dir).context("création répertoire pièces jointes")?;
    for att in &data.attachments {
        let exists_sondage: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM atlas.sondages WHERE id = $1)")
            .bind(att.sondage_id)
            .fetch_one(&mut *tx)
            .await
            .unwrap_or(false);
        if !exists_sondage {
            warnings.push(format!("pièce jointe {} ignorée : sondage {} introuvable", att.id, att.sondage_id));
            continue;
        }
        let bytes = attachment_bytes
            .get(&att.archive_path)
            .ok_or_else(|| anyhow!("pièce jointe absente de l'archive: {}", att.archive_path))?;
        let ext = std::path::Path::new(&att.file_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");
        let storage_path = attachments_dir.join(format!("{}.{}", att.id, ext));
        std::fs::write(&storage_path, bytes).context("écriture pièce jointe sur disque")?;

        sqlx::query(
            r#"INSERT INTO atlas.colab_sondage_attachments
               (id, sondage_id, mission_id, kind, file_name, content_type, size_bytes, sha256, storage_path, caption, taken_at, created_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
               ON CONFLICT (id) DO NOTHING"#,
        )
        .bind(att.id)
        .bind(att.sondage_id)
        .bind(att.mission_id)
        .bind(&att.kind)
        .bind(&att.file_name)
        .bind(&att.content_type)
        .bind(bytes.len() as i64)
        .bind(&att.sha256)
        .bind(storage_path.to_string_lossy().to_string())
        .bind(&att.caption)
        .bind(
            att.taken_at
                .as_deref()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|d| d.with_timezone(&chrono::Utc)),
        )
        .bind(manifest.operator_user_id)
        .execute(&mut *tx)
        .await
        .context("insertion pièce jointe réimportée")?;
    }

    for ev in &data.audit_events {
        sqlx::query(
            r#"INSERT INTO atlas.atlaspack_audit_events
               (id, return_id, package_id, operator_user_id, mission_id, event_type, occurred_at, object_type, object_id, old_values, new_values, metadata)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
               ON CONFLICT (id) DO NOTHING"#,
        )
        .bind(ev.id)
        .bind(manifest.export_id)
        .bind(manifest.package_id)
        .bind(manifest.operator_user_id)
        .bind(ev.mission_id)
        .bind(&ev.event_type)
        .bind(
            chrono::DateTime::parse_from_rfc3339(&ev.occurred_at)
                .map(|d| d.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now()),
        )
        .bind(&ev.object_type)
        .bind(&ev.object_id)
        .bind(&ev.old_values)
        .bind(&ev.new_values)
        .bind(&ev.metadata)
        .execute(&mut *tx)
        .await
        .context("insertion événement d'audit réimporté")?;
    }

    sqlx::query("UPDATE atlas.atlaspack_returns SET status = 'applied', applied_at = NOW() WHERE id = $1")
        .bind(manifest.export_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await.context("validation transaction de réimport")?;

    Ok(ImportSummary {
        export_id: manifest.export_id,
        already_imported: false,
        missions_count: manifest.missions_count,
        sondages_count: data.sondages.len() as i32,
        essais_count: data.lab_results.len() as i32,
        resultats_count: data.lab_results.len() as i32,
        attachments_count: data.attachments.len() as i32,
        warnings,
    })
}

/// Calcule le HMAC `manifest.mac` pour un manifeste donné — utilisé par les
/// tests d'intégration bout-en-bout qui simulent un export mobile pour
/// vérifier le chemin de réimport sans dépendre de l'app React Native. La
/// vraie construction a lieu sur le mobile (TypeScript), cf.
/// `mobile/src/services/atlaspack/exportBuilder.ts`.
#[cfg(test)]
pub fn compute_test_mac(manifest: &super::format::ReturnManifest, raw_argon2_output: &[u8]) -> [u8; 32] {
    let key = crypto::derive_return_mac_key(raw_argon2_output, &manifest.export_id);
    crypto::hmac_sha256(&key, &manifest.canonical_bytes())
}
