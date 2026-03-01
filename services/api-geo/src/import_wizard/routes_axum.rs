// Import Wizard v2.3.0 - Routes Axum

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;
use super::types::*;
use super::batch;

// ============================================================================
// Handlers
// ============================================================================

pub async fn create_import(
    State(state): State<AppState>,
    Json(req): Json<CreateImportRequest>,
) -> Result<Json<CreateImportResponse>, StatusCode> {
    let batch_id = batch::generate_batch_id();
    let id = Uuid::new_v4();

    let result = sqlx::query(
        r#"
        INSERT INTO imports (id, batch_id, filename, sha256, status, params, stats)
        VALUES ($1, $2, $3, $4, 'pending', '{}', '{}')
        RETURNING id, batch_id
        "#,
    )
    .bind(id)
    .bind(&batch_id)
    .bind(&req.filename)
    .bind(&req.sha256)
    .fetch_one(&state.pool)
    .await;
    
    match result {
        Ok(row) => {
            let id: Uuid = row.try_get("id").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            let batch_id: String = row
                .try_get("batch_id")
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(Json(CreateImportResponse {
                id,
                batch_id,
                status: ImportStatus::Pending,
                upload_url: format!("/imports/{}/upload", id),
            }))
        }
        Err(e) => {
            eprintln!("[IMPORT] Erreur création: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_presets() -> Json<Vec<MappingPreset>> {
    Json(get_all_presets())
}

pub async fn preview_import(
    State(_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<PreviewRequest>,
) -> Result<Json<PreviewResponse>, StatusCode> {
    // Pour l'instant, retourner un preview vide
    Ok(Json(PreviewResponse {
        stats: PreviewStats {
            total_rows: 0,
            to_create: 0,
            to_update: 0,
            to_skip: 0,
            errors: 0,
            warnings: 0,
        },
        sample_rows: vec![],
        errors: vec![],
        warnings: vec![],
    }))
}

pub async fn commit_import(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<CommitRequest>,
) -> Result<Json<CommitResponse>, StatusCode> {

    let batch_id: String = sqlx::query_scalar(
        r#"SELECT batch_id FROM imports WHERE id = $1"#,
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;
    
    sqlx::query(r#"UPDATE imports SET status = 'running', updated_at = now() WHERE id = $1"#)
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(CommitResponse {
        batch_id,
        status: ImportStatus::Running,
    }))
}

pub async fn undo_import(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<UndoResponse>, StatusCode> {

    let batch_id: String = sqlx::query_scalar(r#"SELECT batch_id FROM imports WHERE id = $1"#)
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    
    let sondages_deleted = sqlx::query(
        r#"
        UPDATE sondages 
        SET deleted_at = now(), deleted_by_batch = $1
        WHERE created_by_batch = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(&batch_id)
    .execute(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .rows_affected() as usize;
    
    let essais_deleted = sqlx::query(
        r#"
        UPDATE essais_geotechniques
        SET deleted_at = now(), deleted_by_batch = $1
        WHERE created_by_batch = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(&batch_id)
    .execute(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .rows_affected() as usize;
    
    sqlx::query(r#"UPDATE imports SET status = 'undone', updated_at = now() WHERE id = $1"#)
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(UndoResponse {
        undone: UndoStats {
            sondages: sondages_deleted,
            essais: essais_deleted,
            grids_recalculated: 0,
        },
        status: "undone".to_string(),
    }))
}

pub async fn get_import_log(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<String, StatusCode> {
    let errors = sqlx::query_as::<_, ImportError>(
        r#"SELECT * FROM import_errors WHERE import_id = $1 ORDER BY row_no"#,
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let mut csv = String::from("Ligne,Colonne,Code,Message,Sévérité,Valeur,Solution\n");
    
    for error in errors {
        csv.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            error.row_no,
            error.column_name.unwrap_or_default(),
            error.error_code,
            error.message,
            error.severity,
            error.value.unwrap_or_default(),
            error.hint.unwrap_or_default()
        ));
    }
    
    Ok(csv)
}

// ============================================================================
// Router Configuration
// ============================================================================

pub fn configure() -> Router<AppState> {
    Router::new()
        .route("/imports", post(create_import))
        .route("/imports/presets", get(get_presets))
        .route("/imports/:id/preview", post(preview_import))
        .route("/imports/:id/commit", post(commit_import))
        .route("/imports/:id/undo", post(undo_import))
        .route("/imports/:id/log", get(get_import_log))
}
