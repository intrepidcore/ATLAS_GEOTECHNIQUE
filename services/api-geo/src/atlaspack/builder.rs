//! Assemblage d'un `.atlaspack` pour un opérateur donné : requêtes DB,
//! chiffrement, cartes hors-ligne, signature, écriture de l'archive finale.

use std::io::Write as _;
use std::path::PathBuf;

use anyhow::{anyhow, Context};
use argon2::PasswordHash;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use chrono::{Duration, Utc};
use serde::Serialize;
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use uuid::Uuid;
use zip::write::{FileOptions, ZipWriter};

use super::config::AtlasPackState;
use super::crypto;
use super::format::{
    FileEntry, MapCoverage, OperatorIdentity, OperatorPayload, PackageManifest, PackedMission,
    PackedPlannedPoint, PackedSondageMarker, DATA_FILE, FORMAT_VERSION, MANIFEST_FILE,
    MBTILES_FILE, SCHEMA_VERSION, SIGNATURE_FILE,
};
use super::offline_tiles::{build_mbtiles_for_bboxes, TileBuildConfig, write_empty_mbtiles};

/// Statuts métiers "actifs" éligibles à l'embarquement terrain.
/// Une mission `draft`/`cancelled`/`suspended`/`completed` n'a pas sa place
/// dans un paquet destiné à un opérateur qui part sur le terrain.
const ACTIVE_MISSION_STATUSES: [&str; 2] = ["planned", "in_progress"];

pub struct BuildOutcome {
    pub mission_ids: Vec<Uuid>,
    pub mission_snapshot_hash: String,
    pub generated_at: chrono::DateTime<Utc>,
    pub expires_at: chrono::DateTime<Utc>,
    pub signing_key_id: String,
    pub package_sha256: String,
    pub file_path: PathBuf,
    pub file_size_bytes: i64,
    pub tile_count: i32,
    pub tile_zoom_min: i32,
    pub tile_zoom_max: i32,
    pub tiles_truncated: bool,
    pub tiles_truncation_reason: Option<String>,
}

struct OperatorRow {
    user_id: Uuid,
    student_id: Uuid,
    email: String,
    first_name: Option<String>,
    last_name: Option<String>,
    password_hash: String,
}

async fn fetch_operator(pool: &PgPool, student_id: Uuid) -> anyhow::Result<OperatorRow> {
    let row = sqlx::query(
        r#"
        SELECT u.id AS user_id, s.id AS student_id, u.email, u.first_name, u.last_name, u.password_hash
        FROM atlas.colab_students s
        JOIN atlas.users u ON u.id = s.user_id
        WHERE s.id = $1 AND s.deleted_at IS NULL AND u.is_active = TRUE
        "#,
    )
    .bind(student_id)
    .fetch_optional(pool)
    .await
    .context("lecture opérateur")?
    .ok_or_else(|| anyhow!("opérateur introuvable ou inactif (student_id={student_id})"))?;

    Ok(OperatorRow {
        user_id: row.try_get("user_id")?,
        student_id: row.try_get("student_id")?,
        email: row.try_get("email")?,
        first_name: row.try_get("first_name").ok(),
        last_name: row.try_get("last_name").ok(),
        password_hash: row.try_get("password_hash")?,
    })
}

struct MissionRow {
    id: Uuid,
    code: String,
    title: String,
    theme: String,
    status: String,
    start_date: Option<chrono::NaiveDate>,
    end_date: Option<chrono::NaiveDate>,
    maille_id: Option<Uuid>,
    maille_label: Option<String>,
    commune: Option<String>,
    region: Option<String>,
    expected_sondages: i32,
    updated_at: chrono::DateTime<Utc>,
    assignment_id: Uuid,
    assignment_updated: chrono::DateTime<Utc>,
}

