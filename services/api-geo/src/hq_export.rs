/// hq_export.rs — Sprint 1 Roadmap Moteur Export Serveur Headless
///
/// Endpoints :
///   POST   /export/hq               -> creer un job d'export HQ
///   GET    /export/hq/status/:id    -> statut + progression
///   GET    /export/hq/download/:id  -> telechargement du fichier PNG/PDF
///   GET    /export/hq/list          -> historique jobs (requester)
///   DELETE /export/hq/:id           -> annuler/supprimer un job
///
/// Table : atlas.hq_export_jobs (migration 180)
use crate::state::AppState;
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

// ── Structures de requete/reponse ─────────────────────────────────────────────

/// Corps de la requete POST /export/hq
#[derive(Debug, Deserialize)]
pub struct HqExportRequest {
    /// Identifiant du parametre thematique (ex: "vbs_ked_h1", "cbr_95_ked_h1")
    pub thematic_id: String,

    /// Niveau admin de la zone (adm0|adm1|adm2|adm3)
    #[serde(default = "default_adm_level")]
    pub adm_level: String,

    /// Nom de la zone administrative (ex: "Centrale", "Zio", "Togo")
    pub adm_name: Option<String>,

    /// Options de sortie
    #[serde(default)]
    pub output: HqOutputOptions,

    /// Options de style cartographique
    #[serde(default)]
    pub style: HqStyleOptions,

    /// Bbox optionnelle (si non fournie, derive de adm_level+adm_name)
    pub bbox: Option<HqBbox>,

    /// Moteur : "puppeteer" (phase 1) ou "maplibre" (phase 2)
    #[serde(default = "default_engine")]
    pub engine: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct HqOutputOptions {
    #[serde(default = "default_format")]
    pub format: String,      // "png" | "pdf"
    #[serde(default = "default_dpi")]
    pub dpi: u32,
    #[serde(default = "default_width")]
    pub width_px: u32,
    #[serde(default = "default_height")]
    pub height_px: u32,
}

#[derive(Debug, Deserialize, Serialize, Default)]
pub struct HqStyleOptions {
    pub palette: Option<String>,
    pub classification: Option<String>,
    pub n_classes: Option<u32>,
    pub show_empty_cells: Option<bool>,
    pub frame_style: Option<String>,
    pub mask_mode: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct HqBbox {
    pub north: f64,
    pub south: f64,
    pub east: f64,
    pub west: f64,
}

// Defaults
fn default_adm_level() -> String { "adm1".into() }
fn default_engine()    -> String { "puppeteer".into() }
fn default_format()    -> String { "png".into() }
fn default_dpi()       -> u32    { 150 }
fn default_width()     -> u32    { 2480 }
fn default_height()    -> u32    { 3508 }

impl Default for HqOutputOptions {
    fn default() -> Self {
        Self {
            format: default_format(),
            dpi: default_dpi(),
            width_px: default_width(),
            height_px: default_height(),
        }
    }
}

/// Reponse a POST /export/hq
#[derive(Debug, Serialize)]
pub struct HqExportCreated {
    pub job_id: Uuid,
    pub status: String,
    pub engine: String,
    pub message: String,
}

/// Reponse a GET /export/hq/status/:id
#[derive(Debug, Serialize)]
pub struct HqExportStatus {
    pub job_id: Uuid,
    pub status: String,
    pub progress: i32,
    pub engine: String,
    pub duration_ms: Option<i32>,
    pub error_message: Option<String>,
    pub result_path: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
}

/// Parametres de listing
#[derive(Debug, Deserialize)]
pub struct HqListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub status: Option<String>,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// POST /export/hq
/// Cree un nouveau job d'export haute qualite.
pub async fn create_hq_export(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<HqExportRequest>,
) -> impl IntoResponse {
    let pool = &state.pool;

    // Validation engine
    if req.engine != "puppeteer" && req.engine != "maplibre" {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "invalid_engine",
                "expected": ["puppeteer", "maplibre"]
            })),
        )
        .into_response();
    }

    // Validation thematic_id (format basique)
    if req.thematic_id.is_empty() || req.thematic_id.len() > 100 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_thematic_id"})),
        )
        .into_response();
    }

    // Construire le payload JSON versionne
    let payload = serde_json::json!({
        "payload_version": "1.0",
        "thematic_id": req.thematic_id,
        "adm_level": req.adm_level,
        "adm_name": req.adm_name,
        "output": req.output,
        "style": req.style,
        "bbox": req.bbox,
    });

    // Extraire le sujet depuis les headers (Authorization: Bearer <token> -> subject)
    let requested_by = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|t| t.chars().take(64).collect::<String>()) // hash ou truncate
        .unwrap_or_else(|| "anonymous".to_string());

    let row = sqlx::query(
        r#"
        INSERT INTO atlas.hq_export_jobs
          (payload, engine, requested_by, status, progress)
        VALUES
          ($1::jsonb, $2, $3, 'PENDING', 0)
        RETURNING id, status, engine
        "#,
    )
    .bind(&payload)
    .bind(&req.engine)
    .bind(&requested_by)
    .fetch_one(pool)
    .await;

    match row {
        Ok(r) => {
            let job_id: Uuid = r.try_get("id").unwrap_or_else(|_| Uuid::nil());
            let status: String = r.try_get("status").unwrap_or_else(|_| "PENDING".into());
            let engine: String = r.try_get("engine").unwrap_or_else(|_| req.engine.clone());

            tracing::info!(
                job_id = %job_id,
                thematic_id = %req.thematic_id,
                engine = %engine,
                "HQ export job created"
            );

            (
                StatusCode::CREATED,
                Json(HqExportCreated {
                    job_id,
                    status,
                    engine,
                    message: "Job created. Poll /export/hq/status/:id for progress.".into(),
                }),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(?e, "create_hq_export db error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "db_error", "detail": e.to_string()})),
            )
                .into_response()
        }
    }
}

