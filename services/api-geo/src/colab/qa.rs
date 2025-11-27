//! API Q&A pour Atlas Colab
//! 
//! Gestion des questions, réponses, tags et gamification

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put, delete},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::state::AppState;

// ============================================================================
// Types DTOs
// ============================================================================

#[derive(Debug, Serialize, FromRow)]
pub struct Question {
    pub id: Uuid,
    pub title: String,
    pub body: String,
    pub author_id: Uuid,
    pub author_username: String,
    pub mission_id: Option<Uuid>,
    pub mission_title: Option<String>,
    pub is_closed: bool,
    pub is_pinned: bool,
    pub score: i32,
    pub views_count: i32,
    pub answers_count: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub has_best_answer: bool,
}

#[derive(Debug, Serialize, FromRow)]
pub struct QuestionListItem {
    pub id: Uuid,
    pub title: String,
    pub author_username: String,
    pub is_closed: bool,
    pub is_pinned: bool,
    pub score: i32,
    pub views_count: i32,
    pub answers_count: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub has_best_answer: bool,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Answer {
    pub id: Uuid,
    pub question_id: Uuid,
    pub body: String,
    pub author_id: Uuid,
    pub author_username: String,
    pub is_best: bool,
    pub is_accepted: bool,
    pub score: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub author_reputation: Option<i32>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Tag {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub color: String,
    pub usage_count: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateQuestionRequest {
    pub title: String,
    pub body: String,
    pub tags: Option<Vec<String>>,  // Tag slugs
    pub mission_id: Option<Uuid>,
    pub sondage_id: Option<Uuid>,
    pub maille_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateQuestionRequest {
    pub title: Option<String>,
    pub body: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAnswerRequest {
    pub body: String,
}

#[derive(Debug, Deserialize)]
pub struct VoteRequest {
    pub vote: i8,  // +1 ou -1
}

#[derive(Debug, Deserialize)]
pub struct QuestionsQuery {
    pub tag: Option<String>,
    pub mission_id: Option<Uuid>,
    pub search: Option<String>,
    pub is_closed: Option<bool>,
    pub has_best_answer: Option<bool>,
    pub sort: Option<String>,  // score, date, views
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct UserStats {
    pub user_id: Uuid,
    pub username: String,
    pub questions_count: i32,
    pub answers_count: i32,
    pub best_answers_count: i32,
    pub reputation_points: i32,
    pub badges_count: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Badge {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub category: Option<String>,
    pub points: i32,
}

// ============================================================================
// Handlers - Questions
// ============================================================================

/// GET /colab/questions - Liste des questions
pub async fn list_questions(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<QuestionsQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let limit = query.limit.unwrap_or(20).min(100);
    let offset = query.offset.unwrap_or(0);
    let sort = query.sort.as_deref().unwrap_or("date");

    let order_by = match sort {
        "score" => "q.score DESC, q.created_at DESC",
        "views" => "q.views_count DESC, q.created_at DESC",
        _ => "q.created_at DESC",
    };

    // Construction de la requête avec filtres
    let mut sql = format!(
        r#"
        SELECT 
            q.id,
            q.title,
            u.username AS author_username,
            q.is_closed,
            q.is_pinned,
            q.score,
            q.views_count,
            q.answers_count,
            q.created_at,
            EXISTS(SELECT 1 FROM atlas.colab_answers a WHERE a.question_id = q.id AND a.is_best = true) AS has_best_answer
        FROM atlas.colab_questions q
        JOIN atlas.users u ON q.author_id = u.id
        WHERE 1=1
        "#
    );

    if query.is_closed.is_some() {
        sql.push_str(" AND q.is_closed = $3");
    }

    if query.mission_id.is_some() {
        sql.push_str(" AND q.mission_id = $4");
    }

    if query.search.is_some() {
        sql.push_str(" AND (q.title ILIKE '%' || $5 || '%' OR q.body ILIKE '%' || $5 || '%')");
    }

    sql.push_str(&format!(" ORDER BY q.is_pinned DESC, {} LIMIT $1 OFFSET $2", order_by));

    let questions = sqlx::query_as::<_, QuestionListItem>(&sql)
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

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM atlas.colab_questions")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    Ok(Json(serde_json::json!({
        "questions": questions,
        "total": total,
        "page": offset / limit + 1,
        "per_page": limit
    })))
}

/// GET /colab/questions/:id - Détail d'une question
pub async fn get_question(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(question_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Incrémenter le compteur de vues
    sqlx::query("UPDATE atlas.colab_questions SET views_count = views_count + 1 WHERE id = $1")
        .bind(question_id)
        .execute(&state.pool)
        .await
        .ok();

    let question = sqlx::query_as::<_, Question>(
        r#"
        SELECT 
            q.id,
            q.title,
            q.body,
            q.author_id,
            u.username AS author_username,
            q.mission_id,
            m.title AS mission_title,
            q.is_closed,
            q.is_pinned,
            q.score,
            q.views_count,
            q.answers_count,
            q.created_at,
            q.updated_at,
            EXISTS(SELECT 1 FROM atlas.colab_answers a WHERE a.question_id = q.id AND a.is_best = true) AS has_best_answer
        FROM atlas.colab_questions q
        JOIN atlas.users u ON q.author_id = u.id
        LEFT JOIN atlas.colab_missions m ON q.mission_id = m.id
        WHERE q.id = $1
        "#,
    )
    .bind(question_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Question non trouvée" })),
        )
    })?;

    // Récupérer les tags
    let tags = sqlx::query_as::<_, Tag>(
        r#"
        SELECT t.id, t.name, t.slug, t.description, t.color, t.usage_count
        FROM atlas.colab_tags t
        JOIN atlas.colab_question_tags qt ON t.id = qt.tag_id
        WHERE qt.question_id = $1
        "#,
    )
    .bind(question_id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Récupérer les réponses
    let answers = sqlx::query_as::<_, Answer>(
        r#"
        SELECT 
            a.id,
            a.question_id,
            a.body,
            a.author_id,
            u.username AS author_username,
            a.is_best,
            a.is_accepted,
            a.score,
            a.created_at,
            a.updated_at,
            us.reputation_points AS author_reputation
        FROM atlas.colab_answers a
        JOIN atlas.users u ON a.author_id = u.id
        LEFT JOIN atlas.colab_user_stats us ON a.author_id = us.user_id
        WHERE a.question_id = $1
        ORDER BY a.is_best DESC, a.score DESC, a.created_at ASC
        "#,
    )
    .bind(question_id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Vérifier le vote de l'utilisateur
    let user_vote: Option<i16> = sqlx::query_scalar(
        "SELECT vote_value FROM atlas.colab_votes WHERE user_id = $1 AND target_type = 'question' AND target_id = $2",
    )
    .bind(auth.id)
    .bind(question_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    Ok(Json(serde_json::json!({
        "question": question,
        "tags": tags,
        "answers": answers,
        "user_vote": user_vote
    })))
}

/// POST /colab/questions - Créer une question
pub async fn create_question(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateQuestionRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let question_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_questions (title, body, author_id, mission_id, sondage_id, maille_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
    )
    .bind(&req.title)
    .bind(&req.body)
    .bind(auth.id)
    .bind(req.mission_id)
    .bind(req.sondage_id)
    .bind(req.maille_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Erreur création question: {}", e) })),
        )
    })?;

    // Ajouter les tags
    if let Some(tags) = &req.tags {
        for tag_slug in tags {
            sqlx::query(
                r#"
                INSERT INTO atlas.colab_question_tags (question_id, tag_id)
                SELECT $1, id FROM atlas.colab_tags WHERE slug = $2
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(question_id)
            .bind(tag_slug)
            .execute(&state.pool)
            .await
            .ok();
        }
    }

    // Mettre à jour les stats utilisateur
    update_user_stats(&state, auth.id, "question").await;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": question_id,
            "message": "Question créée"
        })),
    ))
}

