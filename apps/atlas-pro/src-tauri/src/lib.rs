// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;
use tauri::Emitter;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::prelude::*;
use fs2::FileExt;
use std::io::Write;
use anyhow::Context;
use std::time::{Duration, Instant};

mod postgres;
mod support;
mod sync;
mod installer;

#[derive(Debug, Clone)]
struct AtlasResources {
    resource_dir: std::path::PathBuf,
    pg_bin_dir: std::path::PathBuf,
    seed_dump: std::path::PathBuf,
}

#[derive(Debug)]
struct ManagedAtlasResources(std::sync::Mutex<ManagedAtlasResourcesInner>);

#[derive(Debug)]
struct ManagedAtlasResourcesInner {
    resources: Option<AtlasResources>,
    error: Option<String>,
}

impl AtlasResources {
    fn resolve(app: &tauri::App) -> Result<Self, String> {
        let resource_dir = app
            .path()
            .resource_dir()
            .map_err(|e| format!("resource_dir() failed: {e}"))?;

        tracing::info!(resource_dir = %resource_dir.display(), "atlas resources: resource_dir");

        let candidates = [resource_dir.clone(), resource_dir.join("resources")];

        let mut selected_base: Option<std::path::PathBuf> = None;
        let mut selected_pg_bin_dir: Option<std::path::PathBuf> = None;
        let mut selected_seed_dump: Option<std::path::PathBuf> = None;

        for base in candidates.iter() {
            let pg_bin_dir = base.join("pg").join("bin");
            let seed_dump = base.join("atlas_desktop_seed.dump");
            if pg_bin_dir.join("pg_ctl.exe").exists() && seed_dump.exists() {
                selected_base = Some(base.clone());
                selected_pg_bin_dir = Some(pg_bin_dir);
                selected_seed_dump = Some(seed_dump);
                break;
            }
        }

        if selected_pg_bin_dir.is_none() {
            Self::log_resource_tree(&resource_dir);
            let tested: Vec<String> = candidates
                .iter()
                .map(|b| b.join("pg").join("bin").display().to_string())
                .collect();
            return Err(format!(
                "pg_ctl.exe introuvable (bundle MSI incomplet). Chemins testés: {}",
                tested.join(" ; ")
            ));
        }

        if selected_seed_dump.is_none() {
            Self::log_resource_tree(&resource_dir);
            let tested: Vec<String> = candidates
                .iter()
                .map(|b| b.join("atlas_desktop_seed.dump").display().to_string())
                .collect();
            return Err(format!(
                "atlas_desktop_seed.dump introuvable (bundle MSI incomplet). Chemins testés: {}",
                tested.join(" ; ")
            ));
        }

        let resource_dir = selected_base.unwrap_or(resource_dir);
        Ok(Self {
            resource_dir,
            pg_bin_dir: selected_pg_bin_dir.expect("pg bin already checked"),
            seed_dump: selected_seed_dump.expect("seed already checked"),
        })
    }

    fn log_resource_tree(dir: &std::path::Path) {
        tracing::warn!(resource_dir = %dir.display(), "=== CONTENU RESOURCE_DIR (diagnostic) ===");
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                tracing::warn!(path = %p.display(), "resource_dir entry");
                if p.is_dir() {
                    if let Ok(sub) = std::fs::read_dir(&p) {
                        for sub_entry in sub.flatten() {
                            let sp = sub_entry.path();
                            tracing::warn!(path = %sp.display(), "resource_dir entry (depth=1)");
                        }
                    }
                }
            }
        }
    }
}

struct ManagedPostgres(std::sync::Mutex<Option<postgres::PostgresHandle>>);
#[allow(dead_code)]
struct ManagedAppLock(std::fs::File);
struct ManagedApiPort(u16);
struct ManagedPaths {
    data_dir: std::path::PathBuf,
    logs_dir: std::path::PathBuf,
}

fn resolve_data_dir() -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
    if let Ok(p) = std::env::var("ATLAS_DATA_DIR") {
        let p = p.trim();
        if !p.is_empty() {
            return Ok(std::path::PathBuf::from(p));
        }
    }
    let base = std::env::var("LOCALAPPDATA")
        .or_else(|_| std::env::var("APPDATA"))
        .map_err(|_| "LOCALAPPDATA/APPDATA not found")?;
    Ok(std::path::PathBuf::from(base).join("IntrepidCore").join("Atlas"))
}