/// Missions actives assignées à cet étudiant — même filtre logique que
/// `colab::mobile::get_my_missions`, restreint au statut "actif" et à une
/// affectation non close (`unassigned_at IS NULL`).
async fn fetch_active_missions(pool: &PgPool, student_id: Uuid) -> anyhow::Result<Vec<MissionRow>> {
    let rows = sqlx::query(
        r#"
        SELECT
            m.id, m.code, m.title, m.theme::text AS theme, m.status::text AS status,
            m.start_date, m.end_date, m.maille_id, m.zone_label AS maille_label,
            m.commune, m.region, COALESCE(m.expected_sondages, 0) AS expected_sondages,
            m.updated_at,
            a.id AS assignment_id,
            GREATEST(a.assigned_at, COALESCE(a.assigned_at, m.updated_at)) AS assignment_updated
        FROM atlas.colab_missions m
        JOIN atlas.colab_mission_assignments a ON a.mission_id = m.id
        WHERE a.student_id = $1
          AND a.unassigned_at IS NULL
          AND m.deleted_at IS NULL
          AND m.status::text = ANY($2)
        ORDER BY m.code
        "#,
    )
    .bind(student_id)
    .bind(&ACTIVE_MISSION_STATUSES[..])
    .fetch_all(pool)
    .await
    .context("lecture missions actives")?;

    rows.into_iter()
        .map(|row| {
            Ok(MissionRow {
                id: row.try_get("id")?,
                code: row.try_get("code")?,
                title: row.try_get("title")?,
                theme: row.try_get("theme")?,
                status: row.try_get("status")?,
                start_date: row.try_get("start_date")?,
                end_date: row.try_get("end_date")?,
                maille_id: row.try_get("maille_id")?,
                maille_label: row.try_get("maille_label")?,
                commune: row.try_get("commune")?,
                region: row.try_get("region")?,
                expected_sondages: row.try_get("expected_sondages")?,
                updated_at: row.try_get("updated_at")?,
                assignment_id: row.try_get("assignment_id")?,
                assignment_updated: row.try_get("assignment_updated")?,
            })
        })
        .collect()
}

struct MailleInfo {
    geojson: Option<serde_json::Value>,
    bbox: Option<[f64; 4]>,
    center_lon: Option<f64>,
    center_lat: Option<f64>,
}

async fn fetch_maille_info(pool: &PgPool, maille_id: Uuid) -> anyhow::Result<MailleInfo> {
    let row = sqlx::query(
        r#"
        SELECT
            ST_AsGeoJSON(ST_Transform(geom, 4326))::jsonb AS geojson,
            ST_XMin(ST_Transform(geom, 4326)) AS min_x,
            ST_YMin(ST_Transform(geom, 4326)) AS min_y,
            ST_XMax(ST_Transform(geom, 4326)) AS max_x,
            ST_YMax(ST_Transform(geom, 4326)) AS max_y,
            ST_X(ST_Centroid(ST_Transform(geom, 4326))) AS center_lon,
            ST_Y(ST_Centroid(ST_Transform(geom, 4326))) AS center_lat
        FROM atlas.mailles WHERE id = $1
        "#,
    )
    .bind(maille_id)
    .fetch_optional(pool)
    .await
    .context("lecture maille")?;

    Ok(match row {
        Some(r) => MailleInfo {
            geojson: r.try_get("geojson").ok(),
            bbox: match (
                r.try_get::<f64, _>("min_x"),
                r.try_get::<f64, _>("min_y"),
                r.try_get::<f64, _>("max_x"),
                r.try_get::<f64, _>("max_y"),
            ) {
                (Ok(a), Ok(b), Ok(c), Ok(d)) => Some([a, b, c, d]),
                _ => None,
            },
            center_lon: r.try_get("center_lon").ok(),
            center_lat: r.try_get("center_lat").ok(),
        },
        None => MailleInfo {
            geojson: None,
            bbox: None,
            center_lon: None,
            center_lat: None,
        },
    })
}