/// GET /export/hq/status/:job_id
pub async fn get_hq_export_status(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let row = sqlx::query(
        r#"
        SELECT id, status, progress, engine, duration_ms, error_message,
               result_path, created_at, updated_at, started_at, finished_at
        FROM atlas.hq_export_jobs
        WHERE id = $1
        "#,
    )
    .bind(job_id)
    .fetch_optional(pool)
    .await;

    match row {
        Ok(Some(r)) => {
            let resp = HqExportStatus {
                job_id:        r.try_get("id").unwrap_or(job_id),
                status:        r.try_get("status").unwrap_or_default(),
                progress:      r.try_get("progress").unwrap_or(0),
                engine:        r.try_get("engine").unwrap_or_default(),
                duration_ms:   r.try_get("duration_ms").ok(),
                error_message: r.try_get("error_message").ok().flatten(),
                result_path:   r.try_get("result_path").ok().flatten(),
                created_at:    r.try_get("created_at").unwrap_or_else(|_| Utc::now()),
                updated_at:    r.try_get("updated_at").unwrap_or_else(|_| Utc::now()),
                started_at:    r.try_get("started_at").ok().flatten(),
                finished_at:   r.try_get("finished_at").ok().flatten(),
            };
            (StatusCode::OK, Json(resp)).into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "job_not_found", "job_id": job_id})),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(?e, %job_id, "get_hq_export_status db error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "db_error"})),
            )
                .into_response()
        }
    }
}

