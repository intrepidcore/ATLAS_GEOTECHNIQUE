// Gestion des sauvegardes et points de restauration
use super::types::*;
use sqlx::{PgPool, Row};

/// Crée un point de restauration (backup)
pub async fn create_backup(
    pool: &PgPool,
    request: CreateBackupRequest,
) -> Result<BackupInfo, sqlx::Error> {
    let backup_id = uuid::Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");

    // Créer un schéma de backup temporaire
    let backup_schema = format!("backup_{}_{}", timestamp, &backup_id[..8]);

    sqlx::query(&format!(
        "CREATE SCHEMA IF NOT EXISTS \"{}\"",
        backup_schema
    ))
    .execute(pool)
    .await?;

    let mut total_size: i64 = 0;

    // Copier chaque table dans le schéma de backup
    for table in &request.tables {
        let parts: Vec<&str> = table.split('.').collect();
        let (schema, table_name) = if parts.len() == 2 {
            (parts[0], parts[1])
        } else {
            ("public", parts[0])
        };

        let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(schema)
            .fetch_one(pool)
            .await?;
        let table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(table_name)
            .fetch_one(pool)
            .await?;
        let backup_schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(&backup_schema)
            .fetch_one(pool)
            .await?;

        // Créer la table de backup
        let create_query = format!(
            "CREATE TABLE {}.{} AS SELECT * FROM {}.{}",
            backup_schema_ident, table_ident, schema_ident, table_ident
        );
        sqlx::query(&create_query).execute(pool).await?;

        // Calculer la taille
        let size_query = format!(
            "SELECT pg_total_relation_size('{}.{}'::regclass)",
            backup_schema, table_name
        );
        let size: i64 = sqlx::query_scalar(&size_query)
            .fetch_one(pool)
            .await
            .unwrap_or(0);
        total_size += size;
    }

    // Enregistrer les métadonnées du backup
    sqlx::query(
        r#"
        INSERT INTO atlas.backup_metadata 
        (backup_id, backup_schema, tables, description, size_bytes, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        "#,
    )
    .bind(&backup_id)
    .bind(&backup_schema)
    .bind(&request.tables)
    .bind(&request.description)
    .bind(total_size)
    .execute(pool)
    .await?;

    Ok(BackupInfo {
        backup_id,
        tables: request.tables,
        created_at: chrono::Utc::now(),
        size_bytes: total_size,
        description: request.description,
    })
}

/// Liste les backups disponibles
pub async fn list_backups(pool: &PgPool) -> Result<Vec<BackupInfo>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT 
            backup_id,
            tables,
            description,
            size_bytes,
            created_at
        FROM atlas.backup_metadata
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut backups = Vec::new();
    for row in rows {
        backups.push(BackupInfo {
            backup_id: row.try_get("backup_id")?,
            tables: row.try_get("tables")?,
            created_at: row.try_get("created_at")?,
            size_bytes: row.try_get("size_bytes")?,
            description: row.try_get("description").ok(),
        });
    }

    Ok(backups)
}

/// Restaure un backup
pub async fn restore_backup(pool: &PgPool, backup_id: &str) -> Result<RestoreResult, sqlx::Error> {
    // Récupérer les métadonnées du backup
    let row = sqlx::query(
        r#"
        SELECT backup_schema, tables
        FROM atlas.backup_metadata
        WHERE backup_id = $1
        "#,
    )
    .bind(backup_id)
    .fetch_one(pool)
    .await?;

    let backup_schema: String = row.try_get("backup_schema")?;
    let tables: Vec<String> = row.try_get("tables")?;

    let mut restored_tables = Vec::new();
    let mut errors = Vec::new();

    // Restaurer chaque table
    for table in &tables {
        let parts: Vec<&str> = table.split('.').collect();
        let (schema, table_name) = if parts.len() == 2 {
            (parts[0], parts[1])
        } else {
            ("public", parts[0])
        };

        match restore_table(pool, &backup_schema, schema, table_name).await {
            Ok(_) => restored_tables.push(table.clone()),
            Err(e) => errors.push(format!(
                "Erreur lors de la restauration de {}: {}",
                table, e
            )),
        }
    }

    Ok(RestoreResult {
        success: errors.is_empty(),
        tables_restored: restored_tables,
        errors,
    })
}

/// Restaure une table spécifique
async fn restore_table(
    pool: &PgPool,
    backup_schema: &str,
    target_schema: &str,
    table_name: &str,
) -> Result<(), sqlx::Error> {
    let backup_schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(backup_schema)
        .fetch_one(pool)
        .await?;
    let target_schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(target_schema)
        .fetch_one(pool)
        .await?;
    let table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(table_name)
        .fetch_one(pool)
        .await?;

    // Commencer une transaction
    let mut tx = pool.begin().await?;

    // Renommer la table actuelle
    let temp_name = format!("{}_old_{}", table_name, chrono::Utc::now().timestamp());
    let temp_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&temp_name)
        .fetch_one(&mut *tx)
        .await?;

    let rename_current = format!(
        "ALTER TABLE {}.{} RENAME TO {}",
        target_schema_ident, table_ident, temp_ident
    );
    sqlx::query(&rename_current).execute(&mut *tx).await?;

    // Copier la table de backup
    let restore_query = format!(
        "CREATE TABLE {}.{} AS SELECT * FROM {}.{}",
        target_schema_ident, table_ident, backup_schema_ident, table_ident
    );
    sqlx::query(&restore_query).execute(&mut *tx).await?;

    // Supprimer l'ancienne table
    let drop_old = format!(
        "DROP TABLE IF EXISTS {}.{}",
        target_schema_ident, temp_ident
    );
    sqlx::query(&drop_old).execute(&mut *tx).await?;

    tx.commit().await?;

    Ok(())
}

/// Supprime un backup
pub async fn delete_backup(pool: &PgPool, backup_id: &str) -> Result<(), sqlx::Error> {
    // Récupérer le schéma de backup
    let backup_schema: String =
        sqlx::query_scalar("SELECT backup_schema FROM atlas.backup_metadata WHERE backup_id = $1")
            .bind(backup_id)
            .fetch_one(pool)
            .await?;

    // Supprimer le schéma
    let backup_schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&backup_schema)
        .fetch_one(pool)
        .await?;

    let drop_schema = format!("DROP SCHEMA IF EXISTS {} CASCADE", backup_schema_ident);
    sqlx::query(&drop_schema).execute(pool).await?;

    // Supprimer les métadonnées
    sqlx::query("DELETE FROM atlas.backup_metadata WHERE backup_id = $1")
        .bind(backup_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Crée un backup automatique avant une opération critique
pub async fn create_auto_backup(
    pool: &PgPool,
    schema: &str,
    table: &str,
    reason: &str,
) -> Result<BackupInfo, sqlx::Error> {
    create_backup(
        pool,
        CreateBackupRequest {
            tables: vec![format!("{}.{}", schema, table)],
            description: Some(format!("Backup automatique: {}", reason)),
        },
    )
    .await
}
