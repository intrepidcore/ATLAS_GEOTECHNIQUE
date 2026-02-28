use anyhow::{anyhow, Context, Result};
use fs2::FileExt;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub struct PostgresHandle {
    pub port: u16,
    pub data_dir: PathBuf,
    pub log_file: PathBuf,
    pub _cluster_lock: std::fs::File,
    pub _port_lock: std::fs::File,
}

pub fn data_root_dir_path() -> Result<PathBuf> {
    data_root_dir()
}

fn pg_secret_service_name() -> &'static str {
    "IntrepidCore.AtlasDesktop"
}

fn pg_secret_username() -> &'static str {
    "postgres_atlas"
}

fn allow_insecure_secret_store() -> bool {
    std::env::var("ATLAS_ALLOW_INSECURE_SECRET_STORE")
        .map(|v| v.trim() == "1" || v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn port_is_free(port: u16) -> bool {
    std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
}

fn select_port() -> u16 {
    if let Ok(v) = std::env::var("ATLAS_PG_PORT") {
        if let Ok(p) = v.parse::<u16>() {
            return p;
        }
    }

    let port_file = pg_port_file().unwrap_or_else(|_| std::env::temp_dir().join("atlas.postgres.port"));
    if let Ok(s) = std::fs::read_to_string(&port_file) {
        if let Ok(p) = s.trim().parse::<u16>() {
            if port_is_free(p) {
                return p;
            }
        }
    }

    // Port range dédiée (évite collision avec un Postgres système)
    for p in 54329..54429 {
        if port_is_free(p) {
            let _ = std::fs::write(&port_file, format!("{}\n", p));
            return p;
        }
    }

    54329
}

fn data_root_dir() -> Result<PathBuf> {
    let base = std::env::var("LOCALAPPDATA")
        .or_else(|_| std::env::var("APPDATA"))
        .map_err(|_| anyhow!("LOCALAPPDATA/APPDATA not found"))?;
    Ok(PathBuf::from(base).join("IntrepidCore").join("Atlas"))
}

fn pg_data_dir() -> Result<PathBuf> {
    Ok(data_root_dir()?.join("postgres"))
}

fn pg_log_file() -> Result<PathBuf> {
    Ok(data_root_dir()?.join("logs").join("postgres.log"))
}

fn pg_port_file() -> Result<PathBuf> {
    Ok(data_root_dir()?.join("postgres.port"))
}

fn pg_password_file() -> Result<PathBuf> {
    Ok(data_root_dir()?.join("postgres.password"))
}

fn file_exists(path: &Path) -> bool {
    std::fs::metadata(path).is_ok()
}

pub fn postgres_available() -> bool {
    pg_bin_dir().is_some()
}

fn validate_embedded_runtime_layout() -> Result<()> {
    let Some(bin_dir) = pg_bin_dir().as_ref() else {
        return Err(anyhow!(
            "PostgreSQL runtime introuvable: ATLAS_PG_BIN_DIR non défini (release) ou détection dev impossible."
        ));
    };

    for exe in [
        "pg_ctl.exe",
        "initdb.exe",
        "postgres.exe",
        "psql.exe",
        "pg_dump.exe",
        "pg_restore.exe",
        "pg_isready.exe",
    ] {
        let p = bin_dir.join(exe);
        if !file_exists(&p) {
            return Err(anyhow!("PostgreSQL runtime incomplet: binaire manquant ({})", p.display()));
        }
    }

    // PostGIS: on vérifie que share/extension contient les control/sql.
    // Layout standard: <pg_root>/share/extension/postgis.control
    let pg_root = bin_dir
        .parent()
        .and_then(|p| p.parent())
        .ok_or_else(|| anyhow!("PostgreSQL runtime invalide: impossible de résoudre pg root depuis {}", bin_dir.display()))?;

    let postgis_control = pg_root.join("share").join("extension").join("postgis.control");
    if !file_exists(&postgis_control) {
        return Err(anyhow!(
            "PostGIS runtime introuvable: fichier manquant ({})",
            postgis_control.display()
        ));
    }

    Ok(())
}

pub fn ensure_password() -> Result<String> {
    let entry = keyring::Entry::new(pg_secret_service_name(), pg_secret_username())
        .map_err(|e| anyhow!("keyring entry init failed: {e}"))?;

    match entry.get_password() {
        Ok(p) => {
            let p = p.trim().to_string();
            if !p.is_empty() {
                return Ok(p);
            }
        }
        Err(_) => {
            // Pas de secret existant, on va en créer un.
        }
    }

    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes)
        .map_err(|_| anyhow!("failed to generate random password"))?;
    let pwd = bytes.iter().map(|b| format!("{:02x}", b)).collect::<String>();

    if let Err(e) = entry.set_password(&pwd) {
        if allow_insecure_secret_store() {
            let path = pg_password_file()?;
            std::fs::write(&path, format!("{}\n", pwd))
                .with_context(|| format!("failed to write insecure password file at {}", path.display()))?;
            return Ok(pwd);
        }

        return Err(anyhow!(
            "Impossible d'enregistrer le secret PostgreSQL dans le store sécurisé Windows (Credential Manager): {e}.\n\
            Pour autoriser un fallback non sécurisé (dev uniquement), définir ATLAS_ALLOW_INSECURE_SECRET_STORE=1."
        ));
    }

    // Nettoyage best-effort d'un ancien stockage en clair.
    if let Ok(p) = pg_password_file() {
        let _ = std::fs::remove_file(p);
    }
    Ok(pwd)
}

fn detect_pg_bin_dir() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("ATLAS_PG_BIN_DIR") {
        let dir = dir.trim();
        if !dir.is_empty() {
            return Some(PathBuf::from(dir));
        }
    }

    if !cfg!(debug_assertions) {
        return None;
    }

    // Détection best-effort sur les chemins classiques
    let candidates: Vec<PathBuf> = vec![
        PathBuf::from(r"C:\\Program Files\\EnterpriseDB"),
        PathBuf::from(r"C:\\Program Files\\PostgreSQL"),
        PathBuf::from(r"C:\\Program Files"),
    ];

    for root in candidates {
        if !file_exists(&root) {
            continue;
        }

        // Cas QGIS: C:\Program Files\QGIS *\bin
        if root.ends_with("Program Files") {
            if let Ok(entries) = std::fs::read_dir(&root) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    let name = p
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("");
                    if !name.starts_with("QGIS") {
                        continue;
                    }
                    let bin = p.join("bin");
                    if file_exists(&bin.join("pg_ctl.exe"))
                        && file_exists(&bin.join("initdb.exe"))
                        && file_exists(&bin.join("psql.exe"))
                    {
                        return Some(bin);
                    }
                }
            }
        }

        // Cas EDB/PostgreSQL: version/bin
        if let Ok(entries) = std::fs::read_dir(&root) {
            for entry in entries.flatten() {
                let p = entry.path();
                let bin = p.join("bin");
                if file_exists(&bin.join("pg_ctl.exe"))
                    && file_exists(&bin.join("initdb.exe"))
                    && file_exists(&bin.join("psql.exe"))
                {
                    return Some(bin);
                }
            }
        }
    }

    None
}