async fn fetch_planned_points(pool: &PgPool, mission_id: Uuid) -> anyhow::Result<Vec<PackedPlannedPoint>> {
    let rows = sqlx::query(
        "SELECT id, numero, label, lat, lon, confirmed_sondage_id FROM atlas.colab_mission_sondage_points WHERE mission_id = $1 ORDER BY numero",
    )
    .bind(mission_id)
    .fetch_all(pool)
    .await
    .context("lecture points prévisionnels")?;
    rows.into_iter()
        .map(|row| {
            Ok(PackedPlannedPoint {
                id: row.try_get("id")?,
                numero: row.try_get("numero")?,
                label: row.try_get("label").ok(),
                lat: row.try_get("lat")?,
                lon: row.try_get("lon")?,
                confirmed_sondage_id: row.try_get("confirmed_sondage_id").ok(),
            })
        })
        .collect()
}

async fn fetch_existing_sondages(pool: &PgPool, mission_id: Uuid) -> anyhow::Result<Vec<PackedSondageMarker>> {
    let rows = sqlx::query(
        r#"
        SELECT s.id, s.code, ST_X(s.geom) AS longitude, ST_Y(s.geom) AS latitude, s.validation_status::text AS status
        FROM atlas.sondages s
        JOIN atlas.colab_mission_sondages cms ON s.id = cms.sondage_id
        WHERE cms.mission_id = $1 AND s.geom IS NOT NULL
        "#,
    )
    .bind(mission_id)
    .fetch_all(pool)
    .await
    .context("lecture sondages existants")?;
    rows.into_iter()
        .map(|row| {
            Ok(PackedSondageMarker {
                id: row.try_get("id")?,
                code: row.try_get("code").ok(),
                longitude: row.try_get("longitude")?,
                latitude: row.try_get("latitude")?,
                status: row.try_get("status").ok(),
            })
        })
        .collect()
}

/// Empreinte de "fraîcheur" du paquet : dès qu'une mission ou une affectation
/// change, ce hash change -> le paquet `ready` correspondant est marqué
/// `stale` par l'appelant (cf. `jobs::mark_stale_for_student`).
fn compute_snapshot_hash(missions: &[MissionRow]) -> String {
    #[derive(Serialize)]
    struct Entry<'a> {
        mission_id: Uuid,
        mission_updated_at: chrono::DateTime<Utc>,
        assignment_id: Uuid,
        assignment_updated: chrono::DateTime<Utc>,
        status: &'a str,
    }
    let mut entries: Vec<Entry> = missions
        .iter()
        .map(|m| Entry {
            mission_id: m.id,
            mission_updated_at: m.updated_at,
            assignment_id: m.assignment_id,
            assignment_updated: m.assignment_updated,
            status: &m.status,
        })
        .collect();
    entries.sort_by_key(|e| e.mission_id);
    let bytes = serde_json::to_vec(&entries).unwrap_or_default();
    crypto::sha256_hex(&bytes)
}

