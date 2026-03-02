use axum::{
    extract::{Path, Query, State},
    http::header,
    http::StatusCode,
    response::Response,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use std::collections::HashSet;
use sqlx::Postgres;
use sqlx::Row;

use crate::state::AppState;

fn desktop_mode_enabled() -> bool {
    std::env::var("ATLAS_DESKTOP")
        .map(|v| v.trim() == "1" || v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/notifications", get(list_notifications))
        .route("/notifications/:id/read", post(mark_notification_read))
        .route("/notifications/read-all", post(mark_all_notifications_read))
        .route("/missions", get(list_missions))
        .route("/missions/stats", get(missions_stats))
        .route("/missions/:id", get(get_mission_detail))
        .route("/supervisors", get(list_supervisors))
        .route("/students", get(list_students))
        .route("/students/:id", get(get_student_detail))
        .route("/students/duplicates", get(list_student_duplicates))
        .route("/attributions/summary", get(attributions_summary))
        .route("/attributions", get(attributions_list))
        .route("/documents", get(list_documents))
        .route("/documents/:id/download", get(download_document))
        .route("/comments", get(list_comments).post(create_comment))
        .route("/comments/:id", axum::routing::delete(delete_comment))
        .route("/comments/:id/replies", get(get_comment_replies))
        .route("/questions", get(list_questions).post(create_question))
        .route("/questions/:id", get(get_question_detail))
        .route("/questions/:id/vote", post(vote_question))
        .route("/questions/:id/close", post(close_question))
        .route("/questions/:id/answers", post(create_answer))
        .route("/answers/:id/vote", post(vote_answer))
        .route("/answers/:id/mark-best", post(mark_best_answer))
        .route("/tags", get(list_tags))
        .route("/leaderboard", get(get_leaderboard))
        .route("/mobile/missions", get(mobile_list_my_missions))
        .route("/mobile/missions/:id", get(mobile_get_mission_detail))
        .route(
            "/mobile/missions/:id/map-context",
            get(mobile_get_mission_map_context),
        )
        .route(
            "/mobile/missions/:id/sondages",
            post(mobile_create_field_sondage),
        )
        .route("/mobile/sync", post(mobile_sync))
        .route("/mobile/tracks", post(mobile_create_track))
        .route("/mobile/tracks/:id/points", post(mobile_add_track_points))
        .route("/mobile/tracks/:id/stop", post(mobile_stop_track))
        .route(
            "/attributions/notifications/history",
            get(attributions_notifications_history),
        )
        .route("/notify/jobs", get(notify_jobs))
}

fn gate_response() -> Option<Response> {
    if !desktop_mode_enabled() {
        Some(
            (StatusCode::NOT_FOUND, Json(serde_json::json!({"error":"colab disabled"})))
                .into_response(),
        )
    } else {
        None
    }
}

#[derive(Deserialize)]
struct NotificationsPaging {
    limit: Option<i64>,
    offset: Option<i64>,
}

async fn list_notifications(
    State(state): State<AppState>,
    Query(q): Query<NotificationsPaging>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let offset = q.offset.unwrap_or(0).max(0);

    let unread_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM atlas.colab_notifications WHERE is_read IS FALSE",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM atlas.colab_notifications",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let rows = sqlx::query(
        r#"
        SELECT
            id, user_id, notification_type, title, message, payload,
            mission_id, sondage_id, comment_id,
            is_read, read_at, created_at
        FROM atlas.colab_notifications
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab notifications list");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let notifications: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "notification_type": r.try_get::<String,_>("notification_type").unwrap_or_default(),
                "title": r.try_get::<String,_>("title").unwrap_or_default(),
                "message": r.try_get::<String,_>("message").ok(),
                "payload": r.try_get::<serde_json::Value,_>("payload").unwrap_or_else(|_| serde_json::json!({})),
                "mission_id": r.try_get::<sqlx::types::Uuid,_>("mission_id").ok().map(|u| u.to_string()),
                "sondage_id": r.try_get::<sqlx::types::Uuid,_>("sondage_id").ok().map(|u| u.to_string()),
                "comment_id": r.try_get::<sqlx::types::Uuid,_>("comment_id").ok().map(|u| u.to_string()),
                "is_read": r.try_get::<bool,_>("is_read").unwrap_or(false),
                "read_at": r.try_get::<chrono::DateTime<chrono::Utc>,_>("read_at").ok().map(|d| d.to_rfc3339()),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>,_>("created_at").to_rfc3339(),
            })
        })
        .collect();

    Json(serde_json::json!({
        "notifications": notifications,
        "unread_count": unread_count,
        "total": total
    }))
    .into_response()
}

async fn mark_notification_read(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let nid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };

    let res = sqlx::query(
        r#"
        UPDATE atlas.colab_notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(nid)
    .execute(&state.pool)
    .await;

    if let Err(e) = res {
        tracing::error!(?e, "colab mark_notification_read");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error":"db error"})),
        )
            .into_response();
    }

    Json(serde_json::json!({"message":"ok"})).into_response()
}

async fn mark_all_notifications_read(State(state): State<AppState>) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let res = sqlx::query(
        r#"
        UPDATE atlas.colab_notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE is_read IS FALSE
        "#,
    )
    .execute(&state.pool)
    .await;

    match res {
        Ok(r) => Json(serde_json::json!({
            "marked_count": r.rows_affected(),
            "message":"ok"
        }))
        .into_response(),
        Err(e) => {
            tracing::error!(?e, "colab mark_all_notifications_read");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct Paging {
    page: Option<i64>,
    per_page: Option<i64>,
}

async fn list_missions(
    State(state): State<AppState>,
    Query(q): Query<Paging>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let page = q.page.unwrap_or(1).max(1);
    let per_page = q.per_page.unwrap_or(12).clamp(1, 200);
    let offset = (page - 1) * per_page;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM atlas.v_colab_missions_summary",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let rows = sqlx::query(
        r#"
        SELECT
            id, code, title, theme, status, maille_id, zone_label, commune, region,
            start_date, end_date, expected_sondages, supervisor_id, supervisor_name,
            assigned_students_count, linked_sondages_count, field_logs_count, documents_count,
            created_at, updated_at,
            description
        FROM atlas.v_colab_missions_summary
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab list_missions");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let missions: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            // operational fields not present in view: provide stable defaults
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "code": r.try_get::<String,_>("code").unwrap_or_default(),
                "title": r.try_get::<String,_>("title").unwrap_or_default(),
                "theme": r.try_get::<String,_>("theme").unwrap_or_default(),
                "status": r.try_get::<String,_>("status").unwrap_or_else(|_| "draft".to_string()),
                "maille_id": r.try_get::<sqlx::types::Uuid,_>("maille_id").ok().map(|u| u.to_string()),
                "zone_label": r.try_get::<String,_>("zone_label").ok(),
                "commune": r.try_get::<String,_>("commune").ok(),
                "region": r.try_get::<String,_>("region").ok(),
                "start_date": r.try_get::<chrono::NaiveDate,_>("start_date").ok().map(|d| d.to_string()),
                "end_date": r.try_get::<chrono::NaiveDate,_>("end_date").ok().map(|d| d.to_string()),
                "expected_sondages": r.try_get::<i32,_>("expected_sondages").unwrap_or(0),
                "supervisor_id": r.try_get::<sqlx::types::Uuid,_>("supervisor_id").ok().map(|u| u.to_string()),
                "supervisor_name": r.try_get::<String,_>("supervisor_name").ok(),
                "assigned_students_count": r.try_get::<i64,_>("assigned_students_count").unwrap_or(0),
                "linked_sondages_count": r.try_get::<i64,_>("linked_sondages_count").unwrap_or(0),
                "field_logs_count": r.try_get::<i64,_>("field_logs_count").unwrap_or(0),
                "documents_count": r.try_get::<i64,_>("documents_count").unwrap_or(0),
                "conflict_holder_email": null,
                "conflict_holder_name": null,
                "conflict_mission_id": null,
                "operational_status": "ok",
                "operational_reason": null,
                "created_at": r.get::<chrono::DateTime<chrono::Utc>,_>("created_at").to_rfc3339(),
                "updated_at": r.get::<chrono::DateTime<chrono::Utc>,_>("updated_at").to_rfc3339(),
            })
        })
        .collect();

    let total_pages = if total == 0 {
        0
    } else {
        ((total as f64) / (per_page as f64)).ceil() as i64
    };

    Json(serde_json::json!({
        "missions": missions,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages
    }))
    .into_response()
}

