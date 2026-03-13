//! API Commentaires et Notifications pour Atlas Colab
//! 
//! Gestion des commentaires, mentions et notifications

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, delete},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use regex::Regex;

use crate::auth::middleware::AuthUser;
use crate::state::AppState;

// ============================================================================
// Types DTOs
// ============================================================================

#[derive(Debug, Serialize, FromRow)]
pub struct Comment {
    pub id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub content: String,
    pub parent_comment_id: Option<Uuid>,
    pub is_edited: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub author_id: Uuid,
    pub author_username: String,
    pub author_email: String,
    pub replies_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateCommentRequest {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub content: String,
    pub parent_comment_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCommentRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct CommentsQuery {
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub notification_type: String,
    pub title: String,
    pub message: Option<String>,
    pub payload: serde_json::Value,
    pub mission_id: Option<Uuid>,
    pub sondage_id: Option<Uuid>,
    pub comment_id: Option<Uuid>,
    pub is_read: bool,
    pub read_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct NotificationsResponse {
    pub notifications: Vec<Notification>,
    pub unread_count: i64,
    pub total: i64,
}

#[derive(Debug, Serialize, FromRow)]
struct NotificationWithCounts {
    pub id: Uuid,
    pub notification_type: String,
    pub title: String,
    pub message: Option<String>,
    pub payload: serde_json::Value,
    pub mission_id: Option<Uuid>,
    pub sondage_id: Option<Uuid>,
    pub comment_id: Option<Uuid>,
    pub is_read: bool,
    pub read_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub unread_count: i64,
    pub total: i64,
}

// ============================================================================
// Handlers - Commentaires
// ============================================================================

/// GET /colab/comments - Liste des commentaires
pub async fn list_comments(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<CommentsQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    let comments = if let (Some(entity_type), Some(entity_id)) = (&query.entity_type, &query.entity_id) {
        sqlx::query_as::<_, Comment>(
            r#"
            SELECT 
                c.id,
                c.entity_type::text,
                c.entity_id,
                c.content,
                c.parent_comment_id,
                c.is_edited,
                c.created_at,
                c.updated_at,
                c.author_id,
                u.username AS author_username,
                u.email AS author_email,
                (SELECT COUNT(*) FROM atlas.colab_comments r WHERE r.parent_comment_id = c.id) AS replies_count
            FROM atlas.colab_comments c
            JOIN atlas.users u ON c.author_id = u.id
            WHERE c.entity_type = $1::atlas.comment_entity_type 
              AND c.entity_id = $2
              AND c.parent_comment_id IS NULL
            ORDER BY c.created_at DESC
            LIMIT $3 OFFSET $4
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, Comment>(
            r#"
            SELECT 
                c.id,
                c.entity_type::text,
                c.entity_id,
                c.content,
                c.parent_comment_id,
                c.is_edited,
                c.created_at,
                c.updated_at,
                c.author_id,
                u.username AS author_username,
                u.email AS author_email,
                (SELECT COUNT(*) FROM atlas.colab_comments r WHERE r.parent_comment_id = c.id) AS replies_count
            FROM atlas.colab_comments c
            JOIN atlas.users u ON c.author_id = u.id
            WHERE c.parent_comment_id IS NULL
            ORDER BY c.created_at DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
    }
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(serde_json::json!({
        "comments": comments,
        "count": comments.len()
    })))
}

/// GET /colab/comments/:id/replies - Réponses à un commentaire
pub async fn get_comment_replies(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(comment_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let replies = sqlx::query_as::<_, Comment>(
        r#"
        SELECT 
            c.id,
            c.entity_type::text,
            c.entity_id,
            c.content,
            c.parent_comment_id,
            c.is_edited,
            c.created_at,
            c.updated_at,
            c.author_id,
            u.username AS author_username,
            u.email AS author_email,
            0::bigint AS replies_count
        FROM atlas.colab_comments c
        JOIN atlas.users u ON c.author_id = u.id
        WHERE c.parent_comment_id = $1
        ORDER BY c.created_at ASC
        "#,
    )
    .bind(comment_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(serde_json::json!({
        "replies": replies,
        "count": replies.len()
    })))
}

/// POST /colab/comments - Créer un commentaire
pub async fn create_comment(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateCommentRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Créer le commentaire
    let comment_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_comments (entity_type, entity_id, author_id, content, parent_comment_id)
        VALUES ($1::atlas.comment_entity_type, $2, $3, $4, $5)
        RETURNING id
        "#,
    )
    .bind(&req.entity_type)
    .bind(req.entity_id)
    .bind(auth.id)
    .bind(&req.content)
    .bind(req.parent_comment_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Erreur création commentaire: {}", e) })),
        )
    })?;

    // Extraire les mentions (@username)
    let mention_regex = Regex::new(r"@(\w+)").unwrap();
    let mentions: Vec<String> = mention_regex
        .captures_iter(&req.content)
        .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
        .collect();

    // Créer les mentions et notifications
    for username in &mentions {
        // Trouver l'utilisateur mentionné
        let mentioned_user: Option<(Uuid, String)> = sqlx::query_as(
            "SELECT id, email FROM atlas.users WHERE username = $1",
        )
        .bind(username)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten();

        if let Some((user_id, _email)) = mentioned_user {
            // Créer la mention
            sqlx::query(
                "INSERT INTO atlas.colab_comment_mentions (comment_id, mentioned_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(comment_id)
            .bind(user_id)
            .execute(&state.pool)
            .await
            .ok();

            // Créer la notification
            sqlx::query(
                r#"
                INSERT INTO atlas.colab_notifications (user_id, notification_type, title, message, comment_id, payload)
                VALUES ($1, 'comment_mention', 'Vous avez été mentionné', $2, $3, $4)
                "#,
            )
            .bind(user_id)
            .bind(format!("@{} vous a mentionné dans un commentaire", auth.username))
            .bind(comment_id)
            .bind(serde_json::json!({
                "entity_type": req.entity_type,
                "entity_id": req.entity_id,
                "author_username": auth.username
            }))
            .execute(&state.pool)
            .await
            .ok();
        }
    }

    // Si c'est une réponse, notifier l'auteur du commentaire parent
    if let Some(parent_id) = req.parent_comment_id {
        let parent_author: Option<Uuid> = sqlx::query_scalar(
            "SELECT author_id FROM atlas.colab_comments WHERE id = $1",
        )
        .bind(parent_id)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten();

        if let Some(parent_author_id) = parent_author {
            if parent_author_id != auth.id {
                sqlx::query(
                    r#"
                    INSERT INTO atlas.colab_notifications (user_id, notification_type, title, message, comment_id, payload)
                    VALUES ($1, 'comment_reply', 'Nouvelle réponse à votre commentaire', $2, $3, $4)
                    "#,
                )
                .bind(parent_author_id)
                .bind(format!("{} a répondu à votre commentaire", auth.username))
                .bind(comment_id)
                .bind(serde_json::json!({
                    "entity_type": req.entity_type,
                    "entity_id": req.entity_id,
                    "author_username": auth.username
                }))
                .execute(&state.pool)
                .await
                .ok();
            }
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": comment_id,
            "mentions_count": mentions.len(),
            "message": "Commentaire créé"
        })),
    ))
}

