use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use tracing;

use crate::{install_marker_path, postgres, ManagedApiPort, ManagedAtlasResources, ManagedPaths, ManagedPostgres};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
pub struct InstallerProgress {
    pub step: String,
    pub message: String,
    pub percent: u8,
}

fn list_postgres_quarantines(paths: &ManagedPaths) -> Vec<std::path::PathBuf> {
    let Ok(it) = std::fs::read_dir(&paths.data_dir) else {
        return vec![];
    };
    let mut out = vec![];
    for e in it.flatten() {
        if let Some(name) = e.file_name().to_str() {
            if name.starts_with("postgres.reset.") {
                out.push(e.path());
            }
        }
    }
    out.sort();
    out
}

fn maintenance_lock(paths: &ManagedPaths) -> Result<std::fs::File, String> {
    use fs2::FileExt;

    let locks_dir = paths.data_dir.join("locks");
    std::fs::create_dir_all(&locks_dir)
        .map_err(|e| format!("failed to create locks dir ({}): {e}", locks_dir.display()))?;
    let lock_path = locks_dir.join("maintenance.lock");
    let file = std::fs::OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .open(&lock_path)
        .map_err(|e| format!("failed to open maintenance lock ({}): {e}", lock_path.display()))?;
    file.try_lock_exclusive()
        .map_err(|_| "Une opération maintenance est déjà en cours".to_string())?;
    Ok(file)
}