/// PUT /colab/questions/:id - Modifier une question
pub async fn update_question(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(question_id): Path<Uuid>,
    Json(req): Json<UpdateQuestionRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Vérifier que l'utilisateur est l'auteur
    let author_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT author_id FROM atlas.colab_questions WHERE id = $1",
    )
    .bind(question_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    if author_id != Some(auth.id) && !auth.permissions.contains(&"colab.questions.delete".to_string()) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Non autorisé" })),
        ));
    }

    if let Some(title) = &req.title {
        sqlx::query("UPDATE atlas.colab_questions SET title = $1, updated_at = NOW() WHERE id = $2")
            .bind(title)
            .bind(question_id)
            .execute(&state.pool)
            .await
            .ok();
    }

    if let Some(body) = &req.body {
        sqlx::query("UPDATE atlas.colab_questions SET body = $1, updated_at = NOW() WHERE id = $2")
            .bind(body)
            .bind(question_id)
            .execute(&state.pool)
            .await
            .ok();
    }

    // Mettre à jour les tags si fournis
    if let Some(tags) = &req.tags {
        // Supprimer les anciens tags
        sqlx::query("DELETE FROM atlas.colab_question_tags WHERE question_id = $1")
            .bind(question_id)
            .execute(&state.pool)
            .await
            .ok();

        // Ajouter les nouveaux
        for tag_slug in tags {
            sqlx::query(
                r#"
                INSERT INTO atlas.colab_question_tags (question_id, tag_id)
                SELECT $1, id FROM atlas.colab_tags WHERE slug = $2
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(question_id)
            .bind(tag_slug)
            .execute(&state.pool)
            .await
            .ok();
        }
    }

    Ok(Json(serde_json::json!({ "message": "Question modifiée" })))
}

