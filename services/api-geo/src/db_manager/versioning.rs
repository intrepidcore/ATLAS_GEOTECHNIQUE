// Module de versioning et undo/redo
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeSet {
    pub id: Uuid,
    pub table_name: String,
    pub operation: ChangeOperation,
    pub changes: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub created_by: Option<String>,
    pub can_undo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChangeOperation {
    Insert,
    Update,
    Delete,
    Ddl,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableVersion {
    pub version: i32,
    pub table_name: String,
    pub schema_snapshot: serde_json::Value,
    pub row_count: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub description: Option<String>,
}

/// Créer un changeset pour tracking
#[allow(dead_code)]
pub async fn create_changeset(
    pool: &PgPool,
    table_name: &str,
    operation: ChangeOperation,
    changes: serde_json::Value,
    user: Option<&str>,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::new_v4();
    
    sqlx::query(
        r#"
        INSERT INTO atlas.changesets (id, table_name, operation, changes, created_by)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(id)
    .bind(table_name)
    .bind(serde_json::to_string(&operation).unwrap_or_default())
    .bind(&changes)
    .bind(user)
    .execute(pool)
    .await?;

    Ok(id)
}

/// Récupérer l'historique des changesets
pub async fn get_changesets(
    pool: &PgPool,
    table_name: Option<&str>,
    limit: i32,
) -> Result<Vec<ChangeSet>, sqlx::Error> {
    let query = if let Some(table) = table_name {
        sqlx::query_as::<_, (Uuid, String, String, serde_json::Value, chrono::DateTime<chrono::Utc>, Option<String>)>(
            r#"
            SELECT id, table_name, operation, changes, created_at, created_by
            FROM atlas.changesets
            WHERE table_name = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(table)
        .bind(limit)
    } else {
        sqlx::query_as::<_, (Uuid, String, String, serde_json::Value, chrono::DateTime<chrono::Utc>, Option<String>)>(
            r#"
            SELECT id, table_name, operation, changes, created_at, created_by
            FROM atlas.changesets
            ORDER BY created_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
    };

    let rows = query.fetch_all(pool).await?;

    let changesets = rows
        .into_iter()
        .map(|(id, table_name, operation, changes, created_at, created_by)| {
            let op: ChangeOperation = serde_json::from_str(&operation).unwrap_or(ChangeOperation::Update);
            ChangeSet {
                id,
                table_name,
                operation: op,
                changes,
                created_at,
                created_by,
                can_undo: true, // À déterminer selon la logique métier
            }
        })
        .collect();

    Ok(changesets)
}

/// Annuler un changeset (undo)
pub async fn undo_changeset(
    pool: &PgPool,
    changeset_id: &Uuid,
) -> Result<(), sqlx::Error> {
    // Récupérer le changeset
    let (table_name, operation, changes): (String, String, serde_json::Value) = sqlx::query_as(
        r#"
        SELECT table_name, operation, changes
        FROM atlas.changesets
        WHERE id = $1
        "#,
    )
    .bind(changeset_id)
    .fetch_one(pool)
    .await?;

    let op: ChangeOperation = serde_json::from_str(&operation).unwrap_or(ChangeOperation::Update);

    // Générer l'opération inverse
    match op {
        ChangeOperation::Insert => {
            // Supprimer les lignes insérées
            let ids = changes["inserted_ids"].as_array().ok_or_else(|| {
                sqlx::Error::Protocol("Invalid changeset format".to_string())
            })?;
            
            for id in ids {
                let delete_sql = format!("DELETE FROM {} WHERE id = $1", table_name);
                sqlx::query(&delete_sql)
                    .bind(id.as_str().unwrap_or_default())
                    .execute(pool)
                    .await?;
            }
        }
        ChangeOperation::Update => {
            // Restaurer les anciennes valeurs
            let updates = changes["updates"].as_array().ok_or_else(|| {
                sqlx::Error::Protocol("Invalid changeset format".to_string())
            })?;
            
            for update in updates {
                let id = update["id"].as_str().unwrap_or_default();
                let old_values = &update["old_values"];
                
                // Construire UPDATE pour restaurer
                // (Simplifié - dans la vraie implémentation, parser old_values)
                let restore_sql = format!(
                    "UPDATE {} SET data = $1 WHERE id = $2",
                    table_name
                );
                sqlx::query(&restore_sql)
                    .bind(old_values)
                    .bind(id)
                    .execute(pool)
                    .await?;
            }
        }
        ChangeOperation::Delete => {
            // Réinsérer les lignes supprimées
            let deleted_rows = changes["deleted_rows"].as_array().ok_or_else(|| {
                sqlx::Error::Protocol("Invalid changeset format".to_string())
            })?;
            
            for row in deleted_rows {
                // Construire INSERT (simplifié)
                let insert_sql = format!("INSERT INTO {} SELECT * FROM jsonb_populate_record(null::{}, $1)", table_name, table_name);
                sqlx::query(&insert_sql)
                    .bind(row)
                    .execute(pool)
                    .await?;
            }
        }
        ChangeOperation::Ddl => {
            // DDL undo est complexe - nécessite migration inverse
            return Err(sqlx::Error::Protocol(
                "DDL undo not implemented".to_string(),
            ));
        }
    }

    // Marquer le changeset comme annulé
    sqlx::query(
        r#"
        UPDATE atlas.changesets
        SET undone_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(changeset_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Créer une version snapshot d'une table
pub async fn create_table_version(
    pool: &PgPool,
    schema: &str,
    table: &str,
    description: Option<&str>,
) -> Result<i32, sqlx::Error> {
    // Récupérer le schéma de la table
    let schema_snapshot = get_table_schema_json(pool, schema, table).await?;

    // Compter les lignes
    let row_count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {}.{}", schema, table))
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    // Insérer la version
    let version: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.table_versions (table_name, schema_snapshot, row_count, description)
        VALUES ($1, $2, $3, $4)
        RETURNING version
        "#,
    )
    .bind(format!("{}.{}", schema, table))
    .bind(&schema_snapshot)
    .bind(row_count)
    .bind(description)
    .fetch_one(pool)
    .await?;

    Ok(version)
}

/// Récupérer le schéma d'une table en JSON
async fn get_table_schema_json(
    pool: &PgPool,
    schema: &str,
    table: &str,
) -> Result<serde_json::Value, sqlx::Error> {
    let columns: Vec<(String, String, bool)> = sqlx::query_as(
        r#"
        SELECT column_name, data_type, is_nullable::boolean
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
        "#,
    )
    .bind(schema)
    .bind(table)
    .fetch_all(pool)
    .await?;

    let schema_json = serde_json::json!({
        "columns": columns.iter().map(|(name, dtype, nullable)| {
            serde_json::json!({
                "name": name,
                "type": dtype,
                "nullable": nullable
            })
        }).collect::<Vec<_>>()
    });

    Ok(schema_json)
}

/// Lister les versions d'une table
type VersionRow = (i32, String, serde_json::Value, i64, chrono::DateTime<chrono::Utc>, Option<String>);

pub async fn list_table_versions(
    pool: &PgPool,
    table_name: &str,
) -> Result<Vec<TableVersion>, sqlx::Error> {
    let rows: Vec<VersionRow> = sqlx::query_as(
        r#"
        SELECT version, table_name, schema_snapshot, row_count, created_at, description
        FROM atlas.table_versions
        WHERE table_name = $1
        ORDER BY version DESC
        "#,
    )
    .bind(table_name)
    .fetch_all(pool)
    .await?;

    let versions = rows
        .into_iter()
        .map(|(version, table_name, schema_snapshot, row_count, created_at, description)| {
            TableVersion {
                version,
                table_name,
                schema_snapshot,
                row_count,
                created_at,
                description,
            }
        })
        .collect();

    Ok(versions)
}
