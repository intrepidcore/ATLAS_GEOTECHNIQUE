// Gestion du staging (modifications en attente)
use super::types::*;
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use uuid::Uuid;

/// Crée une table de staging
pub async fn create_staging(
    pool: &PgPool,
    schema: &str,
    table: &str,
    request: CreateStagingRequest,
) -> Result<StagingInfo, sqlx::Error> {
    let staging_id = Uuid::new_v4().to_string();
    let staging_table = format!("staging_{}_{}", table, staging_id.replace("-", "_"));

    let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(schema)
        .fetch_one(pool)
        .await?;
    let table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(table)
        .fetch_one(pool)
        .await?;
    let staging_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_table)
        .fetch_one(pool)
        .await?;

    // Créer la table de staging comme copie de la table originale
    let create_query = format!(
        "CREATE TABLE {}.{} (LIKE {}.{} INCLUDING ALL)",
        schema_ident, staging_ident, schema_ident, table_ident
    );
    sqlx::query(&create_query).execute(pool).await?;

    // Copier les données
    let copy_query = format!(
        "INSERT INTO {}.{} SELECT * FROM {}.{}",
        schema_ident, staging_ident, schema_ident, table_ident
    );
    sqlx::query(&copy_query).execute(pool).await?;

    // Ajouter une colonne pour tracker les opérations
    let alter_query = format!(
        "ALTER TABLE {}.{} ADD COLUMN IF NOT EXISTS _staging_op VARCHAR(10)",
        schema_ident, staging_ident
    );
    sqlx::query(&alter_query).execute(pool).await?;

    // Enregistrer le staging dans une table de métadonnées
    sqlx::query(
        r#"
        INSERT INTO atlas.staging_metadata 
        (staging_id, table_name, schema_name, staging_table_name, reason, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        "#,
    )
    .bind(&staging_id)
    .bind(table)
    .bind(schema)
    .bind(&staging_table)
    .bind(&request.reason)
    .execute(pool)
    .await?;

    let row_count: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM {}.{}",
        schema_ident, staging_ident
    ))
    .fetch_one(pool)
    .await?;

    Ok(StagingInfo {
        staging_id: staging_table,  // Retourner le nom de table complet sans tirets
        table_name: table.to_string(),
        schema_name: schema.to_string(),
        created_at: chrono::Utc::now(),
        reason: request.reason,
        row_count,
        operations_count: 0,
    })
}