/// POST /colab/questions/:id/close - Fermer une question
pub async fn close_question(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(question_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    sqlx::query(
        "UPDATE atlas.colab_questions SET is_closed = true, closed_at = NOW(), closed_by = $1 WHERE id = $2",
    )
    .bind(auth.id)
    .bind(question_id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(serde_json::json!({ "message": "Question fermée" })))
}

// ============================================================================
// Handlers - Réponses
// ============================================================================

/// POST /colab/questions/:id/answers - Créer une réponse
pub async fn create_answer(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(question_id): Path<Uuid>,
    Json(req): Json<CreateAnswerRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let answer_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_answers (question_id, author_id, body)
        VALUES ($1, $2, $3)
        RETURNING id
        "#,
    )
    .bind(question_id)
    .bind(auth.id)
    .bind(&req.body)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Erreur création réponse: {}", e) })),
        )
    })?;

    // Mettre à jour les stats utilisateur
    update_user_stats(&state, auth.id, "answer").await;

    // Notifier l'auteur de la question
    let question_author: Option<Uuid> = sqlx::query_scalar(
        "SELECT author_id FROM atlas.colab_questions WHERE id = $1",
    )
    .bind(question_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    if let Some(author_id) = question_author {
        if author_id != auth.id {
            sqlx::query(
                r#"
                INSERT INTO atlas.colab_notifications (user_id, notification_type, title, message, payload)
                VALUES ($1, 'comment_entity', 'Nouvelle réponse à votre question', $2, $3)
                "#,
            )
            .bind(author_id)
            .bind(format!("{} a répondu à votre question", auth.username))
            .bind(serde_json::json!({
                "question_id": question_id,
                "answer_id": answer_id,
                "author_username": auth.username
            }))
            .execute(&state.pool)
            .await
            .ok();
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": answer_id,
            "message": "Réponse créée"
        })),
    ))
}

/// POST /colab/answers/:id/mark-best - Marquer comme meilleure réponse
pub async fn mark_best_answer(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(answer_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Récupérer la question et vérifier les droits
    let answer_info: Option<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT question_id, author_id FROM atlas.colab_answers WHERE id = $1",
    )
    .bind(answer_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    let (question_id, answer_author_id) = answer_info.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Réponse non trouvée" })),
        )
    })?;

    // Vérifier que l'utilisateur est l'auteur de la question ou superviseur
    let question_author: Option<Uuid> = sqlx::query_scalar(
        "SELECT author_id FROM atlas.colab_questions WHERE id = $1",
    )
    .bind(question_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    let is_supervisor = auth.permissions.contains(&"colab.answers.mark_best".to_string());
    
    if question_author != Some(auth.id) && !is_supervisor {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Seul l'auteur de la question ou un superviseur peut marquer la meilleure réponse" })),
        ));
    }

    // Retirer l'ancien "best" si existant
    sqlx::query("UPDATE atlas.colab_answers SET is_best = false WHERE question_id = $1")
        .bind(question_id)
        .execute(&state.pool)
        .await
        .ok();

    // Marquer la nouvelle meilleure réponse
    sqlx::query("UPDATE atlas.colab_answers SET is_best = true WHERE id = $1")
        .bind(answer_id)
        .execute(&state.pool)
        .await
        .ok();

    // Mettre à jour les stats de l'auteur de la réponse
    sqlx::query(
        r#"
        INSERT INTO atlas.colab_user_stats (user_id, best_answers_count, reputation_points)
        VALUES ($1, 1, 15)
        ON CONFLICT (user_id) DO UPDATE SET 
            best_answers_count = atlas.colab_user_stats.best_answers_count + 1,
            reputation_points = atlas.colab_user_stats.reputation_points + 15
        "#,
    )
    .bind(answer_author_id)
    .execute(&state.pool)
    .await
    .ok();

    // Vérifier et attribuer des badges
    check_and_award_badges(&state, answer_author_id).await;

    Ok(Json(serde_json::json!({ "message": "Meilleure réponse marquée" })))
}

