//! Routes API pour Atlas Colab

use axum::{
    extract::{Multipart, Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post, put, delete},
    Json, Router,
};
use chrono::Utc;
use serde_json::json;
use sqlx::{Postgres, Row, Transaction};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;
use validator::Validate;

use crate::state::AppState;
use crate::auth::middleware::AuthUser;
use crate::auth::password::PasswordHasher;

use super::types::*;

fn sanitize_username_base(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.chars() {
        if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
            out.push(c);
        } else {
            out.push('_');
        }
        if out.len() >= 50 {
            break;
        }
    }
    let out = out.trim_matches('_').to_string();
    if out.len() < 3 {
        "user".to_string()
    } else {
        out
    }
}

async fn ensure_unique_username(
    tx: &mut Transaction<'_, Postgres>,
    base: &str,
) -> Result<String, sqlx::Error> {
    let mut candidate = sanitize_username_base(base);
    loop {
        let exists: Option<(Uuid,)> = sqlx::query_as(r#"SELECT id FROM atlas.users WHERE username = $1"#)
            .bind(&candidate)
            .fetch_optional(&mut **tx)
            .await?;

        if exists.is_none() {
            return Ok(candidate);
        }

        let suffix = Uuid::new_v4().to_string();
        let suffix = suffix.split('-').next().unwrap_or("x");
        let mut trimmed = candidate;
        if trimmed.len() > 41 {
            trimmed.truncate(41);
        }
        candidate = format!("{}_{}", trimmed, suffix);
    }
}

/// Crée le routeur pour les routes Colab
pub fn colab_routes() -> Router<AppState> {
    Router::new()
        // Missions
        .route("/colab/missions", get(list_missions).post(create_mission))
        .route("/colab/missions/:id", get(get_mission).put(update_mission).delete(delete_mission))
        .route("/colab/missions/stats", get(get_stats))
        // Documents
        .route("/colab/documents", get(list_documents).post(upload_document))
        .route("/colab/documents/:id", delete(delete_document))
        .route("/colab/documents/:id/download", get(download_document))
        // Suggest (autocomplétion)
        .route("/colab/mailles/suggest", get(suggest_mailles))
        .route("/colab/communes/suggest", get(suggest_communes))
        .route("/colab/regions/suggest", get(suggest_regions))
        .route("/colab/students/suggest", get(suggest_students))
        .route("/colab/supervisors/suggest", get(suggest_supervisors))
        // Superviseurs
        .route("/colab/supervisors", get(list_supervisors).post(create_supervisor))
        .route(
            "/colab/supervisors/:id",
            get(get_supervisor).put(update_supervisor).delete(delete_supervisor),
        )
        // Étudiants
        .route("/colab/students", get(list_students).post(create_student))
        .route(
            "/colab/students/:id",
            get(get_student).put(update_student).delete(delete_student),
        )
        // Notifications email (orchestrées par script local)
        .route("/colab/notify/jobs", get(list_notify_jobs).post(create_notify_job))
        .route("/colab/notify/jobs/:id", get(get_notify_job))
        // Attributions & Notifications (mailles ↔ étudiants)
        .route("/colab/attributions/summary", get(get_attributions_summary))
        .route("/colab/attributions", get(list_attributions))
        .route("/colab/attributions/notify", post(enqueue_attributions_notifications))
        .route("/colab/attributions/notifications/history", get(list_attributions_notification_history))
}

// ============================================================================
// Handlers Attributions & Notifications
// ============================================================================

#[derive(Debug, Clone, serde::Deserialize)]
struct AttributionsQuery {
    student: Option<String>,
    notif_status: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Clone, serde::Deserialize)]
struct EnqueueAttributionsNotificationsRequest {
    assignment_ids: Vec<Uuid>,
    include_bbox: Option<bool>,
    include_instructions: Option<bool>,
}

async fn get_attributions_summary(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    // Source de vérité: missions + affectations de mission (pas uniquement colab_student_prefs)
    let total_missions: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM atlas.colab_missions WHERE deleted_at IS NULL AND maille_id IS NOT NULL",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let total_students: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM atlas.colab_students WHERE deleted_at IS NULL",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    // Couverture (missions réellement affectées à un étudiant via colab_mission_assignments)
    let missions_with_student: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT mission_id) FROM atlas.v_colab_mission_attributions WHERE student_uuid IS NOT NULL",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    // Attributions “sync” (lignes ayant un assignment_id, donc notifiables)
    let total_assignments: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM atlas.v_colab_mission_attributions WHERE assignment_id IS NOT NULL",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let pending_notifications: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM atlas.v_colab_mission_attributions
        WHERE assignment_id IS NOT NULL
          AND COALESCE(notification_status, 'never') = 'pending'
        "#,
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    Ok(Json(json!({
        "total_missions": total_missions,
        "total_students": total_students,
        "missions_with_student": missions_with_student,
        "total_assignments": total_assignments,
        "pending_notifications": pending_notifications
    })))
}

async fn list_attributions(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<AttributionsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let limit = query.limit.unwrap_or(200).max(1).min(1000);
    let mut conditions: Vec<String> = vec!["1=1".to_string()];

    if let Some(student) = query.student {
        let s = student.replace('\'', "''");
        conditions.push(format!(
            "(v.full_name ILIKE '%{0}%' OR v.email ILIKE '%{0}%' OR COALESCE(v.student_id,'') ILIKE '%{0}%' OR v.maille_code ILIKE '%{0}%' OR v.mission_code ILIKE '%{0}%')",
            s
        ));
    }
    if let Some(notif_status) = query.notif_status {
        let st = notif_status.replace('\'', "''");
        // Statut dérivé:
        // - unassigned: pas de assignment_id => non notifiable
        // - never: assignment_id présent mais jamais notifié
        conditions.push(format!(
            "(CASE WHEN v.assignment_id IS NULL THEN 'unassigned' ELSE COALESCE(v.notification_status, 'never') END) = '{}'",
            st
        ));
    }

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        r#"
        SELECT
            v.mission_id,
            v.mission_code,
            v.mission_title,
            v.mission_status,
            v.maille_id,
            v.maille_code,
            v.student_uuid,
            v.student_id,
            v.full_name,
            v.email,
            v.assignment_id,
            v.adm_code_used,
            v.pref_rank_used,
            v.assigned_at,
            CASE WHEN v.assignment_id IS NULL THEN 'unassigned' ELSE COALESCE(v.notification_status, 'never') END AS notification_status,
            v.notification_requested_at,
            v.notification_sent_at,
            v.notification_error
        FROM atlas.v_colab_mission_attributions v
        WHERE {}
        ORDER BY v.assigned_at DESC NULLS LAST
        LIMIT {}
        "#,
        where_clause,
        limit
    );

    let rows = sqlx::query(&sql)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "mission_id": r.get::<Uuid, _>("mission_id"),
                "mission_code": r.get::<String, _>("mission_code"),
                "mission_title": r.get::<String, _>("mission_title"),
                "mission_status": r.get::<String, _>("mission_status"),
                "maille_id": r.get::<Uuid, _>("maille_id"),
                "maille_code": r.get::<String, _>("maille_code"),
                "student_uuid": r.try_get::<Uuid, _>("student_uuid").ok(),
                "student_id": r.try_get::<String, _>("student_id").ok(),
                "full_name": r.try_get::<String, _>("full_name").ok(),
                "email": r.try_get::<String, _>("email").ok(),
                "assignment_id": r.try_get::<Uuid, _>("assignment_id").ok(),
                "adm_code_used": r.try_get::<String, _>("adm_code_used").ok(),
                "pref_rank_used": r.try_get::<i32, _>("pref_rank_used").ok(),
                "assigned_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("assigned_at").ok(),
                "notification_status": r.get::<String, _>("notification_status"),
                "notification_requested_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("notification_requested_at").ok(),
                "notification_sent_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("notification_sent_at").ok(),
                "notification_error": r.try_get::<String, _>("notification_error").ok(),
            })
        })
        .collect();

    Ok(Json(json!({ "items": items, "total": items.len() })))
}