#[cfg(windows)]
fn kill_postgres_from_pid_file_best_effort(data_dir: &std::path::Path) {
    let pid_file = data_dir.join("postmaster.pid");
    let Ok(content) = std::fs::read_to_string(&pid_file) else {
        return;
    };
    let Some(first) = content.lines().next() else {
        return;
    };
    let pid = first.trim();
    if pid.is_empty() {
        return;
    }
    let mut cmd = std::process::Command::new("taskkill");
    cmd.arg("/PID").arg(pid).arg("/T").arg("/F");
    if !cfg!(debug_assertions) {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let _ = cmd.status();
}

#[cfg(not(windows))]
fn kill_postgres_from_pid_file_best_effort(_data_dir: &std::path::Path) {}

fn compute_file_sha256_hex(path: &std::path::Path) -> Result<String, String> {
    use sha2::Digest;
    let bytes = std::fs::read(path)
        .map_err(|e| format!("failed to read file for sha256 ({}): {e}", path.display()))?;
    let mut h = sha2::Sha256::new();
    h.update(&bytes);
    Ok(format!("{:x}", h.finalize()))
}

#[cfg(windows)]
fn open_folder_windows(path: &std::path::Path) -> Result<(), String> {
    let mut cmd = std::process::Command::new("explorer.exe");
    cmd.arg(path);
    if !cfg!(debug_assertions) {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.spawn().map_err(|e| format!("failed to open folder ({}): {e}", path.display()))?;
    Ok(())
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct InstallerBackupArgs {
    #[serde(rename = "stopAfter")]
    pub stop_after: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct BackupReport {
    pub path: String,
    pub bytes: u64,
    #[serde(rename = "sha256")]
    pub sha256_hex: String,
    #[serde(rename = "manifestPath")]
    pub manifest_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResetReport {
    pub outcome: String,
    #[serde(rename = "dataRoot")]
    pub data_root: String,
    #[serde(rename = "markerRemoved")]
    pub marker_removed: bool,
    #[serde(rename = "quarantinePath")]
    pub quarantine_path: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CleanupQuarantinesReport {
    #[serde(rename = "deleted")]
    pub deleted: Vec<String>,
    #[serde(rename = "kept")]
    pub kept: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstallerPreflight {
    #[serde(rename = "needsReset")]
    pub needs_reset: bool,
    #[serde(rename = "hasQuarantine")]
    pub has_quarantine: bool,
    #[serde(rename = "quarantineCount")]
    pub quarantine_count: u32,
    // Expert diagnostics (non-bloquant)
    #[serde(rename = "seedPresent")]
    pub seed_present: bool,
    #[serde(rename = "seedPath")]
    pub seed_path: Option<String>,
    #[serde(rename = "seedBytes")]
    pub seed_bytes: u64,
    #[serde(rename = "seedManifestPresent")]
    pub seed_manifest_present: bool,
    #[serde(rename = "pgBinPresent")]
    pub pg_bin_present: bool,
    #[serde(rename = "pgBinDir")]
    pub pg_bin_dir: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct InstallerResetArgs {
    #[serde(rename = "alsoRemoveMarker")]
    pub also_remove_marker: bool,
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

fn postgres_dir_looks_non_empty(paths: &ManagedPaths) -> bool {
    let pg_dir = paths.data_dir.join("postgres");
    if !pg_dir.exists() {
        return false;
    }
    if let Ok(mut it) = std::fs::read_dir(&pg_dir) {
        return it.next().is_some();
    }
    false
}

fn has_postgres_quarantine(paths: &ManagedPaths) -> bool {
    let Ok(it) = std::fs::read_dir(&paths.data_dir) else {
        return false;
    };
    for e in it.flatten() {
        if let Some(name) = e.file_name().to_str() {
            if name.starts_with("postgres.reset.") {
                return true;
            }
        }
    }
    false
}

#[tauri::command]
pub fn installer_preflight(
    _app: AppHandle,
    paths: State<'_, ManagedPaths>,
    atlas_resources: State<'_, ManagedAtlasResources>,
) -> Result<InstallerPreflight, String> {
    let marker_exists = install_marker_path(&paths.data_dir).exists();
    let needs_reset = !marker_exists && postgres_dir_looks_non_empty(&paths);
    let quarantines = list_postgres_quarantines(&paths);
    let has_quarantine = !quarantines.is_empty() || has_postgres_quarantine(&paths);

    // Seed / runtime: contract-based only (ne bloque jamais l'UI)
    let (seed_path, pg_bin_path) = if let Ok(guard) = atlas_resources.0.lock() {
        if let Some(r) = guard.resources.as_ref() {
            (Some(r.seed_dump.clone()), Some(r.pg_bin_dir.clone()))
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    let seed_path = seed_path
        .or_else(|| std::env::var("ATLAS_DESKTOP_SEED_DUMP_PATH").ok().map(std::path::PathBuf::from));
    let pg_bin_path = pg_bin_path
        .or_else(|| std::env::var("ATLAS_PG_BIN_DIR").ok().map(std::path::PathBuf::from));

    let (seed_present, seed_bytes, seed_manifest_present) = match &seed_path {
        Some(p) if p.exists() => {
            let bytes = std::fs::metadata(p).map(|m| m.len()).unwrap_or(0);
            let manifest = p.with_file_name("atlas_desktop_seed.dump.json").exists();
            (true, bytes, manifest)
        }
        _ => (false, 0, false),
    };

    let pg_bin_present = match &pg_bin_path {
        Some(p) => p.join("pg_ctl.exe").exists() && p.join("initdb.exe").exists() && p.join("psql.exe").exists(),
        None => false,
    };
    Ok(InstallerPreflight {
        needs_reset,
        has_quarantine,
        quarantine_count: quarantines.len().min(u32::MAX as usize) as u32,
        seed_present,
        seed_path: seed_path.map(|p| p.to_string_lossy().to_string()),
        seed_bytes,
        seed_manifest_present,
        pg_bin_present,
        pg_bin_dir: pg_bin_path.map(|p| p.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub fn installer_reset_local_db(
    app: AppHandle,
    paths: State<'_, ManagedPaths>,
    pg_state: State<'_, ManagedPostgres>,
    args: InstallerResetArgs,
) -> Result<ResetReport, String> {
    let _lock = maintenance_lock(&paths)?;

    let warnings: Vec<String> = vec![];

    emit_progress(&app, "reset", "Arrêt PostgreSQL (si actif)…", 5);
    if let Ok(mut guard) = pg_state.0.lock() {
        if let Some(pg) = guard.as_ref() {
            let _ = postgres::stop_postgres(pg);
        }
        *guard = None;
    }

    // Best-effort kill (Windows) based on PID file if still locked.
    let data_dir = paths.data_dir.join("postgres");
    kill_postgres_from_pid_file_best_effort(&data_dir);

    emit_progress(&app, "reset", "Suppression base locale…", 35);
    let root = postgres::reset_local_postgres_data_dir().map_err(|e| e.to_string())?;
    tracing::info!(data_root = %root.display(), "installer_reset_local_db: postgres data reset");

    // Vérification post-reset (éviter boucle UI si la suppression n'a pas eu lieu)
    let pg_dir_after = root.join("postgres");
    if pg_dir_after.exists() {
        return Err(format!(
            "Réinitialisation incomplète: le dossier postgres existe encore ({})",
            pg_dir_after.display()
        ));
    }

    let quarantine_path = list_postgres_quarantines(&paths)
        .last()
        .map(|p| p.to_string_lossy().to_string());

    let mut marker_removed = false;
    if args.also_remove_marker {
        emit_progress(&app, "reset", "Réinitialisation état installateur…", 70);
        let marker = install_marker_path(&paths.data_dir);
        if marker.exists() {
            if std::fs::remove_file(&marker).is_ok() {
                marker_removed = true;
            }
        }
    }

    emit_progress(&app, "reset", "Réinitialisation terminée", 100);

    Ok(ResetReport {
        outcome: "ok".to_string(),
        data_root: root.to_string_lossy().to_string(),
        marker_removed,
        quarantine_path,
        warnings,
    })
}

#[tauri::command]
pub fn installer_backup_local_db(
    app: AppHandle,
    paths: State<'_, ManagedPaths>,
    pg_state: State<'_, ManagedPostgres>,
    args: InstallerBackupArgs,
) -> Result<BackupReport, String> {
    let _lock = maintenance_lock(&paths)?;

    if !postgres::postgres_available() {
        return Err("PostgreSQL embarqué indisponible (ATLAS_PG_BIN_DIR)".to_string());
    }

    emit_progress(&app, "backup", "Préparation sauvegarde…", 5);

    let mut started_for_backup = false;
    let port_opt = pg_state
        .0
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|h| h.port));

    let port = if let Some(p) = port_opt {
        p
    } else {
        emit_progress(&app, "backup", "Démarrage PostgreSQL (pour sauvegarde)…", 15);
        let pg = postgres::ensure_postgres_started().map_err(|e| e.to_string())?;
        started_for_backup = true;
        if let Ok(mut guard) = pg_state.0.lock() {
            *guard = Some(pg);
        }
        pg_state
            .0
            .lock()
            .ok()
            .and_then(|g| g.as_ref().map(|h| h.port))
            .unwrap_or(5432)
    };

    let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
    let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
    let db_password = postgres::ensure_password().map_err(|e| e.to_string())?;

    let backup_dir = paths.data_dir.join("backups");
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("failed to create backup dir ({}): {e}", backup_dir.display()))?;

    let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let out = backup_dir.join(format!("atlas_{db_name}_{ts}.dump"));

    emit_progress(&app, "backup", "Sauvegarde en cours (pg_dump)…", 40);

    let pg_dump = postgres::pg_tool_path("pg_dump.exe");
    let mut cmd = std::process::Command::new(&pg_dump);
    cmd.env("PGHOST", "127.0.0.1")
        .env("PGPORT", port.to_string())
        .env("PGUSER", &db_user)
        .env("PGPASSWORD", &db_password)
        .arg("-Fc")
        .arg("-f")
        .arg(&out)
        .arg(&db_name);

    #[cfg(windows)]
    if !cfg!(debug_assertions) {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let status = cmd.status().map_err(|e| format!("failed to run pg_dump: {e}"))?;
    if !status.success() {
        return Err("pg_dump failed".to_string());
    }

    let meta = std::fs::metadata(&out)
        .map_err(|e| format!("failed to read backup metadata ({}): {e}", out.display()))?;
    if meta.len() == 0 {
        return Err("Sauvegarde invalide: fichier dump vide".to_string());
    }

    let sha256_hex = compute_file_sha256_hex(&out)?;

    let manifest = serde_json::json!({
        "created_at": chrono::Utc::now().to_rfc3339(),
        "app_version": env!("CARGO_PKG_VERSION"),
        "db_name": db_name,
        "bytes": meta.len(),
        "sha256": sha256_hex,
    });
    let manifest_path = std::path::PathBuf::from(format!("{}.json", out.to_string_lossy()));
    std::fs::write(&manifest_path, serde_json::to_string_pretty(&manifest).unwrap_or_default())
        .map_err(|e| format!("failed to write backup manifest ({}): {e}", manifest_path.display()))?;

    emit_progress(&app, "backup", "Sauvegarde terminée", 90);

    if args.stop_after && started_for_backup {
        emit_progress(&app, "backup", "Arrêt PostgreSQL…", 95);
        if let Ok(mut guard) = pg_state.0.lock() {
            if let Some(pg) = guard.as_ref() {
                let _ = postgres::stop_postgres(pg);
            }
            *guard = None;
        }
    }

    emit_progress(&app, "backup", "OK", 100);
    Ok(BackupReport {
        path: out.to_string_lossy().to_string(),
        bytes: meta.len(),
        sha256_hex,
        manifest_path: manifest_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn installer_cleanup_quarantines(
    paths: State<'_, ManagedPaths>,
    keep_latest: u32,
) -> Result<CleanupQuarantinesReport, String> {
    let _lock = maintenance_lock(&paths)?;

    let mut quarantines = list_postgres_quarantines(&paths);
    quarantines.sort();
    let keep = keep_latest as usize;
    let split = quarantines.len().saturating_sub(keep);
    let (to_delete, to_keep) = quarantines.split_at(split);
    let mut deleted = vec![];
    let mut kept = vec![];
    for p in to_keep {
        kept.push(p.to_string_lossy().to_string());
    }
    for p in to_delete {
        if p.exists() {
            if std::fs::remove_dir_all(p).is_ok() {
                deleted.push(p.to_string_lossy().to_string());
            }
        }
    }
    Ok(CleanupQuarantinesReport { deleted, kept })
}

#[tauri::command]
pub fn installer_open_data_dir(paths: State<'_, ManagedPaths>) -> Result<(), String> {
    #[cfg(windows)]
    return open_folder_windows(&paths.data_dir);
    #[cfg(not(windows))]
    Err("open_data_dir not implemented on this platform".to_string())
}

#[tauri::command]
pub fn installer_open_backups_dir(paths: State<'_, ManagedPaths>) -> Result<(), String> {
    let dir = paths.data_dir.join("backups");
    #[cfg(windows)]
    return open_folder_windows(&dir);
    #[cfg(not(windows))]
    Err("open_backups_dir not implemented on this platform".to_string())
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

        #[cfg(windows)]
        {
            if !cfg!(debug_assertions) {
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }
        }

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
