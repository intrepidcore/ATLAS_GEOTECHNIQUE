// Routes API pour le gestionnaire de base de données
use super::*;
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use std::collections::HashMap;
use sqlx::PgPool;

fn require_admin_pool(
    state: &AppState,
) -> Result<&PgPool, (StatusCode, Json<DbManagerError>)> {
    state.admin_pool.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        Json(DbManagerError::new(
            "DB_MANAGER_DISABLED",
            "DB Manager désactivé (ENABLE_DB_MANAGER=false)",
        )),
    ))
}

#[derive(Serialize)]
pub struct GeocodeStatus {
    pub id: String,
    pub code: Option<String>,
    pub is_geocoded: bool,
    pub location_mode: Option<String>,
    pub location_accuracy: Option<String>,
    pub has_geometry: bool,
    pub adm3_id: Option<i32>,
}

// ============================================================================
// Schema & Table Info Routes
// ============================================================================

/// GET /db/types - Récupère la liste des types PostgreSQL disponibles
pub async fn get_postgres_types_handler() -> Json<Vec<PostgresType>> {
    Json(pg_types::get_postgres_types())
}

/// POST /db/table/:schema/:table/extent-related
pub async fn extent_by_related_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
    Json(ids): Json<Vec<String>>,
) -> Result<Json<Option<BBox>>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match table::get_extent_by_related(pool, &schema, &table, &ids).await {
        Ok(bbox) => Ok(Json(bbox)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("SELECTION_ERROR", &e.to_string())),
        )),
    }
}

// ============================================================================
// Spatial Selection Routes
// ============================================================================

/// POST /db/table/:schema/:table/select-bbox
pub async fn select_bbox_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
    Json(payload): Json<HashMap<String, serde_json::Value>>,
) -> Result<Json<SelectionResponse>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    let min_x = payload.get("min_x").and_then(|v| v.as_f64()).ok_or((
        StatusCode::BAD_REQUEST,
        Json(DbManagerError::new("BAD_REQUEST", "min_x manquant")),
    ))?;
    let min_y = payload.get("min_y").and_then(|v| v.as_f64()).ok_or((
        StatusCode::BAD_REQUEST,
        Json(DbManagerError::new("BAD_REQUEST", "min_y manquant")),
    ))?;
    let max_x = payload.get("max_x").and_then(|v| v.as_f64()).ok_or((
        StatusCode::BAD_REQUEST,
        Json(DbManagerError::new("BAD_REQUEST", "max_x manquant")),
    ))?;
    let max_y = payload.get("max_y").and_then(|v| v.as_f64()).ok_or((
        StatusCode::BAD_REQUEST,
        Json(DbManagerError::new("BAD_REQUEST", "max_y manquant")),
    ))?;
    let srid = payload.get("srid").and_then(|v| v.as_i64()).unwrap_or(4326) as i32;

    match table::select_bbox(
        pool,
        &schema,
        &table,
        min_x,
        min_y,
        max_x,
        max_y,
        srid,
    )
    .await
    {
        Ok(resp) => Ok(Json(resp)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("SELECTION_ERROR", &e.to_string())),
        )),
    }
}

/// POST /db/table/:schema/:table/extent
pub async fn extent_by_ids_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
    Json(ids): Json<Vec<String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<DbManagerError>)> {
    if ids.is_empty() {
        return Ok(Json(serde_json::json!({
            "bbox": null,
            "message": "No IDs provided"
        })));
    }

    let pool = require_admin_pool(&state)?;
    match table::get_extent_by_ids(pool, &schema, &table, &ids).await {
        Ok(Some(bbox)) => Ok(Json(serde_json::json!({
            "bbox": bbox,
            "message": "Extent calculated successfully"
        }))),
        Ok(None) => Ok(Json(serde_json::json!({
            "bbox": null,
            "message": "No geometries found for the selected rows"
        }))),
        Err(e) => {
            tracing::error!("Extent calculation error for {}.{}: {}", schema, table, e);
            Ok(Json(serde_json::json!({
                "bbox": null,
                "message": format!("Error calculating extent: {}", e),
                "error": true
            })))
        }
    }
}