/// Applique une opération dans le staging
pub async fn apply_staging_operation(
    pool: &PgPool,
    staging_id: &str,
    operation: StagingRowOperation,
) -> Result<(), sqlx::Error> {
    // Récupérer les infos du staging
    let staging_info = get_staging_info(pool, staging_id).await?;
    let staging_table = get_staging_table_name(pool, staging_id).await?;

    let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_info.schema_name)
        .fetch_one(pool)
        .await?;
    let staging_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_table)
        .fetch_one(pool)
        .await?;

    match operation.op {
        RowOperation::Insert => {
            let columns: Vec<String> = operation.data.keys().cloned().collect();
            let values: Vec<String> = operation.data.values().map(value_to_sql_string).collect();

            let columns_str = columns
                .iter()
                .map(|c| format!("\"{}\"", c))
                .collect::<Vec<_>>()
                .join(", ");
            let values_str = values.join(", ");

            let query = format!(
                "INSERT INTO {}.{} ({}, _staging_op) VALUES ({}, 'INSERT')",
                schema_ident, staging_ident, columns_str, values_str
            );
            sqlx::query(&query).execute(pool).await?;
        }
        RowOperation::Update => {
            if let Some(row_id) = operation.row_id {
                let set_clauses: Vec<String> = operation
                    .data
                    .iter()
                    .map(|(k, v)| format!("\"{}\" = {}", k, value_to_sql_string(v)))
                    .collect();

                let query = format!(
                    "UPDATE {}.{} SET {}, _staging_op = 'UPDATE' WHERE id = $1",
                    schema_ident,
                    staging_ident,
                    set_clauses.join(", ")
                );
                sqlx::query(&query).bind(&row_id).execute(pool).await?;
            }
        }
        RowOperation::Delete => {
            if let Some(row_id) = operation.row_id {
                let query = format!(
                    "UPDATE {}.{} SET _staging_op = 'DELETE' WHERE id = $1",
                    schema_ident, staging_ident
                );
                sqlx::query(&query).bind(&row_id).execute(pool).await?;
            }
        }
    }

    // Incrémenter le compteur d'opérations
    sqlx::query(
        "UPDATE atlas.staging_metadata SET operations_count = operations_count + 1 WHERE staging_id = $1"
    )
    .bind(staging_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Valide un staging
pub async fn validate_staging(
    pool: &PgPool,
    staging_id: &str,
) -> Result<StagingValidationResult, sqlx::Error> {
    let staging_info = get_staging_info(pool, staging_id).await?;
    let staging_table = get_staging_table_name(pool, staging_id).await?;

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Vérifier les contraintes NOT NULL
    let columns =
        super::schema::get_columns(pool, &staging_info.schema_name, &staging_info.table_name)
            .await?;

    for column in columns
        .iter()
        .filter(|c| !c.is_nullable && c.column_default.is_none())
    {
        let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(&staging_info.schema_name)
            .fetch_one(pool)
            .await?;
        let staging_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(&staging_table)
            .fetch_one(pool)
            .await?;
        let column_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(&column.name)
            .fetch_one(pool)
            .await?;

        let null_count: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {}.{} WHERE {} IS NULL AND _staging_op != 'DELETE'",
            schema_ident, staging_ident, column_ident
        ))
        .fetch_one(pool)
        .await?;

        if null_count > 0 {
            errors.push(ValidationError {
                row_id: None,
                column: Some(column.name.clone()),
                error_type: "NULL_CONSTRAINT".to_string(),
                message: format!(
                    "La colonne '{}' ne peut pas être NULL ({} lignes)",
                    column.name, null_count
                ),
            });
        }
    }

    // Vérifier les géométries si applicable
    let geom_info =
        super::schema::get_geometry_info(pool, &staging_info.schema_name, &staging_info.table_name)
            .await?;

    if let Some((geom_column, _, _)) = geom_info {
        let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(&staging_info.schema_name)
            .fetch_one(pool)
            .await?;
        let staging_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(&staging_table)
            .fetch_one(pool)
            .await?;
        let geom_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(&geom_column)
            .fetch_one(pool)
            .await?;

        let invalid_geom_count: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {}.{} WHERE {} IS NOT NULL AND NOT ST_IsValid({}) AND _staging_op != 'DELETE'",
            schema_ident, staging_ident, geom_ident, geom_ident
        ))
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        if invalid_geom_count > 0 {
            warnings.push(ValidationWarning {
                message: format!("{} géométries invalides détectées", invalid_geom_count),
                affected_rows: invalid_geom_count,
            });
        }
    }

    Ok(StagingValidationResult {
        is_valid: errors.is_empty(),
        errors,
        warnings,
    })
}

