// Gestion du schéma de base de données
use super::types::*;
use sqlx::{PgPool, Row};

/// Récupère la structure complète de la base de données
pub async fn get_database_schema(pool: &PgPool) -> Result<DatabaseSchema, sqlx::Error> {
    let schemas = get_schemas(pool).await?;
    Ok(DatabaseSchema { schemas })
}

/// Récupère la liste des schémas
async fn get_schemas(pool: &PgPool) -> Result<Vec<SchemaInfo>, sqlx::Error> {
    let schema_names = sqlx::query_scalar::<_, String>(
        r#"
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut schemas = Vec::new();
    for schema_name in schema_names {
        let tables = get_tables(pool, &schema_name).await?;
        let views = get_views(pool, &schema_name).await?;

        schemas.push(SchemaInfo {
            name: schema_name,
            tables,
            views,
        });
    }

    Ok(schemas)
}

/// Récupère les informations d'une table spécifique
pub async fn get_table_info(
    pool: &PgPool,
    schema: &str,
    table: &str,
) -> Result<TableInfo, sqlx::Error> {
    let columns = get_columns(pool, schema, table).await?;
    let primary_keys = get_primary_keys(pool, schema, table).await?;
    let foreign_keys = get_foreign_keys(pool, schema, table).await?;

    // Récupérer le nombre de lignes
    let row_count_query = format!(
        "SELECT COUNT(*) FROM {}.{}",
        sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(schema)
            .fetch_one(pool)
            .await?,
        sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
            .bind(table)
            .fetch_one(pool)
            .await?
    );
    let row_count: i64 = sqlx::query_scalar(&row_count_query)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    // Vérifier si la table a une colonne géométrique
    let geom_info = get_geometry_info(pool, schema, table).await?;

    Ok(TableInfo {
        name: table.to_string(),
        schema: schema.to_string(),
        row_count,
        has_geom: geom_info.is_some(),
        geom_column: geom_info.as_ref().map(|(col, _, _)| col.clone()),
        geom_type: geom_info.as_ref().map(|(_, typ, _)| typ.clone()),
        srid: geom_info.as_ref().map(|(_, _, srid)| *srid),
        columns,
        primary_keys,
        foreign_keys,
    })
}

/// Récupère toutes les tables d'un schéma
async fn get_tables(pool: &PgPool, schema: &str) -> Result<Vec<TableInfo>, sqlx::Error> {
    let table_names = sqlx::query_scalar::<_, String>(
        r#"
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
        "#,
    )
    .bind(schema)
    .fetch_all(pool)
    .await?;

    let mut tables = Vec::new();
    for table_name in table_names {
        match get_table_info(pool, schema, &table_name).await {
            Ok(table_info) => tables.push(table_info),
            Err(e) => {
                eprintln!(
                    "Erreur lors de la récupération de la table {}.{}: {}",
                    schema, table_name, e
                );
            }
        }
    }

    Ok(tables)
}

/// Récupère les vues d'un schéma
async fn get_views(pool: &PgPool, schema: &str) -> Result<Vec<ViewInfo>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT 
            table_name,
            CASE 
                WHEN table_type = 'VIEW' THEN false
                ELSE true
            END as is_materialized
        FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_type IN ('VIEW')
        ORDER BY table_name
        "#,
    )
    .bind(schema)
    .fetch_all(pool)
    .await?;

    let mut views = Vec::new();
    for row in rows {
        let name: String = row.try_get("table_name")?;
        let is_materialized: bool = row.try_get("is_materialized").unwrap_or(false);

        views.push(ViewInfo {
            name,
            schema: schema.to_string(),
            is_materialized,
            definition: None,
        });
    }

    // Récupérer les vues matérialisées
    let mat_views = sqlx::query_scalar::<_, String>(
        r#"
        SELECT matviewname 
        FROM pg_matviews 
        WHERE schemaname = $1
        ORDER BY matviewname
        "#,
    )
    .bind(schema)
    .fetch_all(pool)
    .await?;

    for name in mat_views {
        views.push(ViewInfo {
            name,
            schema: schema.to_string(),
            is_materialized: true,
            definition: None,
        });
    }

    Ok(views)
}

/// Récupère les colonnes d'une table
pub async fn get_columns(
    pool: &PgPool,
    schema: &str,
    table: &str,
) -> Result<Vec<ColumnInfo>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length,
            numeric_precision,
            numeric_scale
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
        "#,
    )
    .bind(schema)
    .bind(table)
    .fetch_all(pool)
    .await?;

    let primary_keys = get_primary_keys(pool, schema, table).await?;
    let foreign_keys = get_foreign_keys(pool, schema, table).await?;
    let fk_columns: Vec<String> = foreign_keys
        .iter()
        .map(|fk| fk.column_name.clone())
        .collect();

    let mut columns = Vec::new();
    for row in rows {
        let column_name: String = row.try_get("column_name")?;
        let data_type: String = row.try_get("data_type")?;
        let is_nullable: String = row.try_get("is_nullable")?;

        columns.push(ColumnInfo {
            name: column_name.clone(),
            data_type,
            is_nullable: is_nullable == "YES",
            column_default: row.try_get("column_default").ok(),
            character_maximum_length: row.try_get("character_maximum_length").ok(),
            numeric_precision: row.try_get("numeric_precision").ok(),
            numeric_scale: row.try_get("numeric_scale").ok(),
            is_primary_key: primary_keys.contains(&column_name),
            is_foreign_key: fk_columns.contains(&column_name),
            ui_order: None,
            ui_visible: true,
            ui_label: None,
            ui_unit: None,
        });
    }

    Ok(columns)
}

/// Récupère les clés primaires
pub async fn get_primary_keys(
    pool: &PgPool,
    schema: &str,
    table: &str,
) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar::<_, String>(
        r#"
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = ($1 || '.' || $2)::regclass
        AND i.indisprimary
        "#,
    )
    .bind(schema)
    .bind(table)
    .fetch_all(pool)
    .await
}

/// Récupère les clés étrangères
pub async fn get_foreign_keys(
    pool: &PgPool,
    schema: &str,
    table: &str,
) -> Result<Vec<ForeignKeyInfo>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
        "#,
    )
    .bind(schema)
    .bind(table)
    .fetch_all(pool)
    .await?;

    let mut foreign_keys = Vec::new();
    for row in rows {
        foreign_keys.push(ForeignKeyInfo {
            column_name: row.try_get("column_name")?,
            foreign_table_schema: row.try_get("foreign_table_schema")?,
            foreign_table_name: row.try_get("foreign_table_name")?,
            foreign_column_name: row.try_get("foreign_column_name")?,
        });
    }

    Ok(foreign_keys)
}

/// Récupère les informations de géométrie
pub async fn get_geometry_info(
    pool: &PgPool,
    schema: &str,
    table: &str,
) -> Result<Option<(String, String, i32)>, sqlx::Error> {
    let result = sqlx::query(
        r#"
        SELECT 
            f_geometry_column,
            type,
            srid
        FROM geometry_columns
        WHERE f_table_schema = $1 AND f_table_name = $2
        LIMIT 1
        "#,
    )
    .bind(schema)
    .bind(table)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = result {
        Ok(Some((
            row.try_get("f_geometry_column")?,
            row.try_get("type")?,
            row.try_get("srid")?,
        )))
    } else {
        Ok(None)
    }
}