async fn missions_stats(State(state): State<AppState>) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let total_missions: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM atlas.v_colab_missions_summary",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let missions_by_status_rows = sqlx::query(
        "SELECT status, COUNT(*)::bigint AS c FROM atlas.v_colab_missions_summary GROUP BY status ORDER BY status",
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let missions_by_theme_rows = sqlx::query(
        "SELECT theme, COUNT(*)::bigint AS c FROM atlas.v_colab_missions_summary GROUP BY theme ORDER BY theme",
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let missions_by_status: Vec<serde_json::Value> = missions_by_status_rows
        .into_iter()
        .map(|r| serde_json::json!({
            "status": r.try_get::<String,_>("status").unwrap_or_default(),
            "count": r.try_get::<i64,_>("c").unwrap_or(0)
        }))
        .collect();

    let missions_by_theme: Vec<serde_json::Value> = missions_by_theme_rows
        .into_iter()
        .map(|r| serde_json::json!({
            "theme": r.try_get::<String,_>("theme").unwrap_or_default(),
            "count": r.try_get::<i64,_>("c").unwrap_or(0)
        }))
        .collect();

    let total_students: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.v_colab_students")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let total_supervisors: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.v_colab_supervisors")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let total_field_logs: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(field_logs_count),0)::bigint FROM atlas.v_colab_missions_summary",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let total_documents: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(documents_count),0)::bigint FROM atlas.v_colab_missions_summary",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    Json(serde_json::json!({
        "total_missions": total_missions,
        "missions_by_status": missions_by_status,
        "missions_by_theme": missions_by_theme,
        "total_students": total_students,
        "total_supervisors": total_supervisors,
        "total_field_logs": total_field_logs,
        "total_documents": total_documents
    }))
    .into_response()
}

async fn list_supervisors(State(state): State<AppState>) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let rows = sqlx::query(
        r#"
        SELECT id, user_id, username, full_name_with_title, specialite, institution, is_active
        FROM atlas.v_colab_supervisors
        WHERE is_active IS TRUE
        ORDER BY full_name_with_title
        "#,
    )
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab list_supervisors");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let out: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "user_id": r.get::<sqlx::types::Uuid,_>("user_id").to_string(),
                "username": r.try_get::<String,_>("username").unwrap_or_default(),
                "full_name": r.try_get::<String,_>("full_name_with_title").unwrap_or_default(),
                "specialite": r.try_get::<String,_>("specialite").ok(),
                "institution": r.try_get::<String,_>("institution").ok(),
                "is_active": r.try_get::<bool,_>("is_active").unwrap_or(true)
            })
        })
        .collect();

    Json(out).into_response()
}

async fn list_students(State(state): State<AppState>) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let rows = sqlx::query(
        r#"
        SELECT id, user_id, username, full_name, matricule, promotion, is_active
        FROM atlas.v_colab_students
        WHERE is_active IS TRUE
        ORDER BY full_name
        "#,
    )
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab list_students");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let students: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "user_id": r.get::<sqlx::types::Uuid,_>("user_id").to_string(),
                "username": r.try_get::<String,_>("username").unwrap_or_default(),
                "full_name": r.try_get::<String,_>("full_name").unwrap_or_default(),
                "matricule": r.try_get::<String,_>("matricule").ok(),
                "promotion": r.try_get::<String,_>("promotion").unwrap_or_default(),
                "role": "student",
                "is_active": r.try_get::<bool,_>("is_active").unwrap_or(true)
            })
        })
        .collect();

    Json(serde_json::json!({"students": students, "total": students.len()})).into_response()
}

async fn get_student_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let sid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };

    let row = sqlx::query(
        r#"
        SELECT
            id,
            user_id,
            email,
            username,
            first_name,
            last_name,
            full_name,
            matricule,
            promotion,
            filiere,
            etablissement,
            niveau,
            notes,
            created_at,
            is_active,
            active_missions_count
        FROM atlas.v_colab_students
        WHERE id = $1
        "#,
    )
    .bind(sid)
    .fetch_optional(&state.pool)
    .await;

    let row = match row {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error":"not found"})),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!(?e, "colab get_student_detail");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let resp = serde_json::json!({
        "id": row.get::<sqlx::types::Uuid,_>("id").to_string(),
        "user_id": row.get::<sqlx::types::Uuid,_>("user_id").to_string(),
        "email": row.try_get::<String,_>("email").unwrap_or_default(),
        "username": row.try_get::<String,_>("username").unwrap_or_default(),
        "first_name": row.try_get::<String,_>("first_name").ok(),
        "last_name": row.try_get::<String,_>("last_name").ok(),
        "full_name": row.try_get::<String,_>("full_name").unwrap_or_default(),
        "matricule": row.try_get::<String,_>("matricule").ok(),
        "promotion": row.try_get::<String,_>("promotion").unwrap_or_default(),
        "filiere": row.try_get::<String,_>("filiere").ok(),
        "etablissement": row.try_get::<String,_>("etablissement").ok(),
        "niveau": row.try_get::<String,_>("niveau").ok(),
        "notes": row.try_get::<String,_>("notes").ok(),
        "created_at": row.get::<chrono::DateTime<chrono::Utc>,_>("created_at").to_rfc3339(),
        "is_active": row.try_get::<bool,_>("is_active").unwrap_or(true),
        "active_missions_count": row.try_get::<i64,_>("active_missions_count").unwrap_or(0)
    });

    Json(resp).into_response()
}

async fn list_student_duplicates(State(state): State<AppState>) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    // Duplicates are defined by same telephone in colab_student_prefs.
    let rows = sqlx::query(
        r#"
        SELECT telephone, ARRAY_AGG(student_id::text) AS student_ids
        FROM atlas.colab_student_prefs
        WHERE telephone IS NOT NULL AND TRIM(telephone) <> ''
        GROUP BY telephone
        HAVING COUNT(*) > 1
        ORDER BY telephone
        "#,
    )
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab students duplicates");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let mut out: Vec<serde_json::Value> = Vec::new();
    for r in rows {
        let telephone: String = match r.try_get("telephone") {
            Ok(v) => v,
            Err(_) => continue,
        };

        // student_ids is text[]
        let student_ids: Vec<String> = r.try_get::<Vec<String>, _>("student_ids").unwrap_or_default();
        let mut students = Vec::new();
        for sid in student_ids {
            let Ok(uuid) = sqlx::types::Uuid::parse_str(&sid) else { continue; };
            let row2 = sqlx::query(
                r#"
                SELECT id, user_id, username, full_name, matricule, promotion, is_active
                FROM atlas.v_colab_students
                WHERE id = $1
                "#,
            )
            .bind(uuid)
            .fetch_optional(&state.pool)
            .await
            .ok()
            .flatten();

            if let Some(s) = row2 {
                students.push(serde_json::json!({
                    "id": s.get::<sqlx::types::Uuid,_>("id").to_string(),
                    "user_id": s.get::<sqlx::types::Uuid,_>("user_id").to_string(),
                    "username": s.try_get::<String,_>("username").unwrap_or_default(),
                    "email": s.try_get::<String,_>("email").ok(),
                    "first_name": s.try_get::<String,_>("first_name").ok(),
                    "last_name": s.try_get::<String,_>("last_name").ok(),
                    "full_name": s.try_get::<String,_>("full_name").unwrap_or_default(),
                    "matricule": s.try_get::<String,_>("matricule").ok(),
                    "promotion": s.try_get::<String,_>("promotion").unwrap_or_default(),
                    "filiere": s.try_get::<String,_>("filiere").ok(),
                    "etablissement": s.try_get::<String,_>("etablissement").ok(),
                    "niveau": s.try_get::<String,_>("niveau").ok(),
                    "notes": s.try_get::<String,_>("notes").ok(),
                    "created_at": s.get::<chrono::DateTime<chrono::Utc>,_>("created_at").to_rfc3339(),
                    "is_active": s.try_get::<bool,_>("is_active").unwrap_or(true),
                    "active_missions_count": s.try_get::<i64,_>("active_missions_count").unwrap_or(0)
                }));
            }
        }

        out.push(serde_json::json!({
            "telephone": telephone,
            "students": students
        }));
    }

    Json(out).into_response()
}

async fn attributions_summary(State(state): State<AppState>) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let total_missions: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.colab_missions")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);
    let total_assignments: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM atlas.colab_mission_assignments WHERE unassigned_at IS NULL",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);
    let total_students: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.colab_students")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);
    let missions_with_student: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT mission_id)::bigint FROM atlas.colab_mission_assignments WHERE unassigned_at IS NULL",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);
    let pending_notifications: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM atlas.colab_notifications WHERE is_read IS FALSE",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    Json(serde_json::json!({
        "total_missions": total_missions,
        "total_assignments": total_assignments,
        "total_students": total_students,
        "missions_with_student": missions_with_student,
        "pending_notifications": pending_notifications
    }))
    .into_response()
}

async fn attributions_list() -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    Json(serde_json::json!({"items":[],"total":0})).into_response()
}