fn smoke_cleanup(data_dir: &std::path::Path, pg: Option<postgres::PostgresHandle>) {
    if let Some(pg) = pg {
        let _ = postgres::stop_postgres(&pg);
    }
    if let Ok(root) = std::env::temp_dir().canonicalize() {
        if let Ok(p) = data_dir.canonicalize() {
            if p.starts_with(&root) {
                let _ = std::fs::remove_dir_all(&p);
            }
        }
    }
}

fn smoke_exit_code_for_error(e: &anyhow::Error) -> i32 {
    if let Some(m) = e.downcast_ref::<postgres::SeedMismatch>() {
        match m {
            postgres::SeedMismatch::IntegrityViolation { .. } => 10,
            postgres::SeedMismatch::InvariantViolation { .. } => 20,
            postgres::SeedMismatch::SchemaMismatch { .. } => 30,
        }
    } else {
        99
    }
}

fn ensure_smoke_test_isolation() {
    if !is_smoke_test_mode() {
        return;
    }

    // Do not override explicit settings.
    if std::env::var("ATLAS_DATA_DIR").is_err() {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let pid = std::process::id();
        let dir = std::env::temp_dir().join(format!("atlas-smoke-{ts}-{pid}"));
        std::env::set_var("ATLAS_DATA_DIR", dir.to_string_lossy().to_string());
    }

    if std::env::var("DB_NAME").is_err() {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let pid = std::process::id();
        std::env::set_var("DB_NAME", format!("atlas_smoke_{ts}_{pid}"));
    }
}

fn is_smoke_test_mode() -> bool {
    std::env::var("ATLAS_SMOKE_TEST")
        .ok()
        .map(|v| {
            let v = v.trim();
            v.eq_ignore_ascii_case("true") || v == "1" || v.eq_ignore_ascii_case("yes")
        })
        .unwrap_or(false)
}

fn smoke_check_healthz(api_port: u16) -> Result<(), anyhow::Error> {
    let url = format!("http://127.0.0.1:{api_port}/healthz");
    tauri::async_runtime::block_on(async move {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(8))
            .build()
            .context("failed to build reqwest client")?;
        let res = client
            .get(&url)
            .send()
            .await
            .context("healthz request failed")?;
        if !res.status().is_success() {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            anyhow::bail!("healthz failed (status={}): {}", status, body);
        }
        Ok(())
    })
}

fn smoke_check_db_mailles_count(pg_port: u16) -> Result<(), anyhow::Error> {
    let bin_dir = postgres::pg_tool_path("psql.exe")
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| anyhow::anyhow!("psql.exe path invalid"))?;

    let path_env = {
        let current = std::env::var("PATH").unwrap_or_default();
        format!("{};{}", bin_dir.display(), current)
    };

    let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
    let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
    let db_password = postgres::ensure_password().context("ensure_password failed")?;

    let expected: i64 = std::env::var("ATLAS_SMOKE_EXPECT_MAILLES")
        .ok()
        .and_then(|v| v.trim().parse::<i64>().ok())
        .unwrap_or(29407);

    let out = std::process::Command::new("psql.exe")
        .current_dir(&bin_dir)
        .env("PATH", path_env)
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", pg_port.to_string())
        .env("PGUSER", &db_user)
        .env("PGPASSWORD", &db_password)
        .env("PGDATABASE", &db_name)
        .env("PAGER", "")
        .env("PSQL_PAGER", "")
        .arg("-v")
        .arg("ON_ERROR_STOP=1")
        .arg("-tAc")
        .arg("SELECT COUNT(*) FROM atlas.mailles;")
        .output()
        .context("failed to run psql count atlas.mailles")?;

    if !out.status.success() {
        anyhow::bail!(
            "psql mailles count failed (exit={}): {}",
            out.status,
            String::from_utf8_lossy(&out.stderr)
        );
    }

    let got_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let got = got_str
        .parse::<i64>()
        .with_context(|| format!("failed to parse mailles count: '{got_str}'"))?;

    if got != expected {
        anyhow::bail!("mailles_count_mismatch expected={expected} got={got}");
    }
    Ok(())
}

