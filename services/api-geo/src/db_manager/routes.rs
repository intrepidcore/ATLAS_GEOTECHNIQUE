// Routes API pour le gestionnaire de base de données
use super::*;
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::collections::HashMap;

// ============================================================================
// Schema & Table Info Routes
// ============================================================================

/// GET /db/schema - Récupère la structure complète de la base
pub async fn get_schema_handler(
    State(state): State<AppState>,
) -> Result<Json<DatabaseSchema>, (StatusCode, Json<DbManagerError>)> {
    match schema::get_database_schema(&state.pool).await {
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
    match schema::get_table_info(&state.pool, &schema, &table).await {
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
    match table::get_table_data(&state.pool, &schema, &table, query).await {
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
    match table::select_rows(&state.pool, &schema, &table, request).await {
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
    // Créer un backup automatique
    if let Err(e) = backup::create_auto_backup(&state.pool, &schema, &table, "Ajout de ligne").await {
        eprintln!("Erreur lors de la création du backup: {}", e);
    }
    
    match table::add_empty_row(&state.pool, &schema, &table).await {
        Ok(id) => {
            // Créer un audit log
            let _ = audit::create_audit_entry(
                &state.pool,
                &schema,
                &table,
                "INSERT_ROW",
                1,
                None,
                None,
                None,
                None,
            ).await;
            
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
    match table::update_cell(&state.pool, &schema, &table, &row_id, &column, value).await {
        Ok(_) => {
            // Créer un audit log
            let _ = audit::create_audit_entry(
                &state.pool,
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
            ).await;
            
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
    if row_ids.len() > 5 {
        // Créer un backup automatique pour les suppressions massives
        if let Err(e) = backup::create_auto_backup(&state.pool, &schema, &table, "Suppression massive").await {
            eprintln!("Erreur lors de la création du backup: {}", e);
        }
    }
    
    match table::delete_rows(&state.pool, &schema, &table, &row_ids).await {
        Ok(count) => {
            // Créer un audit log
            let _ = audit::create_audit_entry(
                &state.pool,
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
            ).await;
            
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
    // Créer un backup automatique
    if let Err(e) = backup::create_auto_backup(&state.pool, &schema, &table, "Création staging").await {
        eprintln!("Erreur lors de la création du backup: {}", e);
    }
    
    match staging::create_staging(&state.pool, &schema, &table, request).await {
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
    match staging::apply_staging_operation(&state.pool, &staging_id, operation).await {
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
    match staging::validate_staging(&state.pool, &staging_id).await {
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
    let limit = params.get("limit")
        .and_then(|s| s.parse::<i64>().ok());
    
    match staging::preview_staging(&state.pool, &staging_id, limit).await {
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
    match staging::commit_staging(&state.pool, &staging_id).await {
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
    match staging::cancel_staging(&state.pool, &staging_id).await {
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
    // Créer un backup automatique
    if let Err(e) = backup::create_auto_backup(&state.pool, &schema, &table, "Ajout de colonne").await {
        eprintln!("Erreur lors de la création du backup: {}", e);
    }
    
    // Construire la requête ALTER TABLE
    let schema_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&schema)
        .fetch_one(&state.pool)
        .await
    {
        Ok(s) => s,
        Err(e) => return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
        )),
    };
    
    let table_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&table)
        .fetch_one(&state.pool)
        .await
    {
        Ok(s) => s,
        Err(e) => return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
        )),
    };
    
    let column_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&request.name)
        .fetch_one(&state.pool)
        .await
    {
        Ok(s) => s,
        Err(e) => return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
        )),
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
    
    match sqlx::query(&alter_query).execute(&state.pool).await {
        Ok(_) => {
            // Créer un audit log
            let _ = audit::create_audit_entry(
                &state.pool,
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
            ).await;
            
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
    // Créer un backup automatique
    if let Err(e) = backup::create_auto_backup(&state.pool, &schema, &table, "Suppression de colonne").await {
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
                .fetch_one(&state.pool)
                .await
            {
                Ok(s) => s,
                Err(e) => return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
                )),
            };
            
            let table_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
                .bind(&table)
                .fetch_one(&state.pool)
                .await
            {
                Ok(s) => s,
                Err(e) => return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
                )),
            };
            
            let column_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
                .bind(&column)
                .fetch_one(&state.pool)
                .await
            {
                Ok(s) => s,
                Err(e) => return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
                )),
            };
            
            let drop_query = format!(
                "ALTER TABLE {}.{} DROP COLUMN {}",
                schema_ident, table_ident, column_ident
            );
            
            match sqlx::query(&drop_query).execute(&state.pool).await {
                Ok(_) => {
                    // Créer un audit log
                    let _ = audit::create_audit_entry(
                        &state.pool,
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
                    ).await;
                    
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
    // Compter les lignes affectées
    let schema_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&schema)
        .fetch_one(&state.pool)
        .await
    {
        Ok(s) => s,
        Err(e) => return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
        )),
    };
    
    let table_ident = match sqlx::query_scalar::<_, String>("SELECT quote_ident($1)")
        .bind(&table)
        .fetch_one(&state.pool)
        .await
    {
        Ok(s) => s,
        Err(e) => return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("DATABASE_ERROR", &e.to_string())),
        )),
    };
    
    let count_query = format!("SELECT COUNT(*) FROM {}.{}", schema_ident, table_ident);
    let affected_rows: i64 = sqlx::query_scalar(&count_query)
        .fetch_one(&state.pool)
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
        "#
    )
    .bind(&schema)
    .bind(&table)
    .bind(&column)
    .fetch_all(&state.pool)
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
    match audit::get_audit_log(&state.pool, &schema, &table, query).await {
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
    match audit::get_audit_stats(&state.pool, &schema, &table).await {
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
    match backup::create_backup(&state.pool, request).await {
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
    match backup::list_backups(&state.pool).await {
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
    match backup::restore_backup(&state.pool, &backup_id).await {
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
    match backup::delete_backup(&state.pool, &backup_id).await {
        Ok(_) => Ok(StatusCode::OK),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(DbManagerError::new("BACKUP_ERROR", &e.to_string())),
        )),
    }
}
