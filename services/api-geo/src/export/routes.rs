use axum::{
    extract::{Path, State, Query},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Json},
    routing::{delete, get, post, put},
    Router,
};
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use tokio::fs;
use sqlx::Row;

use crate::AppState;
use crate::auth::AuthUser;
use crate::export::service::ExportService;
use crate::export::formats::{ExportRequest, ExportJobResponse};

#[derive(Deserialize)]
pub struct ExportHistoryQuery {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Serialize)]
struct ExportScheduleItem {
    id: Uuid,
    name: String,
    description: Option<String>,
    source: String,
    format: String,
    filters: serde_json::Value,
    template_id: Option<Uuid>,
    cron: String,
    timezone: String,
    next_run_at: Option<chrono::DateTime<chrono::Utc>>,
    last_run_at: Option<chrono::DateTime<chrono::Utc>>,
    destinations: serde_json::Value,
    is_active: bool,
    created_by: String,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
struct ExportSchedulesQuery {
    include_inactive: Option<bool>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct CreateExportScheduleRequest {
    name: String,
    description: Option<String>,
    source: String,
    format: String,
    filters: Option<serde_json::Value>,
    template_id: Option<Uuid>,
    cron: String,
    timezone: Option<String>,
    destinations: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct UpdateExportScheduleRequest {
    name: Option<String>,
    description: Option<String>,
    source: Option<String>,
    format: Option<String>,
    filters: Option<serde_json::Value>,
    template_id: Option<Uuid>,
    cron: Option<String>,
    timezone: Option<String>,
    destinations: Option<serde_json::Value>,
    is_active: Option<bool>,
}

async fn list_export_schedules(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ExportSchedulesQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let include_inactive = query.include_inactive.unwrap_or(false);
    let limit = query.limit.unwrap_or(50).max(1).min(200);

    let sql = if include_inactive {
        r#"
        SELECT
            id, name, description, source, format, filters, template_id,
            cron, timezone, next_run_at, last_run_at, destinations,
            is_active, created_by, created_at, updated_at
        FROM atlas.colab_export_schedules
        ORDER BY is_active DESC, created_at DESC
        LIMIT $1
        "#
    } else {
        r#"
        SELECT
            id, name, description, source, format, filters, template_id,
            cron, timezone, next_run_at, last_run_at, destinations,
            is_active, created_by, created_at, updated_at
        FROM atlas.colab_export_schedules
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT $1
        "#
    };

    let rows = sqlx::query(sql)
        .bind(limit)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Erreur BDD schedules: {}", e) })),
            )
        })?;

    let schedules: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<Uuid, _>("id"),
                "name": r.get::<String, _>("name"),
                "description": r.try_get::<String, _>("description").ok(),
                "source": r.get::<String, _>("source"),
                "format": r.get::<String, _>("format"),
                "filters": r.get::<serde_json::Value, _>("filters"),
                "template_id": r.try_get::<Uuid, _>("template_id").ok(),
                "cron": r.get::<String, _>("cron"),
                "timezone": r.get::<String, _>("timezone"),
                "next_run_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("next_run_at").ok(),
                "last_run_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("last_run_at").ok(),
                "destinations": r.get::<serde_json::Value, _>("destinations"),
                "is_active": r.get::<bool, _>("is_active"),
                "created_by": r.get::<String, _>("created_by"),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                "updated_at": r.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({ "schedules": schedules, "total": schedules.len() })))
}

async fn get_export_schedule(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ExportScheduleItem>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let row = sqlx::query(
        r#"
        SELECT
            id, name, description, source, format, filters, template_id,
            cron, timezone, next_run_at, last_run_at, destinations,
            is_active, created_by, created_at, updated_at
        FROM atlas.colab_export_schedules
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Erreur BDD schedule: {}", e) })),
        )
    })?;

    let Some(row) = row else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Schedule non trouvé" })),
        ));
    };

    Ok(Json(ExportScheduleItem {
        id: row.get("id"),
        name: row.get("name"),
        description: row.try_get("description").ok(),
        source: row.get("source"),
        format: row.get("format"),
        filters: row.get("filters"),
        template_id: row.try_get("template_id").ok(),
        cron: row.get("cron"),
        timezone: row.get("timezone"),
        next_run_at: row.try_get("next_run_at").ok(),
        last_run_at: row.try_get("last_run_at").ok(),
        destinations: row.get("destinations"),
        is_active: row.get("is_active"),
        created_by: row.get("created_by"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }))
}

