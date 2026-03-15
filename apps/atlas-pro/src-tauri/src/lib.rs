// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::prelude::*;
use fs2::FileExt;
use std::io::Write;

mod postgres;
mod support;
mod sync;

struct ManagedPostgres(std::sync::Mutex<Option<postgres::PostgresHandle>>);
struct ManagedAppLock(std::fs::File);
struct ManagedApiPort(u16);
struct ManagedPaths {
    data_dir: std::path::PathBuf,
    logs_dir: std::path::PathBuf,
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
    file.try_lock_exclusive()
        .map_err(|e| format!("Atlas Desktop is already running (lock {}): {e}", lock_path.display()))?;
    Ok(file)
}

fn prepend_to_path(dir: &std::path::Path) {
    let current = std::env::var("PATH").unwrap_or_default();
    let mut parts: Vec<String> = Vec::new();
    parts.push(dir.to_string_lossy().to_string());
    parts.push(current);
    std::env::set_var("PATH", parts.join(";"));
}

fn normalize_windows_bin_dir(p: &std::path::Path) -> std::path::PathBuf {
    let canon = std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
    let mut s = canon.to_string_lossy().to_string();
    // Some Windows tooling (and Node libs) represent extended-length paths as `//?/C:/...`.
    // `initdb` fails to spawn `postgres.exe` when invoked from such a path.
    if s.starts_with("//?/") {
        s = format!("\\\\?\\{}", &s[4..]);
    }
    s = s.replace('/', "\\");
    std::path::PathBuf::from(s)
}

