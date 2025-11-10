// Module de pagination pour grandes tables
use serde::{Deserialize, Serialize};
use sqlx::{Column, PgPool, Row};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub cursor: Option<String>, // Pour cursor-based pagination
    pub order_by: Option<String>,
    pub order_dir: Option<String>, // 'ASC' ou 'DESC'
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            limit: Some(50), // Limite par défaut
            offset: Some(0),
            cursor: None,
            order_by: Some("id".to_string()),
            order_dir: Some("ASC".to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: Option<i64>,
    pub limit: i64,
    pub offset: i64,
    pub has_more: bool,
    pub next_cursor: Option<String>,
}

/// Récupérer des données paginées avec offset
pub async fn paginate_table(
    pool: &PgPool,
    schema: &str,
    table: &str,
    params: &PaginationParams,
) -> Result<PaginatedResponse<serde_json::Value>, sqlx::Error> {
    let limit = params.limit.unwrap_or(50).min(1000); // Max 1000 par requête
    let offset = params.offset.unwrap_or(0);
    let order_by = params.order_by.as_deref().unwrap_or("id");
    let order_dir = params.order_dir.as_deref().unwrap_or("ASC");

    // Sanitize order_by et order_dir (éviter injection SQL)
    let order_dir = if order_dir.to_uppercase() == "DESC" {
        "DESC"
    } else {
        "ASC"
    };

    // Compter le total (optionnel, peut être coûteux)
    let total: Option<i64> = if offset == 0 {
        // Seulement compter à la première page
        sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {}.{}", schema, table))
            .fetch_one(pool)
            .await
            .ok()
    } else {
        None
    };

    // Récupérer les données
    let query = format!(
        "SELECT * FROM {}.{} ORDER BY {} {} LIMIT {} OFFSET {}",
        schema, table, order_by, order_dir, limit, offset
    );

    let rows = sqlx::query(&query).fetch_all(pool).await?;

    let mut data = Vec::new();
    for row in &rows {
        let mut obj = serde_json::Map::new();
        for (i, col) in row.columns().iter().enumerate() {
            let value: Option<String> = row.try_get(i).ok();
            obj.insert(
                col.name().to_string(),
                serde_json::Value::String(value.unwrap_or_else(|| "NULL".to_string())),
            );
        }
        data.push(serde_json::Value::Object(obj));
    }

    let has_more = data.len() as i64 == limit;

    Ok(PaginatedResponse {
        data,
        total,
        limit,
        offset,
        has_more,
        next_cursor: None, // Pas utilisé en mode offset
    })
}

/// Pagination basée sur curseur (plus efficace pour grandes tables)
pub async fn paginate_table_cursor(
    pool: &PgPool,
    schema: &str,
    table: &str,
    cursor_column: &str,
    cursor_value: Option<&str>,
    limit: i64,
) -> Result<PaginatedResponse<serde_json::Value>, sqlx::Error> {
    let limit = limit.min(1000);

    let query = if let Some(cursor) = cursor_value {
        format!(
            "SELECT * FROM {}.{} WHERE {} > $1 ORDER BY {} ASC LIMIT {}",
            schema, table, cursor_column, cursor_column, limit
        )
    } else {
        format!(
            "SELECT * FROM {}.{} ORDER BY {} ASC LIMIT {}",
            schema, table, cursor_column, limit
        )
    };

    let rows = if let Some(cursor) = cursor_value {
        sqlx::query(&query).bind(cursor).fetch_all(pool).await?
    } else {
        sqlx::query(&query).fetch_all(pool).await?
    };

    let mut data = Vec::new();
    let mut next_cursor = None;

    for row in &rows {
        let mut obj = serde_json::Map::new();
        for (i, col) in row.columns().iter().enumerate() {
            let value: Option<String> = row.try_get(i).ok();
            
            // Capturer la valeur du curseur pour la prochaine page
            if col.name() == cursor_column {
                next_cursor = value.clone();
            }
            
            obj.insert(
                col.name().to_string(),
                serde_json::Value::String(value.unwrap_or_else(|| "NULL".to_string())),
            );
        }
        data.push(serde_json::Value::Object(obj));
    }

    let has_more = data.len() as i64 == limit;

    Ok(PaginatedResponse {
        data,
        total: None, // Pas de total en mode cursor
        limit,
        offset: 0,
        has_more,
        next_cursor,
    })
}

/// Streaming de données (pour export massif)
pub async fn stream_table_chunks(
    pool: &PgPool,
    schema: &str,
    table: &str,
    chunk_size: i64,
) -> Result<Vec<Vec<serde_json::Value>>, sqlx::Error> {
    let chunk_size = chunk_size.min(10000);
    let mut chunks = Vec::new();
    let mut offset = 0;

    loop {
        let query = format!(
            "SELECT * FROM {}.{} LIMIT {} OFFSET {}",
            schema, table, chunk_size, offset
        );

        let rows = sqlx::query(&query).fetch_all(pool).await?;

        if rows.is_empty() {
            break;
        }

        let mut chunk = Vec::new();
        for row in &rows {
            let mut obj = serde_json::Map::new();
            for (i, col) in row.columns().iter().enumerate() {
                let value: Option<String> = row.try_get(i).ok();
                obj.insert(
                    col.name().to_string(),
                    serde_json::Value::String(value.unwrap_or_else(|| "NULL".to_string())),
                );
            }
            chunk.push(serde_json::Value::Object(obj));
        }

        chunks.push(chunk);
        offset += chunk_size;

        // Limite de sécurité (max 100 chunks = 1M lignes)
        if chunks.len() >= 100 {
            break;
        }
    }

    Ok(chunks)
}