async fn create_export_schedule(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateExportScheduleRequest>,
) -> Result<Json<ExportScheduleItem>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.schedule") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let filters = req.filters.unwrap_or_else(|| serde_json::json!({}));
    let destinations = req.destinations.unwrap_or_else(|| serde_json::json!([]));
    let timezone = req.timezone.unwrap_or_else(|| "UTC".to_string());

    let row = sqlx::query(
        r#"
        INSERT INTO atlas.colab_export_schedules (
            name, description, source, format, filters, template_id,
            cron, timezone, destinations,
            is_active, created_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, NOW(), NOW())
        RETURNING
            id, name, description, source, format, filters, template_id,
            cron, timezone, next_run_at, last_run_at, destinations,
            is_active, created_by, created_at, updated_at
        "#,
    )
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.source)
    .bind(&req.format)
    .bind(&filters)
    .bind(req.template_id)
    .bind(&req.cron)
    .bind(&timezone)
    .bind(&destinations)
    .bind(&auth.username)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": format!("Erreur création schedule: {}", e) })),
        )
    })?;

    Ok(Json(ExportScheduleItem {
        id: row.get("id"),
        name: row.get("name"),
        description: row.try_get("description").ok(),
        source: row.get("source"),
        format: row.get("format"),
        filters: row.get("filters"),
        template_id: row.try_get("template_id").ok(),
        cron: row.get("cron"),
        timezone: row.get("timezone"),
        next_run_at: row.try_get("next_run_at").ok(),
        last_run_at: row.try_get("last_run_at").ok(),
        destinations: row.get("destinations"),
        is_active: row.get("is_active"),
        created_by: row.get("created_by"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }))
}

async fn update_export_schedule(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateExportScheduleRequest>,
) -> Result<Json<ExportScheduleItem>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.schedule") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let row = sqlx::query(
        r#"
        UPDATE atlas.colab_export_schedules
        SET
            name = COALESCE($2, name),
            description = COALESCE($3, description),
            source = COALESCE($4, source),
            format = COALESCE($5, format),
            filters = COALESCE($6, filters),
            template_id = COALESCE($7, template_id),
            cron = COALESCE($8, cron),
            timezone = COALESCE($9, timezone),
            destinations = COALESCE($10, destinations),
            is_active = COALESCE($11, is_active),
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, name, description, source, format, filters, template_id,
            cron, timezone, next_run_at, last_run_at, destinations,
            is_active, created_by, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.source)
    .bind(&req.format)
    .bind(&req.filters)
    .bind(req.template_id)
    .bind(&req.cron)
    .bind(&req.timezone)
    .bind(&req.destinations)
    .bind(req.is_active)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": format!("Erreur update schedule: {}", e) })),
        )
    })?;

    let Some(row) = row else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Schedule non trouvé" })),
        ));
    };

    Ok(Json(ExportScheduleItem {
        id: row.get("id"),
        name: row.get("name"),
        description: row.try_get("description").ok(),
        source: row.get("source"),
        format: row.get("format"),
        filters: row.get("filters"),
        template_id: row.try_get("template_id").ok(),
        cron: row.get("cron"),
        timezone: row.get("timezone"),
        next_run_at: row.try_get("next_run_at").ok(),
        last_run_at: row.try_get("last_run_at").ok(),
        destinations: row.get("destinations"),
        is_active: row.get("is_active"),
        created_by: row.get("created_by"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }))
}

