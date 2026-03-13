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
    let total_count: i64 = if where_clause.is_empty() {
        // COUNT(*) peut être extrêmement lent sur de grosses tables (ex: public.sondages)
        // On utilise une estimation PostgreSQL (ANALYZE/auto-vacuum) qui est quasi instantanée.
        sqlx::query_scalar::<_, Option<i64>>(
            r#"
            SELECT c.reltuples::bigint
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = $1 AND c.relname = $2
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_one(pool)
        .await
        .ok()
        .flatten()
        .unwrap_or(0)
    } else {
        // Si un filtre est fourni, l'estimation n'est pas fiable: on calcule le COUNT(*) exact.
        let count_query = format!(
            "SELECT COUNT(*) FROM {}.{}{}",
            schema_ident, table_ident, where_clause
        );
        sqlx::query_scalar(&count_query)
            .fetch_one(pool)
            .await
            .unwrap_or(0)
    };

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

    // Récupérer les IDs via la clé primaire
    let pks = super::schema::get_primary_keys(pool, schema, table)
        .await
        .unwrap_or_default();
    let pk_name = pks.get(0).cloned().unwrap_or_else(|| "id".to_string());
    let pk_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&pk_name)
        .fetch_one(pool)
        .await?;
    let query = format!(
        "SELECT ({}::text) AS id FROM {}.{} {} LIMIT 1000",
        pk_ident, schema_ident, table_ident, where_clause
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

    // Utiliser la PK pour filtrer
    let pks = super::schema::get_primary_keys(pool, schema, table)
        .await
        .unwrap_or_default();
    let pk_name = pks.get(0).cloned().unwrap_or_else(|| "id".to_string());
    let pk_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&pk_name)
        .fetch_one(pool)
        .await?;
    let query = format!(
        "SELECT 
            ST_XMin(extent) as min_x,
            ST_YMin(extent) as min_y,
            ST_XMax(extent) as max_x,
            ST_YMax(extent) as max_y
        FROM (
            SELECT ST_Extent({}) as extent
            FROM {}.{}
            WHERE ({}::text) IN ({})
        ) sub",
        geom_ident, schema_ident, table_ident, pk_ident, ids_str
    );

    // Vérifier d'abord s'il y a des géométries non-nulles
    let geom_check_query = format!(
        "SELECT COUNT(*) FROM {}.{} WHERE {} IS NOT NULL AND ({}::text) IN ({})",
        schema_ident, table_ident, geom_ident, pk_ident, ids_str
    );

    let geom_count: i64 = sqlx::query_scalar(&geom_check_query)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    if geom_count == 0 {
        tracing::warn!(
            "No geometries found for extent calculation in {}.{}",
            schema,
            table
        );
        return Ok(None);
    }

    let result = sqlx::query(&query).fetch_optional(pool).await?;

    if let Some(row) = result {
        let min_x: Option<f64> = row.try_get("min_x").ok();
        let min_y: Option<f64> = row.try_get("min_y").ok();
        let max_x: Option<f64> = row.try_get("max_x").ok();
        let max_y: Option<f64> = row.try_get("max_y").ok();
        if let (Some(min_x), Some(min_y), Some(max_x), Some(max_y)) = (min_x, min_y, max_x, max_y) {
            tracing::info!(
                "Extent calculated for {}.{}: [{}, {}, {}, {}]",
                schema,
                table,
                min_x,
                min_y,
                max_x,
                max_y
            );
            Ok(Some(BBox {
                min_x,
                min_y,
                max_x,
                max_y,
                srid,
            }))
        } else {
            tracing::warn!(
                "Extent calculation returned null values for {}.{}",
                schema,
                table
            );
            Ok(None)
        }
    } else {
        tracing::warn!("No extent result for {}.{}", schema, table);
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

    // Déterminer la colonne PK (première clé primaire)
    let primary_keys = super::schema::get_primary_keys(pool, schema, table).await?;
    let pk_name = primary_keys
        .get(0)
        .cloned()
        .unwrap_or_else(|| "id".to_string());
    let pk_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&pk_name)
        .fetch_one(pool)
        .await?;

    // Vérifier que row_id n'est pas vide ou invalide
    if row_id.trim().is_empty() || row_id.trim() == "nan" {
        return Err(sqlx::Error::RowNotFound);
    }

    // Construire la requête en castant dynamiquement la valeur de PK
    if let Ok(u) = uuid::Uuid::parse_str(row_id) {
        let query = format!(
            "UPDATE {}.{} SET {} = {} WHERE {} = $1::uuid",
            schema_ident, table_ident, column_ident, value_str, pk_ident
        );
        sqlx::query(&query).bind(u).execute(pool).await?;
    } else if let Ok(n) = row_id.parse::<i64>() {
        let query = format!(
            "UPDATE {}.{} SET {} = {} WHERE {} = $1::bigint",
            schema_ident, table_ident, column_ident, value_str, pk_ident
        );
        sqlx::query(&query).bind(n).execute(pool).await?;
    } else {
        let query = format!(
            "UPDATE {}.{} SET {} = {} WHERE {} = $1::text",
            schema_ident, table_ident, column_ident, value_str, pk_ident
        );
        sqlx::query(&query).bind(row_id).execute(pool).await?;
    }

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

