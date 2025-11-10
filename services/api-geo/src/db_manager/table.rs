// Gestion des données de table
use super::types::*;
use sqlx::{PgPool, Row};
use std::collections::HashMap;

/// Récupère les données d'une table avec pagination et filtres
pub async fn get_table_data(
    pool: &PgPool,
    schema: &str,
    table: &str,
    query: TableDataQuery,
) -> Result<TableDataResponse, sqlx::Error> {
    let limit = query.limit.unwrap_or(100).min(1000);
    let offset = query.offset.unwrap_or(0);

    // Récupérer les informations de colonnes
    let columns = super::schema::get_columns(pool, schema, table).await?;

    // Construire la requête avec filtres
    let mut where_clause = String::new();
    if let Some(filter) = &query.filter {
        if !filter.is_empty() {
            where_clause = format!(" WHERE {}", filter);
        }
    }

    // Construire l'ordre
    let mut order_clause = String::new();
    if let Some(order_by) = &query.order_by {
        let direction = query.order_dir.as_deref().unwrap_or("ASC");
        order_clause = format!(" ORDER BY {} {}", order_by, direction);
    }

    // Échapper les identifiants
    let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(schema)
        .fetch_one(pool)
        .await?;
    let table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(table)
        .fetch_one(pool)
        .await?;

    // Compter le total
    let count_query = format!(
        "SELECT COUNT(*) FROM {}.{}{}",
        schema_ident, table_ident, where_clause
    );
    let total_count: i64 = sqlx::query_scalar(&count_query)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    // Récupérer les données
    let data_query = format!(
        "SELECT * FROM {}.{}{}{} LIMIT {} OFFSET {}",
        schema_ident, table_ident, where_clause, order_clause, limit, offset
    );

    let rows = sqlx::query(&data_query).fetch_all(pool).await?;

    // Convertir les lignes en HashMap
    let mut data_rows = Vec::new();
    for row in rows {
        let mut row_data = HashMap::new();
        for column in &columns {
            let value = get_column_value(&row, &column.name, &column.data_type);
            row_data.insert(column.name.clone(), value);
        }
        data_rows.push(row_data);
    }

    Ok(TableDataResponse {
        table_name: table.to_string(),
        schema_name: schema.to_string(),
        columns,
        rows: data_rows,
        total_count,
        offset,
        limit,
    })
}

/// Extrait la valeur d'une colonne en fonction de son type
pub fn get_column_value(
    row: &sqlx::postgres::PgRow,
    column_name: &str,
    data_type: &str,
) -> serde_json::Value {
    match data_type {
        "integer" | "smallint" | "bigint" => row
            .try_get::<i64, _>(column_name)
            .ok()
            .map(|v| serde_json::json!(v))
            .unwrap_or(serde_json::Value::Null),
        "numeric" | "decimal" | "real" | "double precision" => row
            .try_get::<f64, _>(column_name)
            .ok()
            .map(|v| serde_json::json!(v))
            .unwrap_or(serde_json::Value::Null),
        "boolean" => row
            .try_get::<bool, _>(column_name)
            .ok()
            .map(|v| serde_json::json!(v))
            .unwrap_or(serde_json::Value::Null),
        "date" | "timestamp" | "timestamp with time zone" | "timestamp without time zone" => row
            .try_get::<String, _>(column_name)
            .ok()
            .map(|v| serde_json::json!(v))
            .unwrap_or(serde_json::Value::Null),
        "USER-DEFINED" | "geometry" => {
            // Pour les géométries, retourner en GeoJSON
            row.try_get::<String, _>(column_name)
                .ok()
                .map(|v| serde_json::json!(v))
                .unwrap_or(serde_json::Value::Null)
        }
        _ => {
            // Par défaut, traiter comme texte
            row.try_get::<String, _>(column_name)
                .ok()
                .map(|v| serde_json::json!(v))
                .unwrap_or(serde_json::Value::Null)
        }
    }
}

/// Sélectionne des lignes selon un filtre
pub async fn select_rows(
    pool: &PgPool,
    schema: &str,
    table: &str,
    request: SelectionRequest,
) -> Result<SelectionResponse, sqlx::Error> {
    let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(schema)
        .fetch_one(pool)
        .await?;
    let table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(table)
        .fetch_one(pool)
        .await?;

    // Construire la clause WHERE selon le type de filtre
    let where_clause = match request.filter_type {
        SelectionFilterType::Regex => {
            // Recherche regex sur toutes les colonnes textuelles
            format!("WHERE EXISTS (SELECT 1 FROM unnest(ARRAY[{}]) AS col WHERE col::text ~ '{}')",
                "SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND data_type IN ('character varying', 'text')",
                request.filter.replace("'", "''"))
        }
        SelectionFilterType::SqlFilter | SelectionFilterType::Expression => {
            format!("WHERE {}", request.filter)
        }
    };

    // Récupérer les IDs (supposant qu'il y a une colonne 'id')
    let query = format!(
        "SELECT id::text FROM {}.{} {} LIMIT 1000",
        schema_ident, table_ident, where_clause
    );

    let ids: Vec<String> = sqlx::query_scalar(&query)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    let count = ids.len() as i64;

    // Calculer le bbox si la table a une géométrie
    let bbox = calculate_bbox(pool, schema, table, &ids).await?;

    Ok(SelectionResponse { ids, count, bbox })
}

