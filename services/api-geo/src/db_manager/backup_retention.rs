// Gestion des backups avec politique de rétention
// Utilise std::process::Command avec tokio::task::spawn_blocking pour async
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    pub backup_dir: PathBuf,
    pub retention_days: i32,
    pub max_backups_per_table: usize,
    pub compress: bool,
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            backup_dir: PathBuf::from("./backups"),
            retention_days: 7,
            max_backups_per_table: 10,
            compress: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableBackupInfo {
    pub file_path: PathBuf,
    pub table_name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub size_bytes: u64,
    pub checksum: Option<String>,
}

/// Crée un backup d'une table avec pg_dump (async via spawn_blocking)
pub async fn create_table_backup(
    table_name: &str,
    schema: &str,
    config: &BackupConfig,
) -> Result<TableBackupInfo, std::io::Error> {
    // Créer le dossier de backup si nécessaire
    fs::create_dir_all(&config.backup_dir).await?;

    // Nom du fichier avec timestamp
    let timestamp = chrono::Utc::now().format("%Y%m%dT%H%M%SZ");
    let table_safe = table_name.replace(".", "_");
    let filename = if config.compress {
        format!("{}_{}.{}.dump", schema, table_safe, timestamp)
    } else {
        format!("{}_{}.{}.sql", schema, table_safe, timestamp)
    };

    let backup_path = config.backup_dir.join(&filename);
    let backup_path_clone = backup_path.clone();

    // Variables d'environnement pour pg_dump
    let db_host = std::env::var("DB_HOST").unwrap_or_else(|_| "localhost".to_string());
    let db_port = std::env::var("DB_PORT").unwrap_or_else(|_| "5432".to_string());
    let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
    let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
    let db_password = std::env::var("PGPASSWORD").unwrap_or_else(|_| "atlas".to_string());

    let table_full = format!("{}.{}", schema, table_name);
    let compress = config.compress;

    // Exécuter pg_dump dans spawn_blocking (std::process est sync)
    let output = tokio::task::spawn_blocking(move || {
        use std::process::Command;
        
        let mut cmd = Command::new("pg_dump");
        cmd.env("PGPASSWORD", db_password);
        cmd.arg("-h").arg(&db_host);
        cmd.arg("-p").arg(&db_port);
        cmd.arg("-U").arg(&db_user);
        cmd.arg("-d").arg(&db_name);
        cmd.arg("-t").arg(&table_full);

        if compress {
            cmd.arg("-Fc"); // Format custom compressé
        }

        cmd.arg("-f").arg(&backup_path_clone);

        cmd.output()
    })
    .await
    .map_err(|e| std::io::Error::other(format!("Task join error: {}", e)))?
    ?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(std::io::Error::other(
            format!("pg_dump failed: {}", error_msg),
        ));
    }

    // Récupérer la taille du fichier
    let metadata = fs::metadata(&backup_path).await?;
    let size_bytes = metadata.len();

    // Calculer checksum SHA256
    let checksum = calculate_checksum(&backup_path).await.ok();

    Ok(TableBackupInfo {
        file_path: backup_path,
        table_name: table_name.to_string(),
        created_at: chrono::Utc::now(),
        size_bytes,
        checksum,
    })
}

/// Calcule le checksum SHA256 d'un fichier
async fn calculate_checksum(path: &Path) -> Result<String, std::io::Error> {
    use sha2::{Digest, Sha256};
    
    let content = fs::read(path).await?;
    let mut hasher = Sha256::new();
    hasher.update(&content);
    let result = hasher.finalize();
    
    Ok(format!("{:x}", result))
}

/// Liste tous les backups d'une table
pub async fn list_table_backups(
    table_name: &str,
    config: &BackupConfig,
) -> Result<Vec<TableBackupInfo>, std::io::Error> {
    let mut backups = Vec::new();

    if !config.backup_dir.exists() {
        return Ok(backups);
    }

    let table_safe = table_name.replace(".", "_");
    let mut entries = fs::read_dir(&config.backup_dir).await?;

    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
            if filename.contains(&table_safe) && (filename.ends_with(".dump") || filename.ends_with(".sql")) {
                if let Ok(metadata) = fs::metadata(&path).await {
                    // Parser le timestamp du nom de fichier
                    if let Some(timestamp_str) = extract_timestamp(filename) {
                        if let Ok(created_at) = chrono::DateTime::parse_from_str(
                            &format!("{}+00:00", timestamp_str),
                            "%Y%m%dT%H%M%SZ%z",
                        ) {
                            backups.push(TableBackupInfo {
                                file_path: path.clone(),
                                table_name: table_name.to_string(),
                                created_at: created_at.with_timezone(&chrono::Utc),
                                size_bytes: metadata.len(),
                                checksum: None,
                            });
                        }
                    }
                }
            }
        }
    }

    // Trier par date décroissante
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(backups)
}