/// GET /export/hq/download/:job_id
/// Stream le fichier PNG/PDF si le job est COMPLETED.
pub async fn download_hq_export(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> impl IntoResponse {
    let pool = &state.pool;

    // Verifier que le job est COMPLETED et recuperer le chemin
    let row = sqlx::query(
        "SELECT status, result_path, result_mime FROM atlas.hq_export_jobs WHERE id = $1",
    )
    .bind(job_id)
    .fetch_optional(pool)
    .await;

    let (status, path_opt, mime) = match row {
        Ok(Some(r)) => (
            r.try_get::<String, _>("status").unwrap_or_default(),
            r.try_get::<Option<String>, _>("result_path").ok().flatten(),
            r.try_get::<Option<String>, _>("result_mime")
                .ok()
                .flatten()
                .unwrap_or_else(|| "image/png".to_string()),
        ),
        Ok(None) => return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "job_not_found"})),
        ).into_response(),
        Err(e) => {
            tracing::error!(?e, "download_hq_export db error");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "db_error"})),
            ).into_response();
        }
    };

    if status != "COMPLETED" {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "error": "job_not_completed",
                "status": status,
                "hint": "Poll /export/hq/status/:id until status=COMPLETED"
            })),
        ).into_response();
    }

    let result_path = match path_opt {
        Some(p) => p,
        None => return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "result_path_missing"})),
        ).into_response(),
    };

    // Lire le fichier entier en memoire (images PNG/PDF < 5 MB en general)
    let bytes = match tokio::fs::read(&result_path).await {
        Ok(b) => b,
        Err(e) => {
            tracing::error!(?e, path=%result_path, "download_hq_export file read failed");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "file_not_found", "path": result_path})),
            ).into_response();
        }
    };

    let filename = format!("atlas_export_{}.{}", job_id,
        if mime.contains("pdf") { "pdf" } else { "png" });

    axum::response::Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", filename),
        )
        .body(Body::from(bytes))
        .unwrap_or_else(|_| {
            axum::response::Response::new(Body::empty())
        })
}

/// GET /export/hq/list
/// Liste les jobs recents de l'utilisateur courant.
pub async fn list_hq_exports(
    State(state): State<AppState>,
    Query(q): Query<HqListQuery>,
) -> impl IntoResponse {
    let pool = &state.pool;
    let limit  = q.limit.unwrap_or(20).min(100);
    let offset = q.offset.unwrap_or(0);

    let rows = sqlx::query(
        r#"
        SELECT id, status, progress, engine, duration_ms,
               (payload->>'thematic_id') AS thematic_id,
               created_at, updated_at, finished_at
        FROM atlas.hq_export_jobs
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await;

    match rows {
        Ok(rs) => {
            let jobs: Vec<serde_json::Value> = rs.iter().map(|r| {
                serde_json::json!({
                    "job_id":       r.try_get::<Uuid, _>("id").ok(),
                    "status":       r.try_get::<String, _>("status").ok(),
                    "progress":     r.try_get::<i32, _>("progress").ok(),
                    "engine":       r.try_get::<String, _>("engine").ok(),
                    "duration_ms":  r.try_get::<Option<i32>, _>("duration_ms").ok().flatten(),
                    "thematic_id":  r.try_get::<Option<String>, _>("thematic_id").ok().flatten(),
                    "created_at":   r.try_get::<DateTime<Utc>, _>("created_at").ok(),
                    "updated_at":   r.try_get::<DateTime<Utc>, _>("updated_at").ok(),
                    "finished_at":  r.try_get::<Option<DateTime<Utc>>, _>("finished_at").ok().flatten(),
                })
            }).collect();
            (StatusCode::OK, Json(serde_json::json!({"jobs": jobs, "total": jobs.len()}))).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "list_hq_exports db error");
            (StatusCode::INTERNAL_SERVER_ERROR,
             Json(serde_json::json!({"error": "db_error"}))).into_response()
        }
    }
}

/// DELETE /export/hq/:job_id
/// Annule un job PENDING ou PROCESSING, supprime un job COMPLETED.
pub async fn cancel_hq_export(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let row = sqlx::query(
        r#"
        UPDATE atlas.hq_export_jobs
        SET status = CASE
              WHEN status IN ('PENDING','PROCESSING') THEN 'CANCELLED'
              ELSE status
            END,
            updated_at = now()
        WHERE id = $1
        RETURNING id, status
        "#,
    )
    .bind(job_id)
    .fetch_optional(pool)
    .await;

    match row {
        Ok(Some(r)) => {
            let status: String = r.try_get("status").unwrap_or_default();
            (StatusCode::OK, Json(serde_json::json!({
                "job_id": job_id,
                "status": status,
            }))).into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "job_not_found"})),
        ).into_response(),
        Err(e) => {
            tracing::error!(?e, "cancel_hq_export db error");
            (StatusCode::INTERNAL_SERVER_ERROR,
             Json(serde_json::json!({"error": "db_error"}))).into_response()
        }
    }
}