async fn enqueue_attributions_notifications(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<EnqueueAttributionsNotificationsRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    if req.assignment_ids.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "assignment_ids requis" }))));
    }

    let params = json!({
        "assignment_ids": req.assignment_ids,
        "options": {
            "include_bbox": req.include_bbox.unwrap_or(true),
            "include_instructions": req.include_instructions.unwrap_or(true)
        }
    });

    let job_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_email_jobs (job_type, status, created_by, params)
        VALUES ('maille_bbox_gmail', 'pending', $1, $2)
        RETURNING id
        "#,
    )
    .bind(auth.id)
    .bind(&params)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur création job: {}", e) }))))?;

    // Logs par assignment
    for aid in &req.assignment_ids {
        let _ = sqlx::query(
            r#"
            INSERT INTO atlas.colab_maille_notification_logs (
                assignment_id, email_job_id, status, options, requested_by
            ) VALUES ($1, $2, 'pending', $3, $4)
            "#,
        )
        .bind(aid)
        .bind(job_id)
        .bind(json!({
            "include_bbox": req.include_bbox.unwrap_or(true),
            "include_instructions": req.include_instructions.unwrap_or(true)
        }))
        .bind(auth.id)
        .execute(&state.pool)
        .await;
    }

    // Job log
    let _ = sqlx::query(
        r#"
        INSERT INTO atlas.colab_email_job_logs (job_id, level, message, details)
        VALUES ($1, 'info', 'Attributions enqueued', $2)
        "#,
    )
    .bind(job_id)
    .bind(json!({ "assignment_count": req.assignment_ids.len(), "requested_by": auth.id }))
    .execute(&state.pool)
    .await;

    Ok(Json(json!({ "success": true, "job_id": job_id, "count": req.assignment_ids.len() })))
}

async fn list_attributions_notification_history(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let rows = sqlx::query(
        r#"
        SELECT
            l.id,
            l.assignment_id,
            l.email_job_id,
            l.status,
            l.options,
            l.requested_at,
            l.sent_at,
            l.error,
            d.student_id,
            d.full_name,
            d.email,
            d.maille_code
        FROM atlas.colab_maille_notification_logs l
        JOIN atlas.v_colab_maille_assignment_details d ON d.assignment_id = l.assignment_id
        ORDER BY l.requested_at DESC
        LIMIT 500
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<Uuid, _>("id"),
                "assignment_id": r.get::<Uuid, _>("assignment_id"),
                "email_job_id": r.try_get::<Uuid, _>("email_job_id").ok(),
                "status": r.get::<String, _>("status"),
                "options": r.get::<serde_json::Value, _>("options"),
                "requested_at": r.get::<chrono::DateTime<chrono::Utc>, _>("requested_at"),
                "sent_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("sent_at").ok(),
                "error": r.try_get::<String, _>("error").ok(),
                "student_id": r.get::<String, _>("student_id"),
                "full_name": r.get::<String, _>("full_name"),
                "email": r.try_get::<String, _>("email").ok(),
                "maille_code": r.get::<String, _>("maille_code"),
            })
        })
        .collect();

    Ok(Json(json!({ "items": items, "total": items.len() })))
}

// ============================================================================
// Handlers Notifier (Email Jobs)
// ============================================================================

#[derive(Debug, Clone, serde::Deserialize)]
struct NotifyJobsQuery {
    limit: Option<i64>,
}

#[derive(Debug, Clone, serde::Deserialize)]
struct CreateNotifyJobRequest {
    job_type: Option<String>,
    params: Option<serde_json::Value>,
}

async fn create_notify_job(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateNotifyJobRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let job_type = req.job_type.unwrap_or_else(|| "maille_bbox_gmail".to_string());
    let params = req.params.unwrap_or_else(|| json!({}));

    let job_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_email_jobs (job_type, status, created_by, params)
        VALUES ($1, 'pending', $2, $3)
        RETURNING id
        "#,
    )
    .bind(&job_type)
    .bind(auth.id)
    .bind(&params)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur création job: {}", e) })),
        )
    })?;

    sqlx::query(
        r#"
        INSERT INTO atlas.colab_email_job_logs (job_id, level, message, details)
        VALUES ($1, 'info', 'Job créé', $2)
        "#,
    )
    .bind(job_id)
    .bind(json!({ "job_type": job_type, "created_by": auth.id }))
    .execute(&state.pool)
    .await
    .ok();

    let row = sqlx::query(
        r#"
        SELECT
            id,
            job_type,
            status,
            created_by,
            created_at,
            started_at,
            finished_at,
            error,
            params
        FROM atlas.colab_email_jobs
        WHERE id = $1
        "#,
    )
    .bind(job_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur lecture job: {}", e) })),
        )
    })?;

    Ok(Json(json!({
        "job": {
            "id": row.get::<Uuid, _>("id"),
            "job_type": row.get::<String, _>("job_type"),
            "status": row.get::<String, _>("status"),
            "created_by": row.get::<Option<Uuid>, _>("created_by"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "started_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("started_at"),
            "finished_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("finished_at"),
            "error": row.get::<Option<String>, _>("error"),
            "params": row.get::<serde_json::Value, _>("params"),
        }
    })))
}

async fn list_notify_jobs(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<NotifyJobsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let limit = query.limit.unwrap_or(50).max(1).min(200);

    let rows = sqlx::query(
        r#"
        SELECT
            id,
            job_type,
            status,
            created_by,
            created_at,
            started_at,
            finished_at,
            error,
            params
        FROM atlas.colab_email_jobs
        ORDER BY created_at DESC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur listing jobs: {}", e) })),
        )
    })?;

    let jobs: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<Uuid, _>("id"),
                "job_type": row.get::<String, _>("job_type"),
                "status": row.get::<String, _>("status"),
                "created_by": row.get::<Option<Uuid>, _>("created_by"),
                "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                "started_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("started_at"),
                "finished_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("finished_at"),
                "error": row.get::<Option<String>, _>("error"),
                "params": row.get::<serde_json::Value, _>("params"),
            })
        })
        .collect();

    Ok(Json(json!({ "jobs": jobs, "total": jobs.len() })))
}

