use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use sqlx::Row;

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/schema", get(get_schema))
        .route("/table/:schema/:table", get(get_table_info))
        .route("/table/:schema/:table/data", get(get_table_data))
}

#[derive(Serialize)]
struct DbSchemaResponse {
    schemas: Vec<DbSchema>,
}

#[derive(Serialize)]
struct DbSchema {
    name: String,
    tables: Vec<DbTableSummary>,
}

#[derive(Serialize)]
struct DbTableSummary {
    name: String,
    row_count: i64,
}

#[derive(Serialize)]
struct TableInfoResponse {
    columns: Vec<ColumnInfo>,
    primary_keys: Vec<String>,
}

#[derive(Serialize)]
struct ColumnInfo {
    name: String,
    data_type: String,
    is_nullable: bool,
}

#[derive(Serialize)]
struct TableDataResponse {
    rows: Vec<serde_json::Value>,
}

fn is_safe_ident(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 63
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_')
}

async fn get_schema(State(state): State<AppState>) -> impl IntoResponse {
    let pool = &state.pool;

    let rows = match sqlx::query(
        r#"
        SELECT
            n.nspname AS schema_name,
            c.relname AS table_name,
            COALESCE(c.reltuples::bigint, 0) AS row_estimate
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY n.nspname, c.relname
        "#,
    )
    .fetch_all(pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "db schema query");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"})))
                .into_response();
        }
    };

    let mut by_schema: std::collections::BTreeMap<String, Vec<DbTableSummary>> =
        std::collections::BTreeMap::new();

    for r in rows {
        let schema_name: String = r.get("schema_name");
        let table_name: String = r.get("table_name");
        let row_estimate: i64 = r.try_get("row_estimate").unwrap_or(0);

        by_schema
            .entry(schema_name)
            .or_default()
            .push(DbTableSummary {
                name: table_name,
                row_count: row_estimate,
            });
    }

    let schemas = by_schema
        .into_iter()
        .map(|(name, tables)| DbSchema { name, tables })
        .collect();

    Json(DbSchemaResponse { schemas }).into_response()
}

async fn get_table_info(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
) -> impl IntoResponse {
    if !is_safe_ident(&schema) || !is_safe_ident(&table) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error":"invalid schema/table"})),
        )
            .into_response();
    }

    let pool = &state.pool;

    let col_rows = match sqlx::query(
        r#"
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
        "#,
    )
    .bind(&schema)
    .bind(&table)
    .fetch_all(pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "db table columns query");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"})))
                .into_response();
        }
    };

    let columns = col_rows
        .into_iter()
        .map(|r| {
            let is_nullable: String = r.get("is_nullable");
            ColumnInfo {
                name: r.get("column_name"),
                data_type: r.get("data_type"),
                is_nullable: is_nullable.eq_ignore_ascii_case("YES"),
            }
        })
        .collect::<Vec<_>>();

    let pk_rows = match sqlx::query(
        r#"
        SELECT a.attname AS column_name
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
        WHERE i.indisprimary
          AND n.nspname = $1
          AND t.relname = $2
        ORDER BY a.attnum
        "#,
    )
    .bind(&schema)
    .bind(&table)
    .fetch_all(pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "db table pk query");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"})))
                .into_response();
        }
    };

    let primary_keys = pk_rows
        .into_iter()
        .map(|r| r.get::<String, _>("column_name"))
        .collect::<Vec<_>>();

    Json(TableInfoResponse {
        columns,
        primary_keys,
    })
    .into_response()
}

#[derive(serde::Deserialize)]
struct DataQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

async fn get_table_data(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
    Query(q): Query<DataQuery>,
) -> impl IntoResponse {
    if !is_safe_ident(&schema) || !is_safe_ident(&table) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error":"invalid schema/table"})),
        )
            .into_response();
    }

    let limit = q.limit.unwrap_or(100).clamp(1, 1000);
    let offset = q.offset.unwrap_or(0).max(0);

    let pool = &state.pool;

    let sql = format!(
        "SELECT row_to_json(t) AS row FROM (SELECT * FROM \"{}\".\"{}\" LIMIT {} OFFSET {}) t",
        schema, table, limit, offset
    );

    let rows = match sqlx::query(&sql).fetch_all(pool).await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(?e, "db table data query");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"db error"})))
                .into_response();
        }
    };

    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        let v: serde_json::Value = r.try_get("row").unwrap_or(serde_json::Value::Null);
        out.push(v);
    }

    Json(TableDataResponse { rows: out }).into_response()
}