/// POST /colab/answers/:id/vote - Voter sur une réponse
pub async fn vote_answer(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(answer_id): Path<Uuid>,
    Json(req): Json<VoteRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let vote_value = if req.vote > 0 { 1i16 } else { -1i16 };

    // Insérer ou mettre à jour le vote
    let result = sqlx::query(
        r#"
        INSERT INTO atlas.colab_votes (user_id, target_type, target_id, vote_value)
        VALUES ($1, 'answer', $2, $3)
        ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET vote_value = $3
        "#,
    )
    .bind(auth.id)
    .bind(answer_id)
    .bind(vote_value)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    // Recalculer le score
    let new_score: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(vote_value), 0) FROM atlas.colab_votes WHERE target_type = 'answer' AND target_id = $1",
    )
    .bind(answer_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    sqlx::query("UPDATE atlas.colab_answers SET score = $1 WHERE id = $2")
        .bind(new_score as i32)
        .execute(&state.pool)
        .await
        .ok();

    // Mettre à jour la réputation de l'auteur
    let author_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT author_id FROM atlas.colab_answers WHERE id = $1",
    )
    .bind(answer_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    if let Some(author_id) = author_id {
        let rep_change = if vote_value > 0 { 10 } else { -2 };
        sqlx::query(
            r#"
            INSERT INTO atlas.colab_user_stats (user_id, reputation_points)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET 
                reputation_points = GREATEST(0, atlas.colab_user_stats.reputation_points + $2)
            "#,
        )
        .bind(author_id)
        .bind(rep_change)
        .execute(&state.pool)
        .await
        .ok();
    }

    Ok(Json(serde_json::json!({
        "new_score": new_score,
        "message": "Vote enregistré"
    })))
}

/// POST /colab/questions/:id/vote - Voter sur une question
pub async fn vote_question(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(question_id): Path<Uuid>,
    Json(req): Json<VoteRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let vote_value = if req.vote > 0 { 1i16 } else { -1i16 };

    sqlx::query(
        r#"
        INSERT INTO atlas.colab_votes (user_id, target_type, target_id, vote_value)
        VALUES ($1, 'question', $2, $3)
        ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET vote_value = $3
        "#,
    )
    .bind(auth.id)
    .bind(question_id)
    .bind(vote_value)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    // Recalculer le score
    let new_score: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(vote_value), 0) FROM atlas.colab_votes WHERE target_type = 'question' AND target_id = $1",
    )
    .bind(question_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    sqlx::query("UPDATE atlas.colab_questions SET score = $1 WHERE id = $2")
        .bind(new_score as i32)
        .bind(question_id)
        .execute(&state.pool)
        .await
        .ok();

    Ok(Json(serde_json::json!({
        "new_score": new_score,
        "message": "Vote enregistré"
    })))
}

// ============================================================================
// Handlers - Tags
// ============================================================================