fn pg_bin_dir() -> &'static Option<PathBuf> {
    static BIN_DIR: OnceLock<Option<PathBuf>> = OnceLock::new();
    BIN_DIR.get_or_init(detect_pg_bin_dir)
}

fn pg_bin(name: &str) -> PathBuf {
    if let Some(dir) = pg_bin_dir().as_ref() {
        return dir.join(name);
    }

    // En mode bundle, ces binaires seront résolus via les resources Tauri.
    // Ici on renvoie un chemin relatif de fallback pour les environnements dev.
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("bin")
        .join(name)
}

pub fn pg_tool_path(name: &str) -> PathBuf {
    pg_bin(name)
}

fn wait_port(host: &str, port: u16, timeout_secs: u64) {
    let addr = (host, port);
    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(timeout_secs);

    loop {
        if std::net::TcpStream::connect(addr).is_ok() {
            break;
        }
        if start.elapsed() > timeout {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(150));
    }
}

fn pg_env(bin_dir: &Path) -> String {
    let current = std::env::var("PATH").unwrap_or_default();
    format!("{};{}", bin_dir.display(), current)
}

fn pg_cmd(bin_dir: &Path, exe: &str) -> std::process::Command {
    // IMPORTANT (Windows): execute by name with `current_dir=pg/bin`.
    // Using extended-length/UNC-like absolute paths (e.g. `//?/C:/.../initdb.exe`)
    // can make `initdb` fail to locate/spawn `postgres.exe` in the same directory.
    let mut cmd = std::process::Command::new(exe);
    cmd.current_dir(bin_dir).env("PATH", pg_env(bin_dir));
    cmd
}