async fn get_notify_job(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(job_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let row = sqlx::query(
        r#"
        SELECT
            id,
            job_type,
            status,
            created_by,
            created_at,
            started_at,
            finished_at,
            error,
            params
        FROM atlas.colab_email_jobs
        WHERE id = $1
        "#,
    )
    .bind(job_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur lecture job: {}", e) })),
        )
    })?;

    let Some(row) = row else {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Job introuvable" }))));
    };

    let logs = sqlx::query(
        r#"
        SELECT level, message, details, created_at
        FROM atlas.colab_email_job_logs
        WHERE job_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(job_id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let logs: Vec<serde_json::Value> = logs
        .iter()
        .map(|r| {
            json!({
                "level": r.get::<String, _>("level"),
                "message": r.get::<String, _>("message"),
                "details": r.get::<serde_json::Value, _>("details"),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            })
        })
        .collect();

    Ok(Json(json!({
        "job": {
            "id": row.get::<Uuid, _>("id"),
            "job_type": row.get::<String, _>("job_type"),
            "status": row.get::<String, _>("status"),
            "created_by": row.get::<Option<Uuid>, _>("created_by"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "started_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("started_at"),
            "finished_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("finished_at"),
            "error": row.get::<Option<String>, _>("error"),
            "params": row.get::<serde_json::Value, _>("params"),
        },
        "logs": logs
    })))
}

// ============================================================================
// Handlers Documents
// ============================================================================

#[derive(Debug, Clone, serde::Deserialize)]
struct DocumentsQuery {
    mission_id: Option<Uuid>,
    sondage_id: Option<Uuid>,
    document_type: Option<String>,
}

/// GET /colab/documents?mission_id=...&document_type=...
async fn list_documents(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<DocumentsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let mut conditions = vec!["d.deleted_at IS NULL".to_string()];
    if let Some(mission_id) = params.mission_id {
        conditions.push(format!("d.mission_id = '{}'", mission_id));
    }
    if let Some(sondage_id) = params.sondage_id {
        conditions.push(format!("d.sondage_id = '{}'", sondage_id));
    }
    if let Some(document_type) = params.document_type {
        conditions.push(format!("d.document_type::TEXT = '{}'", document_type.replace('\'', "''")));
    }

    let where_clause = conditions.join(" AND ");

    let query = format!(
        r#"
        SELECT
            d.id,
            d.mission_id,
            d.uploaded_by,
            d.title,
            d.document_type::TEXT as document_type,
            d.description,
            d.file_path,
            d.file_name,
            d.file_size_bytes,
            d.mime_type,
            d.sondage_id,
            d.version,
            d.is_current,
            d.uploaded_at,
            d.notes
        FROM atlas.colab_documents d
        WHERE {}
        ORDER BY d.uploaded_at DESC
        "#,
        where_clause
    );

    let rows = sqlx::query(&query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    let documents: Vec<ColabDocument> = rows
        .iter()
        .map(|r| ColabDocument {
            id: r.get("id"),
            mission_id: r.get("mission_id"),
            uploaded_by: r.get("uploaded_by"),
            title: r.get("title"),
            document_type: r.get("document_type"),
            description: r.get("description"),
            file_path: r.get("file_path"),
            file_name: r.get("file_name"),
            file_size_bytes: r.get("file_size_bytes"),
            mime_type: r.get("mime_type"),
            sondage_id: r.get("sondage_id"),
            version: r.get("version"),
            is_current: r.get("is_current"),
            uploaded_at: r.get("uploaded_at"),
            notes: r.get("notes"),
        })
        .collect();

    Ok(Json(json!({ "documents": documents, "total": documents.len() })))
}

/// GET /colab/supervisors/:id - Détail d'un superviseur
async fn get_supervisor(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(supervisor_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.supervisors.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let row = sqlx::query(
        r#"
        SELECT
            s.id,
            s.user_id,
            u.username,
            u.email,
            COALESCE(u.first_name || ' ' || u.last_name, u.username) as full_name,
            u.telephone,
            u.is_active,
            s.specialite,
            s.institution,
            s.titre,
            s.departement,
            s.notes
        FROM atlas.colab_supervisors s
        JOIN atlas.users u ON s.user_id = u.id
        WHERE s.id = $1 AND s.deleted_at IS NULL AND u.deleted_at IS NULL
        "#,
    )
    .bind(supervisor_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur: {}", e) }))))?;

    let row = row.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "Superviseur non trouvé" }))))?;

    Ok(Json(json!({
        "id": row.get::<Uuid,_>("id"),
        "user_id": row.get::<Uuid,_>("user_id"),
        "username": row.get::<String,_>("username"),
        "email": row.get::<String,_>("email"),
        "full_name": row.get::<String,_>("full_name"),
        "telephone": row.get::<Option<String>,_>("telephone"),
        "is_active": row.get::<bool,_>("is_active"),
        "specialite": row.get::<Option<String>,_>("specialite"),
        "institution": row.get::<Option<String>,_>("institution"),
        "titre": row.get::<Option<String>,_>("titre"),
        "departement": row.get::<Option<String>,_>("departement"),
        "notes": row.get::<Option<String>,_>("notes"),
    })))
}

/// GET /colab/students/:id - Détail d'un étudiant
async fn get_student(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.students.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let row = sqlx::query(
        r#"
        SELECT
            s.id,
            s.user_id,
            u.username,
            u.email,
            COALESCE(u.first_name || ' ' || u.last_name, u.username) as full_name,
            u.telephone,
            u.is_active,
            s.matricule,
            s.promotion,
            s.filiere,
            s.etablissement,
            s.niveau,
            s.age,
            (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.student_id = s.id AND a.unassigned_at IS NULL) as active_missions
        FROM atlas.colab_students s
        JOIN atlas.users u ON s.user_id = u.id
        WHERE s.id = $1 AND s.deleted_at IS NULL AND u.deleted_at IS NULL
        "#,
    )
    .bind(student_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur: {}", e) }))))?;

    let row = row.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "Étudiant non trouvé" }))))?;

    Ok(Json(json!({
        "id": row.get::<Uuid,_>("id"),
        "user_id": row.get::<Uuid,_>("user_id"),
        "username": row.get::<String,_>("username"),
        "email": row.get::<String,_>("email"),
        "full_name": row.get::<String,_>("full_name"),
        "telephone": row.get::<Option<String>,_>("telephone"),
        "is_active": row.get::<bool,_>("is_active"),
        "matricule": row.get::<Option<String>,_>("matricule"),
        "promotion": row.get::<String,_>("promotion"),
        "filiere": row.get::<Option<String>,_>("filiere"),
        "etablissement": row.get::<Option<String>,_>("etablissement"),
        "niveau": row.get::<Option<String>,_>("niveau"),
        "age": row.get::<Option<i32>,_>("age"),
        "active_missions": row.get::<i64,_>("active_missions")
    })))
}

// ... (rest of the code remains the same)

