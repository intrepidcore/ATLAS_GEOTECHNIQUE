// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;
use tauri::Emitter;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::prelude::*;
use fs2::FileExt;
use std::io::Write;
use anyhow::Context;

mod postgres;
mod support;
mod sync;
mod installer;

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

fn emit_startup_progress(app: &tauri::App, step: &str, message: &str, percent: u8) {
    if let Some(w) = app.get_webview_window("splash") {
        let _ = w.emit(
            "startup:progress",
            StartupProgress {
                step: step.to_string(),
                message: message.to_string(),
                percent,
            },
        );
    }
}

fn emit_startup_error(app: &tauri::App, message: &str) {
    if let Some(w) = app.get_webview_window("splash") {
        let _ = w.emit(
            "startup:error",
            serde_json::json!({ "message": message }),
        );
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

fn try_set_bundled_seed_dir(app: &tauri::App) {
    if std::env::var("ATLAS_DESKTOP_SEED_DIR").is_ok() {
        return;
    }
    if let Ok(p) = app
        .path()
        .resolve("data/db/backups", tauri::path::BaseDirectory::Resource)
    {
        std::env::set_var("ATLAS_DESKTOP_SEED_DIR", p.to_string_lossy().to_string());
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
    let builder = tauri::Builder::default()
        .setup(|app| {
            app.manage(ManagedPostgres(std::sync::Mutex::new(None)));

            ensure_smoke_test_isolation();

            let api_port: u16 = select_api_port();
            app.manage(ManagedApiPort(api_port));
            let data_dir = resolve_data_dir()?;

            let logs_dir = data_dir.join("logs");
            init_tauri_logging(&logs_dir);

            append_fatal_log(&logs_dir, "startup: begin");

            emit_startup_progress(app, "init", "Initialisation…", 5);

            std::fs::create_dir_all(&data_dir)
                .map_err(|e| format!("failed to create data dir ({}): {e}", data_dir.display()))?;
            std::fs::create_dir_all(&logs_dir)
                .map_err(|e| format!("failed to create logs dir ({}): {e}", logs_dir.display()))?;

            tracing::info!(
                data_dir = %data_dir.display(),
                logs_dir = %logs_dir.display(),
                pg_bin_dir = %std::env::var("ATLAS_PG_BIN_DIR").unwrap_or_default(),
                seed_dir = %std::env::var("ATLAS_DESKTOP_SEED_DIR").unwrap_or_default(),
                "startup"
            );

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
            try_set_bundled_seed_dir(app);

            emit_startup_progress(app, "paths", "Résolution runtime PostgreSQL / seed", 12);

            // First-run: on n'effectue pas le bootstrap DB/API avant que l'installateur
            // (wizard UI) n'ait validé et déclenché l'installation.
            // EXCEPTION: smoke-test mode must always run the bootstrap and exit 0/1.
            if !is_smoke_test_mode() && (force_installer_mode() || !is_installed(&data_dir)) {
                tracing::info!("Installer mode: skipping postgres/api bootstrap (marker missing)");
                emit_startup_progress(app, "installer", "Installateur requis", 100);
                return Ok(());
            }

            // Postgres embarqué (dev: détection auto; prod: resources Tauri)
            if !postgres::postgres_available() {
                let msg = "PostgreSQL embarqué indisponible. En dev, définis ATLAS_PG_BIN_DIR vers le dossier contenant pg_ctl.exe/initdb.exe/psql.exe (ex: C:\\Program Files\\EnterpriseDB\\...\\bin), puis relance.";
                tracing::error!("{msg}");
                append_fatal_log(&logs_dir, msg);
                emit_startup_error(app, msg);
                return Err(msg.into());
            }

            emit_startup_progress(app, "postgres", "Démarrage PostgreSQL…", 25);

            let pg = postgres::ensure_postgres_started().map_err(|e| {
                let msg = format!("PostgreSQL startup failed: {e:#}");
                tracing::error!("{msg}");
                append_fatal_log(&logs_dir, &msg);
                emit_startup_error(app, &msg);
                Box::<dyn std::error::Error>::from(msg)
            })?;

            let pg_port = pg.port;

            emit_startup_progress(app, "database", "Initialisation base / PostGIS / seed…", 45);
            if let Err(e) = postgres::ensure_database_initialized(&pg) {
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
                    return Err(user_msg.into());
                }

                let msg = format!("PostgreSQL/PostGIS initialization failed: {e:#}");
                tracing::error!("{msg}");
                append_fatal_log(&logs_dir, &msg);
                emit_startup_error(app, &msg);
                if is_smoke_test_mode() {
                    smoke_cleanup(&data_dir, Some(pg));
                    std::process::exit(smoke_exit_code_for_error(&e));
                }
                return Err(msg.into());
            }

            let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
            let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
            let db_password = postgres::ensure_password().map_err(|e| {
                let msg = format!("PostgreSQL password resolution failed: {e:#}");
                tracing::error!("{msg}");
                append_fatal_log(&logs_dir, &msg);
                emit_startup_error(app, &msg);
                Box::<dyn std::error::Error>::from(msg)
            })?;

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
                cmd.spawn()
                    .map_err(|e| {
                        let msg = format!("failed to start backend: {e}");
                        tracing::error!("{msg}");
                        append_fatal_log(&logs_dir, &msg);
                        emit_startup_error(app, &msg);
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
        });

    let builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            installer::installer_is_installed,
            installer::installer_check_free_space,
            installer::installer_run,
            support::diagnostic_export,
            support::db_connection_info,
            support::db_integrity_check,
            support::db_backup,
            support::db_restore,
            support::db_reset,
            sync::check_for_updates,
        ]);

    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    let result = builder.run(tauri::generate_context!());

    if let Err(e) = result {
        eprintln!("error while running tauri application: {e}");
    }
}