/// Construit, chiffre, signe et écrit le `.atlaspack` de `student_id` sur
/// disque. Ne modifie AUCUNE ligne en base — l'appelant (`jobs.rs`) est
/// responsable de la mise à jour transactionnelle de `atlaspack_packages`.
pub async fn build_atlaspack(
    pool: &PgPool,
    state: &AtlasPackState,
    package_id: Uuid,
    student_id: Uuid,
) -> anyhow::Result<BuildOutcome> {
    let operator = fetch_operator(pool, student_id).await?;
    let missions = fetch_active_missions(pool, student_id).await?;
    if missions.is_empty() {
        return Err(anyhow!(
            "aucune mission active assignée à cet opérateur — rien à embarquer"
        ));
    }

    let parsed_hash = PasswordHash::new(&operator.password_hash)
        .map_err(|e| anyhow!("hash de mot de passe illisible pour {}: {e}", operator.email))?;
    let argon2_params = argon2::Params::try_from(&parsed_hash)
        .map_err(|e| anyhow!("paramètres Argon2id illisibles: {e}"))?;
    let salt = parsed_hash
        .salt
        .ok_or_else(|| anyhow!("hash sans sel — compte non conforme Argon2id"))?;
    let mut salt_buf = [0u8; 64];
    let salt_raw = salt
        .decode_b64(&mut salt_buf)
        .map_err(|e| anyhow!("décodage du sel impossible: {e}"))?;
    // base64 standard (RFC 4648), pas le PHC-B64 (sans padding) du hash source —
    // c'est ce que le mobile décodera avec un décodeur base64 standard.
    let salt_b64 = B64.encode(salt_raw);
    let raw_output = parsed_hash
        .hash
        .ok_or_else(|| anyhow!("hash sans sortie brute"))?;
    let raw_output_bytes = raw_output.as_bytes().to_vec();

    let mut packed_missions = Vec::with_capacity(missions.len());
    let mut bboxes: Vec<(f64, f64, f64, f64)> = Vec::new();
    for m in &missions {
        let maille = match m.maille_id {
            Some(id) => fetch_maille_info(pool, id).await?,
            None => MailleInfo {
                geojson: None,
                bbox: None,
                center_lon: None,
                center_lat: None,
            },
        };
        if let Some(b) = maille.bbox {
            bboxes.push((b[0], b[1], b[2], b[3]));
        }
        let planned_points = fetch_planned_points(pool, m.id).await?;
        let existing_sondages = fetch_existing_sondages(pool, m.id).await?;
        packed_missions.push(PackedMission {
            id: m.id,
            code: m.code.clone(),
            title: m.title.clone(),
            theme: m.theme.clone(),
            status: m.status.clone(),
            start_date: m.start_date.map(|d| d.to_string()),
            end_date: m.end_date.map(|d| d.to_string()),
            maille_id: m.maille_id,
            maille_label: m.maille_label.clone(),
            commune: m.commune.clone(),
            region: m.region.clone(),
            expected_sondages: m.expected_sondages,
            maille_geojson: maille.geojson,
            bbox: maille.bbox,
            center_lon: maille.center_lon,
            center_lat: maille.center_lat,
            tolerance_m: 10,
            planned_points,
            existing_sondages,
        });
    }

    let mission_ids: Vec<Uuid> = missions.iter().map(|m| m.id).collect();
    let mission_snapshot_hash = compute_snapshot_hash(&missions);

    let payload = OperatorPayload {
        schema_version: SCHEMA_VERSION,
        operator: OperatorIdentity {
            user_id: operator.user_id,
            student_id: Some(operator.student_id),
            email: operator.email.clone(),
            first_name: operator.first_name.clone(),
            last_name: operator.last_name.clone(),
            password_hash_phc: operator.password_hash.clone(),
        },
        missions: packed_missions,
        default_tolerance_m: 10,
    };
    let payload_bytes = serde_json::to_vec(&payload).context("sérialisation payload")?;

    let data_key = crypto::derive_data_key(&raw_output_bytes, &package_id);
    let data_bin = crypto::encrypt(&data_key, &payload_bytes)
        .map_err(|e| anyhow!("chiffrement data.bin: {e}"))?;
    let data_sha256 = crypto::sha256_hex(&data_bin);

    // ── Cartes hors-ligne ────────────────────────────────────────────────
    let tmp_dir = std::env::temp_dir().join(format!("atlaspack-build-{package_id}"));
    std::fs::create_dir_all(&tmp_dir).context("création répertoire temporaire")?;
    let mbtiles_tmp_path = tmp_dir.join("offline.mbtiles");
    let tile_cfg = TileBuildConfig {
        tile_url_template: state.config.tile_url_template.clone(),
        user_agent: state.config.tile_user_agent.clone(),
        zoom_min: state.config.tile_zoom_min,
        zoom_max: state.config.tile_zoom_max,
        max_tiles: state.config.tile_max_count,
        request_delay_ms: state.config.tile_request_delay_ms,
    };
    // Sans maille rattachée, il n'y a aucune emprise à couvrir : on écrit un
    // MBTiles vide plutôt que de faire échouer tout le paquet. Le générateur
    // de tuiles exige à juste titre au moins une bbox — c'est à l'appelant de
    // ne pas lui demander de couvrir le vide.
    let tile_result = if bboxes.is_empty() {
        tracing::warn!(
            operator = %operator.email,
            "aucune maille rattachée aux missions — paquet généré sans fond de carte"
        );
        write_empty_mbtiles(&mbtiles_tmp_path)
            .await
            .context("écriture du MBTiles vide")?
    } else {
        build_mbtiles_for_bboxes(&bboxes, state.config.map_margin_m, &tile_cfg, &mbtiles_tmp_path)
            .await
            .context("génération des tuiles hors-ligne")?
    };
    let mbtiles_bytes = std::fs::read(&mbtiles_tmp_path).context("lecture mbtiles généré")?;
    let mbtiles_sha256 = crypto::sha256_hex(&mbtiles_bytes);

    let bounds = expand_union_bbox(&bboxes, state.config.map_margin_m);

    // ── Manifeste + signature ───────────────────────────────────────────
    let now = Utc::now();
    let expires_at = now + Duration::days(state.config.expiry_days);
    let mut files = std::collections::BTreeMap::new();
    files.insert(
        DATA_FILE.to_string(),
        FileEntry {
            sha256: data_sha256.clone(),
            size_bytes: data_bin.len() as u64,
        },
    );
    files.insert(
        MBTILES_FILE.to_string(),
        FileEntry {
            sha256: mbtiles_sha256.clone(),
            size_bytes: mbtiles_bytes.len() as u64,
        },
    );

    let manifest = PackageManifest {
        format_version: FORMAT_VERSION,
        schema_version: SCHEMA_VERSION,
        package_id,
        operator_user_id: operator.user_id,
        operator_email: operator.email.clone(),
        generated_at: now.to_rfc3339(),
        expires_at: expires_at.to_rfc3339(),
        signing_key_id: state.signing_key.key_id.clone(),
        mission_ids: mission_ids.clone(),
        password_hash_algorithm: "argon2id".to_string(),
        password_salt_b64: salt_b64,
        password_argon2_m_cost: argon2_params.m_cost(),
        password_argon2_t_cost: argon2_params.t_cost(),
        password_argon2_p_cost: argon2_params.p_cost(),
        password_hash_len: raw_output_bytes.len() as u32,
        files,
        map_coverage: Some(MapCoverage {
            zoom_min: state.config.tile_zoom_min as i32,
            zoom_max_requested: state.config.tile_zoom_max as i32,
            zoom_max_actual: tile_result.actual_zoom_max as i32,
            tile_count: tile_result.tile_count as i64,
            truncated: tile_result.truncated,
            truncation_reason: tile_result.truncation_reason.clone(),
            bounds,
        }),
    };
    let manifest_bytes = manifest.canonical_bytes();
    let signature = state.signing_key.sign(&manifest_bytes);

    // ── Écriture de l'archive .atlaspack ────────────────────────────────
    std::fs::create_dir_all(&state.config.storage_dir).context("création répertoire de stockage")?;
    let file_path = state.config.storage_dir.join(format!("{package_id}.atlaspack"));
    write_archive(&file_path, &manifest_bytes, &signature, &data_bin, &mbtiles_bytes)?;
    let file_size = std::fs::metadata(&file_path)
        .context("lecture taille fichier final")?
        .len();
    let final_bytes = std::fs::read(&file_path).context("relecture archive finale")?;
    let package_sha256 = {
        let mut h = Sha256::new();
        h.update(&final_bytes);
        format!("{:x}", h.finalize())
    };

    let _ = std::fs::remove_dir_all(&tmp_dir);

    Ok(BuildOutcome {
        mission_ids,
        mission_snapshot_hash,
        generated_at: now,
        expires_at,
        signing_key_id: state.signing_key.key_id.clone(),
        package_sha256,
        file_path,
        file_size_bytes: file_size as i64,
        tile_count: tile_result.tile_count as i32,
        tile_zoom_min: state.config.tile_zoom_min as i32,
        tile_zoom_max: tile_result.actual_zoom_max as i32,
        tiles_truncated: tile_result.truncated,
        tiles_truncation_reason: tile_result.truncation_reason,
    })
}