/// Prévisualise les changements du staging
pub async fn preview_staging(
    pool: &PgPool,
    staging_id: &str,
    limit: Option<i64>,
) -> Result<StagingPreview, sqlx::Error> {
    let staging_info = get_staging_info(pool, staging_id).await?;
    let staging_table = get_staging_table_name(pool, staging_id).await?;
    let limit = limit.unwrap_or(50);

    let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_info.schema_name)
        .fetch_one(pool)
        .await?;
    let staging_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_table)
        .fetch_one(pool)
        .await?;
    let table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_info.table_name)
        .fetch_one(pool)
        .await?;

    // Compter les opérations
    let inserts: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM {}.{} WHERE _staging_op = 'INSERT'",
        schema_ident, staging_ident
    ))
    .fetch_one(pool)
    .await?;

    let updates: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM {}.{} WHERE _staging_op = 'UPDATE'",
        schema_ident, staging_ident
    ))
    .fetch_one(pool)
    .await?;

    let deletes: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM {}.{} WHERE _staging_op = 'DELETE'",
        schema_ident, staging_ident
    ))
    .fetch_one(pool)
    .await?;

    // Récupérer un échantillon des changements
    let query = format!(
        "SELECT * FROM {}.{} WHERE _staging_op IS NOT NULL LIMIT {}",
        schema_ident, staging_ident, limit
    );

    let rows = sqlx::query(&query).fetch_all(pool).await?;
    let columns =
        super::schema::get_columns(pool, &staging_info.schema_name, &staging_info.table_name)
            .await?;

    let mut operations = Vec::new();
    for row in rows {
        let op_str: Option<String> = row.try_get("_staging_op").ok().flatten();
        if let Some(op_str) = op_str {
            let op = match op_str.as_str() {
                "INSERT" => RowOperation::Insert,
                "UPDATE" => RowOperation::Update,
                "DELETE" => RowOperation::Delete,
                _ => continue,
            };

            let row_id: Option<String> = row.try_get::<String, _>("id").ok();

            let mut after = HashMap::new();
            for column in &columns {
                let value = super::table::get_column_value(&row, &column.name, &column.data_type);
                after.insert(column.name.clone(), value);
            }

            operations.push(PreviewOperation {
                op,
                row_id,
                before: None, // TODO: récupérer l'état avant si UPDATE
                after: Some(after),
            });
        }
    }

    Ok(StagingPreview {
        staging_id: staging_id.to_string(),
        operations,
        summary: PreviewSummary {
            inserts,
            updates,
            deletes,
            total: inserts + updates + deletes,
        },
    })
}

/// Commit le staging (applique les changements)
pub async fn commit_staging(pool: &PgPool, staging_id: &str) -> Result<CommitResult, sqlx::Error> {
    let staging_info = get_staging_info(pool, staging_id).await?;
    let staging_table = get_staging_table_name(pool, staging_id).await?;

    // Valider avant de commiter
    let validation = validate_staging(pool, staging_id).await?;
    if !validation.is_valid {
        return Err(sqlx::Error::Protocol("Validation échouée".to_string()));
    }

    // Créer un backup automatique avant commit (sécurité)
    let backup_req = crate::db_manager::CreateBackupRequest {
        tables: vec![format!(
            "{}.{}",
            staging_info.schema_name, staging_info.table_name
        )],
        description: Some(format!("Auto-backup avant commit staging {}", staging_id)),
    };
    let _backup = crate::db_manager::create_backup(pool, backup_req).await?;

    let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_info.schema_name)
        .fetch_one(pool)
        .await?;
    let staging_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_table)
        .fetch_one(pool)
        .await?;
    let table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_info.table_name)
        .fetch_one(pool)
        .await?;

    // Commencer une transaction atomique
    // Si erreur à n'importe quelle étape → rollback automatique
    let mut tx = pool.begin().await?;

    // Appliquer les suppressions
    let delete_query = format!(
        "DELETE FROM {}.{} WHERE id IN (SELECT id FROM {}.{} WHERE _staging_op = 'DELETE')",
        schema_ident, table_ident, schema_ident, staging_ident
    );
    let deletes_result = sqlx::query(&delete_query).execute(&mut *tx).await?;

    // Appliquer les mises à jour (remplacer la table entière)
    let temp_table = format!("{}_old", staging_info.table_name);
    let temp_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&temp_table)
        .fetch_one(&mut *tx)
        .await?;

    // Renommer la table originale
    let rename_old = format!(
        "ALTER TABLE {}.{} RENAME TO {}",
        schema_ident, table_ident, temp_ident
    );
    sqlx::query(&rename_old).execute(&mut *tx).await?;

    // Renommer le staging
    let rename_staging = format!(
        "ALTER TABLE {}.{} RENAME TO {}",
        schema_ident, staging_ident, table_ident
    );
    sqlx::query(&rename_staging).execute(&mut *tx).await?;

    // Supprimer la colonne _staging_op
    let drop_column = format!(
        "ALTER TABLE {}.{} DROP COLUMN IF EXISTS _staging_op",
        schema_ident, table_ident
    );
    sqlx::query(&drop_column).execute(&mut *tx).await?;

    // Supprimer l'ancienne table
    let drop_old = format!("DROP TABLE IF EXISTS {}.{}", schema_ident, temp_ident);
    sqlx::query(&drop_old).execute(&mut *tx).await?;

    // Créer un audit log
    let audit_id = Uuid::new_v4().to_string();
    let rows_affected = deletes_result.rows_affected() as i64;

    sqlx::query(
        r#"
        INSERT INTO atlas.audit_log 
        (id, table_name, schema_name, operation, rows_affected, staging_id, created_at)
        VALUES ($1, $2, $3, 'COMMIT_STAGING', $4, $5, NOW())
        "#,
    )
    .bind(&audit_id)
    .bind(&staging_info.table_name)
    .bind(&staging_info.schema_name)
    .bind(rows_affected)
    .bind(staging_id)
    .execute(&mut *tx)
    .await?;

    // Supprimer les métadonnées du staging
    sqlx::query("DELETE FROM atlas.staging_metadata WHERE staging_id = $1")
        .bind(staging_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    // Log structuré pour observabilité
    crate::observability::StructuredLog::new("staging_commit")
        .with_table(&format!("{}.{}", staging_info.schema_name, staging_info.table_name))
        .with_rows_affected(rows_affected)
        .with_details(serde_json::json!({
            "staging_id": staging_id,
            "audit_id": &audit_id
        }))
        .log();

    Ok(CommitResult {
        success: true,
        rows_affected,
        audit_id,
    })
}