#[derive(Clone, serde::Serialize)]
struct StartupProgress {
    step: String,
    message: String,
    percent: u8,
}

fn emit_startup_progress_handle(handle: &tauri::AppHandle, step: &str, message: &str, percent: u8) {
    let payload = StartupProgress {
        step: step.to_string(),
        message: message.to_string(),
        percent,
    };
    let _ = handle.emit("startup:progress", payload);
}

fn emit_startup_progress(app: &tauri::App, step: &str, message: &str, percent: u8) {
    let payload = StartupProgress {
        step: step.to_string(),
        message: message.to_string(),
        percent,
    };

    // Important: during early `setup()`, the splash window may not be ready yet.
    // We broadcast to all existing windows to make delivery robust.
    for w in app.webview_windows().values() {
        let _ = w.emit("startup:progress", payload.clone());
    }

    // Best-effort direct emit for older runtimes / safety.
    if let Some(w) = app.get_webview_window("splash") {
        let _ = w.emit("startup:progress", payload);
    }
}

fn emit_startup_error(app: &tauri::App, message: &str) {
    let payload = serde_json::json!({ "message": message });
    for w in app.webview_windows().values() {
        let _ = w.emit("startup:error", payload.clone());
    }
    if let Some(w) = app.get_webview_window("splash") {
        let _ = w.emit("startup:error", payload);
    }
}

fn install_marker_path(data_dir: &std::path::Path) -> std::path::PathBuf {
    data_dir.join("install").join("installed.marker")
}

fn is_installed(data_dir: &std::path::Path) -> bool {
    install_marker_path(data_dir).exists()
}

fn force_installer_mode() -> bool {
    std::env::var("ATLAS_FORCE_INSTALLER")
        .ok()
        .map(|v| {
            let v = v.trim();
            v.eq_ignore_ascii_case("true") || v == "1" || v.eq_ignore_ascii_case("yes")
        })
        .unwrap_or(false)
}

fn port_is_free(port: u16) -> bool {
    std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
}

fn select_api_port() -> u16 {
    if let Ok(v) = std::env::var("ATLAS_API_PORT") {
        if let Ok(p) = v.trim().parse::<u16>() {
            return p;
        }
    }

    // Prefer 8001 (standard Atlas API port), fallback to a small range to avoid collisions.
    if port_is_free(8001) {
        return 8001;
    }
    for p in 8002..8100 {
        if port_is_free(p) {
            return p;
        }
    }

    // Last resort for legacy setups.
    8000
}

fn acquire_single_instance_lock(data_dir: &std::path::Path) -> Result<std::fs::File, Box<dyn std::error::Error>> {
    std::fs::create_dir_all(data_dir).map_err(|e| format!("failed to create data dir ({}): {e}", data_dir.display()))?;
    let lock_path = data_dir.join("locks").join("atlas-desktop.instance.lock");
    if let Some(parent) = lock_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create lock dir ({}): {e}", parent.display()))?;
    }
    let file = std::fs::OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .open(&lock_path)
        .map_err(|e| format!("failed to open instance lock ({}): {e}", lock_path.display()))?;
    let timeout = Duration::from_secs(3);
    let deadline = Instant::now() + timeout;
    loop {
        match file.try_lock_exclusive() {
            Ok(()) => {
                tracing::info!(lock_path = %lock_path.display(), "single-instance lock acquired");
                break;
            }
            Err(e) => {
                if Instant::now() >= deadline {
                    return Err(format!(
                        "Atlas Desktop is already running or lock is busy ({}): {e}",
                        lock_path.display()
                    )
                    .into());
                }
                std::thread::sleep(Duration::from_millis(100));
            }
        }
    }
    Ok(file)
}

fn rotate_log_file(path: &std::path::Path, max_bytes: u64, max_files: usize) {
    let Ok(meta) = std::fs::metadata(path) else { return; };
    if meta.len() < max_bytes {
        return;
    }

    // Rotation simple: api-geo.log -> api-geo.log.1 ... -> api-geo.log.N
    let base_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("log");
    for i in (1..=max_files).rev() {
        let src = if i == 1 {
            path.to_path_buf()
        } else {
            path.with_file_name(format!("{base_name}.{}", i - 1))
        };
        let dst = path.with_file_name(format!("{base_name}.{i}"));
        if src.exists() {
            let _ = std::fs::remove_file(&dst);
            let _ = std::fs::rename(&src, &dst);
        }
    }
}