async fn get_mission_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let mid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };

    let row = sqlx::query(
        r#"
        SELECT
            m.id, m.code, m.title, m.theme::text AS theme, m.status::text AS status,
            m.maille_id, m.zone_label, m.commune, m.region,
            m.start_date, m.end_date, m.expected_sondages,
            m.supervisor_id,
            m.description, m.objectifs, m.notes_internal,
            m.created_at, m.updated_at
        FROM atlas.colab_missions m
        WHERE m.id = $1
        "#,
    )
    .bind(mid)
    .fetch_optional(&state.pool)
    .await;

    let row = match row {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error":"not found"})),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!(?e, "colab get_mission_detail");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let assigned_students_rows = sqlx::query(
        r#"
        SELECT
            a.id AS assignment_id,
            a.student_id,
            a.role,
            a.assigned_at,
            s.user_id,
            u.username,
            u.email,
            CONCAT(u.first_name, ' ', u.last_name) AS full_name,
            s.matricule,
            s.promotion
        FROM atlas.colab_mission_assignments a
        JOIN atlas.colab_students s ON s.id = a.student_id
        JOIN atlas.users u ON u.id = s.user_id
        WHERE a.mission_id = $1 AND a.unassigned_at IS NULL
        ORDER BY a.assigned_at DESC
        "#,
    )
    .bind(mid)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let assigned_students: Vec<serde_json::Value> = assigned_students_rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "assignment_id": r.get::<sqlx::types::Uuid,_>("assignment_id").to_string(),
                "student_id": r.get::<sqlx::types::Uuid,_>("student_id").to_string(),
                "user_id": r.get::<sqlx::types::Uuid,_>("user_id").to_string(),
                "username": r.try_get::<String,_>("username").unwrap_or_default(),
                "full_name": r.try_get::<String,_>("full_name").unwrap_or_default(),
                "matricule": r.try_get::<String,_>("matricule").ok(),
                "promotion": r.try_get::<String,_>("promotion").unwrap_or_default(),
                "role": r.try_get::<String,_>("role").unwrap_or_else(|_| "membre".to_string()),
                "assigned_at": r.get::<chrono::DateTime<chrono::Utc>,_>("assigned_at").to_rfc3339(),
            })
        })
        .collect();

    let linked_sondages_rows = sqlx::query(
        r#"
        SELECT
            ms.id AS link_id,
            ms.sondage_id,
            s.code AS sondage_code,
            ms.role,
            ms.linked_at
        FROM atlas.colab_mission_sondages ms
        LEFT JOIN atlas.sondages s ON s.id = ms.sondage_id
        WHERE ms.mission_id = $1
        ORDER BY ms.linked_at DESC
        "#,
    )
    .bind(mid)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let linked_sondages: Vec<serde_json::Value> = linked_sondages_rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "link_id": r.get::<sqlx::types::Uuid,_>("link_id").to_string(),
                "sondage_id": r.get::<sqlx::types::Uuid,_>("sondage_id").to_string(),
                "sondage_code": r.try_get::<String,_>("sondage_code").ok(),
                "role": r.try_get::<String,_>("role").unwrap_or_else(|_| "linked".to_string()),
                "linked_at": r.get::<chrono::DateTime<chrono::Utc>,_>("linked_at").to_rfc3339(),
            })
        })
        .collect();

    let resp = serde_json::json!({
        "id": row.get::<sqlx::types::Uuid,_>("id").to_string(),
        "code": row.try_get::<String,_>("code").unwrap_or_default(),
        "title": row.try_get::<String,_>("title").unwrap_or_default(),
        "theme": row.try_get::<String,_>("theme").unwrap_or_default(),
        "status": row.try_get::<String,_>("status").unwrap_or_else(|_| "draft".to_string()),
        "maille_id": row.try_get::<sqlx::types::Uuid,_>("maille_id").ok().map(|u| u.to_string()),
        "zone_label": row.try_get::<String,_>("zone_label").ok(),
        "commune": row.try_get::<String,_>("commune").ok(),
        "region": row.try_get::<String,_>("region").ok(),
        "start_date": row.try_get::<chrono::NaiveDate,_>("start_date").ok().map(|d| d.to_string()),
        "end_date": row.try_get::<chrono::NaiveDate,_>("end_date").ok().map(|d| d.to_string()),
        "expected_sondages": row.try_get::<i32,_>("expected_sondages").unwrap_or(0),
        "supervisor_id": row.try_get::<sqlx::types::Uuid,_>("supervisor_id").ok().map(|u| u.to_string()),
        "supervisor_name": null,
        "assigned_students_count": assigned_students.len(),
        "linked_sondages_count": linked_sondages.len(),
        "field_logs_count": 0,
        "documents_count": 0,
        "operational_status": "ok",
        "operational_reason": null,
        "conflict_holder_email": null,
        "conflict_holder_name": null,
        "conflict_mission_id": null,
        "description": row.try_get::<String,_>("description").ok(),
        "objectifs": row.try_get::<String,_>("objectifs").ok(),
        "notes_internal": row.try_get::<String,_>("notes_internal").ok(),
        "supervisor": null,
        "created_by": null,
        "assigned_students": assigned_students,
        "linked_sondages": linked_sondages,
        "created_at": row.get::<chrono::DateTime<chrono::Utc>,_>("created_at").to_rfc3339(),
        "updated_at": row.get::<chrono::DateTime<chrono::Utc>,_>("updated_at").to_rfc3339(),
    });

    Json(resp).into_response()
}

#[derive(Deserialize)]
struct DocumentsQuery {
    mission_id: Option<String>,
    sondage_id: Option<String>,
    document_type: Option<String>,
}

async fn list_documents(
    State(state): State<AppState>,
    Query(q): Query<DocumentsQuery>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let mut qb: sqlx::QueryBuilder<Postgres> = sqlx::QueryBuilder::new(
        r#"
        SELECT
            id, mission_id, uploaded_by, title, document_type::text AS document_type,
            description, file_path, file_name, file_size_bytes, mime_type,
            sondage_id, version, is_current, uploaded_at, notes
        FROM atlas.colab_documents
        WHERE 1=1
        "#,
    );

    if let Some(mid) = q.mission_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        if let Ok(u) = sqlx::types::Uuid::parse_str(mid) {
            qb.push(" AND mission_id = ").push_bind(u);
        }
    }
    if let Some(sid) = q.sondage_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        if let Ok(u) = sqlx::types::Uuid::parse_str(sid) {
            qb.push(" AND sondage_id = ").push_bind(u);
        }
    }
    if let Some(dt) = q.document_type.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        qb.push(" AND document_type::text = ").push_bind(dt);
    }

    qb.push(" ORDER BY uploaded_at DESC");

    let rows = match qb.build().fetch_all(&state.pool).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab list_documents");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let documents: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "mission_id": r.get::<sqlx::types::Uuid,_>("mission_id").to_string(),
                "uploaded_by": r.get::<sqlx::types::Uuid,_>("uploaded_by").to_string(),
                "title": r.try_get::<String,_>("title").unwrap_or_default(),
                "document_type": r.try_get::<String,_>("document_type").unwrap_or_default(),
                "description": r.try_get::<String,_>("description").ok(),
                "file_path": r.try_get::<String,_>("file_path").unwrap_or_default(),
                "file_name": r.try_get::<String,_>("file_name").unwrap_or_default(),
                "file_size_bytes": r.try_get::<i64,_>("file_size_bytes").ok(),
                "mime_type": r.try_get::<String,_>("mime_type").ok(),
                "sondage_id": r.try_get::<sqlx::types::Uuid,_>("sondage_id").ok().map(|u| u.to_string()),
                "version": r.try_get::<i32,_>("version").unwrap_or(1),
                "is_current": r.try_get::<bool,_>("is_current").unwrap_or(true),
                "uploaded_at": r.get::<chrono::DateTime<chrono::Utc>,_>("uploaded_at").to_rfc3339(),
                "notes": r.try_get::<String,_>("notes").ok(),
            })
        })
        .collect();

    Json(serde_json::json!({"documents": documents, "total": documents.len()})).into_response()
}

async fn download_document(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let did = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };

    let row = sqlx::query(
        r#"
        SELECT file_path, file_name, mime_type
        FROM atlas.colab_documents
        WHERE id = $1
        "#,
    )
    .bind(did)
    .fetch_optional(&state.pool)
    .await;

    let row = match row {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error":"not found"})),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!(?e, "colab download_document db");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let file_path: String = row.try_get("file_path").unwrap_or_default();
    let file_name: String = row.try_get("file_name").unwrap_or_else(|_| "document".to_string());
    let mime_type: Option<String> = row.try_get("mime_type").ok();

    let bytes = match tokio::fs::read(&file_path).await {
        Ok(b) => b,
        Err(e) => {
            tracing::warn!(?e, file_path, "colab download_document file missing");
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error":"file not found"})),
            )
                .into_response();
        }
    };

    let mut resp = Response::new(bytes.into());
    *resp.status_mut() = StatusCode::OK;
    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        header::HeaderValue::from_str(mime_type.as_deref().unwrap_or("application/octet-stream"))
            .unwrap_or_else(|_| header::HeaderValue::from_static("application/octet-stream")),
    );
    resp.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        header::HeaderValue::from_str(&format!("attachment; filename=\"{}\"", file_name))
            .unwrap_or_else(|_| header::HeaderValue::from_static("attachment")),
    );
    resp
}