fn try_set_embedded_postgres_bin_dir(app: &tauri::App) {
    if std::env::var("ATLAS_PG_BIN_DIR").is_ok() {
        return;
    }

    // Layout cible v1.0 : resources/pg/bin/{pg_ctl.exe, initdb.exe, psql.exe}
    let candidate = app
        .path()
        .resolve("pg/bin/pg_ctl.exe", tauri::path::BaseDirectory::Resource)
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .or_else(|| {
            // Dev mode (cargo tauri dev): resources directory is not the same as the bundle.
            // We accept the artifact layout directly under the tauri project.
            let local = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("pg")
                .join("bin");
            if local.join("pg_ctl.exe").exists() {
                Some(local)
            } else {
                None
            }
        });

    if let Some(bin_dir) = candidate {
        let bin_dir = normalize_windows_bin_dir(&bin_dir);
        if bin_dir.join("initdb.exe").exists() && bin_dir.join("psql.exe").exists() {
            std::env::set_var("ATLAS_PG_BIN_DIR", bin_dir.to_string_lossy().to_string());
            prepend_to_path(&bin_dir);
        }
    }
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

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .setup(|app| {
            app.manage(ManagedPostgres(std::sync::Mutex::new(None)));

            let api_port: u16 = select_api_port();
            app.manage(ManagedApiPort(api_port));
            let data_dir = std::env::var("LOCALAPPDATA")
                .or_else(|_| std::env::var("APPDATA"))
                .map(|base| std::path::PathBuf::from(base).join("IntrepidCore").join("Atlas"))
                .map_err(|_| "LOCALAPPDATA/APPDATA not found")?;

            let logs_dir = data_dir.join("logs");
            init_tauri_logging(&logs_dir);

            append_fatal_log(&logs_dir, "startup: begin");

            std::fs::create_dir_all(&data_dir)
                .map_err(|e| format!("failed to create data dir ({}): {e}", data_dir.display()))?;
            std::fs::create_dir_all(&logs_dir)
                .map_err(|e| format!("failed to create logs dir ({}): {e}", logs_dir.display()))?;

            tracing::info!(data_dir = %data_dir.display(), logs_dir = %logs_dir.display(), "startup");

            harden_windows_permissions(&data_dir, &logs_dir);

            // Logs postgres (rotation avant start)
            let postgres_log = logs_dir.join("postgres.log");
            rotate_log_file(&postgres_log, 50 * 1024 * 1024, 5);

            app.manage(ManagedPaths {
                data_dir: data_dir.clone(),
                logs_dir: logs_dir.clone(),
            });

            // Single-instance: lock global conservé en state
            let app_lock = acquire_single_instance_lock(&data_dir)?;
            app.manage(ManagedAppLock(app_lock));

            // Embedded Postgres (bundle): auto-résolution du bin dir depuis les resources
            try_set_embedded_postgres_bin_dir(app);

            // Postgres embarqué (dev: détection auto; prod: resources Tauri)
            if !postgres::postgres_available() {
                let msg = "PostgreSQL embarqué indisponible. En dev, définis ATLAS_PG_BIN_DIR vers le dossier contenant pg_ctl.exe/initdb.exe/psql.exe (ex: C:\\Program Files\\EnterpriseDB\\...\\bin), puis relance.";
                tracing::error!("{msg}");
                append_fatal_log(&logs_dir, msg);
                return Err(msg.into());
            }

            let pg = postgres::ensure_postgres_started().map_err(|e| {
                let msg = format!("PostgreSQL startup failed: {e:#}");
                tracing::error!("{msg}");
                append_fatal_log(&logs_dir, &msg);
                Box::<dyn std::error::Error>::from(msg)
            })?;
            postgres::ensure_database_initialized(&pg).map_err(|e| {
                let msg = format!("PostgreSQL/PostGIS initialization failed: {e:#}");
                tracing::error!("{msg}");
                append_fatal_log(&logs_dir, &msg);
                Box::<dyn std::error::Error>::from(msg)
            })?;

            let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
            let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
            let db_password = postgres::ensure_password().map_err(|e| {
                let msg = format!("PostgreSQL password resolution failed: {e:#}");
                tracing::error!("{msg}");
                append_fatal_log(&logs_dir, &msg);
                Box::<dyn std::error::Error>::from(msg)
            })?;

            let database_url = format!(
                "postgres://{}:{}@127.0.0.1:{}/{}",
                db_user, db_password, pg.port, db_name
            );
            // IMPORTANT: ne pas exporter DATABASE_URL globalement (évite contamination Docker / env externe)
            // et garantit que seul le sidecar reçoit l'URL calculée.

            if let Some(m) = app.try_state::<ManagedPostgres>() {
                if let Ok(mut guard) = m.0.lock() {
                    *guard = Some(pg);
                }
            }

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

            // Isolation Docker / dotenv: on purge toute valeur héritée.
            cmd.env_remove("DATABASE_URL");
            cmd.env("DATABASE_URL", &database_url);

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
                if let Ok(file) = std::fs::OpenOptions::new().create(true).append(true).open(&api_geo_log) {
                    if let Ok(file2) = file.try_clone() {
                        cmd.stdout(std::process::Stdio::from(file));
                        cmd.stderr(std::process::Stdio::from(file2));
                    }
                }
                cmd.spawn()
                    .map_err(|e| {
                        let msg = format!("failed to start backend: {e}");
                        tracing::error!("{msg}");
                        append_fatal_log(&logs_dir, &msg);
                        msg
                    })?;
            }

            // Attendre que le backend écoute, pour éviter les erreurs au premier rendu UI.
            // Best-effort (ne bloque pas indéfiniment).
            let start = std::time::Instant::now();
            let timeout = std::time::Duration::from_secs(10);
            loop {
                if std::net::TcpStream::connect(addr).is_ok() {
                    break;
                }
                if start.elapsed() > timeout {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(150));
            }

            Ok(())
        })
        .on_page_load(|window, _| {
            // Provide backend URL to the frontend at runtime.
            // This avoids hardcoding 8000 and works even when a dev Docker stack already binds it.
            if let Some(p) = window.try_state::<ManagedApiPort>() {
                let _ = window.eval(&format!(
                    "window.__API_GEO__ = 'http://127.0.0.1:{}';",
                    p.0
                ));
            }
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
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
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            support::diagnostic_export,
            support::db_connection_info,
            support::db_integrity_check,
            support::db_backup,
            support::db_restore,
            support::db_reset,
            sync::check_for_updates,
        ])
        .run(tauri::generate_context!());

    if let Err(e) = result {
        eprintln!("error while running tauri application: {e}");
    }
}
