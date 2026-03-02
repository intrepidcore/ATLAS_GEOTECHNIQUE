use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Response,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
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
        .route("/missions", get(list_missions))
        .route("/missions/stats", get(missions_stats))
        .route("/supervisors", get(list_supervisors))
        .route("/students", get(list_students))
        .route("/students/duplicates", get(list_student_duplicates))
        .route("/attributions/summary", get(attributions_summary))
        .route("/attributions", get(attributions_list))
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

async fn list_notifications() -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    Json(serde_json::json!({"notifications":[],"unread_count":0})).into_response()
}

async fn mark_notification_read(Path(_id): Path<String>) -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    Json(serde_json::json!({"ok":true})).into_response()
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

async fn list_student_duplicates() -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    Json(serde_json::json!([])).into_response()
}

async fn attributions_summary() -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    Json(serde_json::json!({
        "total_missions":0,
        "total_assignments":0,
        "total_students":0,
        "missions_with_student":0,
        "pending_notifications":0
    }))
    .into_response()
}

async fn attributions_list() -> impl IntoResponse {
    if let Some(r) = gate_response() {
        return r;
    }

    Json(serde_json::json!({"items":[],"total":0})).into_response()
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