#[derive(Deserialize)]
struct CommentsQuery {
    entity_type: String,
    entity_id: String,
}

async fn list_comments(
    State(state): State<AppState>,
    Query(q): Query<CommentsQuery>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let entity_id = match sqlx::types::Uuid::parse_str(&q.entity_id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid entity_id"})),
            )
                .into_response();
        }
    };

    let rows = sqlx::query(
        r#"
        SELECT
            id,
            entity_type::text AS entity_type,
            entity_id,
            content,
            parent_comment_id,
            is_edited,
            created_at,
            updated_at,
            author_id,
            author_username,
            author_email,
            replies_count
        FROM atlas.v_colab_comments
        WHERE entity_type::text = $1
          AND entity_id = $2
          AND parent_comment_id IS NULL
        ORDER BY created_at DESC
        "#,
    )
    .bind(q.entity_type)
    .bind(entity_id)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab list_comments");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let comments: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "entity_type": r.try_get::<String,_>("entity_type").unwrap_or_default(),
                "entity_id": r.get::<sqlx::types::Uuid,_>("entity_id").to_string(),
                "content": r.try_get::<String,_>("content").unwrap_or_default(),
                "parent_comment_id": r.try_get::<sqlx::types::Uuid,_>("parent_comment_id").ok().map(|u| u.to_string()),
                "is_edited": r.try_get::<bool,_>("is_edited").unwrap_or(false),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>,_>("created_at").to_rfc3339(),
                "updated_at": r.get::<chrono::DateTime<chrono::Utc>,_>("updated_at").to_rfc3339(),
                "author_id": r.get::<sqlx::types::Uuid,_>("author_id").to_string(),
                "author_username": r.try_get::<String,_>("author_username").unwrap_or_default(),
                "author_email": r.try_get::<String,_>("author_email").unwrap_or_default(),
                "replies_count": r.try_get::<i64,_>("replies_count").unwrap_or(0),
            })
        })
        .collect();

    Json(serde_json::json!({"comments": comments, "count": comments.len()})).into_response()
}

async fn get_comment_replies(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let cid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };

    let rows = sqlx::query(
        r#"
        SELECT
            id,
            entity_type::text AS entity_type,
            entity_id,
            content,
            parent_comment_id,
            is_edited,
            created_at,
            updated_at,
            author_id,
            author_username,
            author_email,
            replies_count
        FROM atlas.v_colab_comments
        WHERE parent_comment_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(cid)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let replies: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "entity_type": r.try_get::<String,_>("entity_type").unwrap_or_default(),
                "entity_id": r.get::<sqlx::types::Uuid,_>("entity_id").to_string(),
                "content": r.try_get::<String,_>("content").unwrap_or_default(),
                "parent_comment_id": r.try_get::<sqlx::types::Uuid,_>("parent_comment_id").ok().map(|u| u.to_string()),
                "is_edited": r.try_get::<bool,_>("is_edited").unwrap_or(false),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>,_>("created_at").to_rfc3339(),
                "updated_at": r.get::<chrono::DateTime<chrono::Utc>,_>("updated_at").to_rfc3339(),
                "author_id": r.get::<sqlx::types::Uuid,_>("author_id").to_string(),
                "author_username": r.try_get::<String,_>("author_username").unwrap_or_default(),
                "author_email": r.try_get::<String,_>("author_email").unwrap_or_default(),
                "replies_count": r.try_get::<i64,_>("replies_count").unwrap_or(0),
            })
        })
        .collect();

    Json(serde_json::json!({"replies": replies, "count": replies.len()})).into_response()
}

#[derive(Deserialize)]
struct CreateCommentRequest {
    entity_type: String,
    entity_id: String,
    content: String,
    parent_comment_id: Option<String>,
}

async fn create_comment(
    State(state): State<AppState>,
    Json(req): Json<CreateCommentRequest>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let entity_id = match sqlx::types::Uuid::parse_str(&req.entity_id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid entity_id"})),
            )
                .into_response();
        }
    };
    let parent_id = match req.parent_comment_id.as_deref() {
        Some(s) if !s.trim().is_empty() => match sqlx::types::Uuid::parse_str(s) {
            Ok(v) => Some(v),
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({"error":"invalid parent_comment_id"})),
                )
                    .into_response();
            }
        },
        _ => None,
    };

    // Desktop mode: no authenticated user; keep deterministic author.
    // Prefer the mission creator if possible, otherwise NULL is rejected -> we use first admin user.
    let author_id: Option<sqlx::types::Uuid> = sqlx::query_scalar(
        "SELECT id FROM atlas.users ORDER BY created_at ASC LIMIT 1",
    )
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    let Some(author_id) = author_id else {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error":"no user available"})),
        )
            .into_response();
    };

    let row = sqlx::query(
        r#"
        INSERT INTO atlas.colab_comments(entity_type, entity_id, author_id, content, parent_comment_id)
        VALUES ($1::atlas.comment_entity_type, $2, $3, $4, $5)
        RETURNING id
        "#,
    )
    .bind(req.entity_type)
    .bind(entity_id)
    .bind(author_id)
    .bind(req.content)
    .bind(parent_id)
    .fetch_one(&state.pool)
    .await;

    match row {
        Ok(r) => Json(serde_json::json!({
            "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
            "mentions_count": 0,
            "message": "ok"
        }))
        .into_response(),
        Err(e) => {
            tracing::error!(?e, "colab create_comment");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response()
        }
    }
}

async fn delete_comment(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let cid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };

    let res = sqlx::query(
        r#"DELETE FROM atlas.colab_comments WHERE id = $1 OR parent_comment_id = $1"#,
    )
    .bind(cid)
    .execute(&state.pool)
    .await;

    match res {
        Ok(_) => Json(serde_json::json!({"message":"ok"})).into_response(),
        Err(e) => {
            tracing::error!(?e, "colab delete_comment");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct QuestionsListQuery {
    tag: Option<String>,
    mission_id: Option<String>,
    search: Option<String>,
    sort: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

async fn list_questions(
    State(state): State<AppState>,
    Query(q): Query<QuestionsListQuery>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let offset = q.offset.unwrap_or(0).max(0);

    let mut qb: sqlx::QueryBuilder<Postgres> = sqlx::QueryBuilder::new(
        r#"
        SELECT
            id, title, author_username, is_closed, is_pinned,
            score, views_count, answers_count, created_at, has_best_answer
        FROM atlas.v_colab_questions
        WHERE 1=1
        "#,
    );

    if let Some(mid) = q.mission_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        if let Ok(u) = sqlx::types::Uuid::parse_str(mid) {
            qb.push(" AND mission_id = ").push_bind(u);
        }
    }
    if let Some(t) = q.tag.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        qb.push(" AND ").push_bind(t).push(" = ANY(tags)");
    }
    if let Some(s) = q.search.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        qb.push(" AND (title ILIKE ").push_bind(format!("%{}%", s)).push(" OR body ILIKE ").push_bind(format!("%{}%", s)).push(")");
    }

    match q.sort.as_deref() {
        Some("score") => qb.push(" ORDER BY score DESC, created_at DESC"),
        Some("views") => qb.push(" ORDER BY views_count DESC, created_at DESC"),
        _ => qb.push(" ORDER BY created_at DESC"),
    };

    qb.push(" LIMIT ").push_bind(limit);
    qb.push(" OFFSET ").push_bind(offset);

    let rows = match qb.build().fetch_all(&state.pool).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab list_questions");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let questions: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "title": r.try_get::<String,_>("title").unwrap_or_default(),
                "author_username": r.try_get::<String,_>("author_username").unwrap_or_default(),
                "is_closed": r.try_get::<bool,_>("is_closed").unwrap_or(false),
                "is_pinned": r.try_get::<bool,_>("is_pinned").unwrap_or(false),
                "score": r.try_get::<i32,_>("score").unwrap_or(0),
                "views_count": r.try_get::<i32,_>("views_count").unwrap_or(0),
                "answers_count": r.try_get::<i32,_>("answers_count").unwrap_or(0),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>,_>("created_at").to_rfc3339(),
                "has_best_answer": r.try_get::<bool,_>("has_best_answer").unwrap_or(false),
            })
        })
        .collect();

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM atlas.colab_questions")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    Json(serde_json::json!({
        "questions": questions,
        "total": total,
        "page": 1,
        "per_page": limit
    }))
    .into_response()
}

