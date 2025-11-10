// Gestion de l'audit et de l'historique
use super::types::*;
use sqlx::PgPool;

/// Récupère l'historique d'audit d'une table
pub async fn get_audit_log(
    pool: &PgPool,
    schema: &str,
    table: &str,
    query: AuditQuery,
) -> Result<Vec<AuditLog>, sqlx::Error> {
    let limit = query.limit.unwrap_or(100).min(1000);
    let offset = query.offset.unwrap_or(0);
    
    let mut where_clauses = vec![
        format!("schema_name = '{}'", schema.replace("'", "''")),
        format!("table_name = '{}'", table.replace("'", "''")),
    ];
    
    if let Some(operation) = &query.operation {
        where_clauses.push(format!("operation = '{}'", operation.replace("'", "''")));
    }
    
    if let Some(from_date) = &query.from_date {
        where_clauses.push(format!("created_at >= '{}'", from_date.to_rfc3339()));
    }
    
    if let Some(to_date) = &query.to_date {
        where_clauses.push(format!("created_at <= '{}'", to_date.to_rfc3339()));
    }
    
    let where_clause = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };
    
    let sql = format!(
        r#"
        SELECT 
            id,
            table_name,
            schema_name,
            operation,
            user_id,
            sql_query,
            rows_affected,
            staging_id,
            created_at,
            metadata
        FROM atlas.audit_log
        {}
        ORDER BY created_at DESC
        LIMIT {} OFFSET {}
        "#,
        where_clause, limit, offset
    );
    
    let rows = sqlx::query(&sql).fetch_all(pool).await?;
    
    let mut logs = Vec::new();
    for row in rows {
        logs.push(AuditLog {
            id: row.try_get("id")?,
            table_name: row.try_get("table_name")?,
            schema_name: row.try_get("schema_name")?,
            operation: row.try_get("operation")?,
            user_id: row.try_get("user_id").ok(),
            sql_query: row.try_get("sql_query").ok(),
            rows_affected: row.try_get("rows_affected")?,
            staging_id: row.try_get("staging_id").ok(),
            created_at: row.try_get("created_at")?,
            metadata: row.try_get("metadata").ok(),
        });
    }
    
    Ok(logs)
}

/// Crée une entrée d'audit
pub async fn create_audit_entry(
    pool: &PgPool,
    schema: &str,
    table: &str,
    operation: &str,
    rows_affected: i64,
    sql_query: Option<&str>,
    user_id: Option<&str>,
    staging_id: Option<&str>,
    metadata: Option<serde_json::Value>,
) -> Result<String, sqlx::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    
    sqlx::query(
        r#"
        INSERT INTO atlas.audit_log 
        (id, table_name, schema_name, operation, user_id, sql_query, rows_affected, staging_id, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        "#
    )
    .bind(&id)
    .bind(table)
    .bind(schema)
    .bind(operation)
    .bind(user_id)
    .bind(sql_query)
    .bind(rows_affected)
    .bind(staging_id)
    .bind(metadata)
    .execute(pool)
    .await?;
    
    Ok(id)
}

/// Récupère les statistiques d'audit
pub async fn get_audit_stats(
    pool: &PgPool,
    schema: &str,
    table: &str,
) -> Result<serde_json::Value, sqlx::Error> {
    let sql = format!(
        r#"
        SELECT 
            operation,
            COUNT(*) as count,
            SUM(rows_affected) as total_rows_affected,
            MAX(created_at) as last_operation
        FROM atlas.audit_log
        WHERE schema_name = '{}' AND table_name = '{}'
        GROUP BY operation
        "#,
        schema.replace("'", "''"),
        table.replace("'", "''")
    );
    
    let rows = sqlx::query(&sql).fetch_all(pool).await?;
    
    let mut stats = serde_json::Map::new();
    for row in rows {
        let operation: String = row.try_get("operation")?;
        let count: i64 = row.try_get("count")?;
        let total_rows: i64 = row.try_get("total_rows_affected")?;
        let last_op: Option<chrono::DateTime<chrono::Utc>> = row.try_get("last_operation").ok();
        
        stats.insert(operation, serde_json::json!({
            "count": count,
            "total_rows_affected": total_rows,
            "last_operation": last_op
        }));
    }
    
    Ok(serde_json::Value::Object(stats))
}