async fn deactivate_export_schedule(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.schedule") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let result = sqlx::query(
        r#"
        UPDATE atlas.colab_export_schedules
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Erreur désactivation schedule: {}", e) })),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Schedule non trouvé" })),
        ));
    }

    Ok(Json(serde_json::json!({ "success": true, "id": id })))
}

/// Routes pour les exports
pub fn export_routes() -> Router<AppState> {
    Router::new()
        .route("/colab/export", post(create_export))
        .route("/colab/export/jobs/:id", get(get_job_status))
        .route("/colab/export/download/:id", get(download_export))
        .route("/colab/export/history", get(get_export_history))
        .route("/colab/export/schedule", post(schedule_export)) // Phase 3 (alias)
        .route(
            "/colab/export/schedules",
            get(list_export_schedules).post(create_export_schedule),
        )
        .route(
            "/colab/export/schedules/:id",
            get(get_export_schedule).put(update_export_schedule).delete(deactivate_export_schedule),
        )
        .route(
            "/colab/export/templates",
            get(list_export_templates).post(create_export_template),
        )
        .route(
            "/colab/export/templates/:id",
            get(get_export_template).put(update_export_template).delete(deactivate_export_template),
        )
}

#[derive(Debug, Deserialize)]
struct ExportTemplatesQuery {
    include_inactive: Option<bool>,
    source: Option<String>,
    format: Option<String>,
}

#[derive(Debug, Serialize)]
struct ExportTemplateItem {
    id: Uuid,
    name: String,
    description: Option<String>,
    source: String,
    format: String,
    template_sql: Option<String>,
    template_handlebars: Option<String>,
    created_by: String,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
    is_active: bool,
}

#[derive(Debug, Deserialize)]
struct CreateExportTemplateRequest {
    name: String,
    description: Option<String>,
    source: String,
    format: String,
    template_sql: Option<String>,
    template_handlebars: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateExportTemplateRequest {
    name: Option<String>,
    description: Option<String>,
    source: Option<String>,
    format: Option<String>,
    template_sql: Option<String>,
    template_handlebars: Option<String>,
    is_active: Option<bool>,
}

async fn list_export_templates(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ExportTemplatesQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let include_inactive = query.include_inactive.unwrap_or(false);
    let mut conditions: Vec<String> = vec!["1=1".to_string()];
    if !include_inactive {
        conditions.push("is_active = true".to_string());
    }
    if let Some(source) = query.source {
        conditions.push(format!("source = '{}'", source.replace('\'', "''")));
    }
    if let Some(format_) = query.format {
        conditions.push(format!("format = '{}'", format_.replace('\'', "''")));
    }

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        r#"
        SELECT
            id, name, description, source, format, template_sql, template_handlebars,
            created_by, created_at, updated_at, is_active
        FROM atlas.colab_export_templates
        WHERE {}
        ORDER BY is_active DESC, name ASC
        "#,
        where_clause
    );

    let rows = sqlx::query(&sql)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Erreur BDD templates: {}", e) })),
            )
        })?;

    let templates: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<Uuid, _>("id"),
                "name": r.get::<String, _>("name"),
                "description": r.try_get::<String, _>("description").ok(),
                "source": r.get::<String, _>("source"),
                "format": r.get::<String, _>("format"),
                "template_sql": r.try_get::<String, _>("template_sql").ok(),
                "template_handlebars": r.try_get::<String, _>("template_handlebars").ok(),
                "created_by": r.get::<String, _>("created_by"),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                "updated_at": r.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
                "is_active": r.get::<bool, _>("is_active"),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({ "templates": templates, "total": templates.len() })))
}

async fn get_export_template(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ExportTemplateItem>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let row = sqlx::query(
        r#"
        SELECT
            id, name, description, source, format, template_sql, template_handlebars,
            created_by, created_at, updated_at, is_active
        FROM atlas.colab_export_templates
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Erreur BDD template: {}", e) })),
        )
    })?;

    let Some(row) = row else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Template non trouvé" })),
        ));
    };

    Ok(Json(ExportTemplateItem {
        id: row.get("id"),
        name: row.get("name"),
        description: row.try_get("description").ok(),
        source: row.get("source"),
        format: row.get("format"),
        template_sql: row.try_get("template_sql").ok(),
        template_handlebars: row.try_get("template_handlebars").ok(),
        created_by: row.get("created_by"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        is_active: row.get("is_active"),
    }))
}

