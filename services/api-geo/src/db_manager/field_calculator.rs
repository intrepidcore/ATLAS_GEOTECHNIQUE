// Field Calculator - Transformations massives via expressions SQL
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldCalculatorRequest {
    pub target_column: String,
    pub expression: String,
    pub filter: Option<String>, // WHERE clause optionnelle
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldCalculatorPreview {
    pub sql: String,
    pub sample_results: Vec<SampleRow>,
    pub estimated_affected_rows: i64,
    pub warnings: Vec<String>,
    pub is_safe: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SampleRow {
    pub old_value: Option<String>,
    pub new_value: Option<String>,
    pub row_id: Option<String>,
}

/// Preview du Field Calculator (test sur 50 lignes)
pub async fn preview_field_calculation(
    pool: &PgPool,
    schema: &str,
    table: &str,
    request: &FieldCalculatorRequest,
) -> Result<FieldCalculatorPreview, sqlx::Error> {
    let mut warnings = Vec::new();

    // Sanitize: vérifier que l'expression ne contient pas de commandes dangereuses
    let dangerous_keywords = ["DROP", "DELETE", "TRUNCATE", "ALTER", "CREATE", "INSERT"];
    let expr_upper = request.expression.to_uppercase();
    
    for keyword in &dangerous_keywords {
        if expr_upper.contains(keyword) {
            warnings.push(format!("⚠️ Expression contient le mot-clé dangereux: {}", keyword));
        }
    }

    // Construire le SQL de preview
    let filter_clause = request
        .filter
        .as_ref()
        .map(|f| format!(" WHERE {}", f))
        .unwrap_or_default();

    let preview_sql = format!(
        "SELECT id, {} as old_value, ({}) as new_value FROM {}.{}{} LIMIT 50",
        request.target_column, request.expression, schema, table, filter_clause
    );

    // Exécuter le preview
    let rows = sqlx::query(&preview_sql).fetch_all(pool).await?;

    let mut sample_results = Vec::new();
    for row in &rows {
        let row_id: Option<String> = row.try_get(0).ok();
        let old_value: Option<String> = row.try_get(1).ok();
        let new_value: Option<String> = row.try_get(2).ok();

        sample_results.push(SampleRow {
            old_value,
            new_value,
            row_id,
        });
    }

    // Estimer le nombre total de lignes affectées
    let count_sql = format!(
        "SELECT COUNT(*) FROM {}.{}{}",
        schema, table, filter_clause
    );
    let estimated_affected_rows: i64 = sqlx::query_scalar(&count_sql)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    // Construire le SQL final (UPDATE)
    let update_sql = format!(
        "UPDATE {}.{} SET {} = ({}){}",
        schema, table, request.target_column, request.expression, filter_clause
    );

    let is_safe = warnings.is_empty() && estimated_affected_rows < 1_000_000;

    if estimated_affected_rows > 100_000 {
        warnings.push(format!(
            "⚠️ Opération affectera {} lignes (peut être long)",
            estimated_affected_rows
        ));
    }

    Ok(FieldCalculatorPreview {
        sql: update_sql,
        sample_results,
        estimated_affected_rows,
        warnings,
        is_safe,
    })
}

/// Exécuter le Field Calculator (dans un staging)
pub async fn execute_field_calculation(
    pool: &PgPool,
    staging_id: &str,
    request: &FieldCalculatorRequest,
) -> Result<i64, sqlx::Error> {
    let filter_clause = request
        .filter
        .as_ref()
        .map(|f| format!(" WHERE {}", f))
        .unwrap_or_default();

    let update_sql = format!(
        "UPDATE staging.{} SET {} = ({}){}",
        staging_id, request.target_column, request.expression, filter_clause
    );

    let result = sqlx::query(&update_sql).execute(pool).await?;

    Ok(result.rows_affected() as i64)
}

/// Valider une expression SQL (sandbox test)
pub async fn validate_expression(
    pool: &PgPool,
    schema: &str,
    table: &str,
    expression: &str,
) -> Result<bool, String> {
    // Test l'expression sur 1 ligne
    let test_sql = format!(
        "SELECT ({}) as test_result FROM {}.{} LIMIT 1",
        expression, schema, table
    );

    match sqlx::query(&test_sql).fetch_one(pool).await {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Expression invalide: {}", e)),
    }
}