/// Calcule le bbox d'une sélection
async fn calculate_bbox(
    pool: &PgPool,
    schema: &str,
    table: &str,
    ids: &[String],
) -> Result<Option<BBox>, sqlx::Error> {
    if ids.is_empty() {
        return Ok(None);
    }

    // Vérifier si la table a une colonne géométrique
    let geom_info = super::schema::get_geometry_info(pool, schema, table).await?;
    if geom_info.is_none() {
        return Ok(None);
    }

    let (geom_column, _, srid) = geom_info.unwrap();

    let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(schema)
        .fetch_one(pool)
        .await?;
    let table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(table)
        .fetch_one(pool)
        .await?;
    let geom_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&geom_column)
        .fetch_one(pool)
        .await?;

    let ids_str = ids
        .iter()
        .map(|id| format!("'{}'", id.replace("'", "''")))
        .collect::<Vec<_>>()
        .join(",");

    let query = format!(
        "SELECT 
            ST_XMin(extent) as min_x,
            ST_YMin(extent) as min_y,
            ST_XMax(extent) as max_x,
            ST_YMax(extent) as max_y
        FROM (
            SELECT ST_Extent({}) as extent
            FROM {}.{}
            WHERE id::text IN ({})
        ) sub",
        geom_ident, schema_ident, table_ident, ids_str
    );

    let result = sqlx::query(&query).fetch_optional(pool).await?;

    if let Some(row) = result {
        Ok(Some(BBox {
            min_x: row.try_get("min_x")?,
            min_y: row.try_get("min_y")?,
            max_x: row.try_get("max_x")?,
            max_y: row.try_get("max_y")?,
            srid,
        }))
    } else {
        Ok(None)
    }
}

/// Ajoute une ligne vide à une table
pub async fn add_empty_row(
    pool: &PgPool,
    schema: &str,
    table: &str,
) -> Result<String, sqlx::Error> {
    let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(schema)
        .fetch_one(pool)
        .await?;
    let table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(table)
        .fetch_one(pool)
        .await?;

    // Insérer une ligne avec des valeurs par défaut
    let query = format!(
        "INSERT INTO {}.{} DEFAULT VALUES RETURNING id::text",
        schema_ident, table_ident
    );

    let id: String = sqlx::query_scalar(&query).fetch_one(pool).await?;

    Ok(id)
}

/// Met à jour une cellule
pub async fn update_cell(
    pool: &PgPool,
    schema: &str,
    table: &str,
    row_id: &str,
    column: &str,
    value: serde_json::Value,
) -> Result<(), sqlx::Error> {
    let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(schema)
        .fetch_one(pool)
        .await?;
    let table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(table)
        .fetch_one(pool)
        .await?;
    let column_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(column)
        .fetch_one(pool)
        .await?;

    let value_str = match value {
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        _ => format!("'{}'", value.to_string().replace("'", "''")),
    };

    let query = format!(
        "UPDATE {}.{} SET {} = {} WHERE id = $1",
        schema_ident, table_ident, column_ident, value_str
    );

    sqlx::query(&query).bind(row_id).execute(pool).await?;

    Ok(())
}

/// Supprime des lignes
pub async fn delete_rows(
    pool: &PgPool,
    schema: &str,
    table: &str,
    row_ids: &[String],
) -> Result<i64, sqlx::Error> {
    if row_ids.is_empty() {
        return Ok(0);
    }

    let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(schema)
        .fetch_one(pool)
        .await?;
    let table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(table)
        .fetch_one(pool)
        .await?;

    let ids_str = row_ids
        .iter()
        .map(|id| format!("'{}'", id.replace("'", "''")))
        .collect::<Vec<_>>()
        .join(",");

    let query = format!(
        "DELETE FROM {}.{} WHERE id::text IN ({})",
        schema_ident, table_ident, ids_str
    );

    let result = sqlx::query(&query).execute(pool).await?;

    Ok(result.rows_affected() as i64)
}
