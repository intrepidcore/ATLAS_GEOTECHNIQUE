use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::{install_marker_path, postgres, ManagedApiPort, ManagedPaths, ManagedPostgres};

#[derive(Debug, Clone, Serialize)]
pub struct InstallerProgress {
    pub step: String,
    pub message: String,
    pub percent: u8,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CheckFreeSpaceArgs {
    pub path: String,
    #[serde(rename = "requiredBytes")]
    pub required_bytes: u64,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct InstallerRunArgs {
    #[serde(rename = "installDb")]
    pub install_db: bool,
}

fn emit_progress(app: &AppHandle, step: &str, message: &str, percent: u8) {
    let _ = app.emit(
        "installer:progress",
        InstallerProgress {
            step: step.to_string(),
            message: message.to_string(),
            percent,
        },
    );
}

#[tauri::command]
pub fn installer_is_installed(paths: State<'_, ManagedPaths>) -> Result<bool, String> {
    let force = std::env::var("ATLAS_FORCE_INSTALLER")
        .ok()
        .map(|v| {
            let v = v.trim();
            v.eq_ignore_ascii_case("true") || v == "1" || v.eq_ignore_ascii_case("yes")
        })
        .unwrap_or(false);
    if force {
        return Ok(false);
    }
    Ok(install_marker_path(&paths.data_dir).exists())
}

#[tauri::command]
pub fn installer_check_free_space(args: CheckFreeSpaceArgs) -> Result<u64, String> {
    let p = std::path::PathBuf::from(args.path);
    let available = fs2::available_space(&p)
        .map_err(|e| format!("failed to read available disk space ({}): {e}", p.display()))?;
    if available < args.required_bytes {
        return Err(format!(
            "Espace disque insuffisant: {} bytes disponibles ({} requis)",
            available, args.required_bytes
        ));
    }
    Ok(available)
}

#[tauri::command]
pub async fn installer_run(
    app: AppHandle,
    paths: State<'_, ManagedPaths>,
    api_port: State<'_, ManagedApiPort>,
    pg_state: State<'_, ManagedPostgres>,
    args: InstallerRunArgs,
) -> Result<(), String> {
    if install_marker_path(&paths.data_dir).exists() {
        return Ok(());
    }

    emit_progress(&app, "start", "Démarrage de l'installation", 1);

    if args.install_db {
        if !postgres::postgres_available() {
            return Err("PostgreSQL embarqué indisponible (ATLAS_PG_BIN_DIR)".to_string());
        }

        emit_progress(&app, "postgres", "Démarrage PostgreSQL", 10);
        let pg = postgres::ensure_postgres_started().map_err(|e| e.to_string())?;

        emit_progress(&app, "database", "Initialisation base de données", 35);
        postgres::ensure_database_initialized(&pg).map_err(|e| e.to_string())?;

        if let Ok(mut guard) = pg_state.0.lock() {
            *guard = Some(pg);
        }

        emit_progress(&app, "backend", "Démarrage du backend", 70);

        let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
        let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
        let db_password = postgres::ensure_password().map_err(|e| e.to_string())?;
        let port = pg_state
            .0
            .lock()
            .ok()
            .and_then(|g| g.as_ref().map(|h| h.port))
            .unwrap_or(5432);

        let database_url = format!(
            "postgres://{}:{}@127.0.0.1:{}/{}",
            db_user, db_password, port, db_name
        );

        let exe = app
            .path()
            .resolve("api-geo.exe", tauri::path::BaseDirectory::Resource)
            .or_else(|_| {
                app.path().resolve(
                    "bin/api-geo-x86_64-pc-windows-msvc.exe",
                    tauri::path::BaseDirectory::Resource,
                )
            })
            .or_else(|_| {
                app.path()
                    .resolve("bin/api-geo.exe", tauri::path::BaseDirectory::Resource)
            })
            .map_err(|e| format!("failed to resolve api-geo path: {e}"))?;

        let mut cmd = std::process::Command::new(exe);
        cmd.env("API_GEO_PORT", api_port.0.to_string());
        cmd.env("ATLAS_DATA_DIR", paths.data_dir.to_string_lossy().to_string());
        cmd.env("ATLAS_DESKTOP", "1");
        cmd.env("ENABLE_DB_MANAGER", "1");
        cmd.env_remove("DATABASE_URL");
        cmd.env("DATABASE_URL", &database_url);
        cmd.env("DATABASE_URL_ADMIN", &database_url);

        let _ = cmd.spawn().map_err(|e| format!("failed to start backend: {e}"))?;

        emit_progress(&app, "backend", "Backend démarré", 85);
    }

    emit_progress(&app, "finalize", "Finalisation", 95);

    let marker = install_marker_path(&paths.data_dir);
    if let Some(parent) = marker.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create install dir ({}): {e}", parent.display()))?;
    }
    std::fs::write(&marker, b"installed\n")
        .map_err(|e| format!("failed to write marker ({}): {e}", marker.display()))?;

    emit_progress(&app, "done", "Installation terminée", 100);

    Ok(())
}