/// GET /db/schema - Récupère la structure complète de la base
pub async fn get_schema_handler(
    State(state): State<AppState>,
) -> Result<Json<DatabaseSchema>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match schema::get_database_schema(pool).await {
        Ok(schema) => Ok(Json(schema)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
        )),
    }
}

/// GET /db/table/:schema/:table - Récupère les infos d'une table
pub async fn get_table_info_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
) -> Result<Json<TableInfo>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match schema::get_table_info(pool, &schema, &table).await {
        Ok(info) => Ok(Json(info)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
        )),
    }
}

// ============================================================================
// Table Data Routes
// ============================================================================

/// GET /db/table/:schema/:table/data - Récupère les données d'une table
pub async fn get_table_data_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
    Query(query): Query<TableDataQuery>,
) -> Result<Json<TableDataResponse>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match table::get_table_data(pool, &schema, &table, query).await {
        Ok(data) => Ok(Json(data)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
        )),
    }
}

/// POST /db/table/:schema/:table/select - Sélectionne des lignes
pub async fn select_rows_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
    Json(request): Json<SelectionRequest>,
) -> Result<Json<SelectionResponse>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match table::select_rows(pool, &schema, &table, request).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("SELECTION_ERROR", &e.to_string())),
        )),
    }
}

/// POST /db/table/:schema/:table/row - Ajoute une ligne vide
pub async fn add_row_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    // Créer un backup automatique
    if let Err(e) = backup::create_auto_backup(pool, &schema, &table, "Ajout de ligne").await
    {
        eprintln!("Erreur lors de la création du backup: {}", e);
    }

    match table::add_empty_row(pool, &schema, &table).await {
        Ok(id) => {
            // Créer un audit log
            let _ = audit::create_audit_entry(
                pool,
                &schema,
                &table,
                "INSERT_ROW",
                1,
                None,
                None,
                None,
                None,
            )
            .await;

            Ok(Json(serde_json::json!({ "id": id })))
        }
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("INSERT_ERROR", &e.to_string())),
        )),
    }
}

/// PUT /db/table/:schema/:table/row/:id/:column - Met à jour une cellule
pub async fn update_cell_handler(
    State(state): State<AppState>,
    Path((schema, table, row_id, column)): Path<(String, String, String, String)>,
    Json(value): Json<serde_json::Value>,
) -> Result<StatusCode, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match table::update_cell(pool, &schema, &table, &row_id, &column, value).await {
        Ok(_) => {
            // Créer un audit log
            let _ = audit::create_audit_entry(
                pool,
                &schema,
                &table,
                "UPDATE_CELL",
                1,
                None,
                None,
                None,
                Some(serde_json::json!({
                    "row_id": row_id,
                    "column": column
                })),
            )
            .await;

            Ok(StatusCode::OK)
        }
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("UPDATE_ERROR", &e.to_string())),
        )),
    }
}

/// DELETE /db/table/:schema/:table/rows - Supprime des lignes
pub async fn delete_rows_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
    Json(row_ids): Json<Vec<String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    if row_ids.len() > 5 {
        // Créer un backup automatique pour les suppressions massives
        if let Err(e) =
            backup::create_auto_backup(pool, &schema, &table, "Suppression massive").await
        {
            eprintln!("Erreur lors de la création du backup: {}", e);
        }
    }

    match table::delete_rows(pool, &schema, &table, &row_ids).await {
        Ok(count) => {
            // Créer un audit log
            let _ = audit::create_audit_entry(
                pool,
                &schema,
                &table,
                "DELETE_ROWS",
                count,
                None,
                None,
                None,
                Some(serde_json::json!({
                    "row_ids": row_ids
                })),
            )
            .await;

            Ok(Json(serde_json::json!({ "deleted": count })))
        }
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("DELETE_ERROR", &e.to_string())),
        )),
    }
}

// ============================================================================
// Staging Routes
// ============================================================================

/// POST /db/table/:schema/:table/staging - Crée un staging
pub async fn create_staging_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
    Json(request): Json<CreateStagingRequest>,
) -> Result<Json<StagingInfo>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    // Créer un backup automatique
    if let Err(e) =
        backup::create_auto_backup(pool, &schema, &table, "Création staging").await
    {
        eprintln!("Erreur lors de la création du backup: {}", e);
    }

    match staging::create_staging(pool, &schema, &table, request).await {
        Ok(info) => Ok(Json(info)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("STAGING_ERROR", &e.to_string())),
        )),
    }
}