/// PUT /colab/comments/:id - Modifier un commentaire
pub async fn update_comment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(comment_id): Path<Uuid>,
    Json(req): Json<UpdateCommentRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query(
        r#"
        UPDATE atlas.colab_comments 
        SET content = $1, is_edited = true, updated_at = NOW()
        WHERE id = $2 AND author_id = $3
        "#,
    )
    .bind(&req.content)
    .bind(comment_id)
    .bind(auth.id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Commentaire non trouvé ou non autorisé" })),
        ));
    }

    Ok(Json(serde_json::json!({ "message": "Commentaire modifié" })))
}

/// DELETE /colab/comments/:id - Supprimer un commentaire
pub async fn delete_comment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(comment_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Vérifier si l'utilisateur est l'auteur ou admin
    let is_admin = auth.permissions.contains(&"colab.comments.moderate".to_string());
    
    let result = if is_admin {
        sqlx::query("DELETE FROM atlas.colab_comments WHERE id = $1")
            .bind(comment_id)
            .execute(&state.pool)
            .await
    } else {
        sqlx::query("DELETE FROM atlas.colab_comments WHERE id = $1 AND author_id = $2")
            .bind(comment_id)
            .bind(auth.id)
            .execute(&state.pool)
            .await
    }
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Commentaire non trouvé ou non autorisé" })),
        ));
    }

    Ok(Json(serde_json::json!({ "message": "Commentaire supprimé" })))
}