#[cfg(windows)]
fn harden_windows_permissions(data_dir: &std::path::Path, logs_dir: &std::path::Path) {
    let Ok(user) = std::env::var("USERNAME") else { return; };

    // Best-effort : ne bloque jamais le boot.
    // Objectif: réduire l'héritage et garantir que seul l'utilisateur courant a accès.
    // Remarque: sur certains environnements (GPO), icacls peut être restreint.
    for p in [data_dir, logs_dir, &data_dir.join("postgres")] {
        let _ = std::process::Command::new("icacls")
            .arg(p)
            .arg("/inheritance:r")
            .arg("/grant:r")
            .arg(format!("{user}:(OI)(CI)F"))
            .status();
    }
}

#[cfg(not(windows))]
fn harden_windows_permissions(_data_dir: &std::path::Path, _logs_dir: &std::path::Path) {}

fn init_tauri_logging(logs_dir: &std::path::Path) {
    static INIT: std::sync::Once = std::sync::Once::new();
    static GUARD: std::sync::OnceLock<WorkerGuard> = std::sync::OnceLock::new();
    INIT.call_once(|| {
        let _ = std::fs::create_dir_all(logs_dir);
        let file_appender = tracing_appender::rolling::daily(logs_dir, "tauri.log");
        let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
        let _ = GUARD.set(guard);

        let _ = tracing_subscriber::registry()
            .with(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
            )
            .with(tracing_subscriber::fmt::layer().with_writer(non_blocking))
            .try_init();
    });
}

fn append_fatal_log(logs_dir: &std::path::Path, msg: &str) {
    let path = logs_dir.join("tauri-fatal.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(f, "{msg}");
    }
}