/// GET /colab/missions - Liste des missions avec filtres
async fn list_missions(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(filters): Query<MissionFilters>,
) -> Result<Json<MissionListResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Vérifier permission
    if !auth.has_permission("colab.missions.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée: colab.missions.read requise" })),
        ));
    }

    let page = filters.page.unwrap_or(1).max(1);
    let per_page = filters.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    // Construire la requête avec filtres
    // IMPORTANT: les conditions doivent être compatibles avec:
    // - la requête principale (FROM atlas.colab_missions m)
    // - la requête de comptage
    let mut conditions = vec!["m.deleted_at IS NULL".to_string()];

    if let Some(ref theme) = filters.theme {
        conditions.push(format!(
            "m.theme::TEXT = '{}'",
            theme.replace('\'', "''")
        ));
    }
    if let Some(ref status) = filters.status {
        conditions.push(format!(
            "m.status::TEXT = '{}'",
            status.replace('\'', "''")
        ));
    }
    if let Some(ref commune) = filters.commune {
        conditions.push(format!(
            "m.commune ILIKE '%{}%'",
            commune.replace('\'', "''")
        ));
    }
    if let Some(ref region) = filters.region {
        conditions.push(format!(
            "m.region ILIKE '%{}%'",
            region.replace('\'', "''")
        ));
    }
    if let Some(ref search) = filters.search {
        let search_escaped = search.replace('\'', "''");
        conditions.push(format!(
            "(m.code ILIKE '%{}%' OR m.title ILIKE '%{}%')",
            search_escaped, search_escaped
        ));
    }
    if let Some(supervisor_id) = filters.supervisor_id {
        conditions.push(format!("m.supervisor_id = '{}'", supervisor_id));
    }

    let where_clause = conditions.join(" AND ");

    // Compter le total
    let count_query = format!(
        "SELECT COUNT(*) as count FROM atlas.colab_missions m WHERE {}",
        where_clause
    );
    
    let total: i64 = sqlx::query_scalar(&count_query)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Erreur comptage missions: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur base de données: {}", e) })),
            )
        })?;

    // Récupérer les missions
    let query = format!(
        r#"
        SELECT 
            m.id,
            m.code,
            m.title,
            m.theme::TEXT as theme,
            m.status::TEXT as status,
            m.maille_id,
            m.zone_label,
            m.commune,
            m.region,
            m.start_date,
            m.end_date,
            m.expected_sondages,
            m.created_at,
            m.updated_at,
            s.id as supervisor_id,
            COALESCE(u.first_name || ' ' || u.last_name, u.username) as supervisor_name,
            (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.mission_id = m.id AND a.unassigned_at IS NULL) as assigned_students_count,
            (SELECT COUNT(*) FROM atlas.colab_mission_sondages ms WHERE ms.mission_id = m.id) as linked_sondages_count,
            (SELECT COUNT(*) FROM atlas.colab_field_logs fl WHERE fl.mission_id = m.id) as field_logs_count,
            (SELECT COUNT(*) FROM atlas.colab_documents d WHERE d.mission_id = m.id AND d.is_current = TRUE) as documents_count
        FROM atlas.colab_missions m
        LEFT JOIN atlas.colab_supervisors s ON m.supervisor_id = s.id
        LEFT JOIN atlas.users u ON s.user_id = u.id
        WHERE {}
        ORDER BY m.created_at DESC
        LIMIT {} OFFSET {}
        "#,
        where_clause, per_page, offset
    );

    let rows = sqlx::query(&query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Erreur récupération missions: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur base de données: {}", e) })),
            )
        })?;

    let missions: Vec<MissionListItem> = rows
        .iter()
        .map(|row| MissionListItem {
            id: row.get("id"),
            code: row.get("code"),
            title: row.get("title"),
            theme: row.get("theme"),
            status: row.get("status"),
            maille_id: row.get("maille_id"),
            zone_label: row.get("zone_label"),
            commune: row.get("commune"),
            region: row.get("region"),
            start_date: row.get("start_date"),
            end_date: row.get("end_date"),
            expected_sondages: row.get("expected_sondages"),
            supervisor_id: row.get("supervisor_id"),
            supervisor_name: row.get("supervisor_name"),
            assigned_students_count: row.get("assigned_students_count"),
            linked_sondages_count: row.get("linked_sondages_count"),
            field_logs_count: row.get("field_logs_count"),
            documents_count: row.get("documents_count"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect();

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;

    Ok(Json(MissionListResponse {
        missions,
        total,
        page,
        per_page,
        total_pages,
    }))
}

/// POST /colab/missions - Créer une mission
async fn create_mission(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<CreateMissionRequest>,
) -> Result<Json<MissionListItem>, (StatusCode, Json<serde_json::Value>)> {
    // Vérifier permission
    if !auth.has_permission("colab.missions.create") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée: colab.missions.create requise" })),
        ));
    }

    // Valider le payload
    if let Err(e) = payload.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("Validation échouée: {}", e) })),
        ));
    }

    // Valider le thème
    if MissionTheme::from_str(&payload.theme).is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Thème invalide. Valeurs acceptées: stabilisation, synthese, reconnaissance, etude_detaillee, controle" })),
        ));
    }

    let id = Uuid::new_v4();
    let now = Utc::now();

    // Transaction: mission + assignations
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    // Insérer la mission
    sqlx::query(
        r#"
        INSERT INTO atlas.colab_missions (
            id, code, title, theme, maille_id, zone_label, commune, region,
            supervisor_id, expected_sondages, start_date, end_date,
            description, objectifs, notes_internal, status, created_by, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4::atlas.mission_theme, $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15, 'draft'::atlas.mission_status, $16, $17, $17
        )
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(&payload.code)
    .bind(&payload.title)
    .bind(&payload.theme)
    .bind(payload.maille_id)
    .bind(&payload.zone_label)
    .bind(&payload.commune)
    .bind(&payload.region)
    .bind(payload.supervisor_id)
    .bind(payload.expected_sondages.unwrap_or(0))
    .bind(payload.start_date)
    .bind(payload.end_date)
    .bind(&payload.description)
    .bind(&payload.objectifs)
    .bind(&payload.notes_internal)
    .bind(auth.id)
    .bind(now)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Erreur création mission: {}", e);
        let error_msg = if e.to_string().contains("duplicate key") {
            "Une mission avec ce code existe déjà"
        } else {
            "Erreur lors de la création de la mission"
        };
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": error_msg, "details": e.to_string() })),
        )
    })?;

    // Assignations (si fournies)
    for student_id in payload.assigned_student_ids.iter() {
        let _ = sqlx::query(
            r#"
            INSERT INTO atlas.colab_mission_assignments (mission_id, student_id, role)
            VALUES ($1, $2, 'membre')
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(id)
        .bind(student_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Erreur assignation étudiant", "details": e.to_string() })),
            )
        })?;
    }

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    // Retourner la mission créée
    let mission = MissionListItem {
        id,
        code: payload.code,
        title: payload.title,
        theme: payload.theme,
        status: "draft".to_string(),
        maille_id: payload.maille_id,
        zone_label: payload.zone_label,
        commune: payload.commune,
        region: payload.region,
        start_date: payload.start_date,
        end_date: payload.end_date,
        expected_sondages: payload.expected_sondages.unwrap_or(0),
        supervisor_id: payload.supervisor_id,
        supervisor_name: None,
        assigned_students_count: 0,
        linked_sondages_count: 0,
        field_logs_count: 0,
        documents_count: 0,
        created_at: now,
        updated_at: now,
    };

    tracing::info!("Mission créée: {} par {}", mission.code, auth.email);

    Ok(Json(mission))
}

// ============================================================================
// Handlers Création Étudiants / Superviseurs
// ============================================================================