fn pg_ctl_status(data_dir: &Path) -> Result<bool> {
    let bin_dir = pg_bin_dir()
        .as_ref()
        .cloned()
        .ok_or_else(|| anyhow!("PostgreSQL runtime introuvable (ATLAS_PG_BIN_DIR)"))?;
    let status = pg_cmd(&bin_dir, "pg_ctl.exe")
        .arg("-D")
        .arg(data_dir)
        .arg("status")
        .status()
        .context("failed to run pg_ctl status")?;
    Ok(status.success())
}

fn acquire_exclusive_lock(path: &Path) -> Result<std::fs::File> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("failed to create lock dir ({})", parent.display()))?;
    }

    let file = std::fs::OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .open(path)
        .with_context(|| format!("failed to open lock file ({})", path.display()))?;

    file.try_lock_exclusive()
        .with_context(|| format!("failed to acquire exclusive lock ({})", path.display()))?;

    Ok(file)
}

fn try_recover_stale_postmaster_pid(data_dir: &Path) -> Result<()> {
    let pid_file = data_dir.join("postmaster.pid");
    if !file_exists(&pid_file) {
        return Ok(());
    }

    // Si pg_ctl status indique "not running" mais qu'un postmaster.pid existe,
    // on tente une séquence de cleanup avant start.
    let running = pg_ctl_status(data_dir).unwrap_or(false);
    if running {
        return Ok(());
    }

    let bin_dir = pg_bin_dir()
        .as_ref()
        .cloned()
        .ok_or_else(|| anyhow!("PostgreSQL runtime introuvable (ATLAS_PG_BIN_DIR)"))?;
    let _ = pg_cmd(&bin_dir, "pg_ctl.exe")
        .arg("-D")
        .arg(data_dir)
        .arg("stop")
        .arg("-m")
        .arg("immediate")
        .status();

    // Mise en quarantaine si le fichier persiste
    if file_exists(&pid_file) && !pg_ctl_status(data_dir).unwrap_or(false) {
        let quarantine = data_dir.join("postmaster.pid.stale");
        let _ = std::fs::remove_file(&quarantine);
        std::fs::rename(&pid_file, &quarantine).with_context(|| {
            format!(
                "failed to quarantine stale postmaster.pid ({} -> {})",
                pid_file.display(),
                quarantine.display()
            )
        })?;
    }

    validate_embedded_runtime_layout()?;
    Ok(())
}

