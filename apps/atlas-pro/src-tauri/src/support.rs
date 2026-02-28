use std::io::Write;

use serde::Serialize;
use tauri::State;

use crate::{postgres, ManagedPaths, ManagedPostgres};

#[derive(Serialize)]
struct DiagnosticManifest {
    product: String,
    version: String,
    data_dir: String,
    logs_dir: String,
    postgres_port: Option<u16>,
}

#[tauri::command]
pub fn diagnostic_export(
    paths: State<'_, ManagedPaths>,
    pg: State<'_, ManagedPostgres>,
) -> Result<String, String> {
    let export_root = paths.data_dir.join("support").join("diagnostic");
    std::fs::create_dir_all(&export_root)
        .map_err(|e| format!("failed to create diagnostic dir ({}): {e}", export_root.display()))?;

    let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let out_dir = export_root.join(format!("diag_{ts}"));
    std::fs::create_dir_all(&out_dir)
        .map_err(|e| format!("failed to create diagnostic output dir ({}): {e}", out_dir.display()))?;

    // Copier logs (best-effort)
    let _ = copy_if_exists(&paths.logs_dir.join("tauri.log"), &out_dir.join("tauri.log"));
    let _ = copy_if_exists(&paths.logs_dir.join("postgres.log"), &out_dir.join("postgres.log"));
    let _ = copy_if_exists(&paths.logs_dir.join("api-geo.log"), &out_dir.join("api-geo.log"));

    let port = pg
        .0
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|h| h.port));

    let manifest = DiagnosticManifest {
        product: "Atlas Desktop – IntrepidCore".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        data_dir: paths.data_dir.to_string_lossy().to_string(),
        logs_dir: paths.logs_dir.to_string_lossy().to_string(),
        postgres_port: port,
    };

    let json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("failed to serialize manifest: {e}"))?;
    std::fs::write(out_dir.join("manifest.json"), json)
        .map_err(|e| format!("failed to write manifest.json: {e}"))?;

    Ok(out_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn db_integrity_check(pg: State<'_, ManagedPostgres>) -> Result<(), String> {
    let handle = pg
        .0
        .lock()
        .map_err(|_| "postgres state lock poisoned".to_string())?;
    let Some(h) = handle.as_ref() else {
        return Err("PostgreSQL not started".to_string());
    };

    let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
    let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
    let db_password = postgres::ensure_password().map_err(|e| e.to_string())?;

    // pg_isready
    let pg_isready = postgres::pg_tool_path("pg_isready.exe");
    let status = std::process::Command::new(&pg_isready)
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", h.port.to_string())
        .env("PGUSER", &db_user)
        .env("PGDATABASE", &db_name)
        .status()
        .map_err(|e| format!("failed to run pg_isready: {e}"))?;
    if !status.success() {
        return Err("pg_isready failed".to_string());
    }

    // SELECT 1 + postgis_version()
    let psql = postgres::pg_tool_path("psql.exe");
    let mut cmd = std::process::Command::new(&psql);
    cmd.env("PGHOST", "127.0.0.1")
        .env("PGPORT", h.port.to_string())
        .env("PGUSER", &db_user)
        .env("PGPASSWORD", &db_password)
        .arg("-d")
        .arg(&db_name)
        .arg("-v")
        .arg("ON_ERROR_STOP=1")
        .arg("-tAc")
        .arg("SELECT 1; SELECT postgis_version();");

    let status = cmd.status().map_err(|e| format!("failed to run psql: {e}"))?;
    if !status.success() {
        return Err("psql integrity queries failed".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn db_backup(pg: State<'_, ManagedPostgres>, paths: State<'_, ManagedPaths>) -> Result<String, String> {
    let handle = pg
        .0
        .lock()
        .map_err(|_| "postgres state lock poisoned".to_string())?;
    let Some(h) = handle.as_ref() else {
        return Err("PostgreSQL not started".to_string());
    };

    let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
    let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
    let db_password = postgres::ensure_password().map_err(|e| e.to_string())?;

    let backup_dir = paths.data_dir.join("backups");
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("failed to create backup dir ({}): {e}", backup_dir.display()))?;

    let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let out = backup_dir.join(format!("atlas_{db_name}_{ts}.dump"));

    let pg_dump = postgres::pg_tool_path("pg_dump.exe");
    let status = std::process::Command::new(&pg_dump)
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", h.port.to_string())
        .env("PGUSER", &db_user)
        .env("PGPASSWORD", &db_password)
        .arg("-Fc")
        .arg("-f")
        .arg(&out)
        .arg(&db_name)
        .status()
        .map_err(|e| format!("failed to run pg_dump: {e}"))?;

    if !status.success() {
        return Err("pg_dump failed".to_string());
    }

    Ok(out.to_string_lossy().to_string())
}

#[tauri::command]
pub fn db_restore(
    pg: State<'_, ManagedPostgres>,
    dump_path: String,
) -> Result<(), String> {
    let handle = pg
        .0
        .lock()
        .map_err(|_| "postgres state lock poisoned".to_string())?;
    let Some(h) = handle.as_ref() else {
        return Err("PostgreSQL not started".to_string());
    };

    let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
    let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
    let db_password = postgres::ensure_password().map_err(|e| e.to_string())?;

    let dump_path = std::path::PathBuf::from(dump_path);
    if !dump_path.exists() {
        return Err(format!("dump file not found: {}", dump_path.display()));
    }

    let pg_restore = postgres::pg_tool_path("pg_restore.exe");
    let status = std::process::Command::new(&pg_restore)
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", h.port.to_string())
        .env("PGUSER", &db_user)
        .env("PGPASSWORD", &db_password)
        .arg("--clean")
        .arg("--if-exists")
        .arg("-d")
        .arg(&db_name)
        .arg(&dump_path)
        .status()
        .map_err(|e| format!("failed to run pg_restore: {e}"))?;

    if !status.success() {
        return Err("pg_restore failed".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn db_reset(paths: State<'_, ManagedPaths>, pg: State<'_, ManagedPostgres>) -> Result<String, String> {
    // Arrêt postgres best-effort
    if let Ok(mut guard) = pg.0.lock() {
        if let Some(h) = guard.as_ref() {
            let _ = crate::postgres::stop_postgres(h);
        }
        guard.take();
    }

    let cluster_dir = paths.data_dir.join("postgres");
    if !cluster_dir.exists() {
        return Ok("cluster_not_found".to_string());
    }

    let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let quarantine = paths.data_dir.join(format!("postgres.reset.{ts}"));

    std::fs::rename(&cluster_dir, &quarantine)
        .map_err(|e| format!("failed to quarantine cluster ({} -> {}): {e}", cluster_dir.display(), quarantine.display()))?;

    Ok(quarantine.to_string_lossy().to_string())
}

fn copy_if_exists(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    if src.exists() {
        let mut input = std::fs::File::open(src)?;
        let mut output = std::fs::File::create(dst)?;
        std::io::copy(&mut input, &mut output)?;
        output.flush()?;
    }
    Ok(())
}