/// POST /colab/students - Créer un étudiant (users + role + colab_students)
async fn create_student(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<CreateStudentRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.students.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }
    payload
        .validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("Validation échouée: {}", e) }))))?;

    let password_hasher = PasswordHasher::new(state.auth_config.clone());
    let temp_password = format!("Tmp-{}", Uuid::new_v4());
    let password_hash = password_hasher
        .hash_password(&temp_password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Hash error: {}", e) }))))?;

    let mut tx = state.pool.begin().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) })))
    })?;

    let username_base = payload.email.split('@').next().unwrap_or("user");
    let username = ensure_unique_username(&mut tx, username_base)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur username: {}", e) }))))?;

    // Insert user
    let user_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.users (email, username, password_hash, first_name, last_name, telephone, is_active, is_verified, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, true, false, $7)
        RETURNING id
        "#,
    )
    .bind(&payload.email)
    .bind(&username)
    .bind(&password_hash)
    .bind(&payload.first_name)
    .bind(&payload.last_name)
    .bind(&payload.telephone)
    .bind(auth.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": "Création user impossible", "details": e.to_string() }))))?;

    // Role student
    sqlx::query(
        r#"
        INSERT INTO atlas.user_roles (user_id, role_id, assigned_by)
        VALUES ($1, 'student', $2)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(auth.id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur roles: {}", e) }))))?;

    let student_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_students (user_id, matricule, etablissement, filiere, niveau, promotion, age)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(&payload.matricule)
    .bind(&payload.etablissement)
    .bind(&payload.filiere)
    .bind(&payload.niveau)
    .bind(&payload.promotion)
    .bind(&payload.age)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": "Création étudiant impossible", "details": e.to_string() }))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    Ok(Json(json!({
        "success": true,
        "student_id": student_id,
        "user_id": user_id,
        "temp_password": temp_password
    })))
}

/// POST /colab/supervisors - Créer un superviseur (users + role + colab_supervisors)
async fn create_supervisor(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<CreateSupervisorRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.supervisors.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }
    payload
        .validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("Validation échouée: {}", e) }))))?;

    let password_hasher = PasswordHasher::new(state.auth_config.clone());
    let temp_password = format!("Tmp-{}", Uuid::new_v4());
    let password_hash = password_hasher
        .hash_password(&temp_password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Hash error: {}", e) }))))?;

    let mut tx = state.pool.begin().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) })))
    })?;

    let username_base = payload.email.split('@').next().unwrap_or("user");
    let username = ensure_unique_username(&mut tx, username_base)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur username: {}", e) }))))?;

    let user_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.users (email, username, password_hash, first_name, last_name, is_active, is_verified, created_by)
        VALUES ($1, $2, $3, $4, $5, true, false, $6)
        RETURNING id
        "#,
    )
    .bind(&payload.email)
    .bind(&username)
    .bind(&password_hash)
    .bind(&payload.first_name)
    .bind(&payload.last_name)
    .bind(auth.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": "Création user impossible", "details": e.to_string() }))))?;

    sqlx::query(
        r#"
        INSERT INTO atlas.user_roles (user_id, role_id, assigned_by)
        VALUES ($1, 'supervisor', $2)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(auth.id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur roles: {}", e) }))))?;

    let supervisor_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_supervisors (user_id, specialite, institution, titre, departement, telephone, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(&payload.specialite)
    .bind(&payload.institution)
    .bind(&payload.titre)
    .bind(&payload.departement)
    .bind(&payload.telephone)
    .bind(&payload.notes)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": "Création superviseur impossible", "details": e.to_string() }))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    Ok(Json(json!({
        "success": true,
        "supervisor_id": supervisor_id,
        "user_id": user_id,
        "temp_password": temp_password
    })))
}

/// PUT /colab/students/:id - Mettre à jour un étudiant (profil + user)
async fn update_student(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(student_id): Path<Uuid>,
    Json(payload): Json<UpdateStudentRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.students.update") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }
    payload
        .validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("Validation échouée: {}", e) }))))?;

    let mut tx = state.pool.begin().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) })))
    })?;

    let user_id: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT user_id FROM atlas.colab_students WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(student_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur: {}", e) }))))?;

    let user_id = user_id.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "Étudiant non trouvé" }))))?;

    sqlx::query(
        r#"
        UPDATE atlas.users
        SET
          email = COALESCE($1, email),
          first_name = COALESCE($2, first_name),
          last_name = COALESCE($3, last_name),
          telephone = COALESCE($4, telephone),
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
        WHERE id = $6
        "#,
    )
    .bind(&payload.email)
    .bind(&payload.first_name)
    .bind(&payload.last_name)
    .bind(&payload.telephone)
    .bind(&payload.is_active)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": "Mise à jour user impossible", "details": e.to_string() }))))?;

    sqlx::query(
        r#"
        UPDATE atlas.colab_students
        SET
          matricule = COALESCE($1, matricule),
          promotion = COALESCE($2, promotion),
          filiere = COALESCE($3, filiere),
          etablissement = COALESCE($4, etablissement),
          niveau = COALESCE($5, niveau),
          age = COALESCE($6, age),
          updated_at = NOW()
        WHERE id = $7
        "#,
    )
    .bind(&payload.matricule)
    .bind(&payload.promotion)
    .bind(&payload.filiere)
    .bind(&payload.etablissement)
    .bind(&payload.niveau)
    .bind(&payload.age)
    .bind(student_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": "Mise à jour étudiant impossible", "details": e.to_string() }))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    Ok(Json(json!({ "success": true, "student_id": student_id })))
}

/// DELETE /colab/students/:id - Désactiver un étudiant (soft delete)
async fn delete_student(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.students.delete") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let mut tx = state.pool.begin().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) })))
    })?;

    let user_id: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT user_id FROM atlas.colab_students WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(student_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur: {}", e) }))))?;

    let user_id = user_id.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "Étudiant non trouvé" }))))?;

    sqlx::query(r#"UPDATE atlas.users SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL"#)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": "Désactivation user impossible", "details": e.to_string() }))))?;

    sqlx::query(r#"UPDATE atlas.colab_students SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL"#)
        .bind(student_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": "Soft delete étudiant impossible", "details": e.to_string() }))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    Ok(Json(json!({ "success": true, "student_id": student_id, "deactivated": true })))
}

/// PUT /colab/supervisors/:id - Mettre à jour un superviseur (profil + user)
async fn update_supervisor(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(supervisor_id): Path<Uuid>,
    Json(payload): Json<UpdateSupervisorRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.supervisors.update") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }
    payload
        .validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("Validation échouée: {}", e) }))))?;

    let mut tx = state.pool.begin().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) })))
    })?;

    let user_id: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT user_id FROM atlas.colab_supervisors WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(supervisor_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur: {}", e) }))))?;

    let user_id = user_id.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "Superviseur non trouvé" }))))?;

    sqlx::query(
        r#"
        UPDATE atlas.users
        SET
          email = COALESCE($1, email),
          first_name = COALESCE($2, first_name),
          last_name = COALESCE($3, last_name),
          is_active = COALESCE($4, is_active),
          updated_at = NOW()
        WHERE id = $5
        "#,
    )
    .bind(&payload.email)
    .bind(&payload.first_name)
    .bind(&payload.last_name)
    .bind(&payload.is_active)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": "Mise à jour user impossible", "details": e.to_string() }))))?;

    sqlx::query(
        r#"
        UPDATE atlas.colab_supervisors
        SET
          specialite = COALESCE($1, specialite),
          institution = COALESCE($2, institution),
          titre = COALESCE($3, titre),
          departement = COALESCE($4, departement),
          telephone = COALESCE($5, telephone),
          notes = COALESCE($6, notes),
          updated_at = NOW()
        WHERE id = $7
        "#,
    )
    .bind(&payload.specialite)
    .bind(&payload.institution)
    .bind(&payload.titre)
    .bind(&payload.departement)
    .bind(&payload.telephone)
    .bind(&payload.notes)
    .bind(supervisor_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": "Mise à jour superviseur impossible", "details": e.to_string() }))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    Ok(Json(json!({ "success": true, "supervisor_id": supervisor_id })))
}