/// POST /db/staging/:id/operation - Applique une opération dans le staging
pub async fn apply_staging_operation_handler(
    State(state): State<AppState>,
    Path(staging_id): Path<String>,
    Json(operation): Json<StagingRowOperation>,
) -> Result<StatusCode, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match staging::apply_staging_operation(pool, &staging_id, operation).await {
        Ok(_) => Ok(StatusCode::OK),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("STAGING_ERROR", &e.to_string())),
        )),
    }
}

/// GET /db/staging/:id/validate - Valide un staging
pub async fn validate_staging_handler(
    State(state): State<AppState>,
    Path(staging_id): Path<String>,
) -> Result<Json<StagingValidationResult>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match staging::validate_staging(pool, &staging_id).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("VALIDATION_ERROR", &e.to_string())),
        )),
    }
}

/// GET /db/staging/:id/preview - Prévisualise les changements
pub async fn preview_staging_handler(
    State(state): State<AppState>,
    Path(staging_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<StagingPreview>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    let limit = params.get("limit").and_then(|s| s.parse::<i64>().ok());

    match staging::preview_staging(pool, &staging_id, limit).await {
        Ok(preview) => Ok(Json(preview)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("PREVIEW_ERROR", &e.to_string())),
        )),
    }
}

/// POST /db/staging/:id/commit - Commit le staging
pub async fn commit_staging_handler(
    State(state): State<AppState>,
    Path(staging_id): Path<String>,
) -> Result<Json<CommitResult>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match staging::commit_staging(pool, &staging_id).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("COMMIT_ERROR", &e.to_string())),
        )),
    }
}

/// DELETE /db/staging/:id - Annule un staging
pub async fn cancel_staging_handler(
    State(state): State<AppState>,
    Path(staging_id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match staging::cancel_staging(pool, &staging_id).await {
        Ok(_) => Ok(StatusCode::OK),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("CANCEL_ERROR", &e.to_string())),
        )),
    }
}

// ============================================================================
// Column Operations Routes
// ============================================================================

/// POST /db/table/:schema/:table/column - Ajoute une colonne
pub async fn add_column_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
    Json(request): Json<AddColumnRequest>,
) -> Result<StatusCode, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    // Créer un backup automatique
    if let Err(e) =
        backup::create_auto_backup(pool, &schema, &table, "Ajout de colonne").await
    {
        eprintln!("Erreur lors de la création du backup: {}", e);
    }

    // Construire la requête ALTER TABLE
    let schema_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&schema)
        .fetch_one(pool)
        .await
    {
        Ok(s) => s,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
            ))
        }
    };

    let table_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&table)
        .fetch_one(pool)
        .await
    {
        Ok(s) => s,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
            ))
        }
    };

    let column_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&request.name)
        .fetch_one(pool)
        .await
    {
        Ok(s) => s,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
            ))
        }
    };

    // Construire le type de données
    let mut data_type = request.data_type.clone();
    if data_type.to_lowercase() == "varchar" || data_type.to_lowercase() == "character varying" {
        let length = request.character_length.unwrap_or(255);
        data_type = format!("VARCHAR({})", length);
    }

    let nullable = if request.is_nullable { "" } else { " NOT NULL" };
    let default = if let Some(def) = &request.default_value {
        format!(" DEFAULT {}", def)
    } else {
        String::new()
    };

    let alter_query = format!(
        "ALTER TABLE {}.{} ADD COLUMN {} {}{}{}",
        schema_ident, table_ident, column_ident, data_type, nullable, default
    );

    match sqlx::query(&alter_query).execute(pool).await {
        Ok(_) => {
            // Créer un audit log
            let _ = audit::create_audit_entry(
                pool,
                &schema,
                &table,
                "ADD_COLUMN",
                0,
                Some(&alter_query),
                None,
                None,
                Some(serde_json::json!({
                    "column_name": request.name,
                    "data_type": data_type
                })),
            )
            .await;

            Ok(StatusCode::CREATED)
        }
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("ALTER_TABLE_ERROR", &e.to_string())),
        )),
    }
}