async fn create_export_template(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateExportTemplateRequest>,
) -> Result<Json<ExportTemplateItem>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.admin") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let row = sqlx::query(
        r#"
        INSERT INTO atlas.colab_export_templates (
            name, description, source, format, template_sql, template_handlebars,
            created_by, created_at, updated_at, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), true)
        RETURNING
            id, name, description, source, format, template_sql, template_handlebars,
            created_by, created_at, updated_at, is_active
        "#,
    )
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.source)
    .bind(&req.format)
    .bind(&req.template_sql)
    .bind(&req.template_handlebars)
    .bind(&auth.username)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": format!("Erreur création template: {}", e) })),
        )
    })?;

    Ok(Json(ExportTemplateItem {
        id: row.get("id"),
        name: row.get("name"),
        description: row.try_get("description").ok(),
        source: row.get("source"),
        format: row.get("format"),
        template_sql: row.try_get("template_sql").ok(),
        template_handlebars: row.try_get("template_handlebars").ok(),
        created_by: row.get("created_by"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        is_active: row.get("is_active"),
    }))
}

async fn update_export_template(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateExportTemplateRequest>,
) -> Result<Json<ExportTemplateItem>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.admin") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let row = sqlx::query(
        r#"
        UPDATE atlas.colab_export_templates
        SET
            name = COALESCE($2, name),
            description = COALESCE($3, description),
            source = COALESCE($4, source),
            format = COALESCE($5, format),
            template_sql = COALESCE($6, template_sql),
            template_handlebars = COALESCE($7, template_handlebars),
            is_active = COALESCE($8, is_active),
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, name, description, source, format, template_sql, template_handlebars,
            created_by, created_at, updated_at, is_active
        "#,
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.source)
    .bind(&req.format)
    .bind(&req.template_sql)
    .bind(&req.template_handlebars)
    .bind(req.is_active)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": format!("Erreur update template: {}", e) })),
        )
    })?;

    let Some(row) = row else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Template non trouvé" })),
        ));
    };

    Ok(Json(ExportTemplateItem {
        id: row.get("id"),
        name: row.get("name"),
        description: row.try_get("description").ok(),
        source: row.get("source"),
        format: row.get("format"),
        template_sql: row.try_get("template_sql").ok(),
        template_handlebars: row.try_get("template_handlebars").ok(),
        created_by: row.get("created_by"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        is_active: row.get("is_active"),
    }))
}

async fn deactivate_export_template(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.admin") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let result = sqlx::query(
        r#"
        UPDATE atlas.colab_export_templates
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Erreur désactivation template: {}", e) })),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Template non trouvé" })),
        ));
    }

    Ok(Json(serde_json::json!({ "success": true, "id": id })))
}

/// POST /colab/export - Lancer un export
async fn create_export(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(request): Json<ExportRequest>,
) -> Result<Json<ExportJobResponse>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.create") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let service = ExportService::new(state.pool.clone());
    match service.create_export_job(request, auth).await {
        Ok(response) => Ok(Json(response)),
        Err((msg, code)) => Err((
            StatusCode::from_u16(code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            Json(serde_json::json!({ "error": msg })),
        )),
    }
}

/// GET /colab/export/jobs/:job_id - Statut d’un job
async fn get_job_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(job_id): Path<Uuid>,
) -> Result<Json<ExportJobResponse>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let service = ExportService::new(state.pool.clone());
    match service.get_job_status(job_id).await {
        Ok(Some(response)) => Ok(Json(response)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Job non trouvé" })),
        )),
        Err((msg, code)) => Err((
            StatusCode::from_u16(code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            Json(serde_json::json!({ "error": msg })),
        )),
    }
}

