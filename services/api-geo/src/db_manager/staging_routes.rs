// Routes API complètes pour staging avec locks et dry-run
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use super::{
    locks::*,
    staging::*,
    staging_dryrun::*,
    backup_retention::*,
    types::*,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStagingApiRequest {
    pub schema: String,
    pub table: String,
    pub reason: Option<String>,
    pub copy_data: Option<bool>,
    pub user: String,
    pub user_email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitStagingApiRequest {
    pub message: String,
    pub user: String,
    pub backup: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StagingApiResponse {
    pub success: bool,
    pub staging_info: Option<StagingInfo>,
    pub lock_info: Option<StagingLock>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DryRunApiResponse {
    pub success: bool,
    pub result: Option<StagingDryRunResult>,
    pub error: Option<String>,
}

/// POST /db/staging - Créer un staging avec lock automatique
pub async fn create_staging_api(
    State(pool): State<PgPool>,
    Json(request): Json<CreateStagingApiRequest>,
) -> Result<Json<StagingApiResponse>, AppError> {
    let table_full = format!("{}.{}", request.schema, request.table);

    // 1. Vérifier si table déjà verrouillée
    if is_locked(&pool, &table_full).await? {
        let existing_lock = get_lock(&pool, &table_full).await.ok();
        return Ok(Json(StagingApiResponse {
            success: false,
            staging_info: None,
            lock_info: existing_lock,
            error: Some(format!("Table '{}' déjà verrouillée", table_full)),
        }));
    }

    // 2. Créer le staging
    let staging_info = create_staging(
        &pool,
        &request.schema,
        &request.table,
        CreateStagingRequest {
            reason: request.reason.clone(),
        },
    )
    .await?;

    // 3. Acquérir le lock
    let lock_result = acquire_lock(
        &pool,
        AcquireLockRequest {
            table_name: table_full.clone(),
            locked_by: request.user.clone(),
            user_email: request.user_email.clone(),
            duration_minutes: Some(15),
            staging_id: Some(staging_info.staging_id.clone()),
            reason: request.reason.clone(),
        },
    )
    .await;

    let lock_info = lock_result.ok(); // Lock échoué mais staging créé

    Ok(Json(StagingApiResponse {
        success: true,
        staging_info: Some(staging_info),
        lock_info,
        error: None,
    }))
}

/// GET /db/staging/:id - Récupérer info staging
pub async fn get_staging_api(
    State(pool): State<PgPool>,
    Path(staging_id): Path<String>,
) -> Result<Json<StagingInfo>, AppError> {
    let info = get_staging_info(&pool, &staging_id).await?;
    Ok(Json(info))
}

/// POST /db/staging/:id/dryrun - Dry-run du commit
pub async fn dryrun_staging_api(
    State(pool): State<PgPool>,
    Path(staging_id): Path<String>,
) -> Result<Json<DryRunApiResponse>, AppError> {
    let result = dryrun_commit_staging(&pool, &staging_id).await;

    match result {
        Ok(dryrun_result) => Ok(Json(DryRunApiResponse {
            success: true,
            result: Some(dryrun_result),
            error: None,
        })),
        Err(e) => Ok(Json(DryRunApiResponse {
            success: false,
            result: None,
            error: Some(e.to_string()),
        })),
    }
}

/// POST /db/staging/:id/commit - Commit staging
pub async fn commit_staging_api(
    State(pool): State<PgPool>,
    Path(staging_id): Path<String>,
    Json(request): Json<CommitStagingApiRequest>,
) -> Result<Json<CommitResult>, AppError> {
    // Backup automatique si demandé
    if request.backup.unwrap_or(true) {
        let staging_info = get_staging_info(&pool, &staging_id).await?;
        let config = BackupConfig::default();
        
        match create_table_backup(
            &staging_info.table_name,
            &staging_info.schema_name,
            &config,
        )
        .await
        {
            Ok(backup_info) => {
                eprintln!("Backup créé: {:?} ({} bytes)", backup_info.file_path, backup_info.size_bytes);
            }
            Err(e) => {
                eprintln!("Warning: Backup failed: {}", e);
                // Continue quand même - le backup n'est pas critique
            }
        }
    }

    // Commit
    let result = commit_staging(&pool, &staging_id).await?;

    // Libérer le lock
    release_lock_by_staging(&pool, &staging_id).await.ok();

    Ok(Json(result))
}

/// POST /db/staging/:id/cancel - Annuler staging
pub async fn cancel_staging_api(
    State(pool): State<PgPool>,
    Path(staging_id): Path<String>,
) -> Result<StatusCode, AppError> {
    cancel_staging(&pool, &staging_id).await?;
    
    // Libérer le lock
    release_lock_by_staging(&pool, &staging_id).await.ok();

    Ok(StatusCode::NO_CONTENT)
}

/// POST /db/staging/:id/lock - Acquérir lock
pub async fn acquire_lock_api(
    State(pool): State<PgPool>,
    Path(_staging_id): Path<String>,
    Json(request): Json<AcquireLockRequest>,
) -> Result<Json<StagingLock>, AppError> {
    let lock = acquire_lock(&pool, request).await.map_err(|e| {
        AppError::Conflict(e.message)
    })?;

    Ok(Json(lock))
}

/// DELETE /db/staging/:id/lock - Libérer lock
pub async fn release_lock_api(
    State(pool): State<PgPool>,
    Path(staging_id): Path<String>,
    Json(user): Json<String>,
) -> Result<StatusCode, AppError> {
    let staging_info = get_staging_info(&pool, &staging_id).await?;
    let table_full = format!("{}.{}", staging_info.schema_name, staging_info.table_name);
    
    release_lock(&pool, &table_full, &user).await?;

    Ok(StatusCode::NO_CONTENT)
}

/// GET /db/locks - Liste tous les locks actifs
pub async fn list_locks_api(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<StagingLock>>, AppError> {
    let locks = list_active_locks(&pool).await?;
    Ok(Json(locks))
}

/// POST /db/staging/:id/validate - Valider staging
pub async fn validate_staging_api(
    State(pool): State<PgPool>,
    Path(staging_id): Path<String>,
) -> Result<Json<StagingValidationResult>, AppError> {
    let result = validate_staging(&pool, &staging_id).await?;
    Ok(Json(result))
}

/// GET /db/staging/:id/preview - Preview changements
pub async fn preview_staging_api(
    State(pool): State<PgPool>,
    Path(staging_id): Path<String>,
) -> Result<Json<StagingPreview>, AppError> {
    let preview = preview_staging(&pool, &staging_id, Some(50)).await?;
    Ok(Json(preview))
}

// Error handling
#[derive(Debug)]
pub enum AppError {
    Database(sqlx::Error),
    NotFound(String),
    Conflict(String),
    BadRequest(String),
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        AppError::Database(err)
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::BadRequest(err.to_string())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::Database(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
        };

        let body = Json(serde_json::json!({
            "error": message
        }));

        (status, body).into_response()
    }
}

/// Enregistrer toutes les routes staging
pub fn staging_routes() -> axum::Router<PgPool> {
    use axum::routing::{delete, get, post};

    axum::Router::new()
        .route("/db/staging", post(create_staging_api))
        .route("/db/staging/:id", get(get_staging_api))
        .route("/db/staging/:id/dryrun", post(dryrun_staging_api))
        .route("/db/staging/:id/commit", post(commit_staging_api))
        .route("/db/staging/:id/cancel", post(cancel_staging_api))
        .route("/db/staging/:id/lock", post(acquire_lock_api))
        .route("/db/staging/:id/lock", delete(release_lock_api))
        .route("/db/staging/:id/validate", post(validate_staging_api))
        .route("/db/staging/:id/preview", get(preview_staging_api))
        .route("/db/locks", get(list_locks_api))
}
