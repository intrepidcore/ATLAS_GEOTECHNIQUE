use sqlx::PgPool;

pub async fn pg_pool() -> anyhow::Result<PgPool> {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL is required");
    let pool = PgPool::connect(&url).await?;
    // Health check en runtime (pas de macro compile-time) pour garder les builds Docker
    // indépendants de la DB et éviter d'exiger sqlx-data.json/SQLX_OFFLINE.
    let _one: i32 = sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&pool).await?;
    Ok(pool)
}