pub fn ensure_postgres_started() -> Result<PostgresHandle> {
    let data_dir = pg_data_dir()?;
    let log_file = pg_log_file()?;
    let logs_dir = log_file
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| data_root_dir().unwrap_or_else(|_| std::env::temp_dir()));
    std::fs::create_dir_all(&logs_dir).context("failed to create logs dir")?;
    std::fs::create_dir_all(&data_dir).context("failed to create postgres data dir")?;

    let bin_dir = pg_bin_dir()
        .as_ref()
        .cloned()
        .ok_or_else(|| anyhow!("PostgreSQL runtime introuvable (ATLAS_PG_BIN_DIR)") )?;
    let path_with_pg = {
        let current = std::env::var("PATH").unwrap_or_default();
        format!("{};{}", bin_dir.display(), current)
    };

    // Locks cross-process: empêche double démarrage / corruption cluster.
    let root = data_root_dir()?;
    let cluster_lock = acquire_exclusive_lock(&root.join("locks").join("postgres.cluster.lock"))?;
    let port_lock = acquire_exclusive_lock(&root.join("locks").join("postgres.port.lock"))?;

    let port: u16 = select_port();

    let pg_version_file = data_dir.join("PG_VERSION");
    if !file_exists(&pg_version_file) {
        let password = ensure_password()?;
        let pw_file = data_root_dir()?.join("postgres.pwfile");
        std::fs::write(&pw_file, format!("{}\n", password)).context("failed to write temporary pwfile")?;

        let initdb = "initdb.exe";
        let log = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file)
            .with_context(|| format!("failed to open postgres log file ({})", log_file.display()))?;
        let log2 = log
            .try_clone()
            .with_context(|| format!("failed to clone postgres log file ({})", log_file.display()))?;

        let status = pg_cmd(&bin_dir, initdb)
            .env("PATH", &path_with_pg)
            .stdout(std::process::Stdio::from(log))
            .stderr(std::process::Stdio::from(log2))
            .arg("-D")
            .arg(&data_dir)
            .arg("-U")
            .arg("atlas")
            .arg("--encoding=UTF8")
            .arg("--auth=scram-sha-256")
            .arg("--pwfile")
            .arg(&pw_file)
            .status()
            .context("failed to run initdb")?;

        let _ = std::fs::remove_file(&pw_file);

        if !status.success() {
            return Err(anyhow!("initdb failed (see logs: {})", log_file.display()));
        }
    }

    // Recovery crash dur: PID stale
    try_recover_stale_postmaster_pid(&data_dir)?;

    // Crash recovery basique: si on détecte un cluster incohérent, on tente un stop puis start.
    // (best-effort, mais on échoue explicitement si le start final ne marche pas)
    let is_running = pg_ctl_status(&data_dir).unwrap_or(false);
    if is_running {
        wait_port("127.0.0.1", port, 5);
        return Ok(PostgresHandle {
            port,
            data_dir,
            log_file,
            _cluster_lock: cluster_lock,
            _port_lock: port_lock,
        });
    }

    let status = pg_cmd(&bin_dir, "pg_ctl.exe")
        .env("PATH", &path_with_pg)
        .arg("-D")
        .arg(&data_dir)
        .arg("-l")
        .arg(&log_file)
        .arg("-o")
        .arg(format!("-p {}", port))
        .arg("-w")
        .arg("-t")
        .arg("15")
        .arg("start")
        .status()
        .context("failed to run pg_ctl start")?;

    if !status.success() {
        // Tentative de recovery: stop immédiat puis restart.
        let _ = pg_cmd(&bin_dir, "pg_ctl.exe")
            .env("PATH", &path_with_pg)
            .arg("-D")
            .arg(&data_dir)
            .arg("stop")
            .arg("-m")
            .arg("immediate")
            .status();

        let status2 = pg_cmd(&bin_dir, "pg_ctl.exe")
            .env("PATH", &path_with_pg)
            .arg("-D")
            .arg(&data_dir)
            .arg("-l")
            .arg(&log_file)
            .arg("-o")
            .arg(format!("-p {}", port))
            .arg("-w")
            .arg("-t")
            .arg("15")
            .arg("start")
            .status()
            .context("failed to run pg_ctl start (retry)")?;

        if !status2.success() {
            return Err(anyhow!(
                "PostgreSQL n'a pas pu démarrer (voir {}), même après recovery.",
                log_file.display()
            ));
        }
    }

    wait_port("127.0.0.1", port, 20);

    Ok(PostgresHandle {
        port,
        data_dir,
        log_file,
        _cluster_lock: cluster_lock,
        _port_lock: port_lock,
    })
}

pub fn stop_postgres(pg: &PostgresHandle) -> Result<()> {
    let bin_dir = pg_bin_dir()
        .as_ref()
        .cloned()
        .ok_or_else(|| anyhow!("PostgreSQL runtime introuvable (ATLAS_PG_BIN_DIR)"))?;
    let status = pg_cmd(&bin_dir, "pg_ctl.exe")
        .arg("-D")
        .arg(&pg.data_dir)
        .arg("stop")
        .arg("-m")
        .arg("fast")
        .status()
        .context("failed to run pg_ctl stop")?;

    if !status.success() {
        return Err(anyhow!("pg_ctl stop failed (see {})", pg.log_file.display()));
    }

    Ok(())
}