/// DELETE /colab/supervisors/:id - Désactiver un superviseur (soft delete)
async fn delete_supervisor(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(supervisor_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.supervisors.delete") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let mut tx = state.pool.begin().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) })))
    })?;

    let user_id: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT user_id FROM atlas.colab_supervisors WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(supervisor_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur: {}", e) }))))?;

    let user_id = user_id.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "Superviseur non trouvé" }))))?;

    sqlx::query(r#"UPDATE atlas.users SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL"#)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": "Désactivation user impossible", "details": e.to_string() }))))?;

    sqlx::query(r#"UPDATE atlas.colab_supervisors SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL"#)
        .bind(supervisor_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": "Soft delete superviseur impossible", "details": e.to_string() }))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    Ok(Json(json!({ "success": true, "supervisor_id": supervisor_id, "deactivated": true })))
}

/// GET /colab/missions/:id - Détail d'une mission
async fn get_mission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<MissionDetail>, (StatusCode, Json<serde_json::Value>)> {
    // Vérifier permission
    if !auth.has_permission("colab.missions.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée: colab.missions.read requise" })),
        ));
    }

    // Récupérer la mission
    let row = sqlx::query(
        r#"
        SELECT 
            m.*,
            m.theme::TEXT as theme_str,
            m.status::TEXT as status_str,
            s.id as sup_id,
            s.user_id as sup_user_id,
            u_sup.username as sup_username,
            u_sup.is_active as sup_is_active,
            COALESCE(u_sup.first_name || ' ' || u_sup.last_name, u_sup.username) as sup_full_name,
            sup.specialite as sup_specialite,
            sup.institution as sup_institution,
            u_creator.id as creator_id,
            u_creator.username as creator_username,
            u_creator.email as creator_email,
            COALESCE(u_creator.first_name || ' ' || u_creator.last_name, u_creator.username) as creator_full_name
        FROM atlas.colab_missions m
        LEFT JOIN atlas.colab_supervisors s ON m.supervisor_id = s.id
        LEFT JOIN atlas.users u_sup ON s.user_id = u_sup.id
        LEFT JOIN atlas.colab_supervisors sup ON s.id = sup.id
        LEFT JOIN atlas.users u_creator ON m.created_by = u_creator.id
        WHERE m.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur base de données: {}", e) })),
        )
    })?;

    let row = row.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Mission non trouvée" })),
        )
    })?;

    // Récupérer les étudiants assignés
    let students_rows = sqlx::query(
        r#"
        SELECT 
            a.id as assignment_id,
            a.student_id,
            s.user_id,
            u.username,
            COALESCE(u.first_name || ' ' || u.last_name, u.username) as full_name,
            s.matricule,
            s.promotion,
            a.role,
            a.assigned_at
        FROM atlas.colab_mission_assignments a
        JOIN atlas.colab_students s ON a.student_id = s.id
        JOIN atlas.users u ON s.user_id = u.id
        WHERE a.mission_id = $1 AND a.unassigned_at IS NULL
        ORDER BY a.assigned_at
        "#,
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let assigned_students: Vec<AssignedStudent> = students_rows
        .iter()
        .map(|r| AssignedStudent {
            assignment_id: r.get("assignment_id"),
            student_id: r.get("student_id"),
            user_id: r.get("user_id"),
            username: r.get("username"),
            full_name: r.get("full_name"),
            matricule: r.get("matricule"),
            promotion: r.get("promotion"),
            role: r.get("role"),
            assigned_at: r.get("assigned_at"),
        })
        .collect();

    // Récupérer les sondages liés
    let sondages_rows = sqlx::query(
        r#"
        SELECT 
            ms.id as link_id,
            ms.sondage_id,
            s.code as sondage_code,
            ms.role,
            ms.linked_at
        FROM atlas.colab_mission_sondages ms
        JOIN atlas.sondages s ON ms.sondage_id = s.id
        WHERE ms.mission_id = $1
        ORDER BY ms.linked_at
        "#,
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let linked_sondages: Vec<LinkedSondage> = sondages_rows
        .iter()
        .map(|r| LinkedSondage {
            link_id: r.get("link_id"),
            sondage_id: r.get("sondage_id"),
            sondage_code: r.get("sondage_code"),
            role: r.get("role"),
            linked_at: r.get("linked_at"),
        })
        .collect();

    // Construire le superviseur
    let supervisor = if let Some(sup_id) = row.get::<Option<Uuid>, _>("sup_id") {
        Some(SupervisorSummary {
            id: sup_id,
            user_id: row.get("sup_user_id"),
            username: row.get("sup_username"),
            full_name: row.get("sup_full_name"),
            specialite: row.get("sup_specialite"),
            institution: row.get("sup_institution"),
            is_active: row.get("sup_is_active"),
        })
    } else {
        None
    };

    // Construire le créateur
    let created_by = if let Some(creator_id) = row.get::<Option<Uuid>, _>("creator_id") {
        Some(UserSummary {
            id: creator_id,
            username: row.get("creator_username"),
            email: row.get("creator_email"),
            full_name: row.get("creator_full_name"),
        })
    } else {
        None
    };

    let mission = MissionDetail {
        id: row.get("id"),
        code: row.get("code"),
        title: row.get("title"),
        theme: row.get("theme_str"),
        status: row.get("status_str"),
        maille_id: row.get("maille_id"),
        zone_label: row.get("zone_label"),
        commune: row.get("commune"),
        region: row.get("region"),
        start_date: row.get("start_date"),
        end_date: row.get("end_date"),
        expected_sondages: row.get("expected_sondages"),
        description: row.get("description"),
        objectifs: row.get("objectifs"),
        notes_internal: row.get("notes_internal"),
        supervisor,
        created_by,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        assigned_students,
        linked_sondages,
    };

    Ok(Json(mission))
}

/// PUT /colab/missions/:id - Mettre à jour une mission
async fn update_mission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateMissionRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // Vérifier permission
    if !auth.has_permission("colab.missions.update") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée: colab.missions.update requise" })),
        ));
    }

    // Vérifier que la mission existe
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM atlas.colab_missions WHERE id = $1)")
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur base de données: {}", e) })),
            )
        })?;

    if !exists {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Mission non trouvée" })),
        ));
    }

    // Construire la requête de mise à jour dynamique
    let mut updates = vec!["updated_at = NOW()".to_string()];
    let mut param_idx = 2;

    if let Some(ref title) = payload.title {
        updates.push(format!("title = ${}", param_idx));
        param_idx += 1;
    }
    if let Some(ref theme) = payload.theme {
        if MissionTheme::from_str(theme).is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Thème invalide" })),
            ));
        }
        updates.push(format!("theme = ${}::atlas.mission_theme", param_idx));
        param_idx += 1;
    }
    if let Some(ref status) = payload.status {
        if MissionStatus::from_str(status).is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Statut invalide" })),
            ));
        }
        updates.push(format!("status = ${}::atlas.mission_status", param_idx));
        param_idx += 1;
    }

    // Pour simplifier, on fait une mise à jour complète avec COALESCE
    let result = sqlx::query(
        r#"
        UPDATE atlas.colab_missions SET
            title = COALESCE($2, title),
            theme = COALESCE($3::atlas.mission_theme, theme),
            status = COALESCE($4::atlas.mission_status, status),
            zone_label = COALESCE($5, zone_label),
            commune = COALESCE($6, commune),
            region = COALESCE($7, region),
            supervisor_id = COALESCE($8, supervisor_id),
            expected_sondages = COALESCE($9, expected_sondages),
            start_date = COALESCE($10, start_date),
            end_date = COALESCE($11, end_date),
            description = COALESCE($12, description),
            objectifs = COALESCE($13, objectifs),
            notes_internal = COALESCE($14, notes_internal),
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(&payload.title)
    .bind(&payload.theme)
    .bind(&payload.status)
    .bind(&payload.zone_label)
    .bind(&payload.commune)
    .bind(&payload.region)
    .bind(payload.supervisor_id)
    .bind(payload.expected_sondages)
    .bind(payload.start_date)
    .bind(payload.end_date)
    .bind(&payload.description)
    .bind(&payload.objectifs)
    .bind(&payload.notes_internal)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur mise à jour: {}", e) })),
        )
    })?;

    tracing::info!("Mission {} mise à jour par {}", id, auth.email);

    Ok(Json(json!({ "success": true, "id": id })))
}