async fn get_question_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let qid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };

    let qrow = sqlx::query(
        r#"
        SELECT
            id, title, body, author_id, author_username, mission_id, mission_title,
            is_closed, is_pinned, score, views_count, answers_count,
            created_at, updated_at, has_best_answer, tags
        FROM atlas.v_colab_questions
        WHERE id = $1
        "#,
    )
    .bind(qid)
    .fetch_optional(&state.pool)
    .await;

    let qrow = match qrow {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab get_question_detail");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let Some(qrow) = qrow else {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error":"not found"})),
        )
            .into_response();
    };

    let answers_rows = sqlx::query(
        r#"
        SELECT
            id, question_id, body, author_id, author_username, is_best, is_accepted,
            score, created_at, updated_at, author_reputation
        FROM atlas.v_colab_answers
        WHERE question_id = $1
        ORDER BY is_best DESC, score DESC, created_at ASC
        "#,
    )
    .bind(qid)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let answers: Vec<serde_json::Value> = answers_rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "question_id": r.get::<sqlx::types::Uuid,_>("question_id").to_string(),
                "body": r.try_get::<String,_>("body").unwrap_or_default(),
                "author_id": r.get::<sqlx::types::Uuid,_>("author_id").to_string(),
                "author_username": r.try_get::<String,_>("author_username").unwrap_or_default(),
                "is_best": r.try_get::<bool,_>("is_best").unwrap_or(false),
                "is_accepted": r.try_get::<bool,_>("is_accepted").unwrap_or(false),
                "score": r.try_get::<i32,_>("score").unwrap_or(0),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>,_>("created_at").to_rfc3339(),
                "updated_at": r.get::<chrono::DateTime<chrono::Utc>,_>("updated_at").to_rfc3339(),
                "author_reputation": r.try_get::<i32,_>("author_reputation").ok(),
            })
        })
        .collect();

    let tags: Vec<String> = qrow.try_get::<Vec<String>, _>("tags").unwrap_or_default();
    let tags_rows = if tags.is_empty() {
        Vec::new()
    } else {
        sqlx::query(
            r#"
            SELECT id, name, slug, description, color, usage_count
            FROM atlas.colab_tags
            WHERE name = ANY($1)
            ORDER BY usage_count DESC, name
            "#,
        )
        .bind(&tags)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default()
    };

    let tags_json: Vec<serde_json::Value> = tags_rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "name": r.try_get::<String,_>("name").unwrap_or_default(),
                "slug": r.try_get::<String,_>("slug").unwrap_or_default(),
                "description": r.try_get::<String,_>("description").ok(),
                "color": r.try_get::<String,_>("color").unwrap_or_else(|_| "#6B7280".to_string()),
                "usage_count": r.try_get::<i32,_>("usage_count").unwrap_or(0),
            })
        })
        .collect();

    let question = serde_json::json!({
        "id": qrow.get::<sqlx::types::Uuid,_>("id").to_string(),
        "title": qrow.try_get::<String,_>("title").unwrap_or_default(),
        "body": qrow.try_get::<String,_>("body").unwrap_or_default(),
        "author_id": qrow.get::<sqlx::types::Uuid,_>("author_id").to_string(),
        "author_username": qrow.try_get::<String,_>("author_username").unwrap_or_default(),
        "mission_id": qrow.try_get::<sqlx::types::Uuid,_>("mission_id").ok().map(|u| u.to_string()),
        "mission_title": qrow.try_get::<String,_>("mission_title").ok(),
        "is_closed": qrow.try_get::<bool,_>("is_closed").unwrap_or(false),
        "is_pinned": qrow.try_get::<bool,_>("is_pinned").unwrap_or(false),
        "score": qrow.try_get::<i32,_>("score").unwrap_or(0),
        "views_count": qrow.try_get::<i32,_>("views_count").unwrap_or(0),
        "answers_count": qrow.try_get::<i32,_>("answers_count").unwrap_or(0),
        "created_at": qrow.get::<chrono::DateTime<chrono::Utc>,_>("created_at").to_rfc3339(),
        "updated_at": qrow.get::<chrono::DateTime<chrono::Utc>,_>("updated_at").to_rfc3339(),
        "has_best_answer": qrow.try_get::<bool,_>("has_best_answer").unwrap_or(false),
    });

    Json(serde_json::json!({
        "question": question,
        "tags": tags_json,
        "answers": answers,
        "user_vote": null
    }))
    .into_response()
}

#[derive(Deserialize)]
struct CreateQuestionRequest {
    title: String,
    body: String,
    tags: Option<Vec<String>>,
    mission_id: Option<String>,
    sondage_id: Option<String>,
    maille_id: Option<String>,
}

async fn create_question(
    State(state): State<AppState>,
    Json(req): Json<CreateQuestionRequest>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let author_id: Option<sqlx::types::Uuid> = sqlx::query_scalar(
        "SELECT id FROM atlas.users ORDER BY created_at ASC LIMIT 1",
    )
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();
    let Some(author_id) = author_id else {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error":"no user available"})),
        )
            .into_response();
    };

    let mission_id = req
        .mission_id
        .as_deref()
        .and_then(|s| sqlx::types::Uuid::parse_str(s).ok());
    let sondage_id = req
        .sondage_id
        .as_deref()
        .and_then(|s| sqlx::types::Uuid::parse_str(s).ok());
    let maille_id = req
        .maille_id
        .as_deref()
        .and_then(|s| sqlx::types::Uuid::parse_str(s).ok());

    let row = sqlx::query(
        r#"
        INSERT INTO atlas.colab_questions(title, body, author_id, mission_id, sondage_id, maille_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
    )
    .bind(req.title)
    .bind(req.body)
    .bind(author_id)
    .bind(mission_id)
    .bind(sondage_id)
    .bind(maille_id)
    .fetch_one(&state.pool)
    .await;

    let row = match row {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab create_question");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let qid = row.get::<sqlx::types::Uuid, _>("id");
    if let Some(tags) = req.tags {
        for t in tags.into_iter().filter(|s| !s.trim().is_empty()) {
            // Attach existing tags by slug or name; no auto-create to avoid debt.
            let tag_row = sqlx::query(
                r#"SELECT id FROM atlas.colab_tags WHERE slug = $1 OR name = $2 LIMIT 1"#,
            )
            .bind(t.to_lowercase())
            .bind(&t)
            .fetch_optional(&state.pool)
            .await
            .ok()
            .flatten();
            if let Some(tr) = tag_row {
                let tid: sqlx::types::Uuid = tr.get("id");
                let _ = sqlx::query(
                    r#"INSERT INTO atlas.colab_question_tags(question_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING"#,
                )
                .bind(qid)
                .bind(tid)
                .execute(&state.pool)
                .await;
            }
        }
    }

    Json(serde_json::json!({"id": qid.to_string(), "message":"ok"})).into_response()
}

#[derive(Deserialize)]
struct VoteRequest {
    vote: i16,
}

async fn vote_question(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<VoteRequest>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let qid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };
    if req.vote != 1 && req.vote != -1 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error":"vote must be 1 or -1"})),
        )
            .into_response();
    }

    let user_id: Option<sqlx::types::Uuid> = sqlx::query_scalar(
        "SELECT id FROM atlas.users ORDER BY created_at ASC LIMIT 1",
    )
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();
    let Some(user_id) = user_id else {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error":"no user available"})),
        )
            .into_response();
    };

    let _ = sqlx::query(
        r#"INSERT INTO atlas.colab_votes(user_id, target_type, target_id, vote_value) VALUES ($1,'question',$2,$3)"#,
    )
    .bind(user_id)
    .bind(qid)
    .bind(req.vote)
    .execute(&state.pool)
    .await;

    let new_score: i32 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(vote_value),0)::int FROM atlas.colab_votes WHERE target_type='question' AND target_id=$1",
    )
    .bind(qid)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let _ = sqlx::query("UPDATE atlas.colab_questions SET score=$2 WHERE id=$1")
        .bind(qid)
        .bind(new_score)
        .execute(&state.pool)
        .await;

    Json(serde_json::json!({"new_score": new_score, "message":"ok"})).into_response()
}

async fn close_question(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }
    let qid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };

    let _ = sqlx::query(
        "UPDATE atlas.colab_questions SET is_closed=TRUE, closed_at=NOW() WHERE id=$1",
    )
    .bind(qid)
    .execute(&state.pool)
    .await;

    Json(serde_json::json!({"message":"ok"})).into_response()
}

#[derive(Deserialize)]
struct CreateAnswerRequest {
    body: String,
}

async fn create_answer(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<CreateAnswerRequest>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let qid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };

    let author_id: Option<sqlx::types::Uuid> = sqlx::query_scalar(
        "SELECT id FROM atlas.users ORDER BY created_at ASC LIMIT 1",
    )
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();
    let Some(author_id) = author_id else {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error":"no user available"})),
        )
            .into_response();
    };

    let row = sqlx::query(
        r#"INSERT INTO atlas.colab_answers(question_id, author_id, body) VALUES ($1,$2,$3) RETURNING id"#,
    )
    .bind(qid)
    .bind(author_id)
    .bind(req.body)
    .fetch_one(&state.pool)
    .await;

    match row {
        Ok(r) => {
            let aid: sqlx::types::Uuid = r.get("id");
            Json(serde_json::json!({"id": aid.to_string(), "message":"ok"})).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "colab create_answer");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response()
        }
    }
}

