// ============================================================================
// Routes API pour l'import bulk
// ============================================================================

use super::types::*;
use super::parser::*;
use super::transformer::*;
use super::validator::*;
use super::matcher::*;
use super::importer::*;
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State, Multipart},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use std::collections::HashMap;
use uuid::Uuid;
use sha2::{Sha256, Digest};

// ============================================================================
// CONFIGURATION ROUTES
// ============================================================================

pub fn configure() -> Router<AppState> {
    Router::new()
        .route("/surveys/bulk-import/dry-run", post(dry_run_import))
        .route("/surveys/bulk-import/async", post(import_async))
        .route("/surveys/bulk-import/status/:job_id", get(get_status))
        .route("/surveys/bulk-import/cancel/:job_id", post(cancel_import))
        .route("/surveys/bulk-import/report/:import_id", get(get_report))
        .route("/surveys/bulk-import/templates/:template_type", get(get_template))
        .route("/surveys/bulk-import/profiles", get(list_profiles))
        .route("/surveys/bulk-import/profiles", post(create_profile))
        .route("/surveys/bulk-import/profiles/:profile_id", get(get_profile))
        .route("/surveys/bulk-import/profiles/:profile_id/use", post(use_profile))
}

// ============================================================================
// DRY RUN
// ============================================================================

pub async fn dry_run_import(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<DryRunResult>, (StatusCode, String)> {
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;
    let mut request: Option<ImportRequest> = None;
    
    // Parser multipart
    while let Some(field) = multipart.next_field().await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))? 
    {
        let name = field.name().unwrap_or("").to_string();
        
        match name.as_str() {
            "file" => {
                filename = field.file_name().map(|s| s.to_string());
                file_bytes = Some(field.bytes().await
                    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
                    .to_vec());
            }
            "config" => {
                let data = field.bytes().await
                    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
                request = Some(serde_json::from_slice(&data)
                    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?);
            }
            _ => {}
        }
    }
    
    let file_bytes = file_bytes.ok_or((StatusCode::BAD_REQUEST, "Fichier manquant".to_string()))?;
    let request = request.ok_or((StatusCode::BAD_REQUEST, "Configuration manquante".to_string()))?;
    
    // Parser fichier
    let raw_rows = parse_file(&file_bytes, &request.format)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erreur parsing: {}", e)))?;
    
    // Transformer selon structure
    let mut parsed_rows = Vec::new();
    
    match request.mapping.structure {
        DataStructure::Long => {
            for (idx, row) in raw_rows.iter().enumerate() {
                match map_long_row(row, idx as i32, &request.mapping) {
                    Ok(parsed) => parsed_rows.push(parsed),
                    Err(e) => {
                        // Continuer même en cas d'erreur
                        continue;
                    }
                }
            }
        }
        DataStructure::Large => {
            if let Some(ref prof_cols) = request.mapping.profondeur_cols {
                let type_essai = request.mapping.type_essai.as_ref()
                    .ok_or((StatusCode::BAD_REQUEST, "Type essai requis pour format Large".to_string()))?;
                
                for row in &raw_rows {
                    match transform_large_to_long(row, prof_cols, type_essai, &request.mapping) {
                        Ok(mut rows) => parsed_rows.append(&mut rows),
                        Err(_) => continue,
                    }
                }
            }
        }
    }
    
    // Validation
    let validated = validate_rows(&state.pool, &parsed_rows, &request.geolocation.mode).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    // Statistiques
    let mut stats = ImportStats::default();
    stats.total_rows = validated.len() as i32;
    stats.valid_rows = validated.iter().filter(|v| v.validation_errors.is_empty()).count() as i32;
    stats.warnings = validated.iter().filter(|v| !v.validation_warnings.is_empty()).count() as i32;
    stats.errors = validated.iter().filter(|v| !v.validation_errors.is_empty()).count() as i32;
    
    // Preview (5 premières lignes)
    let preview: Vec<PreviewRow> = validated.iter().take(5).map(|v| {
        PreviewRow {
            row: v.parsed.row_idx,
            localite: v.parsed.localite.clone(),
            code: v.parsed.code.clone(),
            adm3_matched: None, // TODO
            match_score: v.adm3_match_score,
            match_confidence: None,
            tests_count: 1,
            status: if v.validation_errors.is_empty() {
                ItemStatus::Ok
            } else {
                ItemStatus::Error
            },
            warnings: v.validation_warnings.clone(),
            errors: v.validation_errors.clone(),
        }
    }).collect();
    
    // Messages validation
    let mut warnings = Vec::new();
    let mut errors = Vec::new();
    
    for v in &validated {
        for err in &v.validation_errors {
            errors.push(ValidationMessage {
                row: v.parsed.row_idx,
                field: None,
                message: err.clone(),
                severity: "error".to_string(),
            });
        }
        for warn in &v.validation_warnings {
            warnings.push(ValidationMessage {
                row: v.parsed.row_idx,
                field: None,
                message: warn.clone(),
                severity: "warning".to_string(),
            });
        }
    }
    
    Ok(Json(DryRunResult {
        valid: stats.errors == 0,
        stats,
        preview,
        warnings,
        errors,
        ambiguous_matches: vec![], // TODO
    }))
}

