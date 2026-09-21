//! Configuration centralisée du système `.atlaspack`.
//!
//! Toutes les valeurs métier ont un défaut sûr mais sont surchageables par
//! variable d'environnement — rien n'est codé en dur dans la logique de
//! génération elle-même (`builder.rs`, `offline_tiles.rs`).

use std::path::PathBuf;
use std::sync::Arc;

use super::crypto::AtlasPackSigningKeypair;

#[derive(Debug, Clone)]
pub struct AtlasPackConfig {
    /// Durée de validité d'un paquet fraîchement généré.
    pub expiry_days: i64,
    /// Marge géographique (mètres) ajoutée autour de l'enveloppe des missions
    /// de l'opérateur avant de découper les tuiles hors-ligne.
    pub map_margin_m: f64,
    pub tile_zoom_min: u8,
    pub tile_zoom_max: u8,
    /// Garde-fou : nombre maximal de tuiles embarquées par paquet. Si
    /// dépassé, le zoom max est réduit automatiquement (jamais silencieux :
    /// `manifest.map_coverage.truncated` + `truncation_reason` tracent la
    /// décision).
    pub tile_max_count: u32,
    pub tile_url_template: String,
    pub tile_user_agent: String,
    pub tile_request_delay_ms: u64,
    /// Répertoire de stockage des paquets générés (montage docker persistant).
    pub storage_dir: PathBuf,
    /// Taille max en octets d'une pièce jointe individuelle embarquée dans un
    /// `.atlasreturn` réimporté.
    pub max_attachment_size_bytes: u64,
}

impl AtlasPackConfig {
    pub fn from_env() -> Self {
        Self {
            expiry_days: env_i64("ATLASPACK_EXPIRY_DAYS", 30),
            map_margin_m: env_f64("ATLASPACK_MAP_MARGIN_M", 800.0),
            tile_zoom_min: env_u8("ATLASPACK_TILE_ZOOM_MIN", 12),
            tile_zoom_max: env_u8("ATLASPACK_TILE_ZOOM_MAX", 17),
            tile_max_count: env_u32("ATLASPACK_TILE_MAX_COUNT", 15_000),
            tile_url_template: std::env::var("ATLASPACK_TILE_URL_TEMPLATE")
                .unwrap_or_else(|_| "https://tile.openstreetmap.org/{z}/{x}/{y}.png".to_string()),
            tile_user_agent: std::env::var("ATLASPACK_TILE_USER_AGENT").unwrap_or_else(|_| {
                "AtlasTerrain-PackageBuilder/1.0 (contact: contact@intrepidcore.example)"
                    .to_string()
            }),
            tile_request_delay_ms: env_u64("ATLASPACK_TILE_REQUEST_DELAY_MS", 250),
            storage_dir: std::env::var("ATLASPACK_STORAGE_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("./data/atlaspack")),
            max_attachment_size_bytes: env_u64(
                "ATLASPACK_MAX_ATTACHMENT_SIZE_BYTES",
                8 * 1024 * 1024,
            ),
        }
    }
}

fn env_i64(key: &str, default: i64) -> i64 {
    std::env::var(key).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}
fn env_f64(key: &str, default: f64) -> f64 {
    std::env::var(key).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}
fn env_u8(key: &str, default: u8) -> u8 {
    std::env::var(key).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}
fn env_u32(key: &str, default: u32) -> u32 {
    std::env::var(key).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}
fn env_u64(key: &str, default: u64) -> u64 {
    std::env::var(key).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}

/// État partagé .atlaspack ajouté à `AppState` : config + trousseau de
/// signature, chargés une fois au démarrage.
#[derive(Clone)]
pub struct AtlasPackState {
    pub config: Arc<AtlasPackConfig>,
    pub signing_key: Arc<AtlasPackSigningKeypair>,
}