async fn vote_answer(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<VoteRequest>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }
    let aid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };
    if req.vote != 1 && req.vote != -1 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error":"vote must be 1 or -1"})),
        )
            .into_response();
    }
    let user_id: Option<sqlx::types::Uuid> = sqlx::query_scalar(
        "SELECT id FROM atlas.users ORDER BY created_at ASC LIMIT 1",
    )
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();
    let Some(user_id) = user_id else {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error":"no user available"})),
        )
            .into_response();
    };

    let _ = sqlx::query(
        r#"INSERT INTO atlas.colab_votes(user_id, target_type, target_id, vote_value) VALUES ($1,'answer',$2,$3)"#,
    )
    .bind(user_id)
    .bind(aid)
    .bind(req.vote)
    .execute(&state.pool)
    .await;

    let new_score: i32 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(vote_value),0)::int FROM atlas.colab_votes WHERE target_type='answer' AND target_id=$1",
    )
    .bind(aid)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let _ = sqlx::query("UPDATE atlas.colab_answers SET score=$2 WHERE id=$1")
        .bind(aid)
        .bind(new_score)
        .execute(&state.pool)
        .await;

    Json(serde_json::json!({"new_score": new_score, "message":"ok"})).into_response()
}

async fn mark_best_answer(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }
    let aid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };
    // Mark this answer best; unmark others of same question.
    let qid: Option<sqlx::types::Uuid> = sqlx::query_scalar(
        "SELECT question_id FROM atlas.colab_answers WHERE id=$1",
    )
    .bind(aid)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();
    let Some(qid) = qid else {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error":"not found"})),
        )
            .into_response();
    };
    let _ = sqlx::query("UPDATE atlas.colab_answers SET is_best=FALSE WHERE question_id=$1")
        .bind(qid)
        .execute(&state.pool)
        .await;
    let _ = sqlx::query("UPDATE atlas.colab_answers SET is_best=TRUE WHERE id=$1")
        .bind(aid)
        .execute(&state.pool)
        .await;
    Json(serde_json::json!({"message":"ok"})).into_response()
}

async fn list_tags(State(state): State<AppState>) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }
    let rows = sqlx::query(
        "SELECT id, name, slug, description, color, usage_count FROM atlas.colab_tags ORDER BY usage_count DESC, name",
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();
    let tags: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "name": r.try_get::<String,_>("name").unwrap_or_default(),
                "slug": r.try_get::<String,_>("slug").unwrap_or_default(),
                "description": r.try_get::<String,_>("description").ok(),
                "color": r.try_get::<String,_>("color").unwrap_or_else(|_| "#6B7280".to_string()),
                "usage_count": r.try_get::<i32,_>("usage_count").unwrap_or(0)
            })
        })
        .collect();
    Json(serde_json::json!({"tags": tags})).into_response()
}

#[derive(Deserialize)]
struct LeaderboardQuery {
    limit: Option<i64>,
}

async fn get_leaderboard(
    State(state): State<AppState>,
    Query(q): Query<LeaderboardQuery>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }
    let limit = q.limit.unwrap_or(20).clamp(1, 100);
    let rows = sqlx::query(
        r#"
        SELECT user_id, username, reputation_points, questions_count, answers_count, best_answers_count, badges_count
        FROM atlas.v_colab_leaderboard
        ORDER BY reputation_points DESC NULLS LAST, questions_count DESC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let leaderboard: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "user_id": r.get::<sqlx::types::Uuid,_>("user_id").to_string(),
                "username": r.try_get::<String,_>("username").unwrap_or_default(),
                "questions_count": r.try_get::<i32,_>("questions_count").unwrap_or(0),
                "answers_count": r.try_get::<i32,_>("answers_count").unwrap_or(0),
                "best_answers_count": r.try_get::<i32,_>("best_answers_count").unwrap_or(0),
                "reputation_points": r.try_get::<i32,_>("reputation_points").unwrap_or(0),
                "badges_count": r.try_get::<i32,_>("badges_count").unwrap_or(0)
            })
        })
        .collect();

    Json(serde_json::json!({"leaderboard": leaderboard})).into_response()
}

async fn mobile_list_my_missions(State(state): State<AppState>) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    // Desktop mode: we don't have per-user auth. Return all missions for now.
    let rows = sqlx::query(
        r#"
        SELECT
            m.id,
            m.code,
            m.title,
            m.theme::text AS theme,
            m.status::text AS status,
            m.start_date,
            m.end_date,
            m.maille_id,
            COALESCE(ma.code, NULL) AS maille_label,
            m.commune,
            m.region,
            COALESCE(m.expected_sondages, 0) AS expected_sondages,
            (
                SELECT COUNT(*)::int
                FROM atlas.sondages s
                WHERE s.mission_id = m.id
                  AND s.deleted_at IS NULL
            ) AS completed_sondages
        FROM atlas.colab_missions m
        LEFT JOIN atlas.mailles ma ON ma.id = m.maille_id
        ORDER BY m.updated_at DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab mobile_list_my_missions");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let missions: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            let expected = r.try_get::<i32, _>("expected_sondages").unwrap_or(0);
            let completed = r.try_get::<i32, _>("completed_sondages").unwrap_or(0);
            let percent_done = if expected > 0 {
                ((completed as f64) * 100.0 / (expected as f64)).round() as i32
            } else {
                0
            };
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "code": r.try_get::<String,_>("code").unwrap_or_default(),
                "title": r.try_get::<String,_>("title").unwrap_or_default(),
                "theme": r.try_get::<String,_>("theme").unwrap_or_else(|_| "".to_string()),
                "status": r.try_get::<String,_>("status").unwrap_or_else(|_| "draft".to_string()),
                "start_date": r.try_get::<chrono::NaiveDate,_>("start_date").ok().map(|d| d.to_string()),
                "end_date": r.try_get::<chrono::NaiveDate,_>("end_date").ok().map(|d| d.to_string()),
                "maille_id": r.try_get::<sqlx::types::Uuid,_>("maille_id").ok().map(|u| u.to_string()),
                "maille_label": r.try_get::<String,_>("maille_label").ok(),
                "commune": r.try_get::<String,_>("commune").ok(),
                "region": r.try_get::<String,_>("region").ok(),
                "expected_sondages": expected,
                "completed_sondages": completed,
                "percent_done": percent_done,
            })
        })
        .collect();

    Json(serde_json::json!({"missions": missions, "count": missions.len()})).into_response()
}