/// GET /colab/tags - Liste des tags
pub async fn list_tags(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let tags = sqlx::query_as::<_, Tag>(
        "SELECT id, name, slug, description, color, usage_count FROM atlas.colab_tags ORDER BY usage_count DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(serde_json::json!({ "tags": tags })))
}

// ============================================================================
// Handlers - Leaderboard & Stats
// ============================================================================

/// GET /colab/leaderboard - Classement des utilisateurs
pub async fn get_leaderboard(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<QuestionsQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let limit = query.limit.unwrap_or(20).min(100);

    let leaderboard = sqlx::query_as::<_, UserStats>(
        r#"
        SELECT 
            us.user_id,
            u.username,
            us.questions_count,
            us.answers_count,
            us.best_answers_count,
            us.reputation_points,
            (SELECT COUNT(*) FROM atlas.colab_user_badges ub WHERE ub.user_id = us.user_id) AS badges_count
        FROM atlas.colab_user_stats us
        JOIN atlas.users u ON us.user_id = u.id
        ORDER BY us.reputation_points DESC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(serde_json::json!({ "leaderboard": leaderboard })))
}

/// GET /colab/users/:id/stats - Stats d'un utilisateur
pub async fn get_user_stats(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let stats = sqlx::query_as::<_, UserStats>(
        r#"
        SELECT 
            us.user_id,
            u.username,
            us.questions_count,
            us.answers_count,
            us.best_answers_count,
            us.reputation_points,
            (SELECT COUNT(*) FROM atlas.colab_user_badges ub WHERE ub.user_id = us.user_id) AS badges_count
        FROM atlas.colab_user_stats us
        JOIN atlas.users u ON us.user_id = u.id
        WHERE us.user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    let badges = sqlx::query_as::<_, Badge>(
        r#"
        SELECT b.id, b.code, b.name, b.description, b.icon, b.category, b.points
        FROM atlas.colab_badges b
        JOIN atlas.colab_user_badges ub ON b.id = ub.badge_id
        WHERE ub.user_id = $1
        ORDER BY ub.earned_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Ok(Json(serde_json::json!({
        "stats": stats,
        "badges": badges
    })))
}

// ============================================================================
// Helpers
// ============================================================================

async fn update_user_stats(state: &AppState, user_id: Uuid, action: &str) {
    let (field, points) = match action {
        "question" => ("questions_count", 5),
        "answer" => ("answers_count", 10),
        _ => return,
    };

    sqlx::query(&format!(
        r#"
        INSERT INTO atlas.colab_user_stats (user_id, {}, reputation_points, last_active_at)
        VALUES ($1, 1, $2, NOW())
        ON CONFLICT (user_id) DO UPDATE SET 
            {} = atlas.colab_user_stats.{} + 1,
            reputation_points = atlas.colab_user_stats.reputation_points + $2,
            last_active_at = NOW()
        "#,
        field, field, field
    ))
    .bind(user_id)
    .bind(points)
    .execute(&state.pool)
    .await
    .ok();
}

async fn check_and_award_badges(state: &AppState, user_id: Uuid) {
    // Récupérer les stats de l'utilisateur
    let stats: Option<(i32, i32, i32, i32)> = sqlx::query_as(
        "SELECT questions_count, answers_count, best_answers_count, reputation_points FROM atlas.colab_user_stats WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    if let Some((questions, answers, best_answers, reputation)) = stats {
        // Vérifier chaque badge
        let badges_to_check = vec![
            ("first_question", "questions_count", questions),
            ("first_answer", "answers_count", answers),
            ("teacher", "best_answers_count", best_answers),
            ("expert", "best_answers_count", best_answers),
            ("helpful", "reputation_points", reputation),
            ("guru", "reputation_points", reputation),
            ("legend", "reputation_points", reputation),
        ];

        for (badge_code, condition_type, current_value) in badges_to_check {
            // Vérifier si le badge peut être attribué
            let badge_info: Option<(Uuid, i32)> = sqlx::query_as(
                "SELECT id, condition_value FROM atlas.colab_badges WHERE code = $1 AND condition_type = $2",
            )
            .bind(badge_code)
            .bind(condition_type)
            .fetch_optional(&state.pool)
            .await
            .ok()
            .flatten();

            if let Some((badge_id, threshold)) = badge_info {
                if current_value >= threshold {
                    // Attribuer le badge s'il n'est pas déjà attribué
                    sqlx::query(
                        "INSERT INTO atlas.colab_user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                    )
                    .bind(user_id)
                    .bind(badge_id)
                    .execute(&state.pool)
                    .await
                    .ok();
                }
            }
        }
    }
}

// ============================================================================
// Router
// ============================================================================

pub fn qa_routes() -> Router<AppState> {
    Router::new()
        // Questions
        .route("/questions", get(list_questions).post(create_question))
        .route("/questions/:id", get(get_question).put(update_question))
        .route("/questions/:id/close", post(close_question))
        .route("/questions/:id/vote", post(vote_question))
        .route("/questions/:id/answers", post(create_answer))
        // Réponses
        .route("/answers/:id/mark-best", post(mark_best_answer))
        .route("/answers/:id/vote", post(vote_answer))
        // Tags
        .route("/tags", get(list_tags))
        // Leaderboard & Stats
        .route("/leaderboard", get(get_leaderboard))
        .route("/users/:id/stats", get(get_user_stats))
}