/// Extrait le timestamp du nom de fichier
fn extract_timestamp(filename: &str) -> Option<String> {
    // Format: schema_table.YYYYMMDDTHHMMSSZ.dump
    let parts: Vec<&str> = filename.split('.').collect();
    if parts.len() >= 2 {
        Some(parts[parts.len() - 2].to_string())
    } else {
        None
    }
}

/// Applique la politique de rétention (supprime les vieux backups)
pub async fn apply_retention_policy(
    table_name: &str,
    config: &BackupConfig,
) -> Result<usize, std::io::Error> {
    let backups = list_table_backups(table_name, config).await?;
    let mut deleted_count = 0;

    let retention_cutoff = chrono::Utc::now() - chrono::Duration::days(config.retention_days as i64);

    for (index, backup) in backups.iter().enumerate() {
        // Supprimer si:
        // 1. Plus vieux que retention_days
        // 2. OU au-delà de max_backups_per_table
        let should_delete = backup.created_at < retention_cutoff || index >= config.max_backups_per_table;

        if should_delete {
            if let Err(e) = fs::remove_file(&backup.file_path).await {
                eprintln!("Erreur suppression backup {:?}: {}", backup.file_path, e);
            } else {
                deleted_count += 1;
            }
        }
    }

    Ok(deleted_count)
}

/// Restaure un backup (async via spawn_blocking)
pub async fn restore_backup(
    backup_path: &Path,
    _schema: &str,
    _table_name: &str,
) -> Result<(), std::io::Error> {
    let db_host = std::env::var("DB_HOST").unwrap_or_else(|_| "localhost".to_string());
    let db_port = std::env::var("DB_PORT").unwrap_or_else(|_| "5432".to_string());
    let db_user = std::env::var("DB_USER").unwrap_or_else(|_| "atlas".to_string());
    let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "atlas_clean".to_string());
    let db_password = std::env::var("PGPASSWORD").unwrap_or_else(|_| "atlas".to_string());

    // Utiliser pg_restore pour les dumps compressés
    let is_compressed = backup_path.extension().and_then(|e| e.to_str()) == Some("dump");
    let backup_path_clone = backup_path.to_path_buf();

    let output = tokio::task::spawn_blocking(move || {
        use std::process::Command;
        
        let mut cmd = if is_compressed {
            let mut c = Command::new("pg_restore");
            c.arg("-Fc");
            c
        } else {
            Command::new("psql")
        };

        cmd.env("PGPASSWORD", db_password);
        cmd.arg("-h").arg(&db_host);
        cmd.arg("-p").arg(&db_port);
        cmd.arg("-U").arg(&db_user);
        cmd.arg("-d").arg(&db_name);

        if is_compressed {
            cmd.arg(backup_path_clone);
        } else {
            cmd.arg("-f").arg(backup_path_clone);
        }

        cmd.output()
    })
    .await
    .map_err(|e| std::io::Error::other(format!("Task join error: {}", e)))?
    ?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(std::io::Error::other(
            format!("Restore failed: {}", error_msg),
        ));
    }

    Ok(())
}

/// Nettoie tous les backups expirés (toutes tables)
pub async fn cleanup_all_expired_backups(config: &BackupConfig) -> Result<usize, std::io::Error> {
    let mut total_deleted = 0;

    if !config.backup_dir.exists() {
        return Ok(0);
    }

    let retention_cutoff = chrono::Utc::now() - chrono::Duration::days(config.retention_days as i64);
    let mut entries = fs::read_dir(&config.backup_dir).await?;

    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if let Ok(metadata) = fs::metadata(&path).await {
            if let Ok(modified) = metadata.modified() {
                let modified_dt: chrono::DateTime<chrono::Utc> = modified.into();
                if modified_dt < retention_cutoff {
                    if let Err(e) = fs::remove_file(&path).await {
                        eprintln!("Erreur suppression {:?}: {}", path, e);
                    } else {
                        total_deleted += 1;
                    }
                }
            }
        }
    }

    Ok(total_deleted)
}