async fn mobile_get_mission_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    // Reuse desktop mission detail shape, but mobile expects a subset.
    let mid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };

    let row = sqlx::query(
        r#"
        SELECT
            m.id,
            m.code,
            m.title,
            m.theme::text AS theme,
            m.status::text AS status,
            m.start_date,
            m.end_date,
            m.maille_id,
            COALESCE(ma.code, NULL) AS maille_label,
            m.commune,
            m.region,
            COALESCE(m.expected_sondages, 0) AS expected_sondages,
            m.supervisor_id
        FROM atlas.colab_missions m
        LEFT JOIN atlas.mailles ma ON ma.id = m.maille_id
        WHERE m.id = $1
        "#,
    )
    .bind(mid)
    .fetch_optional(&state.pool)
    .await;

    let row = match row {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error":"not found"})),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!(?e, "colab mobile_get_mission_detail");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let mission_id = row.get::<sqlx::types::Uuid, _>("id");
    let expected = row.try_get::<i32, _>("expected_sondages").unwrap_or(0);
    let completed: i32 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::int
        FROM atlas.sondages s
        WHERE s.mission_id = $1
          AND s.deleted_at IS NULL
        "#,
    )
    .bind(mission_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);
    let percent_done = if expected > 0 {
        ((completed as f64) * 100.0 / (expected as f64)).round() as i32
    } else {
        0
    };

    let supervisor_id: Option<sqlx::types::Uuid> = row.try_get("supervisor_id").ok();
    let supervisor = if let Some(sid) = supervisor_id {
        sqlx::query(
            r#"
            SELECT u.first_name, u.last_name, u.email
            FROM atlas.colab_supervisors s
            JOIN atlas.users u ON u.id = s.user_id
            WHERE s.id = $1
            "#,
        )
        .bind(sid)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten()
    } else {
        None
    };

    let (supervisor_name, supervisor_email) = match supervisor {
        Some(r) => {
            let first = r.try_get::<String, _>("first_name").ok();
            let last = r.try_get::<String, _>("last_name").ok();
            let email = r.try_get::<String, _>("email").ok();
            let name = match (first, last) {
                (Some(f), Some(l)) => Some(format!("{} {}", f, l).trim().to_string()),
                (Some(f), None) => Some(f),
                (None, Some(l)) => Some(l),
                _ => None,
            };
            (name, email)
        }
        None => (None, None),
    };

    let team_rows = sqlx::query(
        r#"
        SELECT
            u.id AS user_id,
            u.username,
            u.email,
            a.role
        FROM atlas.colab_mission_assignments a
        JOIN atlas.colab_students st ON st.id = a.student_id
        JOIN atlas.users u ON u.id = st.user_id
        WHERE a.mission_id = $1
          AND a.unassigned_at IS NULL
        ORDER BY u.username ASC
        "#,
    )
    .bind(mission_id)
    .fetch_all(&state.pool)
    .await;

    let team_rows = match team_rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab mobile_get_mission_detail team_members");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let team_members: Vec<serde_json::Value> = team_rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "user_id": r.get::<sqlx::types::Uuid,_>("user_id").to_string(),
                "username": r.try_get::<String,_>("username").unwrap_or_default(),
                "email": r.try_get::<String,_>("email").unwrap_or_default(),
                "role": r.try_get::<String,_>("role").unwrap_or_else(|_| "membre".to_string()),
            })
        })
        .collect();

    let sondage_rows = sqlx::query(
        r#"
        SELECT
            s.id,
            s.code AS code_sondage,
            CASE WHEN s.geom IS NOT NULL THEN ST_X(ST_Transform(s.geom, 4326)) END AS longitude,
            CASE WHEN s.geom IS NOT NULL THEN ST_Y(ST_Transform(s.geom, 4326)) END AS latitude,
            NULL::double precision AS profondeur_atteinte,
            s.validation_status::text AS validation_status,
            s.created_at
        FROM atlas.sondages s
        WHERE s.mission_id = $1
          AND s.deleted_at IS NULL
        ORDER BY s.created_at DESC
        LIMIT 20
        "#,
    )
    .bind(mission_id)
    .fetch_all(&state.pool)
    .await;

    let sondage_rows = match sondage_rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab mobile_get_mission_detail recent_sondages");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let recent_sondages: Vec<serde_json::Value> = sondage_rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "code_sondage": r.try_get::<String,_>("code_sondage").ok(),
                "longitude": r.try_get::<f64,_>("longitude").ok(),
                "latitude": r.try_get::<f64,_>("latitude").ok(),
                "profondeur_atteinte": r.try_get::<f64,_>("profondeur_atteinte").ok(),
                "validation_status": r.try_get::<String,_>("validation_status").ok(),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>,_>("created_at").to_rfc3339(),
            })
        })
        .collect();

    let bbox_row = sqlx::query(
        r#"
        SELECT
            ST_XMin(e.ext)::double precision AS min_x,
            ST_YMin(e.ext)::double precision AS min_y,
            ST_XMax(e.ext)::double precision AS max_x,
            ST_YMax(e.ext)::double precision AS max_y,
            ST_X(ST_Centroid(e.ext))::double precision AS center_lon,
            ST_Y(ST_Centroid(e.ext))::double precision AS center_lat
        FROM (
            SELECT ST_Extent(ST_Transform(ma.geom, 4326)) AS ext
            FROM atlas.colab_missions m
            JOIN atlas.mailles ma ON ma.id = m.maille_id
            WHERE m.id = $1
        ) e
        "#,
    )
    .bind(mission_id)
    .fetch_optional(&state.pool)
    .await;

    let bbox = match bbox_row {
        Ok(Some(r)) => Some(serde_json::json!({
            "min_x": r.try_get::<f64,_>("min_x").ok().unwrap_or(0.0),
            "min_y": r.try_get::<f64,_>("min_y").ok().unwrap_or(0.0),
            "max_x": r.try_get::<f64,_>("max_x").ok().unwrap_or(0.0),
            "max_y": r.try_get::<f64,_>("max_y").ok().unwrap_or(0.0),
            "center_lon": r.try_get::<f64,_>("center_lon").ok().unwrap_or(0.0),
            "center_lat": r.try_get::<f64,_>("center_lat").ok().unwrap_or(0.0),
        })),
        Ok(None) => None,
        Err(e) => {
            tracing::error!(?e, "colab mobile_get_mission_detail bbox");
            None
        }
    };

    let mission = serde_json::json!({
        "id": mission_id.to_string(),
        "code": row.try_get::<String,_>("code").unwrap_or_default(),
        "title": row.try_get::<String,_>("title").unwrap_or_default(),
        "theme": row.try_get::<String,_>("theme").unwrap_or_else(|_| "".to_string()),
        "status": row.try_get::<String,_>("status").unwrap_or_else(|_| "draft".to_string()),
        "start_date": row.try_get::<chrono::NaiveDate,_>("start_date").ok().map(|d| d.to_string()),
        "end_date": row.try_get::<chrono::NaiveDate,_>("end_date").ok().map(|d| d.to_string()),
        "maille_id": row.try_get::<sqlx::types::Uuid,_>("maille_id").ok().map(|u| u.to_string()),
        "maille_label": row.try_get::<String,_>("maille_label").ok(),
        "commune": row.try_get::<String,_>("commune").ok(),
        "region": row.try_get::<String,_>("region").ok(),
        "expected_sondages": expected,
        "completed_sondages": completed,
        "percent_done": percent_done,
    });

    Json(serde_json::json!({
        "mission": mission,
        "supervisor_name": supervisor_name,
        "supervisor_email": supervisor_email,
        "team_members": team_members,
        "recent_sondages": recent_sondages,
        "bbox": bbox,
    }))
    .into_response()
}

async fn mobile_get_mission_map_context(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let mid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid id"})),
            )
                .into_response();
        }
    };

    let maille_row = sqlx::query(
        r#"
        SELECT
            m.maille_id,
            ST_AsGeoJSON(ST_Transform(ma.geom, 4326))::jsonb AS maille_geojson,
            ST_XMin(env)::double precision AS min_x,
            ST_YMin(env)::double precision AS min_y,
            ST_XMax(env)::double precision AS max_x,
            ST_YMax(env)::double precision AS max_y,
            ST_X(ST_Centroid(env))::double precision AS center_lon,
            ST_Y(ST_Centroid(env))::double precision AS center_lat
        FROM atlas.colab_missions m
        JOIN atlas.mailles ma ON ma.id = m.maille_id
        CROSS JOIN LATERAL (
            SELECT ST_Envelope(ST_Transform(ma.geom, 4326)) AS env
        ) e
        WHERE m.id = $1
        "#,
    )
    .bind(mid)
    .fetch_optional(&state.pool)
    .await;

    let (maille_geojson, bbox, center_lon, center_lat) = match maille_row {
        Ok(Some(r)) => {
            let maille_geojson: Option<serde_json::Value> = r.try_get("maille_geojson").ok();
            let bbox = Some(serde_json::json!({
                "min_x": r.try_get::<f64,_>("min_x").ok().unwrap_or(0.0),
                "min_y": r.try_get::<f64,_>("min_y").ok().unwrap_or(0.0),
                "max_x": r.try_get::<f64,_>("max_x").ok().unwrap_or(0.0),
                "max_y": r.try_get::<f64,_>("max_y").ok().unwrap_or(0.0),
                "center_lon": r.try_get::<f64,_>("center_lon").ok().unwrap_or(0.0),
                "center_lat": r.try_get::<f64,_>("center_lat").ok().unwrap_or(0.0),
            }));
            let center_lon = r.try_get::<f64, _>("center_lon").ok();
            let center_lat = r.try_get::<f64, _>("center_lat").ok();
            (maille_geojson, bbox, center_lon, center_lat)
        }
        Ok(None) => (None, None, None, None),
        Err(e) => {
            tracing::error!(?e, "colab mobile_get_mission_map_context");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let sondage_rows = sqlx::query(
        r#"
        SELECT
            s.id,
            s.code,
            ST_X(ST_Transform(s.geom, 4326))::double precision AS longitude,
            ST_Y(ST_Transform(s.geom, 4326))::double precision AS latitude,
            s.validation_status::text AS status
        FROM atlas.sondages s
        WHERE s.mission_id = $1
          AND s.deleted_at IS NULL
          AND s.geom IS NOT NULL
        ORDER BY s.created_at DESC
        LIMIT 500
        "#,
    )
    .bind(mid)
    .fetch_all(&state.pool)
    .await;

    let sondage_rows = match sondage_rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(?e, "colab mobile_get_mission_map_context sondages");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response();
        }
    };

    let existing_sondages: Vec<serde_json::Value> = sondage_rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<sqlx::types::Uuid,_>("id").to_string(),
                "code": r.try_get::<String,_>("code").ok(),
                "longitude": r.try_get::<f64,_>("longitude").unwrap_or(0.0),
                "latitude": r.try_get::<f64,_>("latitude").unwrap_or(0.0),
                "status": r.try_get::<String,_>("status").ok(),
            })
        })
        .collect();

    Json(serde_json::json!({
        "mission_id": mid.to_string(),
        "maille_geojson": maille_geojson,
        "center_lon": center_lon,
        "center_lat": center_lat,
        "bbox": bbox,
        "existing_sondages": existing_sondages,
    }))
    .into_response()
}

#[derive(Deserialize)]
struct CreateFieldSondageRequest {
    longitude: f64,
    latitude: f64,
    location_accuracy_m: Option<f32>,
    depth_m: Option<f32>,
    profile_description: Option<String>,
    layers_count: Option<i32>,
    notes: Option<String>,
    photo_ids: Option<Vec<String>>,
}