/// DELETE /colab/missions/:id - Supprimer une mission
async fn delete_mission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // Vérifier permission
    if !auth.has_permission("colab.missions.delete") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée: colab.missions.delete requise" })),
        ));
    }

    let result = sqlx::query("UPDATE atlas.colab_missions SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur suppression: {}", e) })),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Mission non trouvée" })),
        ));
    }

    tracing::info!("Mission {} supprimée par {}", id, auth.email);

    Ok(Json(json!({ "success": true, "deleted": id })))
}

/// GET /colab/missions/stats - Statistiques Colab
async fn get_stats(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<ColabStats>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée" })),
        ));
    }

    // Compter les missions par statut
    let status_rows = sqlx::query(
        "SELECT status::TEXT as status, COUNT(*) as count FROM atlas.colab_missions WHERE deleted_at IS NULL GROUP BY status"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let missions_by_status: Vec<StatusCount> = status_rows
        .iter()
        .map(|r| StatusCount {
            status: r.get("status"),
            count: r.get("count"),
        })
        .collect();

    // Compter les missions par thème
    let theme_rows = sqlx::query(
        "SELECT theme::TEXT as theme, COUNT(*) as count FROM atlas.colab_missions WHERE deleted_at IS NULL GROUP BY theme"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let missions_by_theme: Vec<ThemeCount> = theme_rows
        .iter()
        .map(|r| ThemeCount {
            theme: r.get("theme"),
            count: r.get("count"),
        })
        .collect();

    // Totaux
    let total_missions: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM atlas.colab_missions WHERE deleted_at IS NULL")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let total_students: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM atlas.colab_students WHERE deleted_at IS NULL")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let total_supervisors: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM atlas.colab_supervisors WHERE deleted_at IS NULL")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let total_field_logs: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM atlas.colab_field_logs")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let total_documents: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM atlas.colab_documents WHERE deleted_at IS NULL")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    Ok(Json(ColabStats {
        total_missions,
        missions_by_status,
        missions_by_theme,
        total_students,
        total_supervisors,
        total_field_logs,
        total_documents,
    }))
}

// ============================================================================
// Handlers Superviseurs
// ============================================================================

/// GET /colab/supervisors - Liste des superviseurs
async fn list_supervisors(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<SupervisorSummary>>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.supervisors.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée" })),
        ));
    }

    let rows = sqlx::query(
        r#"
        SELECT 
            s.id,
            s.user_id,
            u.username,
            COALESCE(u.first_name || ' ' || u.last_name, u.username) as full_name,
            s.specialite,
            s.institution,
            u.is_active
        FROM atlas.colab_supervisors s
        JOIN atlas.users u ON s.user_id = u.id
        WHERE s.deleted_at IS NULL
          AND u.deleted_at IS NULL
        ORDER BY u.is_active DESC, full_name
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur: {}", e) })),
        )
    })?;

    let supervisors: Vec<SupervisorSummary> = rows
        .iter()
        .map(|r| SupervisorSummary {
            id: r.get("id"),
            user_id: r.get("user_id"),
            username: r.get("username"),
            full_name: r.get("full_name"),
            specialite: r.get("specialite"),
            institution: r.get("institution"),
            is_active: r.get("is_active"),
        })
        .collect();

    Ok(Json(supervisors))
}

// ============================================================================
// Handlers Étudiants
// ============================================================================

/// GET /colab/students - Liste des étudiants
async fn list_students(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.students.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée" })),
        ));
    }

    let rows = sqlx::query(
        r#"
        SELECT 
            s.id,
            s.user_id,
            u.username,
            u.email,
            COALESCE(u.first_name || ' ' || u.last_name, u.username) as full_name,
            u.telephone,
            s.matricule,
            s.promotion,
            s.filiere,
            s.etablissement,
            s.niveau,
            s.age,
            u.is_active,
            (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.student_id = s.id AND a.unassigned_at IS NULL) as active_missions
        FROM atlas.colab_students s
        JOIN atlas.users u ON s.user_id = u.id
        WHERE s.deleted_at IS NULL
          AND u.deleted_at IS NULL
        ORDER BY s.promotion DESC, full_name
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur: {}", e) })),
        )
    })?;

    let students: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<Uuid, _>("id"),
                "user_id": r.get::<Uuid, _>("user_id"),
                "username": r.get::<String, _>("username"),
                "email": r.get::<String, _>("email"),
                "full_name": r.get::<String, _>("full_name"),
                "telephone": r.get::<Option<String>, _>("telephone"),
                "matricule": r.get::<Option<String>, _>("matricule"),
                "promotion": r.get::<String, _>("promotion"),
                "filiere": r.get::<Option<String>, _>("filiere"),
                "etablissement": r.get::<Option<String>, _>("etablissement"),
                "niveau": r.get::<Option<String>, _>("niveau"),
                "age": r.get::<Option<i32>, _>("age"),
                "is_active": r.get::<bool, _>("is_active"),
                "active_missions": r.get::<i64, _>("active_missions"),
            })
        })
        .collect();

    Ok(Json(json!({ "students": students, "total": students.len() })))
}

// ============================================================================
// Handlers Documents (upload/download/delete) - restaurés
// ============================================================================

