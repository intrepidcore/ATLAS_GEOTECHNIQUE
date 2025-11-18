// Gestion des locks pour staging - prévient éditions concurrentes
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StagingLock {
    pub table_name: String,
    pub locked_by: String,
    pub user_email: Option<String>,
    pub locked_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub staging_id: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcquireLockRequest {
    pub table_name: String,
    pub locked_by: String,
    pub user_email: Option<String>,
    pub duration_minutes: Option<i32>, // Défaut 15 min
    pub staging_id: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockError {
    pub error_type: String, // "already_locked", "expired", "not_found"
    pub message: String,
    pub current_lock: Option<StagingLock>,
}

/// Tente d'acquérir un lock sur une table
/// Retourne Ok(lock) si succès, Err si déjà verrouillée
pub async fn acquire_lock(
    pool: &PgPool,
    request: AcquireLockRequest,
) -> Result<StagingLock, LockError> {
    // Nettoyer les locks expirés d'abord
    cleanup_expired_locks(pool).await.ok();

    let duration_minutes = request.duration_minutes.unwrap_or(15);
    let expires_at = chrono::Utc::now() + chrono::Duration::minutes(duration_minutes as i64);

    // Tenter l'insertion (ON CONFLICT DO NOTHING)
    let result = sqlx::query(
        r#"
        INSERT INTO atlas.staging_locks 
        (table_name, locked_by, user_email, expires_at, staging_id, reason)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (table_name) DO NOTHING
        RETURNING table_name, locked_by, user_email, locked_at, expires_at, staging_id, reason
        "#,
    )
    .bind(&request.table_name)
    .bind(&request.locked_by)
    .bind(&request.user_email)
    .bind(expires_at)
    .bind(&request.staging_id)
    .bind(&request.reason)
    .fetch_optional(pool)
    .await
    .map_err(|e| LockError {
        error_type: "database_error".to_string(),
        message: format!("Erreur base de données: {}", e),
        current_lock: None,
    })?;

    if let Some(row) = result {
        // Lock acquis avec succès
        Ok(StagingLock {
            table_name: row.try_get("table_name").unwrap(),
            locked_by: row.try_get("locked_by").unwrap(),
            user_email: row.try_get("user_email").ok(),
            locked_at: row.try_get("locked_at").unwrap(),
            expires_at: row.try_get("expires_at").unwrap(),
            staging_id: row.try_get("staging_id").ok(),
            reason: row.try_get("reason").ok(),
        })
    } else {
        // Conflit - table déjà verrouillée
        // Récupérer le lock existant
        let existing = get_lock(pool, &request.table_name).await?;

        Err(LockError {
            error_type: "already_locked".to_string(),
            message: format!(
                "Table '{}' déjà verrouillée par '{}' jusqu'à {}",
                request.table_name,
                existing.locked_by,
                existing.expires_at.format("%Y-%m-%d %H:%M:%S UTC")
            ),
            current_lock: Some(existing),
        })
    }
}

/// Libère un lock
pub async fn release_lock(
    pool: &PgPool,
    table_name: &str,
    locked_by: &str,
) -> Result<bool, sqlx::Error> {
    let result =
        sqlx::query("DELETE FROM atlas.staging_locks WHERE table_name = $1 AND locked_by = $2")
            .bind(table_name)
            .bind(locked_by)
            .execute(pool)
            .await?;

    Ok(result.rows_affected() > 0)
}

/// Libère un lock par staging_id
pub async fn release_lock_by_staging(pool: &PgPool, staging_id: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM atlas.staging_locks WHERE staging_id = $1")
        .bind(staging_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

/// Récupère un lock existant
pub async fn get_lock(pool: &PgPool, table_name: &str) -> Result<StagingLock, LockError> {
    let row = sqlx::query(
        r#"
        SELECT table_name, locked_by, user_email, locked_at, expires_at, staging_id, reason
        FROM atlas.staging_locks
        WHERE table_name = $1
        "#,
    )
    .bind(table_name)
    .fetch_optional(pool)
    .await
    .map_err(|e| LockError {
        error_type: "database_error".to_string(),
        message: format!("Erreur base de données: {}", e),
        current_lock: None,
    })?;

    if let Some(row) = row {
        Ok(StagingLock {
            table_name: row.try_get("table_name").unwrap(),
            locked_by: row.try_get("locked_by").unwrap(),
            user_email: row.try_get("user_email").ok(),
            locked_at: row.try_get("locked_at").unwrap(),
            expires_at: row.try_get("expires_at").unwrap(),
            staging_id: row.try_get("staging_id").ok(),
            reason: row.try_get("reason").ok(),
        })
    } else {
        Err(LockError {
            error_type: "not_found".to_string(),
            message: format!("Aucun lock trouvé pour '{}'", table_name),
            current_lock: None,
        })
    }
}

/// Liste tous les locks actifs
pub async fn list_active_locks(pool: &PgPool) -> Result<Vec<StagingLock>, sqlx::Error> {
    // Nettoyer d'abord
    cleanup_expired_locks(pool).await.ok();

    let rows = sqlx::query(
        r#"
        SELECT table_name, locked_by, user_email, locked_at, expires_at, staging_id, reason
        FROM atlas.staging_locks
        ORDER BY locked_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .iter()
        .map(|row| StagingLock {
            table_name: row.try_get("table_name").unwrap(),
            locked_by: row.try_get("locked_by").unwrap(),
            user_email: row.try_get("user_email").ok(),
            locked_at: row.try_get("locked_at").unwrap(),
            expires_at: row.try_get("expires_at").unwrap(),
            staging_id: row.try_get("staging_id").ok(),
            reason: row.try_get("reason").ok(),
        })
        .collect())
}

/// Nettoie les locks expirés
pub async fn cleanup_expired_locks(pool: &PgPool) -> Result<i64, sqlx::Error> {
    let result = sqlx::query("SELECT atlas.cleanup_expired_locks()")
        .fetch_one(pool)
        .await?;

    let count: i32 = result.try_get(0)?;
    Ok(count as i64)
}

/// Prolonge un lock existant
pub async fn extend_lock(
    pool: &PgPool,
    table_name: &str,
    locked_by: &str,
    additional_minutes: i32,
) -> Result<StagingLock, LockError> {
    let new_expires = chrono::Utc::now() + chrono::Duration::minutes(additional_minutes as i64);

    let result = sqlx::query(
        r#"
        UPDATE atlas.staging_locks
        SET expires_at = $3
        WHERE table_name = $1 AND locked_by = $2
        RETURNING table_name, locked_by, user_email, locked_at, expires_at, staging_id, reason
        "#,
    )
    .bind(table_name)
    .bind(locked_by)
    .bind(new_expires)
    .fetch_optional(pool)
    .await
    .map_err(|e| LockError {
        error_type: "database_error".to_string(),
        message: format!("Erreur base de données: {}", e),
        current_lock: None,
    })?;

    if let Some(row) = result {
        Ok(StagingLock {
            table_name: row.try_get("table_name").unwrap(),
            locked_by: row.try_get("locked_by").unwrap(),
            user_email: row.try_get("user_email").ok(),
            locked_at: row.try_get("locked_at").unwrap(),
            expires_at: row.try_get("expires_at").unwrap(),
            staging_id: row.try_get("staging_id").ok(),
            reason: row.try_get("reason").ok(),
        })
    } else {
        Err(LockError {
            error_type: "not_found".to_string(),
            message: format!("Lock non trouvé ou non détenu par '{}'", locked_by),
            current_lock: None,
        })
    }
}

/// Vérifie si une table est verrouillée
pub async fn is_locked(pool: &PgPool, table_name: &str) -> Result<bool, sqlx::Error> {
    cleanup_expired_locks(pool).await.ok();

    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM atlas.staging_locks WHERE table_name = $1")
            .bind(table_name)
            .fetch_one(pool)
            .await?;

    Ok(count > 0)
}
