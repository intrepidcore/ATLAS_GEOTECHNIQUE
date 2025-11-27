use crate::state::AppState;
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub database: DatabaseHealth,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseHealth {
    pub connected: bool,
    pub tables_ok: bool,
    pub missing_tables: Vec<String>,
}

/// Healthcheck endpoint avec vérification des tables critiques
pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let pool = state.pool;
    let mut db_health = DatabaseHealth {
        connected: false,
        tables_ok: false,
        missing_tables: Vec::new(),
    };

    // Test de connexion
    if let Ok(_) = sqlx::query("SELECT 1").fetch_one(&pool).await {
        db_health.connected = true;

        // Vérifier les tables critiques
        let critical_tables = vec![
            ("atlas", "staging_metadata"),
            ("atlas", "staging_locks"),
            ("atlas", "audit_log"),
            ("atlas", "backup_metadata"),
            ("atlas", "users"),
            ("atlas", "roles"),
            ("atlas", "sondages"),
        ];

        for (schema, table) in critical_tables {
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = $1 AND table_name = $2
                )",
            )
            .bind(schema)
            .bind(table)
            .fetch_one(&pool)
            .await
            .unwrap_or(false);

            if !exists {
                db_health
                    .missing_tables
                    .push(format!("{}.{}", schema, table));
            }
        }

        db_health.tables_ok = db_health.missing_tables.is_empty();
    }

    let status = if db_health.connected && db_health.tables_ok {
        "healthy"
    } else if db_health.connected {
        "degraded"
    } else {
        "unhealthy"
    };

    Json(HealthResponse {
        status: status.to_string(),
        database: db_health,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// Healthcheck simple (pour Docker/K8s)
pub async fn health_check_simple(State(state): State<AppState>) -> &'static str {
    match sqlx::query("SELECT 1").fetch_one(&state.pool).await {
        Ok(_) => "ok",
        Err(_) => "error",
    }
}