/// DELETE /db/table/:schema/:table/column/:column - Supprime une colonne
pub async fn delete_column_handler(
    State(state): State<AppState>,
    Path((schema, table, column)): Path<(String, String, String)>,
    Json(request): Json<DeleteColumnRequest>,
) -> Result<StatusCode, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    // Créer un backup automatique
    if let Err(e) =
        backup::create_auto_backup(pool, &schema, &table, "Suppression de colonne").await
    {
        eprintln!("Erreur lors de la création du backup: {}", e);
    }

    match request.mode {
        DeleteMode::Soft => {
            // Mode soft: marquer comme invisible dans les métadonnées
            // Pour l'instant, on ne fait rien (à implémenter avec une table de métadonnées UI)
            Ok(StatusCode::OK)
        }
        DeleteMode::Hard => {
            // Vérifier le token de confirmation
            if request.confirm_token.as_deref() != Some(&column) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(DbManagerError::new(
                        "CONFIRMATION_REQUIRED",
                        "Le token de confirmation ne correspond pas au nom de la colonne",
                    )),
                ));
            }

            let schema_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
                .bind(&schema)
                .fetch_one(pool)
                .await
            {
                Ok(s) => s,
                Err(e) => {
                    return Err((
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
                    ))
                }
            };

            let table_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
                .bind(&table)
                .fetch_one(pool)
                .await
            {
                Ok(s) => s,
                Err(e) => {
                    return Err((
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
                    ))
                }
            };

            let column_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
                .bind(&column)
                .fetch_one(pool)
                .await
            {
                Ok(s) => s,
                Err(e) => {
                    return Err((
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
                    ))
                }
            };

            let drop_query = format!(
                "ALTER TABLE {}.{} DROP COLUMN {}",
                schema_ident, table_ident, column_ident
            );

            match sqlx::query(&drop_query).execute(pool).await {
                Ok(_) => {
                    // Créer un audit log
                    let _ = audit::create_audit_entry(
                        pool,
                        &schema,
                        &table,
                        "DROP_COLUMN",
                        0,
                        Some(&drop_query),
                        None,
                        None,
                        Some(serde_json::json!({
                            "column_name": column
                        })),
                    )
                    .await;

                    Ok(StatusCode::OK)
                }
                Err(e) => Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(DbManagerError::new("DROP_COLUMN_ERROR", &e.to_string())),
                )),
            }
        }
    }
}

/// GET /db/table/:schema/:table/column/:column/impact - Analyse l'impact de la suppression
pub async fn analyze_column_impact_handler(
    State(state): State<AppState>,
    Path((schema, table, column)): Path<(String, String, String)>,
) -> Result<Json<ColumnImpactAnalysis>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    // Compter les lignes affectées
    let schema_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&schema)
        .fetch_one(pool)
        .await
    {
        Ok(s) => s,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
            ))
        }
    };

    let table_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&table)
        .fetch_one(pool)
        .await
    {
        Ok(s) => s,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
            ))
        }
    };

    let count_query = format!("SELECT COUNT(*) FROM {}.{}", schema_ident, table_ident);
    let affected_rows: i64 = sqlx::query_scalar(&count_query)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    // Rechercher les vues dépendantes
    let dependent_views: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT DISTINCT v.table_name
        FROM information_schema.view_column_usage v
        WHERE v.view_schema = $1 
        AND v.table_name = $2
        AND v.column_name = $3
        "#,
    )
    .bind(&schema)
    .bind(&table)
    .bind(&column)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Rechercher les vues matérialisées (approximatif)
    let dependent_materialized_views: Vec<String> = Vec::new(); // TODO: implémenter

    Ok(Json(ColumnImpactAnalysis {
        column_name: column,
        affected_rows,
        dependent_views,
        dependent_materialized_views,
        dependent_functions: Vec::new(),
        dependent_triggers: Vec::new(),
    }))
}

// ============================================================================
// Audit Routes
// ============================================================================

/// GET /db/table/:schema/:table/audit - Récupère l'historique d'audit
pub async fn get_audit_log_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
    Query(query): Query<AuditQuery>,
) -> Result<Json<Vec<AuditLog>>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match audit::get_audit_log(pool, &schema, &table, query).await {
        Ok(logs) => Ok(Json(logs)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("AUDIT_ERROR", &e.to_string())),
        )),
    }
}