// ============================================================================
// IMPORT ASYNC
// ============================================================================

pub async fn import_async(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<ImportResponse>, (StatusCode, String)> {
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;
    let mut request: Option<ImportRequest> = None;
    
    while let Some(field) = multipart.next_field().await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))? 
    {
        let name = field.name().unwrap_or("").to_string();
        
        match name.as_str() {
            "file" => {
                filename = field.file_name().map(|s| s.to_string());
                file_bytes = Some(field.bytes().await
                    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
                    .to_vec());
            }
            "config" => {
                let data = field.bytes().await
                    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
                request = Some(serde_json::from_slice(&data)
                    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?);
            }
            _ => {}
        }
    }
    
    let file_bytes = file_bytes.ok_or((StatusCode::BAD_REQUEST, "Fichier manquant".to_string()))?;
    let filename = filename.ok_or((StatusCode::BAD_REQUEST, "Nom fichier manquant".to_string()))?;
    let request = request.ok_or((StatusCode::BAD_REQUEST, "Configuration manquante".to_string()))?;
    
    // Hash fichier
    let mut hasher = Sha256::new();
    hasher.update(&file_bytes);
    let content_hash = format!("{:x}", hasher.finalize());
    
    // Créer job
    let file_blob = if request.save_file.unwrap_or(false) {
        Some(file_bytes.clone())
    } else {
        None
    };
    
    let job_id = create_import_job(
        &state.pool,
        filename.clone(),
        file_bytes.len() as i32,
        content_hash,
        &request.mapping,
        &request.geolocation,
        file_blob,
    ).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    // TODO: Lancer job async (tokio::spawn)
    // Pour l'instant, traitement synchrone
    
    // Parser
    let raw_rows = parse_file(&file_bytes, &request.format)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erreur parsing: {}", e)))?;
    
    // Transformer
    let mut parsed_rows = Vec::new();
    match request.mapping.structure {
        DataStructure::Long => {
            for (idx, row) in raw_rows.iter().enumerate() {
                if let Ok(parsed) = map_long_row(row, idx as i32, &request.mapping) {
                    parsed_rows.push(parsed);
                }
            }
        }
        DataStructure::Large => {
            if let Some(ref prof_cols) = request.mapping.profondeur_cols {
                let type_essai = request.mapping.type_essai.as_ref()
                    .ok_or((StatusCode::BAD_REQUEST, "Type essai requis".to_string()))?;
                
                for row in &raw_rows {
                    if let Ok(mut rows) = transform_large_to_long(row, prof_cols, type_essai, &request.mapping) {
                        parsed_rows.append(&mut rows);
                    }
                }
            }
        }
    }
    
    // Process import
    update_import_status(&state.pool, job_id, ImportStatus::Running, 0.0, None, None).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    let stats = process_import(
        &state.pool,
        job_id,
        parsed_rows,
        &request.mapping,
        &request.geolocation,
    ).await
    .map_err(|e| {
        // Log erreur
        let _ = update_import_status(
            &state.pool,
            job_id,
            ImportStatus::Failed,
            0.0,
            None,
            Some(&e.to_string()),
        );
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;
    
    Ok(Json(ImportResponse {
        job_id,
        status: ImportStatus::Succeeded,
        message: format!("{} sondages, {} essais importés", stats.sondages, stats.essais),
    }))
}

// ============================================================================
// STATUS
// ============================================================================

pub async fn get_status(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<ImportJob>, (StatusCode, String)> {
    let record = sqlx::query_as!(
        ImportRecord,
        r#"
        SELECT 
            id, filename, size_bytes, content_hash,
            status, progress, stats_json, geoloc_mode,
            created_at, started_at, completed_at, error_message
        FROM imports
        WHERE id = $1
        "#,
        job_id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Import not found".to_string()))?;
    
    let stats: ImportStats = serde_json::from_value(record.stats_json.unwrap_or_default())
        .unwrap_or_default();
    
    let status = match record.status.as_str() {
        "pending" => ImportStatus::Pending,
        "running" => ImportStatus::Running,
        "succeeded" => ImportStatus::Succeeded,
        "failed" => ImportStatus::Failed,
        "partial" => ImportStatus::Partial,
        "cancelled" => ImportStatus::Cancelled,
        _ => ImportStatus::Pending,
    };
    
    let geoloc_mode = match record.geoloc_mode.as_str() {
        "exact" => GeolocationMode::Exact,
        "centroid" => GeolocationMode::Centroid,
        "random" => GeolocationMode::Random,
        "unknown" => GeolocationMode::Unknown,
        "maille" => GeolocationMode::Maille,
        _ => GeolocationMode::Unknown,
    };
    
    Ok(Json(ImportJob {
        id: record.id,
        filename: record.filename,
        size_bytes: record.size_bytes,
        content_hash: record.content_hash,
        status,
        progress: record.progress.unwrap_or(0.0) as f32,
        stats,
        geoloc_mode,
        created_at: record.created_at.unwrap(),
        started_at: record.started_at,
        completed_at: record.completed_at,
        error_message: record.error_message,
    }))
}

// ============================================================================
// CANCEL
// ============================================================================

pub async fn cancel_import(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let result = sqlx::query!(
        r#"
        UPDATE imports
        SET status = 'cancelled', completed_at = now()
        WHERE id = $1 AND status IN ('pending', 'running')
        RETURNING id
        "#,
        job_id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    match result {
        Some(_) => Ok(Json(serde_json::json!({
            "success": true,
            "message": "Import cancelled"
        }))),
        None => Err((StatusCode::NOT_FOUND, "Import not found or already completed".to_string())),
    }
}

// ============================================================================
// REPORT
// ============================================================================

pub async fn get_report(
    State(state): State<AppState>,
    Path(import_id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let format = params.get("format").map(|s| s.as_str()).unwrap_or("json");
    
    let items = sqlx::query_as!(
        ImportItemReport,
        r#"
        SELECT 
            row_idx, status, error_msg, warning_msg,
            created_tests_count, raw_json
        FROM import_items
        WHERE import_id = $1
        ORDER BY row_idx
        "#,
        import_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    if format == "csv" {
        let mut csv = String::from("row,status,tests_created,warnings,errors\n");
        for item in items {
            csv.push_str(&format!(
                "{},{},{},{},{}\n",
                item.row_idx,
                item.status,
                item.created_tests_count,
                item.warning_msg.unwrap_or_default(),
                item.error_msg.unwrap_or_default()
            ));
        }
        Ok((StatusCode::OK, [("content-type", "text/csv")], csv))
    } else {
        Ok((StatusCode::OK, [("content-type", "application/json")], serde_json::to_string(&items).unwrap()))
    }
}

// ============================================================================
// TEMPLATES
// ============================================================================

pub async fn get_template(
    Path(template_type): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let csv = match template_type.as_str() {
        "granulometrie" => {
            "localite,type_essai,profondeur_m,valeur,unite,date,source,operator,adm3\n\
             Adjengré,Granulometrie,1.0,77.73,%,2024-01-15,Lab LNBTP,LNBTP,Sotouboua\n\
             Adjengré,Granulometrie,1.5,81.8,%,2024-01-15,Lab LNBTP,LNBTP,Sotouboua\n"
        }
        "vbs" => {
            "localite,type_essai,profondeur_m,valeur,unite,analyse_qualitative,date,adm3\n\
             Akéi,BleuMethylene_VBS,1.0,1.75,g/100g,Faible,2024-02-10,Bassar\n"
        }
        "atterberg" => {
            "localite,type_essai,profondeur_m,valeur,unite,analyse_qualitative,date,adm3\n\
             Adjengré,Atterberg_WL,1.0,50.34,%,Elevé,2024-03-01,Sotouboua\n\
             Adjengré,Atterberg_WP,1.0,22.64,%,,2024-03-01,Sotouboua\n"
        }
        _ => return Err((StatusCode::NOT_FOUND, "Template not found".to_string())),
    };
    
    Ok((
        StatusCode::OK,
        [
            ("content-type", "text/csv"),
            ("content-disposition", &format!("attachment; filename=\"template_{}.csv\"", template_type))
        ],
        csv
    ))
}

// ============================================================================
// PROFILS (TODO Phase 2)
// ============================================================================

pub async fn list_profiles(
    State(_state): State<AppState>,
) -> Result<Json<Vec<MappingProfile>>, (StatusCode, String)> {
    Ok(Json(vec![]))
}

pub async fn create_profile(
    State(_state): State<AppState>,
    Json(_req): Json<CreateMappingProfileRequest>,
) -> Result<Json<MappingProfile>, (StatusCode, String)> {
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented yet".to_string()))
}

pub async fn get_profile(
    State(_state): State<AppState>,
    Path(_profile_id): Path<Uuid>,
) -> Result<Json<MappingProfile>, (StatusCode, String)> {
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented yet".to_string()))
}

pub async fn use_profile(
    State(_state): State<AppState>,
    Path(_profile_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented yet".to_string()))
}