pub fn ensure_database_initialized(pg: &PostgresHandle) -> Result<()> {
    let bin_dir = pg_bin_dir()
        .as_ref()
        .cloned()
        .ok_or_else(|| anyhow!("PostgreSQL runtime introuvable (ATLAS_PG_BIN_DIR)"))?;
    let psql = "psql.exe";
    let createdb = "createdb.exe";

    let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
    let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
    let db_password = ensure_password()?;

    // 1) Créer la DB si nécessaire
    let create_db_sql = format!(
        "SELECT 1 FROM pg_database WHERE datname='{}';",
        db_name.replace('"', "")
    );

    let out = pg_cmd(&bin_dir, psql)
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", pg.port.to_string())
        .env("PGUSER", &db_user)
        .env("PGPASSWORD", &db_password)
        .arg("-d")
        .arg("postgres")
        .arg("-tAc")
        .arg(&create_db_sql)
        .output()
        .with_context(|| format!("failed to run psql ({psql})"))?;

    if !out.status.success() {
        return Err(anyhow!(
            "failed to check database existence (psql exit={})",
            out.status
        ));
    }

    let exists = String::from_utf8_lossy(&out.stdout).trim() == "1";
    if !exists {
        let status = pg_cmd(&bin_dir, createdb)
            .env("PGHOST", "127.0.0.1")
            .env("PGPORT", pg.port.to_string())
            .env("PGUSER", &db_user)
            .env("PGPASSWORD", &db_password)
            .arg("-h")
            .arg("127.0.0.1")
            .arg("-p")
            .arg(pg.port.to_string())
            .arg("-U")
            .arg(&db_user)
            .arg(&db_name)
            .status()
            .with_context(|| format!("failed to run createdb ({createdb})"))?;

        if !status.success() {
            return Err(anyhow!("failed to create database {db_name}"));
        }
    }

    // Schéma applicatif attendu par les migrations (ex: atlas.*)
    let status = pg_cmd(&bin_dir, psql)
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", pg.port.to_string())
        .env("PGUSER", &db_user)
        .env("PGPASSWORD", &db_password)
        .arg("-d")
        .arg(&db_name)
        .arg("-v")
        .arg("ON_ERROR_STOP=1")
        .arg("-c")
        .arg("CREATE SCHEMA IF NOT EXISTS atlas;")
        .status()
        .with_context(|| format!("failed to ensure schema atlas exists ({psql})"))?;
    if !status.success() {
        return Err(anyhow!("failed to ensure schema atlas exists"));
    }

    // 2) Activer postgis (si les binaires embarqués incluent l'extension)
    let status = pg_cmd(&bin_dir, psql)
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", pg.port.to_string())
        .env("PGUSER", &db_user)
        .env("PGPASSWORD", &db_password)
        .arg("-d")
        .arg(&db_name)
        .arg("-v")
        .arg("ON_ERROR_STOP=1")
        .arg("-c")
        .arg("CREATE EXTENSION IF NOT EXISTS postgis;")
        .status()
        .with_context(|| format!("failed to run psql create extension ({psql})"))?;

    if !status.success() {
        return Err(anyhow!(
            "Impossible d'activer PostGIS (CREATE EXTENSION postgis). La distribution Postgres/PostGIS embarquée est incomplète."
        ));
    }

    // Vérification explicite (bloquante)
    let status = pg_cmd(&bin_dir, psql)
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", pg.port.to_string())
        .env("PGUSER", &db_user)
        .env("PGPASSWORD", &db_password)
        .arg("-d")
        .arg(&db_name)
        .arg("-tAc")
        .arg("SELECT postgis_version();")
        .status()
        .with_context(|| format!("failed to run psql postgis_version ({psql})"))?;

    if !status.success() {
        return Err(anyhow!(
            "PostGIS n'est pas opérationnel (postgis_version() a échoué)."
        ));
    }

    Ok(())
}