/// GET /db/table/:schema/:table/audit/stats - Récupère les statistiques d'audit
pub async fn get_audit_stats_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match audit::get_audit_stats(pool, &schema, &table).await {
        Ok(stats) => Ok(Json(stats)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("AUDIT_ERROR", &e.to_string())),
        )),
    }
}

// ============================================================================
// Backup Routes
// ============================================================================

/// POST /db/backup - Crée un backup
pub async fn create_backup_handler(
    State(state): State<AppState>,
    Json(request): Json<CreateBackupRequest>,
) -> Result<Json<BackupInfo>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match backup::create_backup(pool, request).await {
        Ok(info) => Ok(Json(info)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("BACKUP_ERROR", &e.to_string())),
        )),
    }
}

/// GET /db/backup - Liste les backups
pub async fn list_backups_handler(
    State(state): State<AppState>,
) -> Result<Json<Vec<BackupInfo>>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match backup::list_backups(pool).await {
        Ok(backups) => Ok(Json(backups)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("BACKUP_ERROR", &e.to_string())),
        )),
    }
}

/// POST /db/backup/:id/restore - Restaure un backup
pub async fn restore_backup_handler(
    State(state): State<AppState>,
    Path(backup_id): Path<String>,
) -> Result<Json<RestoreResult>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match backup::restore_backup(pool, &backup_id).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("RESTORE_ERROR", &e.to_string())),
        )),
    }
}

/// DELETE /db/backup/:id - Supprime un backup
pub async fn delete_backup_handler(
    State(state): State<AppState>,
    Path(backup_id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match backup::delete_backup(pool, &backup_id).await {
        Ok(_) => Ok(StatusCode::OK),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("BACKUP_ERROR", &e.to_string())),
        )),
    }
}

// ============================================================================
// Dry-run Routes
// ============================================================================

/// POST /db/table/:schema/:table/column/dryrun - Dry-run ajout colonne
pub async fn dryrun_add_column_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
    Json(request): Json<AddColumnRequest>,
) -> Result<Json<DryRunResult>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match dryrun::dryrun_add_column(pool, &schema, &table, &request).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("DRYRUN_ERROR", &e.to_string())),
        )),
    }
}

/// DELETE /db/table/:schema/:table/column/:column/dryrun - Dry-run suppression colonne
pub async fn dryrun_delete_column_handler(
    State(state): State<AppState>,
    Path((schema, table, column)): Path<(String, String, String)>,
) -> Result<Json<DryRunResult>, (StatusCode, Json<DbManagerError>)> {
    let pool = require_admin_pool(&state)?;
    match dryrun::dryrun_delete_column(pool, &schema, &table, &column).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("DRYRUN_ERROR", &e.to_string())),
        )),
    }
}

// ============================================================================
// Geocoding Status Routes
// ============================================================================

/// GET /geocode/status/:schema/:table - Statut de géocodage pour une table
pub async fn geocode_status_handler(
    State(state): State<AppState>,
    Path((schema, table)): Path<(String, String)>,
) -> Result<Json<Vec<GeocodeStatus>>, (StatusCode, Json<DbManagerError>)> {
    let query = format!(
        "SELECT 
            id::text,
            code,
            is_geocoded,
            location_mode,
            location_accuracy,
            (geom IS NOT NULL) as has_geometry,
            adm3_id
        FROM {}.{}
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 100",
        schema, table
    );

    match sqlx::query_as::<
        _,
        (
            String,
            Option<String>,
            bool,
            Option<String>,
            Option<String>,
            bool,
            Option<i32>,
        ),
    >(&query)
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => {
            let statuses: Vec<GeocodeStatus> = rows
                .into_iter()
                .map(
                    |(
                        id,
                        code,
                        is_geocoded,
                        location_mode,
                        location_accuracy,
                        has_geometry,
                        adm3_id,
                    )| {
                        GeocodeStatus {
                            id,
                            code,
                            is_geocoded,
                            location_mode,
                            location_accuracy,
                            has_geometry,
                            adm3_id,
                        }
                    },
                )
                .collect();
            Ok(Json(statuses))
        }
        Err(e) => {
            tracing::error!("Geocode status error for {}.{}: {}", schema, table, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DbManagerError::new("GEOCODE_STATUS_ERROR", &e.to_string())),
            ))
        }
    }
}
