use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use crate::state::AppState;

#[derive(Serialize)]
pub struct AuditLogEntry {
    pub id: String,
    pub action: String,
    pub entity: String,
    pub entity_id: String,
    pub payload: Option<serde_json::Value>,
    pub created_at: String,
    pub user_id: Option<String>,
}

#[derive(Deserialize)]
pub struct AuditQuery {
    pub entity: Option<String>,
    pub entity_id: Option<String>,
    pub limit: Option<i64>,
}

/// GET /audit - Liste l'historique d'édition
pub async fn list_audit_logs(
    Query(q): Query<AuditQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let mut query = r#"
        SELECT 
            id::text,
            action,
            entity,
            entity_id::text,
            payload,
            created_at,
            user_id
        FROM audit_log
        WHERE 1=1
    "#.to_string();
    
    if let Some(entity) = &q.entity {
        query.push_str(&format!(" AND entity = '{}'", entity.replace("'", "''")));
    }
    
    if let Some(entity_id) = &q.entity_id {
        query.push_str(&format!(" AND entity_id::text = '{}'", entity_id.replace("'", "''")));
    }
    
    query.push_str(" ORDER BY created_at DESC");
    
    let limit = q.limit.unwrap_or(100).min(1000);
    query.push_str(&format!(" LIMIT {}", limit));
    
    let rows = sqlx::query(&query).fetch_all(pool).await;
    
    match rows {
        Ok(rows) => {
            let logs: Vec<AuditLogEntry> = rows.iter().map(|r| {
                let created: Option<time::OffsetDateTime> = r.try_get("created_at").ok();
                
                AuditLogEntry {
                    id: r.try_get("id").unwrap_or_default(),
                    action: r.try_get("action").unwrap_or_default(),
                    entity: r.try_get("entity").unwrap_or_default(),
                    entity_id: r.try_get("entity_id").unwrap_or_default(),
                    payload: r.try_get("payload").ok(),
                    created_at: created.map(|t| t.format(&time::format_description::well_known::Rfc3339).unwrap()).unwrap_or_default(),
                    user_id: r.try_get("user_id").ok(),
                }
            }).collect();
            
            Json(logs).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "list_audit_logs error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))).into_response()
        }
    }
}

/// GET /audit/export/csv - Export l'historique en CSV
pub async fn export_audit_csv(
    Query(q): Query<AuditQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let mut query = r#"
        SELECT 
            id::text,
            action,
            entity,
            entity_id::text,
            payload,
            created_at,
            user_id
        FROM audit_log
        WHERE 1=1
    "#.to_string();
    
    if let Some(entity) = &q.entity {
        query.push_str(&format!(" AND entity = '{}'", entity.replace("'", "''")));
    }
    
    if let Some(entity_id) = &q.entity_id {
        query.push_str(&format!(" AND entity_id::text = '{}'", entity_id.replace("'", "''")));
    }
    
    query.push_str(" ORDER BY created_at DESC");
    
    let limit = q.limit.unwrap_or(1000).min(10000);
    query.push_str(&format!(" LIMIT {}", limit));
    
    let rows = sqlx::query(&query).fetch_all(pool).await;
    
    match rows {
        Ok(rows) => {
            let mut csv = String::from("id,action,entity,entity_id,payload,created_at,user_id\n");
            
            for r in rows.iter() {
                let id: String = r.try_get("id").unwrap_or_default();
                let action: String = r.try_get("action").unwrap_or_default();
                let entity: String = r.try_get("entity").unwrap_or_default();
                let entity_id: String = r.try_get("entity_id").unwrap_or_default();
                let payload: Option<serde_json::Value> = r.try_get("payload").ok();
                let created: Option<time::OffsetDateTime> = r.try_get("created_at").ok();
                let user_id: Option<String> = r.try_get("user_id").ok();
                
                let payload_str = payload.map(|p| p.to_string().replace("\"", "\"\"")).unwrap_or_default();
                let created_str = created.map(|t| t.format(&time::format_description::well_known::Rfc3339).unwrap()).unwrap_or_default();
                let user_str = user_id.unwrap_or_default();
                
                csv.push_str(&format!(
                    "{},{},{},{},\"{}\",{},{}\n",
                    id, action, entity, entity_id, payload_str, created_str, user_str
                ));
            }
            
            (
                StatusCode::OK,
                [("Content-Type", "text/csv"), ("Content-Disposition", "attachment; filename=\"audit_log.csv\"")],
                csv
            ).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "export_audit_csv error");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))).into_response()
        }
    }
}