fn expand_union_bbox(bboxes: &[(f64, f64, f64, f64)], margin_m: f64) -> [f64; 4] {
    if bboxes.is_empty() {
        return [0.0, 0.0, 0.0, 0.0];
    }
    let mut min_lon = f64::MAX;
    let mut min_lat = f64::MAX;
    let mut max_lon = f64::MIN;
    let mut max_lat = f64::MIN;
    for &(a, b, c, d) in bboxes {
        let center_lat = (b + d) / 2.0;
        let lat_margin = margin_m / 111_320.0;
        let lon_margin = margin_m / (111_320.0 * center_lat.to_radians().cos().max(0.01));
        min_lon = min_lon.min(a - lon_margin);
        min_lat = min_lat.min(b - lat_margin);
        max_lon = max_lon.max(c + lon_margin);
        max_lat = max_lat.max(d + lat_margin);
    }
    [min_lon, min_lat, max_lon, max_lat]
}

fn write_archive(
    path: &std::path::Path,
    manifest_bytes: &[u8],
    signature: &[u8; 64],
    data_bin: &[u8],
    mbtiles_bytes: &[u8],
) -> anyhow::Result<()> {
    let file = std::fs::File::create(path).context("création fichier .atlaspack")?;
    let mut zip = ZipWriter::new(file);

    let deflated = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    // data.bin et le mbtiles sont déjà chiffrés/binaires (peu compressibles) —
    // STORED évite du travail CPU inutile côté serveur ET côté mobile à l'extraction.
    let stored = FileOptions::default().compression_method(zip::CompressionMethod::Stored);

    zip.start_file(MANIFEST_FILE, deflated)?;
    zip.write_all(manifest_bytes)?;

    zip.start_file(SIGNATURE_FILE, stored)?;
    zip.write_all(signature)?;

    zip.start_file(DATA_FILE, stored)?;
    zip.write_all(data_bin)?;

    zip.start_file(MBTILES_FILE, stored)?;
    zip.write_all(mbtiles_bytes)?;

    zip.finish().context("finalisation archive .atlaspack")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_hash_changes_when_mission_updated_at_changes() {
        let base = chrono::Utc::now();
        let m1 = MissionRow {
            id: Uuid::new_v4(),
            code: "M1".into(),
            title: "t".into(),
            theme: "reconnaissance".into(),
            status: "planned".into(),
            start_date: None,
            end_date: None,
            maille_id: None,
            maille_label: None,
            commune: None,
            region: None,
            expected_sondages: 0,
            updated_at: base,
            assignment_id: Uuid::new_v4(),
            assignment_updated: base,
        };
        let hash1 = compute_snapshot_hash(std::slice::from_ref(&m1));
        let mut m2 = m1;
        m2.updated_at = base + chrono::Duration::seconds(1);
        let hash2 = compute_snapshot_hash(std::slice::from_ref(&m2));
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn expand_union_bbox_grows_with_margin() {
        let bboxes = vec![(0.0, 0.0, 0.1, 0.1)];
        let small = expand_union_bbox(&bboxes, 100.0);
        let large = expand_union_bbox(&bboxes, 5000.0);
        assert!(large[0] < small[0]);
        assert!(large[2] > small[2]);
    }
}
