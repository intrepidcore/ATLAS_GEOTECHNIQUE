use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};

use tauri::State;

use crate::{postgres, ManagedPostgres};

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct PlatformInfo {
    pub signature: String,
    pub url: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct RemoteVersionInfo {
    pub version: String,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
    pub min_schema_version: Option<i32>,
    pub platforms: Option<HashMap<String, PlatformInfo>>,
}

#[derive(Serialize, Debug, Clone)]
pub struct UpdateCheckResult {
    pub update_available: bool,
    pub current_version: String,
    pub remote_version: Option<String>,
    pub notes: Option<String>,
    pub schema_compatible: bool,
    pub last_checked_at: String,
    pub error: Option<String>,
}

fn escape_sql_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "").replace('\'', "''")
}

fn psql_query_scalar(port: u16, sql: &str) -> Result<String, String> {
    let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
    let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
    let db_password = postgres::ensure_password().map_err(|e| e.to_string())?;

    let psql = postgres::pg_tool_path("psql.exe");
    let out = std::process::Command::new(&psql)
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", port.to_string())
        .env("PGUSER", &db_user)
        .env("PGPASSWORD", &db_password)
        .env("PGDATABASE", &db_name)
        .env("PAGER", "")
        .env("PSQL_PAGER", "")
        .arg("-tAc")
        .arg(sql)
        .output()
        .map_err(|e| format!("psql spawn failed: {e}"))?;

    if !out.status.success() {
        return Err(format!(
            "psql failed (exit={}): {}",
            out.status,
            String::from_utf8_lossy(&out.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

fn psql_exec(port: u16, sql: &str) -> Result<(), String> {
    let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
    let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
    let db_password = postgres::ensure_password().map_err(|e| e.to_string())?;

    let psql = postgres::pg_tool_path("psql.exe");
    let out = std::process::Command::new(&psql)
        .env("PGHOST", "127.0.0.1")
        .env("PGPORT", port.to_string())
        .env("PGUSER", &db_user)
        .env("PGPASSWORD", &db_password)
        .env("PGDATABASE", &db_name)
        .env("PAGER", "")
        .env("PSQL_PAGER", "")
        .arg("-v")
        .arg("ON_ERROR_STOP=1")
        .arg("-tAc")
        .arg(sql)
        .output()
        .map_err(|e| format!("psql spawn failed: {e}"))?;

    if !out.status.success() {
        return Err(format!(
            "psql failed (exit={}): {}",
            out.status,
            String::from_utf8_lossy(&out.stderr)
        ));
    }

    Ok(())
}

fn get_current_schema_version(port: u16) -> i32 {
    let exists = psql_query_scalar(
        port,
        "SELECT 1 FROM information_schema.tables WHERE table_schema='atlas' AND table_name='desktop_seed_state' LIMIT 1;",
    )
    .ok();

    if exists.as_deref() != Some("1") {
        return 0;
    }

    psql_query_scalar(
        port,
        "SELECT COALESCE(MAX(max_migration_applied), 0) FROM atlas.desktop_seed_state;",
    )
    .ok()
    .and_then(|s| s.parse::<i32>().ok())
    .unwrap_or(0)
}

fn log_update_check(
    port: u16,
    current_version: &str,
    remote_version: Option<&str>,
    update_available: Option<bool>,
    min_schema_required: Option<i32>,
    current_schema_version: Option<i32>,
    schema_compatible: Option<bool>,
    check_duration_ms: Option<i32>,
    error: Option<&str>,
    update_url: &str,
) {
    let current_version = escape_sql_string(current_version);
    let remote_version = remote_version.map(escape_sql_string);
    let error = error.map(escape_sql_string);
    let update_url = escape_sql_string(update_url);

    let sql = format!(
        "INSERT INTO atlas.update_check_log (current_version, remote_version, update_available, min_schema_required, current_schema_version, schema_compatible, check_duration_ms, error, update_url) VALUES ('{}', {}, {}, {}, {}, {}, {}, {}, '{}');",
        current_version,
        remote_version
            .as_ref()
            .map(|v| format!("'{}'", v))
            .unwrap_or_else(|| "NULL".to_string()),
        update_available
            .map(|v| if v { "TRUE" } else { "FALSE" }.to_string())
            .unwrap_or_else(|| "NULL".to_string()),
        min_schema_required
            .map(|v| v.to_string())
            .unwrap_or_else(|| "NULL".to_string()),
        current_schema_version
            .map(|v| v.to_string())
            .unwrap_or_else(|| "NULL".to_string()),
        schema_compatible
            .map(|v| if v { "TRUE" } else { "FALSE" }.to_string())
            .unwrap_or_else(|| "NULL".to_string()),
        check_duration_ms
            .map(|v| v.to_string())
            .unwrap_or_else(|| "NULL".to_string()),
        error
            .as_ref()
            .map(|v| format!("'{}'", v))
            .unwrap_or_else(|| "NULL".to_string()),
        update_url,
    );

    let _ = psql_exec(port, &sql);
}

#[tauri::command]
pub async fn check_for_updates(
    pg: State<'_, ManagedPostgres>,
    update_url: Option<String>,
) -> Result<UpdateCheckResult, String> {
    let port = {
        let handle = pg
            .0
            .lock()
            .map_err(|_| "postgres state lock poisoned".to_string())?;
        let Some(h) = handle.as_ref() else {
            return Err("PostgreSQL not started".to_string());
        };
        h.port
    };

    let url = update_url
        .unwrap_or_else(|| std::env::var("ATLAS_UPDATE_URL").unwrap_or_default())
        .trim()
        .to_string();
    if url.is_empty() {
        return Err("ATLAS_UPDATE_URL not set".to_string());
    }

    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let current_schema_version = get_current_schema_version(port);

    let start = Instant::now();

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => {
            log_update_check(
                port,
                &current_version,
                None,
                None,
                None,
                Some(current_schema_version),
                None,
                Some(start.elapsed().as_millis() as i32),
                Some(&e.to_string()),
                &url,
            );

            return Ok(UpdateCheckResult {
                update_available: false,
                current_version,
                remote_version: None,
                notes: None,
                schema_compatible: true,
                last_checked_at: chrono::Utc::now().to_rfc3339(),
                error: Some(e.to_string()),
            });
        }
    };

    let info = match resp.json::<RemoteVersionInfo>().await {
        Ok(v) => v,
        Err(e) => {
            log_update_check(
                port,
                &current_version,
                None,
                None,
                None,
                Some(current_schema_version),
                None,
                Some(start.elapsed().as_millis() as i32),
                Some(&e.to_string()),
                &url,
            );

            return Ok(UpdateCheckResult {
                update_available: false,
                current_version,
                remote_version: None,
                notes: None,
                schema_compatible: true,
                last_checked_at: chrono::Utc::now().to_rfc3339(),
                error: Some(e.to_string()),
            });
        }
    };

    let update_available = info.version.as_str() > current_version.as_str();
    let schema_compatible = info
        .min_schema_version
        .map(|min| current_schema_version >= min)
        .unwrap_or(true);

    log_update_check(
        port,
        &current_version,
        Some(&info.version),
        Some(update_available),
        info.min_schema_version,
        Some(current_schema_version),
        Some(schema_compatible),
        Some(start.elapsed().as_millis() as i32),
        None,
        &url,
    );

    Ok(UpdateCheckResult {
        update_available,
        current_version,
        remote_version: Some(info.version),
        notes: info.notes,
        schema_compatible,
        last_checked_at: chrono::Utc::now().to_rfc3339(),
        error: None,
    })
}