// ============================================================================
// Handlers - Notifications
// ============================================================================

/// GET /colab/notifications - Mes notifications
pub async fn list_notifications(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<CommentsQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    let rows = sqlx::query_as::<_, NotificationWithCounts>(
        r#"
        WITH base AS (
            SELECT
                id,
                notification_type::text AS notification_type,
                title,
                message,
                payload,
                mission_id,
                sondage_id,
                comment_id,
                is_read,
                read_at,
                created_at
            FROM atlas.colab_notifications
            WHERE user_id = $1
        )
        SELECT
            id,
            notification_type,
            title,
            message,
            payload,
            mission_id,
            sondage_id,
            comment_id,
            is_read,
            read_at,
            created_at,
            COALESCE(SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) OVER (), 0)::bigint AS unread_count,
            COALESCE(COUNT(*) OVER (), 0)::bigint AS total
        FROM base
        ORDER BY is_read ASC, created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(auth.id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    let unread_count = rows.first().map(|r| r.unread_count).unwrap_or(0);
    let total = rows.first().map(|r| r.total).unwrap_or(0);
    let notifications = rows
        .into_iter()
        .map(|r| Notification {
            id: r.id,
            notification_type: r.notification_type,
            title: r.title,
            message: r.message,
            payload: r.payload,
            mission_id: r.mission_id,
            sondage_id: r.sondage_id,
            comment_id: r.comment_id,
            is_read: r.is_read,
            read_at: r.read_at,
            created_at: r.created_at,
        })
        .collect();

    Ok(Json(NotificationsResponse {
        notifications,
        unread_count,
        total,
    }))
}

/// POST /colab/notifications/:id/read - Marquer comme lu
pub async fn mark_notification_read(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(notification_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    sqlx::query(
        r#"
        UPDATE atlas.colab_notifications 
        SET is_read = true, read_at = NOW()
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(notification_id)
    .bind(auth.id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(serde_json::json!({ "message": "Notification marquée comme lue" })))
}

/// POST /colab/notifications/read-all - Marquer toutes comme lues
pub async fn mark_all_notifications_read(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query(
        r#"
        UPDATE atlas.colab_notifications 
        SET is_read = true, read_at = NOW()
        WHERE user_id = $1 AND is_read = false
        "#,
    )
    .bind(auth.id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(serde_json::json!({
        "marked_count": result.rows_affected(),
        "message": "Toutes les notifications marquées comme lues"
    })))
}

// ============================================================================
// Router
// ============================================================================

pub fn comments_routes() -> Router<AppState> {
    Router::new()
        // Commentaires
        .route("/comments", get(list_comments).post(create_comment))
        .route("/comments/:id", delete(delete_comment))
        .route("/comments/:id/replies", get(get_comment_replies))
        // Notifications
        .route("/notifications", get(list_notifications))
        .route("/notifications/:id/read", post(mark_notification_read))
        .route("/notifications/read-all", post(mark_all_notifications_read))
}
