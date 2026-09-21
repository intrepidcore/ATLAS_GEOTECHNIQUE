//! Format `.atlaspack` / `.atlasreturn` — structures sérialisées, versionnées.
//!
//! Un `.atlaspack` est une archive ZIP contenant :
//!   - `manifest.json`   (clair, signé)
//!   - `manifest.sig`    (signature Ed25519 détachée de `manifest.json`)
//!   - `data.bin`        (JSON chiffré ChaCha20-Poly1305 : identité + missions)
//!   - `maps/offline.mbtiles` (optionnel, tuiles hors-ligne, non chiffré)
//!
//! `manifest.json` est un struct Rust à champs fixes : sa sérialisation JSON
//! est déterministe par construction (ordre des champs = ordre de
//! déclaration), donc `sha256(manifest.json bytes)` est stable — pas besoin
//! de tri de clés artificiel, sauf pour la map `files` (BTreeMap, déjà triée).

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Version du conteneur .atlaspack lui-même (structure de l'archive).
pub const FORMAT_VERSION: i32 = 1;
/// Version du schéma des données métier contenues dans `data.bin`.
pub const SCHEMA_VERSION: i32 = 1;

pub const MANIFEST_FILE: &str = "manifest.json";
pub const SIGNATURE_FILE: &str = "manifest.sig";
pub const DATA_FILE: &str = "data.bin";
pub const MBTILES_FILE: &str = "maps/offline.mbtiles";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub sha256: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapCoverage {
    pub zoom_min: i32,
    pub zoom_max_requested: i32,
    pub zoom_max_actual: i32,
    pub tile_count: i64,
    pub truncated: bool,
    pub truncation_reason: Option<String>,
    pub bounds: [f64; 4], // [min_lon, min_lat, max_lon, max_lat]
}

/// Contenu de `manifest.json`. Signé dans son intégralité : toute
/// modification d'un octet invalide la signature.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageManifest {
    pub format_version: i32,
    pub schema_version: i32,
    pub package_id: Uuid,
    pub operator_user_id: Uuid,
    pub operator_email: String,
    /// RFC 3339
    pub generated_at: String,
    /// RFC 3339 — le mobile refuse tout import après cette date
    pub expires_at: String,
    pub signing_key_id: String,
    pub mission_ids: Vec<Uuid>,
    pub password_hash_algorithm: String,
    /// Salt + params Argon2id extraits du PHC string (dupliqués ici en clair
    /// pour que le mobile puisse dériver la clé de déchiffrement de `data.bin`
    /// AVANT de déchiffrer — ce ne sont pas des secrets : le salt et les
    /// coûts Argon2id ne compromettent rien sans le mot de passe réel).
    pub password_salt_b64: String,
    pub password_argon2_m_cost: u32,
    pub password_argon2_t_cost: u32,
    pub password_argon2_p_cost: u32,
    pub password_hash_len: u32,
    pub files: BTreeMap<String, FileEntry>,
    pub map_coverage: Option<MapCoverage>,
}