/// GET /colab/export/download/:job_id - Télécharger un fichier d’export
async fn download_export(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(job_id): Path<Uuid>,
) -> Result<axum::response::Response, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let service = ExportService::new(state.pool.clone());
    match service.get_job_status(job_id).await {
        Ok(Some(response)) => {
            if let Some(file_path) = response.file_path {
                // Résoudre les anciens chemins relatifs (ex: "exports/..."),
                // afin que le download ne retourne pas un JSON d'erreur.
                let resolved_path = {
                    let p = std::path::PathBuf::from(&file_path);
                    if p.is_absolute() {
                        p
                    } else {
                        let export_dir = std::env::var("EXPORT_DIR").unwrap_or_else(|_| "exports".to_string());
                        // Compat: si on a un ancien chemin préfixé par "exports/",
                        // on le rebase directement sur EXPORT_DIR.
                        let mut iter = p.components();
                        let first = iter.next();
                        let rebased = match first {
                            Some(std::path::Component::Normal(os)) if os == "exports" => iter.as_path().to_path_buf(),
                            _ => p,
                        };
                        std::path::PathBuf::from(export_dir).join(rebased)
                    }
                };

                // Lire le fichier
                let bytes = fs::read(&resolved_path).await.map_err(|e| {
                    (
                        StatusCode::NOT_FOUND,
                        Json(serde_json::json!({
                            "error": "Fichier non trouvé",
                            "details": e.to_string()
                        })),
                    )
                })?;

                // Content-Type basique par extension
                let resolved_str = resolved_path.to_string_lossy();
                let content_type = if resolved_str.ends_with(".csv") {
                    "text/csv"
                } else if resolved_str.ends_with(".json") {
                    "application/json"
                } else if resolved_str.ends_with(".xlsx") {
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                } else if resolved_str.ends_with(".pdf") {
                    "application/pdf"
                } else {
                    "application/octet-stream"
                };

                let filename = resolved_str
                    .split('/').last()
                    .or_else(|| resolved_str.split('\\').last())
                    .unwrap_or("export");

                // Audit log: downloaded
                // (best effort)
                let _ = sqlx::query(
                    r#"INSERT INTO atlas.colab_export_logs (job_id, action, actor, timestamp, details)
                       VALUES ($1, 'downloaded', $2, NOW(), $3)"#,
                )
                .bind(job_id)
                .bind(&auth.username)
                .bind(serde_json::json!({"file_path": resolved_str.to_string()}))
                .execute(&state.pool)
                .await;

                let mut headers = axum::http::HeaderMap::new();
                headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
                headers.insert(
                    header::CONTENT_DISPOSITION,
                    HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename))
                        .unwrap_or_else(|_| HeaderValue::from_static("attachment")),
                );

                Ok((headers, bytes).into_response())
            } else {
                Err((
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({ "error": "Fichier non disponible" })),
                ))
            }
        }
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Job non trouvé" })),
        )),
        Err((msg, code)) => Err((
            StatusCode::from_u16(code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            Json(serde_json::json!({ "error": msg })),
        )),
    }
}

/// GET /colab/export/history - Historique des exports
async fn get_export_history(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(_query): Query<ExportHistoryQuery>,
) -> Result<Json<Vec<ExportJobResponse>>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.export.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Permission refusée" })),
        ));
    }

    let service = ExportService::new(state.pool.clone());
    match service.get_export_history(auth).await {
        Ok(history) => Ok(Json(history)),
        Err((msg, code)) => Err((
            StatusCode::from_u16(code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            Json(serde_json::json!({ "error": msg })),
        )),
    }
}

/// POST /colab/export/schedule - Programmer un export récurrent (Phase 3)
async fn schedule_export(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateExportScheduleRequest>,
) -> Result<Json<ExportScheduleItem>, (StatusCode, Json<serde_json::Value>)> {
    create_export_schedule(State(state), auth, Json(req)).await
}