/// Annule un staging
pub async fn cancel_staging(pool: &PgPool, staging_id: &str) -> Result<(), sqlx::Error> {
    let staging_table = get_staging_table_name(pool, staging_id).await?;
    let staging_info = get_staging_info(pool, staging_id).await?;

    let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_info.schema_name)
        .fetch_one(pool)
        .await?;
    let staging_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_table)
        .fetch_one(pool)
        .await?;

    // Supprimer la table de staging
    let drop_query = format!("DROP TABLE IF EXISTS {}.{}", schema_ident, staging_ident);
    sqlx::query(&drop_query).execute(pool).await?;

    // Supprimer les métadonnées
    sqlx::query("DELETE FROM atlas.staging_metadata WHERE staging_id = $1")
        .bind(staging_id)
        .execute(pool)
        .await?;

    Ok(())
}

// Fonctions utilitaires

async fn get_staging_info(pool: &PgPool, staging_id: &str) -> Result<StagingInfo, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT table_name, schema_name, reason, created_at, operations_count
        FROM atlas.staging_metadata
        WHERE staging_id = $1
        "#,
    )
    .bind(staging_id)
    .fetch_one(pool)
    .await?;

    Ok(StagingInfo {
        staging_id: staging_id.to_string(),
        table_name: row.try_get("table_name")?,
        schema_name: row.try_get("schema_name")?,
        created_at: row.try_get("created_at")?,
        reason: row.try_get("reason").ok(),
        row_count: 0,
        operations_count: row.try_get("operations_count")?,
    })
}

async fn get_staging_table_name(pool: &PgPool, staging_id: &str) -> Result<String, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT staging_table_name FROM atlas.staging_metadata WHERE staging_id = $1",
    )
    .bind(staging_id)
    .fetch_one(pool)
    .await
}

fn value_to_sql_string(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        _ => format!("'{}'", value.to_string().replace("'", "''")),
    }
}
