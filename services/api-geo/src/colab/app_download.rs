//! Distribution publique de l'APK Atlas Terrain.
//!
//! Contrairement aux routes `atlaspack::routes` (réservées au personnel —
//! l'opérateur n'a par définition pas encore de session avant d'avoir
//! installé l'app), cette route est volontairement PUBLIQUE : c'est le tout
//! premier contact d'un opérateur avec le système, avant toute authentification
//! possible. Le fichier lui-même ne contient aucune donnée d'opérateur — c'est
//! le binaire de l'application, identique pour tout le monde.
//!
//! Chemin du binaire configuré via `ATLAS_TERRAIN_APK_PATH`. Si absent, la
//! route répond 404 plutôt que de paniquer au démarrage — la distribution de
//! l'app n'est pas un prérequis pour que le reste de l'API fonctionne.

use axum::{
    body::Bytes,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde_json::json;
use sha2::{Digest, Sha256};

use crate::state::AppState;

fn apk_path() -> Option<std::path::PathBuf> {
    std::env::var("ATLAS_TERRAIN_APK_PATH")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .map(std::path::PathBuf::from)
}

/// Lit le binaire et calcule son SHA-256. Pas de cache : ce n'est pas un
/// chemin chaud (téléchargement manuel + un envoi email par job), et un
/// cache périmé après remplacement de l'APK serait pire qu'une relecture
/// disque de quelques dizaines de ms.
pub fn read_apk() -> anyhow::Result<(Vec<u8>, String)> {
    let path = apk_path().ok_or_else(|| {
        anyhow::anyhow!("ATLAS_TERRAIN_APK_PATH non défini — distribution APK désactivée")
    })?;
    let bytes = std::fs::read(&path)
        .map_err(|e| anyhow::anyhow!("lecture APK impossible ({}): {e}", path.display()))?;
    let sha256 = format!("{:x}", Sha256::digest(&bytes));
    Ok((bytes, sha256))
}

async fn download_apk() -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let (bytes, _sha256) = read_apk().map_err(|e| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": e.to_string()})),
        )
    })?;
    Ok((
        StatusCode::OK,
        [
            (
                header::CONTENT_TYPE,
                "application/vnd.android.package-archive".to_string(),
            ),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=\"AtlasTerrain.apk\"".to_string(),
            ),
        ],
        Bytes::from(bytes),
    )
        .into_response())
}

async fn apk_info() -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let (bytes, sha256) = read_apk().map_err(|e| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": e.to_string()})),
        )
    })?;
    Ok(Json(json!({
        "sha256": sha256,
        "size_bytes": bytes.len(),
    })))
}

pub fn app_download_routes() -> Router<AppState> {
    Router::new()
        .route("/colab/app/latest", get(download_apk))
        .route("/colab/app/latest/info", get(apk_info))
}