/// POST /colab/documents (multipart)
async fn upload_document(
    State(state): State<AppState>,
    auth: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.update") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let mut mission_id: Option<Uuid> = None;
    let mut title: Option<String> = None;
    let mut document_type: Option<String> = None;
    let mut description: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;
    let mut mime_type: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("Multipart invalide: {}", e)}))))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            file_name = field.file_name().map(|s| s.to_string());
            mime_type = field.content_type().map(|s| s.to_string());
            let bytes = field
                .bytes()
                .await
                .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("Fichier invalide: {}", e)}))))?;
            file_bytes = Some(bytes.to_vec());
        } else {
            let value = field
                .text()
                .await
                .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("Champ invalide: {}", e)}))))?;
            match name.as_str() {
                "mission_id" => {
                    mission_id = value.parse::<Uuid>().ok();
                }
                "title" => title = Some(value),
                "document_type" => document_type = Some(value),
                "description" => description = Some(value),
                _ => {}
            }
        }
    }

    let mission_id = mission_id.ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"error":"mission_id requis"})))
    })?;
    let title = title.unwrap_or_default();
    if title.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"title requis"}))));
    }
    let document_type = document_type.unwrap_or_else(|| "autre".to_string());
    let file_bytes = file_bytes.ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"error":"file requis"})))
    })?;

    // vérifier mission non supprimée
    let exists: Option<(Uuid,)> = sqlx::query_as(
        r#"SELECT id FROM atlas.colab_missions WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(mission_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur DB: {}", e)}))))?;

    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Mission non trouvée"}))));
    }

    let doc_id = Uuid::new_v4();
    let stored_name = format!("{}_{}", doc_id, file_name.clone().unwrap_or_else(|| "document".to_string()));
    let storage_dir = "./data/colab_documents";
    fs::create_dir_all(storage_dir)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur storage: {}", e)}))))?;
    let file_path = format!("{}/{}", storage_dir, stored_name);
    let mut f = fs::File::create(&file_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur écriture: {}", e)}))))?;
    f.write_all(&file_bytes)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur écriture: {}", e)}))))?;

    sqlx::query(
        r#"
        INSERT INTO atlas.colab_documents (
          id, mission_id, uploaded_by, title, document_type, description,
          file_path, file_name, file_size_bytes, mime_type, is_current, version, uploaded_at
        ) VALUES (
          $1, $2, $3, $4, $5::atlas.document_type, $6,
          $7, $8, $9, $10, TRUE, 1, NOW()
        )
        "#,
    )
    .bind(doc_id)
    .bind(mission_id)
    .bind(auth.id)
    .bind(title.trim())
    .bind(&document_type)
    .bind(description.as_deref())
    .bind(&file_path)
    .bind(file_name.clone().unwrap_or_else(|| stored_name.clone()))
    .bind(file_bytes.len() as i64)
    .bind(mime_type.as_deref())
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error":"Upload impossible", "details": e.to_string()}))))?;

    Ok(Json(json!({"success": true, "id": doc_id})))
}

/// GET /colab/documents/:id/download
async fn download_document(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(document_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let row = sqlx::query(
        r#"SELECT file_path, file_name, mime_type FROM atlas.colab_documents WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(document_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    let row = row.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error":"Document non trouvé"}))))?;
    let file_path: String = row.get("file_path");
    let file_name: String = row.get("file_name");
    let mime_type: Option<String> = row.get("mime_type");

    let bytes = fs::read(&file_path)
        .await
        .map_err(|e| (StatusCode::NOT_FOUND, Json(json!({"error": format!("Fichier introuvable: {}", e)}))))?;

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"{}\"", file_name)
            .parse()
            .unwrap(),
    );
    headers.insert(
        header::CONTENT_TYPE,
        mime_type
            .unwrap_or_else(|| "application/octet-stream".to_string())
            .parse()
            .unwrap(),
    );

    Ok((headers, bytes))
}

/// DELETE /colab/documents/:id - soft delete
async fn delete_document(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(document_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.update") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let res = sqlx::query(
        r#"UPDATE atlas.colab_documents SET deleted_at = NOW(), is_current = FALSE WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(document_id)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Document non trouvé"}))));
    }

    Ok(Json(json!({"success": true, "deleted": document_id})))
}

// ============================================================================
// Suggest (autocomplétion) - restauré
// ============================================================================

/// GET /colab/mailles/suggest?q=TG-0
async fn suggest_mailles(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<MailleSuggestItem>>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let q = params.get("q").cloned().unwrap_or_default();
    let q = format!("%{}%", q);

    let rows = sqlx::query(
        r#"
        SELECT id, code, adm1_name, adm2_name, adm3_name
        FROM atlas.mailles
        WHERE code ILIKE $1
        ORDER BY code
        LIMIT 10
        "#,
    )
    .bind(&q)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    let out = rows
        .iter()
        .map(|r| MailleSuggestItem {
            id: r.get("id"),
            code: r.get("code"),
            adm1_name: r.get("adm1_name"),
            adm2_name: r.get("adm2_name"),
            adm3_name: r.get("adm3_name"),
        })
        .collect();

    Ok(Json(out))
}

#[derive(Debug, serde::Deserialize)]
struct SuggestTextQuery {
    q: String,
}

/// GET /colab/communes/suggest?q=lom
async fn suggest_communes(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<SuggestTextQuery>,
) -> Result<Json<Vec<String>>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }
    let q = format!("%{}%", params.q);
    let rows = sqlx::query_scalar(
        r#"
        SELECT DISTINCT commune
        FROM atlas.colab_missions
        WHERE deleted_at IS NULL
          AND commune IS NOT NULL
          AND commune ILIKE $1
        ORDER BY commune
        LIMIT 10
        "#,
    )
    .bind(&q)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    Ok(Json(rows.into_iter().filter_map(|x: Option<String>| x).collect()))
}

/// GET /colab/regions/suggest?q=mar
async fn suggest_regions(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<SuggestTextQuery>,
) -> Result<Json<Vec<String>>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }
    let q = format!("%{}%", params.q);
    let rows = sqlx::query_scalar(
        r#"
        SELECT DISTINCT region
        FROM atlas.colab_missions
        WHERE deleted_at IS NULL
          AND region IS NOT NULL
          AND region ILIKE $1
        ORDER BY region
        LIMIT 10
        "#,
    )
    .bind(&q)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    Ok(Json(rows.into_iter().filter_map(|x: Option<String>| x).collect()))
}

/// GET /colab/students/suggest?q=jo
async fn suggest_students(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<UserSuggestItem>>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let q = params.get("q").cloned().unwrap_or_default();
    let q = format!("%{}%", q);

    let rows = sqlx::query(
        r#"
        SELECT s.id, COALESCE(u.first_name || ' ' || u.last_name, u.username) AS full_name,
               s.promotion
        FROM atlas.colab_students s
        JOIN atlas.users u ON s.user_id = u.id
        WHERE u.is_active = TRUE
          AND u.deleted_at IS NULL
          AND s.deleted_at IS NULL
          AND (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.username ILIKE $1)
        ORDER BY full_name
        LIMIT 10
        "#,
    )
    .bind(&q)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    let out = rows
        .iter()
        .map(|r| {
            let id: Uuid = r.get("id");
            let full_name: String = r.get("full_name");
            let promotion: Option<String> = r.get("promotion");
            let label = if let Some(p) = promotion {
                format!("{} ({})", full_name, p)
            } else {
                full_name
            };
            UserSuggestItem { id, label }
        })
        .collect();

    Ok(Json(out))
}

/// GET /colab/supervisors/suggest?q=al
async fn suggest_supervisors(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<UserSuggestItem>>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let q = params.get("q").cloned().unwrap_or_default();
    let q = format!("%{}%", q);

    let rows = sqlx::query(
        r#"
        SELECT s.id, COALESCE(u.first_name || ' ' || u.last_name, u.username) AS full_name
        FROM atlas.colab_supervisors s
        JOIN atlas.users u ON s.user_id = u.id
        WHERE u.is_active = TRUE
          AND u.deleted_at IS NULL
          AND s.deleted_at IS NULL
          AND (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.username ILIKE $1)
        ORDER BY full_name
        LIMIT 10
        "#,
    )
    .bind(&q)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    let out = rows
        .iter()
        .map(|r| UserSuggestItem {
            id: r.get("id"),
            label: r.get::<String, _>("full_name"),
        })
        .collect();

    Ok(Json(out))
}