async fn mobile_create_field_sondage(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<CreateFieldSondageRequest>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let mid = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid mission id"})),
            )
                .into_response();
        }
    };

    let user_id: Option<sqlx::types::Uuid> = sqlx::query_scalar(
        "SELECT id FROM atlas.users ORDER BY created_at ASC LIMIT 1",
    )
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    let Some(user_id) = user_id else {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error":"no user available"})),
        )
            .into_response();
    };

    let code: String = sqlx::query_scalar(
        "SELECT CONCAT('MOB-', REPLACE(gen_random_uuid()::text,'-',''))",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or_else(|_| "MOB".to_string());

    let meta = serde_json::json!({
        "profile_description": req.profile_description,
        "layers_count": req.layers_count,
        "photo_ids": req.photo_ids,
    });

    let row = sqlx::query(
        r#"
        INSERT INTO atlas.sondages(
            id,
            code,
            mission_id,
            geom,
            created_at,
            updated_at,
            notes,
            location_mode,
            location_accuracy_m,
            meta
        )
        VALUES(
            gen_random_uuid(),
            $1,
            $2,
            ST_SetSRID(ST_MakePoint($3,$4),4326),
            NOW(),
            NOW(),
            $5,
            'gps',
            $6,
            $7
        )
        RETURNING id
        "#,
    )
    .bind(code.clone())
    .bind(mid)
    .bind(req.longitude)
    .bind(req.latitude)
    .bind(req.notes)
    .bind(req.location_accuracy_m)
    .bind(meta)
    .fetch_one(&state.pool)
    .await;

    match row {
        Ok(r) => {
            let sid: sqlx::types::Uuid = r.get("id");
            // Link to mission_sondages for completeness when table exists.
            let _ = sqlx::query(
                r#"INSERT INTO atlas.colab_mission_sondages(mission_id, sondage_id, role, linked_by) VALUES ($1,$2,'principal',$3) ON CONFLICT DO NOTHING"#,
            )
            .bind(mid)
            .bind(sid)
            .bind(user_id)
            .execute(&state.pool)
            .await;

            Json(serde_json::json!({
                "id": sid.to_string(),
                "code_sondage": code,
                "message": "ok"
            }))
            .into_response()
        }
        Err(e) => {
            tracing::error!(?e, "colab mobile_create_field_sondage");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct SyncRequest {
    actions: Vec<SyncAction>,
}

#[derive(Deserialize)]
struct SyncAction {
    client_id: String,
    action_type: String,
    payload: serde_json::Value,
}

async fn mobile_sync(
    State(state): State<AppState>,
    Json(req): Json<SyncRequest>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let user_id: Option<sqlx::types::Uuid> = sqlx::query_scalar(
        "SELECT id FROM atlas.users ORDER BY created_at ASC LIMIT 1",
    )
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    let Some(user_id) = user_id else {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error":"no user available"})),
        )
            .into_response();
    };

    let allowed: HashSet<&'static str> = HashSet::from([
        "create_sondage",
        "update_sondage",
        "delete_sondage",
        "create_field_log",
        "update_field_log",
        "upload_photo",
        "update_position",
    ]);

    let mut results: Vec<serde_json::Value> = Vec::with_capacity(req.actions.len());
    let mut synced_count = 0usize;
    let mut failed_count = 0usize;

    for a in req.actions {
        if !allowed.contains(a.action_type.as_str()) {
            failed_count += 1;
            results.push(serde_json::json!({
                "client_id": a.client_id,
                "success": false,
                "server_id": null,
                "error": "invalid action_type"
            }));
            continue;
        }

        let res = sqlx::query(
            r#"
            INSERT INTO atlas.colab_sync_queue(user_id, action_type, client_id, payload, status)
            VALUES ($1, $2, $3, $4, 'pending')
            ON CONFLICT (user_id, client_id)
            DO UPDATE SET
                action_type = EXCLUDED.action_type,
                payload = EXCLUDED.payload,
                status = 'pending',
                error_message = NULL,
                retry_count = 0,
                processed_at = NULL,
                result = NULL
            "#,
        )
        .bind(user_id)
        .bind(a.action_type)
        .bind(a.client_id.clone())
        .bind(a.payload)
        .execute(&state.pool)
        .await;

        match res {
            Ok(_) => {
                synced_count += 1;
                results.push(serde_json::json!({
                    "client_id": a.client_id,
                    "success": true,
                    "server_id": null,
                    "error": null
                }));
            }
            Err(e) => {
                tracing::error!(?e, "colab mobile_sync enqueue");
                failed_count += 1;
                results.push(serde_json::json!({
                    "client_id": a.client_id,
                    "success": false,
                    "server_id": null,
                    "error": "db error"
                }));
            }
        }
    }

    Json(serde_json::json!({
        "results": results,
        "synced_count": synced_count,
        "failed_count": failed_count
    }))
    .into_response()
}

#[derive(Deserialize)]
struct CreateTrackRequest {
    mission_id: String,
    name: Option<String>,
}

async fn mobile_create_track(
    State(state): State<AppState>,
    Json(req): Json<CreateTrackRequest>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let mission_id = match sqlx::types::Uuid::parse_str(&req.mission_id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid mission_id"})),
            )
                .into_response();
        }
    };

    let user_id: Option<sqlx::types::Uuid> = sqlx::query_scalar(
        "SELECT id FROM atlas.users ORDER BY created_at ASC LIMIT 1",
    )
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();
    let Some(user_id) = user_id else {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error":"no user available"})),
        )
            .into_response();
    };

    let row = sqlx::query(
        r#"
        INSERT INTO atlas.colab_tracks(mission_id, user_id, name, started_at, is_active)
        VALUES ($1,$2,$3,NOW(),true)
        RETURNING id
        "#,
    )
    .bind(mission_id)
    .bind(user_id)
    .bind(req.name)
    .fetch_one(&state.pool)
    .await;

    match row {
        Ok(r) => {
            let tid: sqlx::types::Uuid = r.get("id");
            Json(serde_json::json!({"id": tid.to_string(), "message":"ok"})).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "colab mobile_create_track");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response()
        }
    }
}

#[derive(Deserialize)]
struct TrackPoint {
    longitude: f64,
    latitude: f64,
    altitude_m: Option<f32>,
    accuracy_m: Option<f32>,
    recorded_at: String,
}

#[derive(Deserialize)]
struct AddTrackPointsRequest {
    points: Vec<TrackPoint>,
}

async fn mobile_add_track_points(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<AddTrackPointsRequest>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    let track_id = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid track id"})),
            )
                .into_response();
        }
    };

    let max_seq: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(sequence_num), 0)::int FROM atlas.colab_track_points WHERE track_id=$1",
    )
    .bind(track_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let mut next_seq = max_seq + 1;
    let mut added = 0usize;
    for p in req.points {
        let recorded_at = match chrono::DateTime::parse_from_rfc3339(&p.recorded_at) {
            Ok(dt) => dt.with_timezone(&chrono::Utc),
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({"error":"invalid recorded_at"})),
                )
                    .into_response();
            }
        };

        let res = sqlx::query(
            r#"
            INSERT INTO atlas.colab_track_points(
                track_id, geom, altitude_m, accuracy_m, recorded_at, sequence_num
            )
            VALUES(
                $1,
                ST_SetSRID(ST_MakePoint($2,$3),4326),
                $4,
                $5,
                $6,
                $7
            )
            "#,
        )
        .bind(track_id)
        .bind(p.longitude)
        .bind(p.latitude)
        .bind(p.altitude_m)
        .bind(p.accuracy_m)
        .bind(recorded_at)
        .bind(next_seq)
        .execute(&state.pool)
        .await;

        match res {
            Ok(_) => {
                added += 1;
                next_seq += 1;
            }
            Err(e) => {
                tracing::error!(?e, "colab mobile_add_track_points");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error":"db error"})),
                )
                    .into_response();
            }
        }
    }

    let total_points: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM atlas.colab_track_points WHERE track_id=$1",
    )
    .bind(track_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    Json(serde_json::json!({"added": added, "total_points": total_points})).into_response()
}

async fn mobile_stop_track(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }
    let track_id = match sqlx::types::Uuid::parse_str(&id) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error":"invalid track id"})),
            )
                .into_response();
        }
    };
    let res = sqlx::query("UPDATE atlas.colab_tracks SET ended_at=NOW(), is_active=false WHERE id=$1")
        .bind(track_id)
        .execute(&state.pool)
        .await;

    match res {
        Ok(_) => Json(serde_json::json!({"message":"ok"})).into_response(),
        Err(e) => {
            tracing::error!(?e, "colab mobile_stop_track");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error":"db error"})),
            )
                .into_response()
        }
    }
}

async fn attributions_notifications_history() -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    Json(serde_json::json!({"items":[]})).into_response()
}

async fn notify_jobs() -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    Json(serde_json::json!({"jobs":[]})).into_response()
}