impl PackageManifest {
    /// Sérialisation canonique utilisée à la fois pour signer et pour
    /// vérifier — DOIT être strictement identique des deux côtés.
    pub fn canonical_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).expect("PackageManifest est toujours sérialisable")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperatorIdentity {
    pub user_id: Uuid,
    pub student_id: Option<Uuid>,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    /// Chaîne PHC Argon2id complète, copiée telle quelle depuis
    /// `atlas.users.password_hash`. Le backend n'a jamais accès au mot de
    /// passe en clair, seulement à ce hash — c'est ce même hash que le
    /// mobile revérifie hors-ligne.
    pub password_hash_phc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackedPlannedPoint {
    pub id: Uuid,
    pub numero: i32,
    pub label: Option<String>,
    pub lat: f64,
    pub lon: f64,
    pub confirmed_sondage_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackedSondageMarker {
    pub id: Uuid,
    pub code: Option<String>,
    pub longitude: f64,
    pub latitude: f64,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackedMission {
    pub id: Uuid,
    pub code: String,
    pub title: String,
    pub theme: String,
    pub status: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub maille_id: Option<Uuid>,
    pub maille_label: Option<String>,
    pub commune: Option<String>,
    pub region: Option<String>,
    pub expected_sondages: i32,
    pub maille_geojson: Option<serde_json::Value>,
    /// [min_lon, min_lat, max_lon, max_lat] WGS84
    pub bbox: Option<[f64; 4]>,
    pub center_lon: Option<f64>,
    pub center_lat: Option<f64>,
    pub tolerance_m: i32,
    pub planned_points: Vec<PackedPlannedPoint>,
    pub existing_sondages: Vec<PackedSondageMarker>,
}

/// Contenu déchiffré de `data.bin`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperatorPayload {
    pub schema_version: i32,
    pub operator: OperatorIdentity,
    pub missions: Vec<PackedMission>,
    pub default_tolerance_m: i32,
}

// ============================================================================
// .atlasreturn — export terrain réimporté au bureau
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReturnManifest {
    pub format_version: i32,
    pub export_id: Uuid,
    pub package_id: Option<Uuid>,
    pub operator_user_id: Uuid,
    pub operator_email: String,
    pub generated_at: String,
    pub missions_count: i32,
    pub sondages_count: i32,
    pub essais_count: i32,
    pub resultats_count: i32,
    pub attachments_count: i32,
    pub size_bytes: u64,
    pub sha256: String,
    pub files: BTreeMap<String, FileEntry>,
}

impl ReturnManifest {
    /// Octets signés par le HMAC (stocké séparément dans l'archive, fichier
    /// `manifest.mac`) — le manifeste tel quel, sous peine de circularité.
    pub fn canonical_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).expect("ReturnManifest est toujours sérialisable")
    }

    /// `sha256` "racine" = sha256 de la concaténation triée des empreintes
    /// individuelles de `files` — recalculé et comparé au champ `sha256` du
    /// manifeste pour détecter une incohérence interne (ex: `files` modifié
    /// sans mettre à jour `sha256`), en plus de la vérification HMAC globale.
    pub fn compute_root_hash(&self) -> String {
        use sha2::Digest;
        let mut hashes: Vec<&str> = self.files.values().map(|f| f.sha256.as_str()).collect();
        hashes.sort_unstable();
        let joined = hashes.concat();
        let mut h = sha2::Sha256::new();
        h.update(joined.as_bytes());
        format!("{:x}", h.finalize())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReturnedSondage {
    pub id: Uuid,
    pub mission_id: Uuid,
    pub planned_point_id: Option<Uuid>,
    pub code: String,
    pub longitude: f64,
    pub latitude: f64,
    pub location_accuracy_m: Option<f32>,
    pub depth_m: Option<f64>,
    pub layers_count: Option<i32>,
    pub profile_description: Option<String>,
    pub notes: Option<String>,
    pub point_name: Option<String>,
    pub relocation_reason: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReturnedLabResult {
    pub id: Uuid,
    pub mission_id: Uuid,
    pub sondage_id: Uuid,
    pub sample_code: String,
    pub depth_top_m: f64,
    pub depth_bottom_m: f64,
    pub sample: serde_json::Value,
    pub tests: serde_json::Value,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReturnedFieldLog {
    pub id: Uuid,
    pub mission_id: Uuid,
    pub log_type: String,
    pub content: String,
    pub longitude: Option<f64>,
    pub latitude: Option<f64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReturnedAttachment {
    pub id: Uuid,
    pub sondage_id: Uuid,
    pub mission_id: Option<Uuid>,
    pub kind: String,
    pub file_name: String,
    pub content_type: String,
    pub caption: Option<String>,
    pub taken_at: Option<String>,
    /// Chemin de l'entrée binaire dans l'archive .atlasreturn (attachments/<id>.<ext>)
    pub archive_path: String,
    pub sha256: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReturnedAuditEvent {
    pub id: Uuid,
    pub mission_id: Option<Uuid>,
    pub event_type: String,
    pub occurred_at: String,
    pub object_type: Option<String>,
    pub object_id: Option<String>,
    pub old_values: Option<serde_json::Value>,
    pub new_values: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReturnData {
    pub schema_version: i32,
    pub sondages: Vec<ReturnedSondage>,
    pub lab_results: Vec<ReturnedLabResult>,
    pub field_logs: Vec<ReturnedFieldLog>,
    pub attachments: Vec<ReturnedAttachment>,
    pub audit_events: Vec<ReturnedAuditEvent>,
}