fn show_installer_for_repair(app: &tauri::App, reason: &str) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
        let _ = main.eval(
            "try { if (window.location.pathname !== '/installer.html') window.location.replace('/installer.html'); } catch {}",
        );
    }
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.eval(&format!(
            "try {{ window.__ATLAS_STARTUP_FATAL__ = {}; }} catch {{}}",
            serde_json::to_string(reason).unwrap_or_else(|_| "\"Erreur\"".to_string())
        ));
        let _ = splash.close();
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .setup(|app| {
            app.manage(ManagedPostgres(std::sync::Mutex::new(None)));
            app.manage(ManagedAtlasResources(std::sync::Mutex::new(
                ManagedAtlasResourcesInner {
                    resources: None,
                    error: None,
                },
            )));

            ensure_smoke_test_isolation();

            let api_port: u16 = select_api_port();
            app.manage(ManagedApiPort(api_port));
            let data_dir = resolve_data_dir()?;

            let logs_dir = data_dir.join("logs");
            init_tauri_logging(&logs_dir);

            append_fatal_log(&logs_dir, "startup: begin");

            emit_startup_progress(app, "init", "Initialisation…", 5);

            tracing::info!("setup: before create data/log dirs");
            append_fatal_log(&logs_dir, "setup: before create data/log dirs");
            std::fs::create_dir_all(&data_dir)
                .map_err(|e| format!("failed to create data dir ({}): {e}", data_dir.display()))?;
            std::fs::create_dir_all(&logs_dir)
                .map_err(|e| format!("failed to create logs dir ({}): {e}", logs_dir.display()))?;
            tracing::info!("setup: after create data/log dirs");
            append_fatal_log(&logs_dir, "setup: after create data/log dirs");

            tracing::info!("setup: before harden_windows_permissions");
            harden_windows_permissions(&data_dir, &logs_dir);
            tracing::info!("setup: after harden_windows_permissions");

            // Logs postgres (rotation avant start)
            let postgres_log = logs_dir.join("postgres.log");
            rotate_log_file(&postgres_log, 50 * 1024 * 1024, 5);

            app.manage(ManagedPaths {
                data_dir: data_dir.clone(),
                logs_dir: logs_dir.clone(),
            });

            // Single-instance: lock global conservé en state
            tracing::info!("setup: before single-instance lock");
            append_fatal_log(&logs_dir, "setup: before single-instance lock");
            let app_lock = match acquire_single_instance_lock(&data_dir) {
                Ok(lock) => lock,
                Err(e) => {
                    let msg = format!("Single-instance lock unavailable: {e}");
                    tracing::warn!("{msg}");
                    append_fatal_log(&logs_dir, &msg);
                    emit_startup_error(app, "Atlas Desktop est déjà ouvert (ou verrou occupé). Fermez l'autre instance puis réessayez.");
                    show_installer_for_repair(
                        app,
                        "Atlas Desktop est deja ouvert (ou verrou occupé). Fermez l'autre instance puis relancez.",
                    );
                    return Ok(());
                }
            };
            tracing::info!("setup: after single-instance lock");
            append_fatal_log(&logs_dir, "setup: after single-instance lock");
            app.manage(ManagedAppLock(app_lock));

            // Contrat de packaging: résolution unique au startup
            tracing::info!("setup: before AtlasResources::resolve");
            let resolved = AtlasResources::resolve(app);
            match resolved {
                Ok(r) => {
                    if std::env::var("ATLAS_PG_BIN_DIR").is_err() {
                        std::env::set_var("ATLAS_PG_BIN_DIR", r.pg_bin_dir.to_string_lossy().to_string());
                    }
                    if std::env::var("ATLAS_DESKTOP_SEED_DUMP_PATH").is_err() {
                        std::env::set_var(
                            "ATLAS_DESKTOP_SEED_DUMP_PATH",
                            r.seed_dump.to_string_lossy().to_string(),
                        );
                    }
                    if std::env::var("ATLAS_DESKTOP_SEED_DIR").is_err() {
                        std::env::set_var(
                            "ATLAS_DESKTOP_SEED_DIR",
                            r.resource_dir.to_string_lossy().to_string(),
                        );
                    }

                    if let Ok(mut guard) = app.state::<ManagedAtlasResources>().0.lock() {
                        guard.resources = Some(r);
                        guard.error = None;
                    }
                }
                Err(e) => {
                    tracing::error!("atlas resources resolve failed: {}", e);
                    if let Ok(mut guard) = app.state::<ManagedAtlasResources>().0.lock() {
                        guard.resources = None;
                        guard.error = Some(e);
                    }
                }
            }
            tracing::info!("setup: after AtlasResources::resolve");

            let pg_bin_dir = std::env::var("ATLAS_PG_BIN_DIR").unwrap_or_default();
            let seed_dir = std::env::var("ATLAS_DESKTOP_SEED_DIR").unwrap_or_default();
            let resource_dir = app
                .path()
                .resource_dir()
                .ok()
                .map(|p| p.display().to_string())
                .unwrap_or_default();
            tracing::info!(
                data_dir = %data_dir.display(),
                logs_dir = %logs_dir.display(),
                resource_dir = %resource_dir,
                pg_bin_dir = %pg_bin_dir,
                seed_dir = %seed_dir,
                "startup"
            );

            if !pg_bin_dir.is_empty() {
                let bin = std::path::PathBuf::from(&pg_bin_dir);
                tracing::info!(
                    pg_ctl = %bin.join("pg_ctl.exe").exists(),
                    initdb = %bin.join("initdb.exe").exists(),
                    psql = %bin.join("psql.exe").exists(),
                    pg_restore = %bin.join("pg_restore.exe").exists(),
                    "startup: pg tool existence"
                );
            }
            if !seed_dir.is_empty() {
                let base = std::path::PathBuf::from(&seed_dir);
                let seed = base.join("atlas_desktop_seed.dump");
                let manifest = base.join("atlas_desktop_seed.dump.json");
                tracing::info!(
                    seed = %seed.exists(),
                    manifest = %manifest.exists(),
                    seed_bytes = %seed.metadata().map(|m| m.len()).unwrap_or(0),
                    "startup: seed existence"
                );
            }

            emit_startup_progress(app, "paths", "Résolution runtime PostgreSQL / seed", 12);

            // Installer mode: allow forcing the installer UI without starting services.
            // IMPORTANT: In production we must be robust even if installed.marker is missing
            // (e.g. partial cleanup, roaming profiles, or installer wizard not completed).
            // Therefore we only skip bootstrap when explicitly forced.
            // EXCEPTION: smoke-test mode must always run the bootstrap and exit 0/1.
            if !is_smoke_test_mode() && force_installer_mode() {
                tracing::info!("Installer mode: skipping postgres/api bootstrap (forced)");
                emit_startup_progress(app, "installer", "Installateur requis", 100);
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.set_focus();
                    let _ = main.eval(
                        "try { if (window.location.pathname !== '/installer.html') window.location.replace('/installer.html'); } catch {}",
                    );
                }
                if let Some(splash) = app.get_webview_window("splash") {
                    let _ = splash.close();
                }
                return Ok(());
            }

            if !is_smoke_test_mode() && !is_installed(&data_dir) {
                tracing::warn!(
                    marker = %install_marker_path(&data_dir).display(),
                    "installed.marker missing: continuing bootstrap for robustness"
                );
            }

            // Postgres embarqué (dev: détection auto; prod: resources Tauri)
            if !postgres::postgres_available() {
                let msg = "PostgreSQL embarqué indisponible. En dev, définis ATLAS_PG_BIN_DIR vers le dossier contenant pg_ctl.exe/initdb.exe/psql.exe (ex: C:\\Program Files\\EnterpriseDB\\...\\bin), puis relance.";
                tracing::error!("{msg}");
                append_fatal_log(&logs_dir, msg);
                emit_startup_error(app, msg);
                show_installer_for_repair(app, msg);
                return Ok(());
            }

            emit_startup_progress(app, "postgres", "Démarrage PostgreSQL…", 25);

            tracing::info!("setup: before ensure_postgres_started");
            append_fatal_log(&logs_dir, "setup: before ensure_postgres_started");
            let pg = match postgres::ensure_postgres_started() {
                Ok(pg) => pg,
                Err(e) => {
                    let msg = format!("PostgreSQL startup failed: {e:#}");
                    tracing::error!("{msg}");
                    append_fatal_log(&logs_dir, &msg);
                    emit_startup_error(app, &msg);
                    show_installer_for_repair(app, &msg);
                    return Ok(());
                }
            };
            tracing::info!("setup: after ensure_postgres_started");
            append_fatal_log(&logs_dir, "setup: after ensure_postgres_started");

            let pg_port = pg.port;

            emit_startup_progress(app, "database", "Initialisation base / PostGIS / seed…", 45);

            // Heartbeat: `ensure_database_initialized()` (seed restore) can take several minutes.
            // We keep updating the splash to avoid the impression of a frozen app.
            let handle = app.handle().clone();
            let stop_hb = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
            let stop_hb2 = stop_hb.clone();
            let hb_start = std::time::Instant::now();
            let hb = std::thread::spawn(move || {
                while !stop_hb2.load(std::sync::atomic::Ordering::Relaxed) {
                    let secs = hb_start.elapsed().as_secs();
                    emit_startup_progress_handle(
                        &handle,
                        "database",
                        &format!("Initialisation base / seed en cours… ({}s)", secs),
                        45,
                    );
                    std::thread::sleep(std::time::Duration::from_secs(2));
                }
            });

            tracing::info!("setup: before ensure_database_initialized");
            append_fatal_log(&logs_dir, "setup: before ensure_database_initialized");
            let init_result = postgres::ensure_database_initialized(&pg);
            stop_hb.store(true, std::sync::atomic::Ordering::Relaxed);
            let _ = hb.join();
            tracing::info!("setup: after ensure_database_initialized");
            append_fatal_log(&logs_dir, "setup: after ensure_database_initialized");

            if let Err(e) = init_result {
                let e = anyhow::Error::from(e);

                if let Some(m) = e.downcast_ref::<postgres::SeedMismatch>() {
                    let user_msg = m.user_message();
                    let msg = format!("SEED_MISMATCH: {m}");
                    tracing::error!("{msg}");
                    append_fatal_log(&logs_dir, &msg);
                    emit_startup_error(app, &user_msg);
                    if is_smoke_test_mode() {
                        smoke_cleanup(&data_dir, Some(pg));
                        std::process::exit(smoke_exit_code_for_error(&e));
                    }

                    // Fail-safe: do not quit. Bring the installer/maintenance UI so the user can reset.
                    let _ = postgres::stop_postgres(&pg);
                    show_installer_for_repair(app, &user_msg);
                    return Ok(());
                }

                let msg = format!("PostgreSQL/PostGIS initialization failed: {e:#}");
                tracing::error!("{msg}");
                append_fatal_log(&logs_dir, &msg);
                emit_startup_error(app, &msg);
                if is_smoke_test_mode() {
                    smoke_cleanup(&data_dir, Some(pg));
                    std::process::exit(smoke_exit_code_for_error(&e));
                }

                // Fail-safe: do not quit. Bring the installer/maintenance UI so the user can reset.
                let _ = postgres::stop_postgres(&pg);
                show_installer_for_repair(app, &msg);
                return Ok(());
            }

            let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
            let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
            let db_password = match postgres::ensure_password() {
                Ok(v) => v,
                Err(e) => {
                    let msg = format!("PostgreSQL password resolution failed: {e:#}");
                    tracing::error!("{msg}");
                    append_fatal_log(&logs_dir, &msg);
                    emit_startup_error(app, &msg);
                    let _ = postgres::stop_postgres(&pg);
                    show_installer_for_repair(app, &msg);
                    return Ok(());
                }
            };

            let database_url = format!(
                "postgres://{}:{}@127.0.0.1:{}/{}",
                db_user, db_password, pg.port, db_name
            );
            // IMPORTANT: ne pas exporter DATABASE_URL globalement (évite contamination Docker / env externe)
            // et garantit que seul le sidecar reçoit l'URL calculée.

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
                .ok()
                .filter(|p| p.exists())
                .unwrap_or_else(|| {
                    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                        .join("bin")
                        .join("api-geo-x86_64-pc-windows-msvc.exe")
                });

            let mut cmd = std::process::Command::new(exe);
            cmd.env("API_GEO_PORT", api_port.to_string());
            cmd.env("ATLAS_DATA_DIR", data_dir.to_string_lossy().to_string());
            cmd.env("ATLAS_DESKTOP", "1");
            cmd.env("ENABLE_DB_MANAGER", "1");

            // Isolation Docker / dotenv: on purge toute valeur héritée.
            cmd.env_remove("DATABASE_URL");
            cmd.env("DATABASE_URL", &database_url);
            cmd.env("DATABASE_URL_ADMIN", &database_url);

            // Override autorisé uniquement en debug (dev ergonomics)
            if cfg!(debug_assertions) {
                if let Ok(v) = std::env::var("ATLAS_DATABASE_URL_OVERRIDE") {
                    let v = v.trim().to_string();
                    if !v.is_empty() {
                        cmd.env("DATABASE_URL", v);
                    }
                }
            }

            // Logs séparés api-geo
            let api_geo_log = logs_dir.join("api-geo.log");
            rotate_log_file(&api_geo_log, 20 * 1024 * 1024, 5);

            // Si un backend écoute déjà sur le port choisi, on ne respawn pas.
            // Cela évite les erreurs 10048 (port déjà utilisé) et stabilise le boot en dev.
            let addr = ("127.0.0.1", api_port);
            let backend_already_running = std::net::TcpStream::connect(addr).is_ok();
            if !backend_already_running {
                emit_startup_progress(app, "backend", "Démarrage backend…", 75);
                if let Ok(file) = std::fs::OpenOptions::new().create(true).append(true).open(&api_geo_log) {
                    if let Ok(file2) = file.try_clone() {
                        cmd.stdout(std::process::Stdio::from(file));
                        cmd.stderr(std::process::Stdio::from(file2));
                    }
                }
                tracing::info!("setup: before api-geo spawn");
                append_fatal_log(&logs_dir, "setup: before api-geo spawn");
                if let Err(e) = cmd.spawn() {
                    let msg = format!("failed to start backend: {e}");
                    tracing::error!("{msg}");
                    append_fatal_log(&logs_dir, &msg);
                    emit_startup_error(app, &msg);
                    let _ = postgres::stop_postgres(&pg);
                    show_installer_for_repair(app, &msg);
                    return Ok(());
                }
                tracing::info!("setup: after api-geo spawn");
                append_fatal_log(&logs_dir, "setup: after api-geo spawn");
            }

            // Attendre que le backend écoute, pour éviter les erreurs au premier rendu UI.
            // Best-effort (ne bloque pas indéfiniment).
            let start = std::time::Instant::now();
            let timeout = std::time::Duration::from_secs(10);
            tracing::info!("setup: before backend readiness wait");
            append_fatal_log(&logs_dir, "setup: before backend readiness wait");
            loop {
                if std::net::TcpStream::connect(addr).is_ok() {
                    break;
                }
                if start.elapsed() > timeout {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(150));
            }
            tracing::info!("setup: after backend readiness wait");
            append_fatal_log(&logs_dir, "setup: after backend readiness wait");

            if is_smoke_test_mode() {
                emit_startup_progress(app, "smoke", "Smoke test: /healthz", 92);
                if let Err(e) = smoke_check_healthz(api_port) {
                    let msg = format!("SMOKE_FAIL healthz: {e:#}");
                    tracing::error!("{msg}");
                    append_fatal_log(&logs_dir, &msg);
                    emit_startup_error(app, &msg);
                    smoke_cleanup(&data_dir, Some(pg));
                    std::process::exit(1);
                }

                emit_startup_progress(app, "smoke", "Smoke test: invariant DB", 96);
                if let Err(e) = smoke_check_db_mailles_count(pg_port) {
                    let msg = format!("SMOKE_FAIL db: {e:#}");
                    tracing::error!("{msg}");
                    append_fatal_log(&logs_dir, &msg);
                    emit_startup_error(app, &msg);
                    smoke_cleanup(&data_dir, Some(pg));
                    std::process::exit(1);
                }

                emit_startup_progress(app, "smoke", "Smoke test OK", 100);
                smoke_cleanup(&data_dir, Some(pg));
                std::process::exit(0);
            }

            // Keep the Postgres handle alive for the lifetime of the app (non-smoke mode).
            if let Some(m) = app.try_state::<ManagedPostgres>() {
                if let Ok(mut guard) = m.0.lock() {
                    *guard = Some(pg);
                }
            }

            emit_startup_progress(app, "ui", "Ouverture de l'interface…", 95);
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
            }
            if let Some(splash) = app.get_webview_window("splash") {
                let _ = splash.close();
            }
            emit_startup_progress(app, "done", "Prêt", 100);

            Ok(())
        })
        .on_page_load(|window, _| {
            // Provide backend URL to the frontend at runtime.
            // This avoids hardcoding 8000 and works even when a dev Docker stack already binds it.
            if let Some(p) = window.try_state::<ManagedApiPort>() {
                let _ = window.eval(&format!(
                    "window.__ATLAS_CONFIG__ = {};",
                    serde_json::json!({
                        "apiBase": format!("http://127.0.0.1:{}/api", p.0),
                        "wsBase": format!("ws://127.0.0.1:{}/api/ws", p.0),
                        "version": env!("CARGO_PKG_VERSION"),
                    })
                ));
                let _ = window.eval("window.dispatchEvent(new Event('atlas:api-base:updated'));\n");
            }
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Important: we close the splash window during normal startup.
                // Never stop Postgres on splash close, otherwise the DB shuts down right after bootstrap.
                if window.label() == "main" {
                    if let Some(m) = window.try_state::<ManagedPostgres>() {
                        if let Ok(mut guard) = m.0.lock() {
                            if let Some(pg) = guard.take() {
                                if let Err(e) = postgres::stop_postgres(&pg) {
                                    eprintln!("PostgreSQL stop failed: {e:#}");
                                }
                            }
                        }
                    }
                }
            }
        });

    let builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            installer::installer_is_installed,
            installer::installer_check_free_space,
            installer::installer_run,
            installer::installer_preflight,
            installer::installer_reset_local_db,
            installer::installer_backup_local_db,
            installer::installer_cleanup_quarantines,
            installer::installer_open_data_dir,
            installer::installer_open_backups_dir,
            support::diagnostic_export,
            support::db_connection_info,
            support::db_integrity_check,
            support::db_backup,
            support::db_restore,
            sync::check_for_updates,
        ]);

    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    let result = builder.run(tauri::generate_context!());

    if let Err(e) = result {
        eprintln!("error while running tauri application: {e}");
    }
}
