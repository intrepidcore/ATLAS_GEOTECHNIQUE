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

fn get_desktop_state_value_if_table_exists(
    bin_dir: &Path,
    port: u16,
    db_user: &str,
    db_password: &str,
    db_name: &str,
    key: &str,
) -> Result<Option<String>> {
    let exists_sql = "SELECT 1 FROM information_schema.tables WHERE table_schema='atlas' AND table_name='desktop_state' LIMIT 1;";
    let out = pg_cmd(bin_dir, "psql.exe")
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", port.to_string())
        .env("PGUSER", db_user)
        .env("PGPASSWORD", db_password)
        .env("PGDATABASE", db_name)
        .arg("-tAc")
        .arg(exists_sql)
        .output()
        .context("failed to check atlas.desktop_state existence")?;
    if !out.status.success() {
        return Err(anyhow!(
            "failed to check desktop_state existence (exit={}): {}",
            out.status,
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    if String::from_utf8_lossy(&out.stdout).trim() != "1" {
        return Ok(None);
    }
    get_desktop_state_value(bin_dir, port, db_user, db_password, db_name, key)
}

fn ensure_desktop_state_table(bin_dir: &Path, port: u16, db_user: &str, db_password: &str, db_name: &str) -> Result<()> {
    run_sql(
        bin_dir,
        port,
        db_user,
        db_password,
        db_name,
        "CREATE SCHEMA IF NOT EXISTS atlas;\n\
         CREATE TABLE IF NOT EXISTS atlas.desktop_state (\n\
           k TEXT PRIMARY KEY,\n\
           v TEXT NOT NULL,\n\
           updated_at TIMESTAMPTZ NOT NULL DEFAULT now()\n\
         );",
    )
}

fn run_sql(bin_dir: &Path, port: u16, db_user: &str, db_password: &str, db_name: &str, sql: &str) -> Result<()> {
    let out = pg_cmd(bin_dir, "psql.exe")
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", port.to_string())
        .env("PGUSER", db_user)
        .env("PGPASSWORD", db_password)
        .env("PGDATABASE", db_name)
        .arg("-v")
        .arg("ON_ERROR_STOP=1")
        .arg("-tAc")
        .arg(sql)
        .output()
        .context("failed to run psql -tAc")?;

    if !out.status.success() {
        return Err(anyhow!(
            "psql sql failed (exit={}): {}",
            out.status,
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(())
}

fn get_desktop_state_value(
    bin_dir: &Path,
    port: u16,
    db_user: &str,
    db_password: &str,
    db_name: &str,
    key: &str,
) -> Result<Option<String>> {
    let sql = format!(
        "SELECT v FROM atlas.desktop_state WHERE k='{}' LIMIT 1;",
        key.replace('"', "")
    );
    let out = pg_cmd(bin_dir, "psql.exe")
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", port.to_string())
        .env("PGUSER", db_user)
        .env("PGPASSWORD", db_password)
        .env("PGDATABASE", db_name)
        .arg("-tAc")
        .arg(sql)
        .output()
        .context("failed to query atlas.desktop_state")?;
    if !out.status.success() {
        return Err(anyhow!(
            "failed to query desktop_state (exit={}): {}",
            out.status,
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if v.is_empty() {
        Ok(None)
    } else {
        Ok(Some(v))
    }
}

fn set_desktop_state_value(
    bin_dir: &Path,
    port: u16,
    db_user: &str,
    db_password: &str,
    db_name: &str,
    key: &str,
    value: &str,
) -> Result<()> {
    let sql = format!(
        "INSERT INTO atlas.desktop_state(k, v) VALUES ('{}', '{}')\n\
         ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v, updated_at=now();",
        key.replace('"', ""),
        value.replace('"', "").replace('\'', "''")
    );
    run_sql(bin_dir, port, db_user, db_password, db_name, &sql)
}

fn compute_file_blake3(path: &Path) -> Result<String> {
    let bytes = std::fs::read(path).with_context(|| format!("failed to read file ({})", path.display()))?;
    Ok(blake3::hash(&bytes).to_hex().to_string())
}

fn compute_file_sha256_hex(path: &Path) -> Result<String> {
    use sha2::Digest;

    let bytes = std::fs::read(path).with_context(|| format!("failed to read file ({})", path.display()))?;
    let mut h = sha2::Sha256::new();
    h.update(&bytes);
    Ok(format!("{:x}", h.finalize()))
}

fn max_migration_number(repo_root: &Path) -> Result<i32> {
    let dir = repo_root.join("migrations");
    if !dir.exists() {
        return Ok(0);
    }
    let mut best: i32 = 0;
    for e in std::fs::read_dir(&dir).with_context(|| format!("failed to read migrations dir ({})", dir.display()))? {
        let p = match e {
            Ok(v) => v.path(),
            Err(_) => continue,
        };
        if p.extension().and_then(|s| s.to_str()).unwrap_or("") != "sql" {
            continue;
        }
        let file = p.file_name().and_then(|s| s.to_str()).unwrap_or("");
        let prefix = file.split('_').next().unwrap_or("");
        if let Ok(n) = prefix.parse::<i32>() {
            if n > best {
                best = n;
            }
        }
    }
    Ok(best)
}

fn ensure_desktop_seed_state_table(
    bin_dir: &Path,
    port: u16,
    db_user: &str,
    db_password: &str,
    db_name: &str,
) -> Result<()> {
    run_sql(
        bin_dir,
        port,
        db_user,
        db_password,
        db_name,
        "CREATE SCHEMA IF NOT EXISTS atlas;\n\
         CREATE TABLE IF NOT EXISTS atlas.desktop_seed_state (\n\
           id SERIAL PRIMARY KEY,\n\
           seed_sha256 TEXT NOT NULL UNIQUE,\n\
           max_migration_applied INTEGER NOT NULL,\n\
           applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n\
           notes TEXT\n\
         );",
    )
}

fn desktop_seed_state_has_hash(
    bin_dir: &Path,
    port: u16,
    db_user: &str,
    db_password: &str,
    db_name: &str,
    seed_sha256: &str,
) -> Result<bool> {
    let exists_sql = "SELECT 1 FROM information_schema.tables WHERE table_schema='atlas' AND table_name='desktop_seed_state' LIMIT 1;";
    let out = pg_cmd(bin_dir, "psql.exe")
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", port.to_string())
        .env("PGUSER", db_user)
        .env("PGPASSWORD", db_password)
        .env("PGDATABASE", db_name)
        .arg("-tAc")
        .arg(exists_sql)
        .output()
        .context("failed to check atlas.desktop_seed_state existence")?;
    if !out.status.success() {
        return Err(anyhow!(
            "failed to check desktop_seed_state existence (exit={}): {}",
            out.status,
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    if String::from_utf8_lossy(&out.stdout).trim() != "1" {
        return Ok(false);
    }

    let sql = format!(
        "SELECT 1 FROM atlas.desktop_seed_state WHERE seed_sha256='{}' LIMIT 1;",
        seed_sha256.replace('"', "").replace('\'', "''")
    );
    let out = pg_cmd(bin_dir, "psql.exe")
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", port.to_string())
        .env("PGUSER", db_user)
        .env("PGPASSWORD", db_password)
        .env("PGDATABASE", db_name)
        .arg("-tAc")
        .arg(sql)
        .output()
        .context("failed to query atlas.desktop_seed_state")?;
    if !out.status.success() {
        return Err(anyhow!(
            "failed to query desktop_seed_state (exit={}): {}",
            out.status,
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim() == "1")
}

fn record_desktop_seed_state(
    bin_dir: &Path,
    port: u16,
    db_user: &str,
    db_password: &str,
    db_name: &str,
    seed_sha256: &str,
    max_migration_applied: i32,
    notes: &str,
) -> Result<()> {
    ensure_desktop_seed_state_table(bin_dir, port, db_user, db_password, db_name)?;
    let sql = format!(
        "INSERT INTO atlas.desktop_seed_state(seed_sha256, max_migration_applied, notes)\n\
         VALUES ('{}', {}, '{}')\n\
         ON CONFLICT (seed_sha256) DO UPDATE SET max_migration_applied=EXCLUDED.max_migration_applied, notes=EXCLUDED.notes, applied_at=now();",
        seed_sha256.replace('"', "").replace('\'', "''"),
        max_migration_applied,
        notes.replace('"', "").replace('\'', "''"),
    );
    run_sql(bin_dir, port, db_user, db_password, db_name, &sql)
}

fn database_has_user_objects(bin_dir: &Path, port: u16, db_user: &str, db_password: &str, db_name: &str) -> Result<bool> {
    let out = pg_cmd(bin_dir, "psql.exe")
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", port.to_string())
        .env("PGUSER", db_user)
        .env("PGPASSWORD", db_password)
        .env("PGDATABASE", db_name)
        .arg("-tAc")
        .arg("SELECT 1 FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') LIMIT 1;")
        .output()
        .context("failed to check if database has user objects")?;

    if !out.status.success() {
        return Err(anyhow!(
            "failed to check user objects (exit={}): {}",
            out.status,
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim() == "1")
}

fn desktop_data_dir() -> Result<PathBuf> {
    let base = std::env::var("LOCALAPPDATA")
        .or_else(|_| std::env::var("APPDATA"))
        .map_err(|_| anyhow!("LOCALAPPDATA/APPDATA not found"))?;
    Ok(PathBuf::from(base).join("IntrepidCore").join("Atlas"))
}

fn backup_database_dump(
    bin_dir: &Path,
    port: u16,
    db_user: &str,
    db_password: &str,
    db_name: &str,
) -> Result<(PathBuf, String)> {
    let backup_dir = desktop_data_dir()?.join("backups");
    std::fs::create_dir_all(&backup_dir)
        .with_context(|| format!("failed to create backup dir ({})", backup_dir.display()))?;

    let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let out = backup_dir.join(format!("atlas_{db_name}_pre_migrations_{ts}.dump"));

    let status = pg_cmd(bin_dir, "pg_dump.exe")
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", port.to_string())
        .env("PGUSER", db_user)
        .env("PGPASSWORD", db_password)
        .arg("-Fc")
        .arg("-f")
        .arg(&out)
        .arg(db_name)
        .status()
        .with_context(|| format!("failed to run pg_dump to {}", out.display()))?;

    if !status.success() {
        return Err(anyhow!("pg_dump failed (exit={})", status));
    }

    let sha256 = compute_file_sha256_hex(&out)?;
    Ok((out, sha256))
}

fn restore_database_dump(
    bin_dir: &Path,
    port: u16,
    db_user: &str,
    db_password: &str,
    db_name: &str,
    dump_path: &Path,
) -> Result<()> {
    let status = pg_cmd(bin_dir, "pg_restore.exe")
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", port.to_string())
        .env("PGUSER", db_user)
        .env("PGPASSWORD", db_password)
        .arg("--clean")
        .arg("--if-exists")
        .arg("-d")
        .arg(db_name)
        .arg(dump_path)
        .status()
        .with_context(|| format!("failed to run pg_restore from {}", dump_path.display()))?;

    if !status.success() {
        return Err(anyhow!("pg_restore failed (exit={})", status));
    }
    Ok(())
}

fn repo_root_from_tauri() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
}

fn find_seed_dump(repo_root: &Path) -> Option<PathBuf> {
    if let Ok(p) = std::env::var("ATLAS_DESKTOP_SEED_DUMP_PATH") {
        let p = PathBuf::from(p);
        if p.exists() {
            return Some(p);
        }
    }

    let base = repo_root.join("data").join("db").join("backups");
    for name in [
        "atlas_desktop_seed.dump",
        "atlas_desktop_seed.sql",
        "atlas_desktop_seed.backup",
    ] {
        let p = base.join(name);
        if p.exists() {
            return Some(p);
        }
    }

    // Fallback: pick the newest dump-like file in backups.
    let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
    if let Ok(rd) = std::fs::read_dir(&base) {
        for e in rd.flatten() {
            let p = e.path();
            if !p.is_file() {
                continue;
            }
            let ext = p
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            if ext != "dump" && ext != "backup" && ext != "sql" {
                continue;
            }
            let mt = e
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            let replace = match &best {
                None => true,
                Some((best_mt, _)) => mt > *best_mt,
            };
            if replace {
                best = Some((mt, p));
            }
        }
    }
    if let Some((_, p)) = best {
        return Some(p);
    }
    None
}

fn database_looks_initialized(bin_dir: &Path, port: u16, db_user: &str, db_password: &str, db_name: &str) -> Result<bool> {
    database_has_user_objects(bin_dir, port, db_user, db_password, db_name)
}

fn restore_seed_dump(
    bin_dir: &Path,
    port: u16,
    db_user: &str,
    db_password: &str,
    db_name: &str,
    dump_path: &Path,
) -> Result<()> {
    let ext = dump_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if ext == "sql" {
        let status = pg_cmd(bin_dir, "psql.exe")
            .env("PGHOST", "127.0.0.1")
            .env("PGPORT", port.to_string())
            .env("PGUSER", db_user)
            .env("PGPASSWORD", db_password)
            .env("PGDATABASE", db_name)
            .arg("-v")
            .arg("ON_ERROR_STOP=1")
            .arg("-f")
            .arg(dump_path)
            .status()
            .with_context(|| format!("failed to restore seed sql ({})", dump_path.display()))?;
        if !status.success() {
            return Err(anyhow!("seed sql restore failed ({})", dump_path.display()));
        }
        return Ok(());
    }

    // Assume pg_restore compatible format (custom/tar/directory/backup).
    let status = pg_cmd(bin_dir, "pg_restore.exe")
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", port.to_string())
        .env("PGUSER", db_user)
        .env("PGPASSWORD", db_password)
        .arg("--no-owner")
        .arg("--no-privileges")
        .arg("--clean")
        .arg("--if-exists")
        .arg("-d")
        .arg(db_name)
        .arg(dump_path)
        .status()
        .with_context(|| format!("failed to restore seed dump ({})", dump_path.display()))?;

    if !status.success() {
        return Err(anyhow!("seed dump restore failed ({})", dump_path.display()));
    }
    Ok(())
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
    let logs_dir = data_root_dir()?.join("logs");
    let pid = std::process::id();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    Ok(logs_dir.join(format!("postgres-{}-{}.log", ts, pid)))
}

fn open_postgres_log_file(preferred: PathBuf) -> Result<(std::fs::File, PathBuf)> {
    match std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&preferred)
    {
        Ok(f) => Ok((f, preferred)),
        Err(e) => {
            if e.raw_os_error() == Some(32) {
                let pid = std::process::id();
                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis();
                let fallback = preferred
                    .parent()
                    .unwrap_or_else(|| Path::new("."))
                    .join(format!("postgres-{}-{}.log", ts, pid));
                let f = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&fallback)
                    .with_context(|| {
                        format!(
                            "failed to open postgres log file ({})",
                            fallback.display()
                        )
                    })?;
                Ok((f, fallback))
            } else {
                Err(e).with_context(|| {
                    format!("failed to open postgres log file ({})", preferred.display())
                })
            }
        }
    }
}

fn pg_port_file() -> Result<PathBuf> {
    Ok(data_root_dir()?.join("postgres.port"))
}

fn running_port_from_postmaster_pid(data_dir: &Path) -> Option<u16> {
    let pid_file = data_dir.join("postmaster.pid");
    let content = std::fs::read_to_string(pid_file).ok()?;
    // postmaster.pid format: pid, data_dir, start_time, port, ...
    let port_line = content.lines().nth(3)?;
    port_line.trim().parse::<u16>().ok()
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

fn apply_repo_migrations(
    bin_dir: &Path,
    port: u16,
    db_user: &str,
    db_password: &str,
    db_name: &str,
) -> Result<()> {
    ensure_desktop_state_table(bin_dir, port, db_user, db_password, db_name)?;

    // Repo root from src-tauri is ../../..
    let repo_root = repo_root_from_tauri();

    // Seeded baseline mode (v1): the database is restored from a known-good dump and must not
    // replay the full historical migrations. Only apply post-v1 migrations.
    let seed_hash = get_desktop_state_value(
        bin_dir,
        port,
        db_user,
        db_password,
        db_name,
        "seed_hash",
    )?;

    let seeded_baseline = seed_hash.as_deref().map(|s| !s.trim().is_empty()).unwrap_or(false);

    let current_fingerprint = if seeded_baseline {
        compute_post_v1_migrations_fingerprint(&repo_root)?
    } else {
        compute_migrations_fingerprint(&repo_root)?
    };
    let applied = get_desktop_state_value(
        bin_dir,
        port,
        db_user,
        db_password,
        db_name,
        "migrations_fingerprint",
    )?;
    if applied.as_deref() == Some(current_fingerprint.as_str()) {
        return Ok(());
    }

    if seeded_baseline {
        // Safety: automatic backup + rollback for post-v1 upgrades.
        // We only do this when we actually need to apply migrations.
        let (backup_path, backup_sha256) = backup_database_dump(bin_dir, port, db_user, db_password, db_name)?;
        set_desktop_state_value(
            bin_dir,
            port,
            db_user,
            db_password,
            db_name,
            "last_migration_backup_path",
            &backup_path.to_string_lossy(),
        )?;
        set_desktop_state_value(
            bin_dir,
            port,
            db_user,
            db_password,
            db_name,
            "last_migration_backup_sha256",
            &backup_sha256,
        )?;

        // Only apply future migrations (post baseline v1).
        let post_dir = repo_root.join("migrations_post_v1");
        if post_dir.exists() {
            let mut entries: Vec<PathBuf> = std::fs::read_dir(&post_dir)
                .with_context(|| {
                    format!("failed to read migrations_post_v1 dir ({})", post_dir.display())
                })?
                .flatten()
                .map(|e| e.path())
                .filter(|p| p.extension().and_then(|s| s.to_str()).unwrap_or("") == "sql")
                .collect();

            entries.sort();
            for file in entries {
                if let Err(e) = run_migration_file(bin_dir, port, db_user, db_password, db_name, &file) {
                    // Rollback: restore the pre-migration backup.
                    let _ = restore_database_dump(bin_dir, port, db_user, db_password, db_name, &backup_path);
                    return Err(anyhow!(
                        "post-v1 migration failed and rollback was attempted (file={}, backup={}): {:#}",
                        file.display(),
                        backup_path.display(),
                        e
                    ));
                }
            }
        }

        set_desktop_state_value(
            bin_dir,
            port,
            db_user,
            db_password,
            db_name,
            "migrations_fingerprint",
            &current_fingerprint,
        )?;

        return Ok(());
    }

    let base_migrations_dir = repo_root.join("migrations");
    let base_init = base_migrations_dir.join("init.sql");
    if base_init.exists() {
        run_migration_file(bin_dir, port, db_user, db_password, db_name, &base_init)?;
    }

    // Apply other base migrations (excluding init.sql) in lexical order.
    if base_migrations_dir.exists() {
        let mut entries: Vec<PathBuf> = std::fs::read_dir(&base_migrations_dir)
            .with_context(|| format!("failed to read migrations dir ({})", base_migrations_dir.display()))?
            .flatten()
            .map(|e| e.path())
            .filter(|p| {
                p.extension().and_then(|s| s.to_str()).unwrap_or("") == "sql"
                    && p.file_name().and_then(|s| s.to_str()).unwrap_or("") != "init.sql"
            })
            .collect();
        entries.sort();
        for file in entries {
            run_migration_file(bin_dir, port, db_user, db_password, db_name, &file)?;
        }
    }

    // Apply full DB migrations (historical) used by the app.
    let migrations_dir = repo_root.join("db").join("migrations");
    if migrations_dir.exists() {
        let mut entries: Vec<PathBuf> = std::fs::read_dir(&migrations_dir)
            .with_context(|| format!("failed to read migrations dir ({})", migrations_dir.display()))?
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.extension().and_then(|s| s.to_str()).unwrap_or("") == "sql")
            .collect();

        entries.sort();
        for file in entries {
            run_migration_file(bin_dir, port, db_user, db_password, db_name, &file)?;
        }
    }

    set_desktop_state_value(
        bin_dir,
        port,
        db_user,
        db_password,
        db_name,
        "migrations_fingerprint",
        &current_fingerprint,
    )?;

    Ok(())
}

fn compute_migrations_fingerprint(repo_root: &Path) -> Result<String> {
    let mut hasher = blake3::Hasher::new();

    // Hash both base migrations/ and db/migrations/ so changes in either directory trigger re-apply.
    let rel_dirs: Vec<PathBuf> = vec![PathBuf::from("migrations"), PathBuf::from("db").join("migrations")];
    for rel_dir in rel_dirs {
        let dir = repo_root.join(&rel_dir);
        if !dir.exists() {
            continue;
        }

        let mut files: Vec<PathBuf> = std::fs::read_dir(&dir)
            .with_context(|| format!("failed to read migrations dir ({})", dir.display()))?
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.extension().and_then(|s| s.to_str()).unwrap_or("") == "sql")
            .collect();
        files.sort();

        for p in files {
            let rel = p
                .strip_prefix(repo_root)
                .unwrap_or(&p)
                .to_string_lossy()
                .replace('\\', "/");
            hasher.update(rel.as_bytes());
            hasher.update(&[0u8]);

            let bytes = std::fs::read(&p)
                .with_context(|| format!("failed to read migration file ({})", p.display()))?;
            hasher.update(&bytes);
            hasher.update(&[0u8]);
        }
    }

    Ok(hasher.finalize().to_hex().to_string())
}

fn compute_post_v1_migrations_fingerprint(repo_root: &Path) -> Result<String> {
    let mut hasher = blake3::Hasher::new();

    let dir = repo_root.join("migrations_post_v1");
    if dir.exists() {
        let mut files: Vec<PathBuf> = std::fs::read_dir(&dir)
            .with_context(|| format!("failed to read migrations_post_v1 dir ({})", dir.display()))?
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.extension().and_then(|s| s.to_str()).unwrap_or("") == "sql")
            .collect();
        files.sort();

        for p in files {
            let rel = p
                .strip_prefix(repo_root)
                .unwrap_or(&p)
                .to_string_lossy()
                .replace('\\', "/");
            hasher.update(rel.as_bytes());
            hasher.update(&[0u8]);

            let bytes = std::fs::read(&p)
                .with_context(|| format!("failed to read migration file ({})", p.display()))?;
            hasher.update(&bytes);
            hasher.update(&[0u8]);
        }
    }

    Ok(hasher.finalize().to_hex().to_string())
}

fn run_migration_file(
    bin_dir: &Path,
    port: u16,
    db_user: &str,
    db_password: &str,
    db_name: &str,
    file: &Path,
) -> Result<()> {
    let psql_out = pg_cmd(bin_dir, "psql.exe")
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", port.to_string())
        .env("PGUSER", db_user)
        .env("PGPASSWORD", db_password)
        .env("PGDATABASE", db_name)
        .arg("-v")
        .arg("ON_ERROR_STOP=1")
        .arg("-f")
        .arg(file)
        .output()
        .with_context(|| format!("failed to run psql for migration ({})", file.display()))?;

    if !psql_out.status.success() {
        return Err(anyhow!(
            "migration failed ({}): {}",
            file.display(),
            String::from_utf8_lossy(&psql_out.stderr)
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
    cmd.current_dir(bin_dir)
        .env("PATH", pg_env(bin_dir))
        // Prevent psql from invoking a pager like `cat` (common in CI/dev tooling)
        // which is not available on Windows.
        .env("PAGER", "")
        .env("PSQL_PAGER", "");
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
        let (log, log_file) = open_postgres_log_file(log_file.clone())?;
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
        // If already running, derive the actual port from the live cluster.
        // `select_port()` can return a different free port, so never trust it in this branch.
        let running_port = std::env::var("ATLAS_PG_PORT")
            .ok()
            .and_then(|v| v.trim().parse::<u16>().ok())
            .or_else(|| running_port_from_postmaster_pid(&data_dir))
            .or_else(|| {
                pg_port_file()
                    .ok()
                    .and_then(|p| std::fs::read_to_string(p).ok())
                    .and_then(|s| s.trim().parse::<u16>().ok())
            })
            .unwrap_or(port);

        if let Ok(port_file) = pg_port_file() {
            let _ = std::fs::write(&port_file, format!("{}\n", running_port));
        }

        wait_port("127.0.0.1", running_port, 5);
        return Ok(PostgresHandle {
            port: running_port,
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

    if let Ok(port_file) = pg_port_file() {
        let _ = std::fs::write(&port_file, format!("{}\n", port));
    }

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
            "failed to check database existence (psql exit={}): {}",
            out.status,
            String::from_utf8_lossy(&out.stderr)
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

    // Forcer le search_path pour que les migrations non qualifiées créent leurs objets sous `atlas`.
    // (Sinon, elles finissent en `public` et le schéma diverge du runtime attendu.)
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
        .arg("ALTER ROLE atlas SET search_path = atlas, public;")
        .status()
        .with_context(|| format!("failed to set atlas search_path ({psql})"))?;
    if !status.success() {
        return Err(anyhow!("failed to set role search_path"));
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

    // Phase 9: seed-from-dump (v1) on first-run to avoid replaying all historical migrations.
    let repo_root = repo_root_from_tauri();

    let allow_force = std::env::var("ATLAS_FORCE_SEED_RESTORE")
        .map(|v| v.trim() == "1" || v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let mut seed_already_applied = false;
    if let Some(seed_path) = find_seed_dump(&repo_root) {
        if let Ok(seed_sha256) = compute_file_sha256_hex(&seed_path) {
            if desktop_seed_state_has_hash(&bin_dir, pg.port, &db_user, &db_password, &db_name, &seed_sha256)? {
                seed_already_applied = true;
            }
        }
    }

    let seed_hash_existing = get_desktop_state_value_if_table_exists(
        &bin_dir,
        pg.port,
        &db_user,
        &db_password,
        &db_name,
        "seed_hash",
    )?;
    if seed_hash_existing.is_some() || seed_already_applied {
        // DB seed already recorded (legacy key/value or new desktop_seed_state).
    } else {
        let looks_init = database_looks_initialized(&bin_dir, pg.port, &db_user, &db_password, &db_name)?;
        if looks_init && !allow_force {
            // Never destroy an existing user DB implicitly.
        } else if let Some(seed_path) = find_seed_dump(&repo_root) {
            let seed_sha256 = compute_file_sha256_hex(&seed_path)?;
            let max_mig = max_migration_number(&repo_root)?;

            restore_seed_dump(&bin_dir, pg.port, &db_user, &db_password, &db_name, &seed_path)?;

            // Create state tables AFTER restore (pg_restore --clean may drop schema atlas).
            ensure_desktop_state_table(&bin_dir, pg.port, &db_user, &db_password, &db_name)?;
            ensure_desktop_seed_state_table(&bin_dir, pg.port, &db_user, &db_password, &db_name)?;

            record_desktop_seed_state(
                &bin_dir,
                pg.port,
                &db_user,
                &db_password,
                &db_name,
                &seed_sha256,
                max_mig,
                "seed restore",
            )?;

            // Backward-compat state keys
            set_desktop_state_value(
                &bin_dir,
                pg.port,
                &db_user,
                &db_password,
                &db_name,
                "seed_version",
                "v1",
            )?;
            set_desktop_state_value(
                &bin_dir,
                pg.port,
                &db_user,
                &db_password,
                &db_name,
                "seed_hash",
                &seed_sha256,
            )?;
            set_desktop_state_value(
                &bin_dir,
                pg.port,
                &db_user,
                &db_password,
                &db_name,
                "seed_dump_path",
                &seed_path.to_string_lossy(),
            )?;
            set_desktop_state_value(
                &bin_dir,
                pg.port,
                &db_user,
                &db_password,
                &db_name,
                "seed_max_migration_applied",
                &max_mig.to_string(),
            )?;
        }
    }

    apply_repo_migrations(&bin_dir, pg.port, &db_user, &db_password, &db_name)?;

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
