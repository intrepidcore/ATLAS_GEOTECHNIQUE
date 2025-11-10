// Dry-run pour les opérations DDL (preview sans exécution)
use super::types::*;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DryRunResult {
    pub sql: String,
    pub estimated_duration_ms: Option<i64>,
    pub affected_objects: Vec<AffectedObject>,
    pub warnings: Vec<String>,
    pub is_safe: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AffectedObject {
    pub object_type: String, // 'table', 'view', 'index', 'constraint', 'trigger'
    pub object_name: String,
    pub impact: String, // 'modified', 'dropped', 'recreated'
}

/// Dry-run pour ajout de colonne
pub async fn dryrun_add_column(
    pool: &PgPool,
    schema: &str,
    table: &str,
    request: &AddColumnRequest,
) -> Result<DryRunResult, sqlx::Error> {
    let mut warnings = Vec::new();
    let mut affected_objects = Vec::new();

    // Construire le SQL
    let mut sql = format!(
        "ALTER TABLE {}.{} ADD COLUMN {} {}",
        schema, table, request.name, request.data_type
    );

    if let Some(default) = &request.default_value {
        sql.push_str(&format!(" DEFAULT {}", default));
    }

    if !request.is_nullable {
        sql.push_str(" NOT NULL");
        if request.default_value.is_none() {
            warnings.push(
                "Colonne NOT NULL sans valeur par défaut : nécessite que la table soit vide"
                    .to_string(),
            );
        }
    }

    sql.push(';');

    // Vérifier les vues dépendantes
    let views = sqlx::query_scalar::<_, String>(
        r#"
        SELECT DISTINCT v.table_name
        FROM information_schema.view_table_usage v
        WHERE v.view_schema = $1 AND v.table_name = $2
        "#,
    )
    .bind(schema)
    .bind(table)
    .fetch_all(pool)
    .await?;

    for view in views {
        affected_objects.push(AffectedObject {
            object_type: "view".to_string(),
            object_name: view.clone(),
            impact: "may need refresh".to_string(),
        });
        warnings.push(format!("Vue {} peut nécessiter une mise à jour", view));
    }

    // Vérifier les contraintes FK
    let fk_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM information_schema.table_constraints
        WHERE table_schema = $1 AND table_name = $2 AND constraint_type = 'FOREIGN KEY'
        "#,
    )
    .bind(schema)
    .bind(table)
    .fetch_one(pool)
    .await?;

    if fk_count > 0 {
        warnings.push(format!("{} contraintes FK sur cette table", fk_count));
    }

    // Estimer la durée (basé sur le nombre de lignes)
    let row_count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {}.{}", schema, table))
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    let estimated_duration_ms = if row_count > 1_000_000 {
        Some(row_count / 10_000) // Estimation grossière
    } else {
        Some(100)
    };

    if row_count > 10_000_000 {
        warnings.push(format!(
            "Table volumineuse ({} lignes) : opération peut être longue",
            row_count
        ));
    }

    affected_objects.push(AffectedObject {
        object_type: "table".to_string(),
        object_name: table.to_string(),
        impact: "modified".to_string(),
    });

    let is_safe = warnings.is_empty() || warnings.iter().all(|w| !w.contains("nécessite"));

    Ok(DryRunResult {
        sql,
        estimated_duration_ms,
        affected_objects,
        warnings,
        is_safe,
    })
}

/// Dry-run pour suppression de colonne
pub async fn dryrun_delete_column(
    pool: &PgPool,
    schema: &str,
    table: &str,
    column: &str,
) -> Result<DryRunResult, sqlx::Error> {
    let mut warnings = Vec::new();
    let mut affected_objects = Vec::new();

    let sql = format!(
        "ALTER TABLE {}.{} DROP COLUMN {} CASCADE;",
        schema, table, column
    );

    // Vérifier les dépendances
    let deps = sqlx::query_scalar::<_, String>(
        r#"
        SELECT DISTINCT v.table_name
        FROM information_schema.view_column_usage v
        WHERE v.view_schema = $1 AND v.table_name = $2 AND v.column_name = $3
        "#,
    )
    .bind(schema)
    .bind(table)
    .bind(column)
    .fetch_all(pool)
    .await?;

    for dep in deps {
        affected_objects.push(AffectedObject {
            object_type: "view".to_string(),
            object_name: dep.clone(),
            impact: "dropped or recreated".to_string(),
        });
        warnings.push(format!("⚠️ Vue {} sera supprimée ou recréée", dep));
    }

    // Vérifier les index
    let indexes = sqlx::query_scalar::<_, String>(
        r#"
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = $1 AND tablename = $2
        AND indexdef LIKE '%' || $3 || '%'
        "#,
    )
    .bind(schema)
    .bind(table)
    .bind(column)
    .fetch_all(pool)
    .await?;

    for idx in indexes {
        affected_objects.push(AffectedObject {
            object_type: "index".to_string(),
            object_name: idx.clone(),
            impact: "dropped".to_string(),
        });
        warnings.push(format!("Index {} sera supprimé", idx));
    }

    affected_objects.push(AffectedObject {
        object_type: "table".to_string(),
        object_name: table.to_string(),
        impact: "modified".to_string(),
    });

    warnings.push("⚠️ OPÉRATION DESTRUCTIVE : Données de la colonne seront perdues".to_string());

    Ok(DryRunResult {
        sql,
        estimated_duration_ms: Some(500),
        affected_objects,
        warnings,
        is_safe: false, // Suppression jamais "safe"
    })
}
