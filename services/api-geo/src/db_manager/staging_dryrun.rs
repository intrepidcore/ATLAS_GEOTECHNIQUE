// Dry-run transactionnel pour staging - détection de conflits avant commit
use sqlx::{PgPool, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StagingDryRunResult {
    pub is_safe: bool,
    pub conflicts: Vec<ConflictDetail>,
    pub warnings: Vec<String>,
    pub estimated_duration_ms: Option<i64>,
    pub affected_rows: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictDetail {
    pub conflict_type: String, // "UNIQUE", "FOREIGN_KEY", "CHECK", "NOT_NULL"
    pub table: String,
    pub column: Option<String>,
    pub constraint_name: Option<String>,
    pub affected_rows: i64,
    pub sample_values: Vec<String>,
}

/// Dry-run transactionnel du commit staging
/// Exécute toutes les opérations dans une transaction puis ROLLBACK
/// Retourne les conflits détectés sans modifier la DB
pub async fn dryrun_commit_staging(
    pool: &PgPool,
    staging_id: &str,
) -> Result<StagingDryRunResult, sqlx::Error> {
    let staging_info = super::staging::get_staging_info(pool, staging_id).await?;
    let staging_table = super::staging::get_staging_table_name(pool, staging_id).await?;

    let mut conflicts = Vec::new();
    let mut warnings = Vec::new();

    // Compter les lignes
    let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_info.schema_name)
        .fetch_one(pool)
        .await?;
    let staging_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_table)
        .fetch_one(pool)
        .await?;

    let affected_rows: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM {}.{}",
        schema_ident, staging_ident
    ))
    .fetch_one(pool)
    .await?;

    // Démarrer transaction pour dry-run
    let mut tx = pool.begin().await?;

    // Tenter le swap dans la transaction
    let temp_table = format!("{}_dryrun_temp", staging_info.table_name);
    let temp_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&temp_table)
        .fetch_one(&mut *tx)
        .await?;
    let table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&staging_info.table_name)
        .fetch_one(&mut *tx)
        .await?;

    // Supprimer colonne _staging_op
    let drop_col = format!(
        "ALTER TABLE {}.{} DROP COLUMN IF EXISTS _staging_op",
        schema_ident, staging_ident
    );
    if let Err(e) = sqlx::query(&drop_col).execute(&mut *tx).await {
        warnings.push(format!("Impossible de supprimer _staging_op: {}", e));
    }

    // Tenter rename original -> temp
    let rename_old = format!(
        "ALTER TABLE {}.{} RENAME TO {}",
        schema_ident, table_ident, temp_ident
    );
    if let Err(e) = sqlx::query(&rename_old).execute(&mut *tx).await {
        conflicts.push(ConflictDetail {
            conflict_type: "RENAME_ERROR".to_string(),
            table: staging_info.table_name.clone(),
            column: None,
            constraint_name: None,
            affected_rows: 0,
            sample_values: vec![e.to_string()],
        });
    }

    // Tenter rename staging -> original
    let rename_staging = format!(
        "ALTER TABLE {}.{} RENAME TO {}",
        schema_ident, staging_ident, table_ident
    );
    if let Err(e) = sqlx::query(&rename_staging).execute(&mut *tx).await {
        conflicts.push(ConflictDetail {
            conflict_type: "RENAME_ERROR".to_string(),
            table: staging_table.clone(),
            column: None,
            constraint_name: None,
            affected_rows: 0,
            sample_values: vec![e.to_string()],
        });
    }

    // Vérifier contraintes UNIQUE potentielles
    // (si on avait des contraintes, elles seraient vérifiées ici)
    
    // Vérifier les foreign keys si elles existent
    let fk_check = "SELECT COUNT(*) FROM information_schema.table_constraints 
         WHERE table_schema = $1 AND table_name = $2 AND constraint_type = 'FOREIGN KEY'";
    let fk_count: i64 = sqlx::query_scalar(fk_check)
        .bind(&staging_info.schema_name)
        .bind(&staging_info.table_name)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(0);

    if fk_count > 0 {
        warnings.push(format!(
            "{} contraintes de clé étrangère détectées - vérifiez l'intégrité référentielle",
            fk_count
        ));
    }

    // ROLLBACK - ne pas appliquer les changements
    tx.rollback().await?;

    let is_safe = conflicts.is_empty();

    Ok(StagingDryRunResult {
        is_safe,
        conflicts,
        warnings,
        estimated_duration_ms: Some((affected_rows / 1000).max(10)), // Estimation simple
        affected_rows,
    })
}

/// Détecte les conflits UNIQUE dans le staging avant commit
pub async fn detect_unique_conflicts(
    pool: &PgPool,
    staging_id: &str,
) -> Result<Vec<ConflictDetail>, sqlx::Error> {
    let staging_info = super::staging::get_staging_info(pool, staging_id).await?;
    let staging_table = super::staging::get_staging_table_name(pool, staging_id).await?;

    let mut conflicts = Vec::new();

    // Récupérer les contraintes UNIQUE de la table originale
    let unique_constraints = sqlx::query(
        r#"
        SELECT 
            tc.constraint_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = $1 
            AND tc.table_name = $2 
            AND tc.constraint_type = 'UNIQUE'
        "#,
    )
    .bind(&staging_info.schema_name)
    .bind(&staging_info.table_name)
    .fetch_all(pool)
    .await?;

    for constraint_row in unique_constraints {
        let constraint_name: String = constraint_row.try_get("constraint_name")?;
        let column_name: String = constraint_row.try_get("column_name")?;

        // Vérifier doublons dans staging
        let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(&staging_info.schema_name)
            .fetch_one(pool)
            .await?;
        let staging_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(&staging_table)
            .fetch_one(pool)
            .await?;
        let column_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(&column_name)
            .fetch_one(pool)
            .await?;

        let duplicates_query = format!(
            "SELECT {}, COUNT(*) as cnt 
             FROM {}.{} 
             GROUP BY {} 
             HAVING COUNT(*) > 1 
             LIMIT 5",
            column_ident, schema_ident, staging_ident, column_ident
        );

        let duplicate_rows = sqlx::query(&duplicates_query).fetch_all(pool).await?;

        if !duplicate_rows.is_empty() {
            let sample_values: Vec<String> = duplicate_rows
                .iter()
                .map(|r| {
                    r.try_get::<String, _>(0)
                        .unwrap_or_else(|_| "NULL".to_string())
                })
                .collect();

            let total_conflicts: i64 = duplicate_rows
                .iter()
                .map(|r| r.try_get::<i64, _>("cnt").unwrap_or(0))
                .sum();

            conflicts.push(ConflictDetail {
                conflict_type: "UNIQUE".to_string(),
                table: staging_info.table_name.clone(),
                column: Some(column_name),
                constraint_name: Some(constraint_name),
                affected_rows: total_conflicts,
                sample_values,
            });
        }
    }

    Ok(conflicts)
}
