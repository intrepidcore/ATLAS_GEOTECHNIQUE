use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;

pub async fn pg_pool() -> anyhow::Result<PgPool> {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL is required");

    // Configuration pool avec timeouts généreux pour Docker
    let pool = PgPoolOptions::new()
        .max_connections(30)
        .min_connections(5)
        .acquire_timeout(Duration::from_secs(120))
        .idle_timeout(Duration::from_secs(600))
        .max_lifetime(Duration::from_secs(1800))
        .connect(&url)
        .await?;

    // Health check en runtime (pas de macro compile-time) pour garder les builds Docker
    // indépendants de la DB et éviter d'exiger sqlx-data.json/SQLX_OFFLINE.
    let _one: i32 = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&pool)
        .await?;

    Ok(pool)
}

/// Tentative de connexion avec retries exponentiels
pub async fn pg_pool_with_retry(max_attempts: u32) -> anyhow::Result<PgPool> {
    let mut attempt = 1;
    loop {
        match pg_pool().await {
            Ok(pool) => return Ok(pool),
            Err(e) if attempt < max_attempts => {
                let delay = Duration::from_secs(2_u64.pow(attempt.min(5)));
                tracing::warn!(
                    "DB connexion échouée (tentative {}/{}): {:?}. Retry dans {:?}",
                    attempt,
                    max_attempts,
                    e,
                    delay
                );
                tokio::time::sleep(delay).await;
                attempt += 1;
            }
            Err(e) => return Err(e),
        }
    }
}
