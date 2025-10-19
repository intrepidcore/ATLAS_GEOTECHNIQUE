// ============================================================================
// Routes API pour l'import bulk
// ============================================================================

use super::types::*;
use super::parser::*;
use super::transformer::*;
use super::importer::*;
use super::job_queue::{JOB_QUEUE, ImportJob};
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State, Multipart},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use sqlx::Row;
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
    let mut request: Option<ImportRequest> = None;
    
    // Parser multipart
    while let Some(field) = multipart.next_field().await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))? 
    {
        let name = field.name().unwrap_or("").to_string();
        
        match name.as_str() {
            "file" => {
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
                    Err(_) => {
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
    
    let import_id = create_import_job(
        &state.pool,
        filename.clone(),
        file_bytes.len() as i32,
        content_hash,
        &request.mapping,
        &request.geolocation,
        file_blob,
    ).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Parser fichier
    let raw_rows = parse_file(&file_bytes, &request.format)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Erreur parsing: {}", e)))?;

    // Transformer données
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

    // Créer job et soumettre à la queue
    let job = ImportJob {
        import_id,
        rows: parsed_rows,
        mapping: request.mapping,
        geoloc_config: request.geolocation,
    };

    JOB_QUEUE.submit(job, std::sync::Arc::new(state.pool.clone())).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Retourner immédiatement avec job_id
    Ok(Json(ImportResponse {
        job_id: import_id,
        status: ImportStatus::Pending,
        message: format!("Import démarré en arrière-plan. Utilisez /status/{} pour suivre la progression.", import_id),
    }))
}

// ============================================================================
// STATUS
// ============================================================================

pub async fn get_status(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<ImportJob>, (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT 
            id::text as id_str, filename, size_bytes, content_hash,
            status, progress, stats_json, geoloc_mode,
            created_at, started_at, completed_at, error_message
        FROM imports
        WHERE id = $1
        "#
    )
    .bind(job_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Import not found".to_string()))?;
    
    let record = ImportRecord {
        id: Uuid::parse_str(&row.try_get::<String, _>("id_str").unwrap()).unwrap(),
        filename: row.try_get("filename").unwrap(),
        size_bytes: row.try_get("size_bytes").unwrap(),
        content_hash: row.try_get("content_hash").unwrap(),
        status: row.try_get("status").unwrap(),
        progress: row.try_get("progress").ok(),
        stats_json: row.try_get("stats_json").ok(),
        geoloc_mode: row.try_get("geoloc_mode").unwrap(),
        created_at: row.try_get("created_at").ok(),
        started_at: row.try_get("started_at").ok(),
        completed_at: row.try_get("completed_at").ok(),
        error_message: row.try_get("error_message").ok(),
    };
    
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
    
    let progress = record.progress
        .and_then(|p| p.to_string().parse::<f32>().ok())
        .unwrap_or(0.0);
    
    Ok(Json(ImportJob {
        id: record.id,
        filename: record.filename,
        size_bytes: record.size_bytes,
        content_hash: record.content_hash,
        status,
        progress,
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
    // Annuler dans le job queue
    JOB_QUEUE.cancel(&job_id).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Mettre à jour en DB
    let result = sqlx::query(
        r#"
        UPDATE imports
        SET status = 'cancelled', completed_at = now()
        WHERE id = $1 AND status IN ('pending', 'running')
        RETURNING id
        "#
    )
    .bind(job_id)
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
    
    let rows = sqlx::query(
        r#"
        SELECT 
            row_idx, status, error_msg, warning_msg,
            created_tests_count, raw_json
        FROM import_items
        WHERE import_id = $1
        ORDER BY row_idx
        "#
    )
    .bind(import_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    let items: Vec<ImportItemReport> = rows.into_iter().map(|r| ImportItemReport {
        row_idx: r.try_get("row_idx").unwrap(),
        status: r.try_get("status").unwrap(),
        error_msg: r.try_get("error_msg").ok(),
        warning_msg: r.try_get("warning_msg").ok(),
        created_tests_count: r.try_get("created_tests_count").ok(),
        raw_json: r.try_get("raw_json").ok(),
    }).collect();
    
    if format == "csv" {
        let mut csv = String::from("row,status,tests_created,warnings,errors\n");
        for item in items {
            csv.push_str(&format!(
                "{},{},{},{},{}\n",
                item.row_idx,
                item.status,
                item.created_tests_count.unwrap_or(0),
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
    
    let filename = format!("template_{}.csv", template_type);
    
    Ok((
        StatusCode::OK,
        [
            ("content-type", "text/csv".to_string()),
            ("content-disposition", format!("attachment; filename=\"{}\"", filename))
        ],
        csv.to_string()
    ))
}

// ============================================================================
// PROFILS MAPPING
// ============================================================================

pub async fn list_profiles(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<MappingProfile>>, (StatusCode, String)> {
    // Filtrer par user_id si fourni
    let user_id = params.get("user_id").and_then(|s| Uuid::parse_str(s).ok());

    let query = if let Some(uid) = user_id {
        sqlx::query(
            r#"
            SELECT
                id::text as id_str, user_id::text as user_id_str,
                name, description, mapping_json,
                created_at, updated_at, last_used_at, use_count
            FROM import_mapping_profiles
            WHERE user_id = $1
            ORDER BY last_used_at DESC NULLS LAST, created_at DESC
            "#
        )
        .bind(uid)
    } else {
        sqlx::query(
            r#"
            SELECT
                id::text as id_str, user_id::text as user_id_str,
                name, description, mapping_json,
                created_at, updated_at, last_used_at, use_count
            FROM import_mapping_profiles
            ORDER BY use_count DESC, created_at DESC
            LIMIT 100
            "#
        )
    };

    let rows = query
        .fetch_all(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let profiles: Vec<MappingProfile> = rows
        .iter()
        .filter_map(|row| {
            Some(MappingProfile {
                id: Uuid::parse_str(&row.try_get::<String, _>("id_str").ok()?).ok()?,
                user_id: row.try_get::<String, _>("user_id_str").ok()
                    .and_then(|s| Uuid::parse_str(&s).ok()),
                name: row.try_get("name").ok()?,
                description: row.try_get("description").ok(),
                mapping: serde_json::from_value(row.try_get("mapping_json").ok()?).ok()?,
                created_at: row.try_get("created_at").ok()?,
                updated_at: row.try_get("updated_at").ok(),
                last_used_at: row.try_get("last_used_at").ok(),
                use_count: row.try_get("use_count").ok()?,
            })
        })
        .collect();

    Ok(Json(profiles))
}

pub async fn create_profile(
    State(state): State<AppState>,
    Json(req): Json<CreateMappingProfileRequest>,
) -> Result<Json<MappingProfile>, (StatusCode, String)> {
    // Valider le mapping JSON
    let mapping_json = serde_json::to_value(&req.mapping)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Mapping invalide: {}", e)))?;

    let row = sqlx::query(
        r#"
        INSERT INTO import_mapping_profiles (
            user_id, name, description, mapping_json
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
            id::text as id_str,
            user_id::text as user_id_str,
            name, description, mapping_json,
            created_at, updated_at, last_used_at, use_count
        "#
    )
    .bind(req.user_id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&mapping_json)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(MappingProfile {
        id: Uuid::parse_str(&row.try_get::<String, _>("id_str").unwrap()).unwrap(),
        user_id: row.try_get::<String, _>("user_id_str").ok()
            .and_then(|s| Uuid::parse_str(&s).ok()),
        name: row.try_get("name").unwrap(),
        description: row.try_get("description").ok(),
        mapping: serde_json::from_value(row.try_get("mapping_json").unwrap()).unwrap(),
        created_at: row.try_get("created_at").unwrap(),
        updated_at: row.try_get("updated_at").ok(),
        last_used_at: row.try_get("last_used_at").ok(),
        use_count: row.try_get("use_count").unwrap(),
    }))
}

pub async fn get_profile(
    State(state): State<AppState>,
    Path(profile_id): Path<Uuid>,
) -> Result<Json<MappingProfile>, (StatusCode, String)> {
    let row = sqlx::query(
        r#"
        SELECT
            id::text as id_str, user_id::text as user_id_str,
            name, description, mapping_json,
            created_at, updated_at, last_used_at, use_count
        FROM import_mapping_profiles
        WHERE id = $1
        "#
    )
    .bind(profile_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Profile not found".to_string()))?;

    Ok(Json(MappingProfile {
        id: Uuid::parse_str(&row.try_get::<String, _>("id_str").unwrap()).unwrap(),
        user_id: row.try_get::<String, _>("user_id_str").ok()
            .and_then(|s| Uuid::parse_str(&s).ok()),
        name: row.try_get("name").unwrap(),
        description: row.try_get("description").ok(),
        mapping: serde_json::from_value(row.try_get("mapping_json").unwrap()).unwrap(),
        created_at: row.try_get("created_at").unwrap(),
        updated_at: row.try_get("updated_at").ok(),
        last_used_at: row.try_get("last_used_at").ok(),
        use_count: row.try_get("use_count").unwrap(),
    }))
}

pub async fn use_profile(
    State(state): State<AppState>,
    Path(profile_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Incrémenter use_count et mettre à jour last_used_at
    let result = sqlx::query(
        r#"
        UPDATE import_mapping_profiles
        SET use_count = use_count + 1,
            last_used_at = now()
        WHERE id = $1
        RETURNING id
        "#
    )
    .bind(profile_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match result {
        Some(_) => Ok(Json(serde_json::json!({
            "success": true,
            "message": "Profile usage tracked"
        }))),
        None => Err((StatusCode::NOT_FOUND, "Profile not found".to_string())),
    }
}