/// Sélectionne des lignes intersectant une BBOX (srid fourni)
pub async fn select_bbox(
    pool: &PgPool,
    schema: &str,
    table: &str,
    min_x: f64,
    min_y: f64,
    max_x: f64,
    max_y: f64,
    srid: i32,
) -> Result<SelectionResponse, sqlx::Error> {
    // Obtenir info géométrie
    let geom_info = super::schema::get_geometry_info(pool, schema, table).await?;
    if geom_info.is_none() {
        return Ok(SelectionResponse {
            ids: vec![],
            count: 0,
            bbox: None,
        });
    }
    let (geom_column, _geom_type, _srid_existing) = geom_info.unwrap();

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

    let query = format!(
        "SELECT id::text FROM {}.{} WHERE ST_Intersects({}, ST_Transform(ST_MakeEnvelope($1,$2,$3,$4,$5), ST_SRID({}))) LIMIT 2000",
        schema_ident, table_ident, geom_ident, geom_ident
    );

    let ids: Vec<String> = sqlx::query_scalar(&query)
        .bind(min_x)
        .bind(min_y)
        .bind(max_x)
        .bind(max_y)
        .bind(srid)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    let count = ids.len() as i64;
    let bbox = calculate_bbox(pool, schema, table, &ids).await?;
    Ok(SelectionResponse { ids, count, bbox })
}

/// Expose le calcul d'extent pour une liste d'ids
pub async fn get_extent_by_ids(
    pool: &PgPool,
    schema: &str,
    table: &str,
    ids: &[String],
) -> Result<Option<BBox>, sqlx::Error> {
    calculate_bbox(pool, schema, table, ids).await
}

/// Calcule un extent en joignant des tables référencées (via FKs) qui possèdent une géométrie
pub async fn get_extent_by_related(
    pool: &PgPool,
    schema: &str,
    table: &str,
    ids: &[String],
) -> Result<Option<BBox>, sqlx::Error> {
    use super::schema;
    if ids.is_empty() {
        return Ok(None);
    }

    // Récupérer FKs
    let fks = schema::get_foreign_keys(pool, schema, table)
        .await
        .unwrap_or_default();
    if fks.is_empty() {
        return Ok(None);
    }

    // Échappes
    let schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(schema)
        .fetch_one(pool)
        .await?;
    let table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(table)
        .fetch_one(pool)
        .await?;
    let ids_str = ids
        .iter()
        .map(|id| format!("'{}'", id.replace("'", "''")))
        .collect::<Vec<_>>()
        .join(",");

    // Essayer chaque FK et retourner le premier extent non nul
    for fk in fks {
        if let Ok(Some((geom_col, _typ, srid))) =
            schema::get_geometry_info(pool, &fk.foreign_table_schema, &fk.foreign_table_name).await
        {
            let ref_schema_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
                .bind(&fk.foreign_table_schema)
                .fetch_one(pool)
                .await?;
            let ref_table_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
                .bind(&fk.foreign_table_name)
                .fetch_one(pool)
                .await?;
            let ref_geom_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
                .bind(&geom_col)
                .fetch_one(pool)
                .await?;
            let src_fk_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
                .bind(&fk.column_name)
                .fetch_one(pool)
                .await?;
            let ref_fk_ident = sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
                .bind(&fk.foreign_column_name)
                .fetch_one(pool)
                .await?;

            let query = format!(
                "SELECT ST_XMin(ext) as min_x, ST_YMin(ext) as min_y, ST_XMax(ext) as max_x, ST_YMax(ext) as max_y FROM (\n                 SELECT ST_Extent(rtn.{ref_geom}) as ext\n                 FROM {src_schema}.{src_table} src\n                 JOIN {ref_schema}.{ref_table} rtn ON src.{src_fk} = rtn.{ref_fk}\n                 WHERE src.id::text IN ({ids})\n            ) sub",
                ref_geom = ref_geom_ident,
                src_schema = schema_ident,
                src_table = table_ident,
                ref_schema = ref_schema_ident,
                ref_table = ref_table_ident,
                src_fk = src_fk_ident,
                ref_fk = ref_fk_ident,
                ids = ids_str,
            );
            if let Some(row) = sqlx::query(&query).fetch_optional(pool).await? {
                let (min_x, min_y, max_x, max_y): (
                    Option<f64>,
                    Option<f64>,
                    Option<f64>,
                    Option<f64>,
                ) = (
                    row.try_get("min_x").ok(),
                    row.try_get("min_y").ok(),
                    row.try_get("max_x").ok(),
                    row.try_get("max_y").ok(),
                );
                if let (Some(min_x), Some(min_y), Some(max_x), Some(max_y)) =
                    (min_x, min_y, max_x, max_y)
                {
                    return Ok(Some(BBox {
                        min_x,
                        min_y,
                        max_x,
                        max_y,
                        srid,
                    }));
                }
            }
        }
    }
    Ok(None)
}
