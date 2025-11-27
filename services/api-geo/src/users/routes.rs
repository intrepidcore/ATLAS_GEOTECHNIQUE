// Routes CRUD pour les utilisateurs
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, patch, post, put},
    Json, Router,
};
use uuid::Uuid;
use validator::Validate;

use super::types::*;
use crate::auth::{
    error::AuthError,
    middleware::AuthUser,
    password::PasswordHasher,
    session::SessionManager,
    types::DbUser,
};
use crate::state::AppState;

/// Configure les routes de gestion des utilisateurs
pub fn users_routes() -> Router<AppState> {
    Router::new()
        .route("/users", get(list_users).post(create_user))
        .route("/users/stats", get(get_users_stats))
        .route(
            "/users/:id",
            get(get_user).put(update_user).delete(delete_user),
        )
        .route("/users/:id/roles", put(assign_roles).delete(remove_all_roles))
        .route("/users/:id/roles/:role_id", delete(remove_role))
        .route("/users/:id/activate", post(activate_user))
        .route("/users/:id/deactivate", post(deactivate_user))
        .route("/users/:id/unlock", post(unlock_user))
        .route("/users/:id/reset-password", post(admin_reset_password))
        .route("/users/:id/sessions", get(list_user_sessions).delete(revoke_user_sessions))
}

/// GET /users - Liste les utilisateurs avec pagination et filtres
async fn list_users(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Query(query): Query<ListUsersQuery>,
) -> Result<Json<UserListResponse>, AuthError> {
    // Vérifier la permission
    if !auth_user.has_permission("users.read") {
        return Err(AuthError::PermissionDenied("users.read requis".to_string()));
    }

    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let order_by = match query.order_by.as_deref() {
        Some("email") => "u.email",
        Some("username") => "u.username",
        Some("created_at") => "u.created_at",
        Some("last_login_at") => "u.last_login_at",
        _ => "u.created_at",
    };

    let order_dir = match query.order_dir.as_deref() {
        Some("asc") => "ASC",
        _ => "DESC",
    };

    // Construire la requête avec filtres
    let mut conditions = vec!["1=1".to_string()];
    let mut params: Vec<String> = vec![];

    if let Some(search) = &query.search {
        params.push(format!("%{}%", search.to_lowercase()));
        conditions.push(format!(
            "(LOWER(u.email) LIKE ${} OR LOWER(u.username) LIKE ${} OR LOWER(u.first_name) LIKE ${} OR LOWER(u.last_name) LIKE ${})",
            params.len(), params.len(), params.len(), params.len()
        ));
    }

    if let Some(is_active) = query.is_active {
        conditions.push(format!("u.is_active = {}", is_active));
    }

    let where_clause = conditions.join(" AND ");

    // Requête pour le total
    let count_sql = format!(
        r#"SELECT COUNT(*) FROM atlas.users u WHERE {}"#,
        where_clause
    );

    let total: i64 = if let Some(search) = &query.search {
        let pattern = format!("%{}%", search.to_lowercase());
        sqlx::query_scalar(&count_sql)
            .bind(&pattern)
            .fetch_one(&state.pool)
            .await?
    } else {
        sqlx::query_scalar(&count_sql)
            .fetch_one(&state.pool)
            .await?
    };

    // Requête principale avec rôles
    let sql = format!(
        r#"
        SELECT 
            u.id, u.email, u.username, u.first_name, u.last_name, u.avatar_url,
            u.is_active, u.is_verified, u.last_login_at, u.created_at, u.updated_at,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', r.id,
                        'name', r.name,
                        'assigned_at', ur.assigned_at,
                        'expires_at', ur.expires_at
                    )
                ) FILTER (WHERE r.id IS NOT NULL),
                '[]'::json
            ) as roles
        FROM atlas.users u
        LEFT JOIN atlas.user_roles ur ON u.id = ur.user_id AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        LEFT JOIN atlas.roles r ON ur.role_id = r.id
        WHERE {}
        GROUP BY u.id
        ORDER BY {} {}
        LIMIT {} OFFSET {}
        "#,
        where_clause, order_by, order_dir, per_page, offset
    );

    let users: Vec<DbUserWithRoles> = if let Some(search) = &query.search {
        let pattern = format!("%{}%", search.to_lowercase());
        sqlx::query_as(&sql)
            .bind(&pattern)
            .fetch_all(&state.pool)
            .await?
    } else {
        sqlx::query_as(&sql).fetch_all(&state.pool).await?
    };

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;

    Ok(Json(UserListResponse {
        users: users.into_iter().map(|u| u.into_response()).collect(),
        total,
        page,
        per_page,
        total_pages,
    }))
}

/// POST /users - Créer un nouvel utilisateur
async fn create_user(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(request): Json<CreateUserRequest>,
) -> Result<(StatusCode, Json<UserResponse>), AuthError> {
    // Vérifier la permission
    if !auth_user.has_permission("users.create") {
        return Err(AuthError::PermissionDenied("users.create requis".to_string()));
    }

    request.validate().map_err(|e| AuthError::ValidationError(e.to_string()))?;

    let password_hasher = PasswordHasher::new(state.auth_config.clone());

    // Valider le mot de passe
    password_hasher.validate_password_strength(&request.password)?;

    // Vérifier l'unicité de l'email
    let existing: Option<(Uuid,)> = sqlx::query_as(
        r#"SELECT id FROM atlas.users WHERE email = $1"#,
    )
    .bind(&request.email)
    .fetch_optional(&state.pool)
    .await?;

    if existing.is_some() {
        return Err(AuthError::EmailAlreadyExists);
    }

    // Vérifier l'unicité du username
    let existing: Option<(Uuid,)> = sqlx::query_as(
        r#"SELECT id FROM atlas.users WHERE username = $1"#,
    )
    .bind(&request.username)
    .fetch_optional(&state.pool)
    .await?;

    if existing.is_some() {
        return Err(AuthError::UsernameAlreadyExists);
    }

    // Hasher le mot de passe
    let password_hash = password_hasher.hash_password(&request.password)?;

    // Créer l'utilisateur
    let user_id = Uuid::new_v4();
    let now = chrono::Utc::now();

    sqlx::query(
        r#"
        INSERT INTO atlas.users (
            id, email, username, password_hash, first_name, last_name, avatar_url,
            is_active, is_verified, created_at, updated_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11)
        "#,
    )
    .bind(user_id)
    .bind(&request.email)
    .bind(&request.username)
    .bind(&password_hash)
    .bind(&request.first_name)
    .bind(&request.last_name)
    .bind(&request.avatar_url)
    .bind(request.is_active.unwrap_or(true))
    .bind(request.is_verified.unwrap_or(false))
    .bind(now)
    .bind(auth_user.id)
    .execute(&state.pool)
    .await?;

    // Assigner les rôles si fournis
    let mut roles = Vec::new();
    if let Some(role_ids) = request.roles {
        for role_id in role_ids {
            // Vérifier que le rôle existe
            let role: Option<(String, String)> = sqlx::query_as(
                r#"SELECT id, name FROM atlas.roles WHERE id = $1"#,
            )
            .bind(&role_id)
            .fetch_optional(&state.pool)
            .await?;

            if let Some((id, name)) = role {
                sqlx::query(
                    r#"
                    INSERT INTO atlas.user_roles (user_id, role_id, assigned_by)
                    VALUES ($1, $2, $3)
                    ON CONFLICT DO NOTHING
                    "#,
                )
                .bind(user_id)
                .bind(&id)
                .bind(auth_user.id)
                .execute(&state.pool)
                .await?;

                roles.push(RoleInfo {
                    id,
                    name,
                    assigned_at: Some(now),
                    expires_at: None,
                });
            }
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(UserResponse {
            id: user_id,
            email: request.email,
            username: request.username,
            first_name: request.first_name,
            last_name: request.last_name,
            avatar_url: request.avatar_url,
            is_active: request.is_active.unwrap_or(true),
            is_verified: request.is_verified.unwrap_or(false),
            last_login_at: None,
            created_at: now,
            updated_at: now,
            roles,
        }),
    ))
}

/// GET /users/:id - Récupérer un utilisateur
async fn get_user(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<Json<UserResponse>, AuthError> {
    // Peut voir son propre profil ou avoir la permission
    if user_id != auth_user.id && !auth_user.has_permission("users.read") {
        return Err(AuthError::PermissionDenied("users.read requis".to_string()));
    }

    let user: DbUserWithRoles = sqlx::query_as(
        r#"
        SELECT 
            u.id, u.email, u.username, u.first_name, u.last_name, u.avatar_url,
            u.is_active, u.is_verified, u.last_login_at, u.created_at, u.updated_at,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', r.id,
                        'name', r.name,
                        'assigned_at', ur.assigned_at,
                        'expires_at', ur.expires_at
                    )
                ) FILTER (WHERE r.id IS NOT NULL),
                '[]'::json
            ) as roles
        FROM atlas.users u
        LEFT JOIN atlas.user_roles ur ON u.id = ur.user_id AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        LEFT JOIN atlas.roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AuthError::UserNotFound)?;

    Ok(Json(user.into_response()))
}

/// PUT /users/:id - Mettre à jour un utilisateur
async fn update_user(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(user_id): Path<Uuid>,
    Json(request): Json<UpdateUserRequest>,
) -> Result<Json<UserResponse>, AuthError> {
    // Peut modifier son propre profil (limité) ou avoir la permission
    let is_self = user_id == auth_user.id;
    if !is_self && !auth_user.has_permission("users.update") {
        return Err(AuthError::PermissionDenied("users.update requis".to_string()));
    }

    request.validate().map_err(|e| AuthError::ValidationError(e.to_string()))?;

    // Vérifier que l'utilisateur existe
    let existing: Option<DbUser> = sqlx::query_as(
        r#"SELECT * FROM atlas.users WHERE id = $1"#,
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await?;

    if existing.is_none() {
        return Err(AuthError::UserNotFound);
    }

    // Vérifier l'unicité de l'email si modifié
    if let Some(email) = &request.email {
        let existing: Option<(Uuid,)> = sqlx::query_as(
            r#"SELECT id FROM atlas.users WHERE email = $1 AND id != $2"#,
        )
        .bind(email)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await?;

        if existing.is_some() {
            return Err(AuthError::EmailAlreadyExists);
        }
    }

    // Vérifier l'unicité du username si modifié
    if let Some(username) = &request.username {
        let existing: Option<(Uuid,)> = sqlx::query_as(
            r#"SELECT id FROM atlas.users WHERE username = $1 AND id != $2"#,
        )
        .bind(username)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await?;

        if existing.is_some() {
            return Err(AuthError::UsernameAlreadyExists);
        }
    }

    // Construire la mise à jour dynamique
    let mut updates = vec!["updated_at = NOW()".to_string()];
    let mut param_idx = 1;

    if request.email.is_some() {
        updates.push(format!("email = ${}", param_idx));
        param_idx += 1;
    }
    if request.username.is_some() {
        updates.push(format!("username = ${}", param_idx));
        param_idx += 1;
    }
    if request.first_name.is_some() {
        updates.push(format!("first_name = ${}", param_idx));
        param_idx += 1;
    }
    if request.last_name.is_some() {
        updates.push(format!("last_name = ${}", param_idx));
        param_idx += 1;
    }
    if request.avatar_url.is_some() {
        updates.push(format!("avatar_url = ${}", param_idx));
        param_idx += 1;
    }
    // Seuls les admins peuvent modifier is_active et is_verified
    if !is_self && auth_user.has_permission("users.manage") {
        if request.is_active.is_some() {
            updates.push(format!("is_active = ${}", param_idx));
            param_idx += 1;
        }
        if request.is_verified.is_some() {
            updates.push(format!("is_verified = ${}", param_idx));
            param_idx += 1;
        }
    }

    let sql = format!(
        "UPDATE atlas.users SET {} WHERE id = ${}",
        updates.join(", "),
        param_idx
    );

    // Exécuter la mise à jour
    let mut query = sqlx::query(&sql);
    
    if let Some(email) = &request.email {
        query = query.bind(email);
    }
    if let Some(username) = &request.username {
        query = query.bind(username);
    }
    if let Some(first_name) = &request.first_name {
        query = query.bind(first_name);
    }
    if let Some(last_name) = &request.last_name {
        query = query.bind(last_name);
    }
    if let Some(avatar_url) = &request.avatar_url {
        query = query.bind(avatar_url);
    }
    if !is_self && auth_user.has_permission("users.manage") {
        if let Some(is_active) = request.is_active {
            query = query.bind(is_active);
        }
        if let Some(is_verified) = request.is_verified {
            query = query.bind(is_verified);
        }
    }
    query = query.bind(user_id);

    query.execute(&state.pool).await?;

    // Récupérer l'utilisateur mis à jour
    let user: DbUserWithRoles = sqlx::query_as(
        r#"
        SELECT 
            u.id, u.email, u.username, u.first_name, u.last_name, u.avatar_url,
            u.is_active, u.is_verified, u.last_login_at, u.created_at, u.updated_at,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', r.id,
                        'name', r.name,
                        'assigned_at', ur.assigned_at,
                        'expires_at', ur.expires_at
                    )
                ) FILTER (WHERE r.id IS NOT NULL),
                '[]'::json
            ) as roles
        FROM atlas.users u
        LEFT JOIN atlas.user_roles ur ON u.id = ur.user_id AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        LEFT JOIN atlas.roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id
        "#,
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(user.into_response()))
}

/// DELETE /users/:id - Supprimer un utilisateur
async fn delete_user(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<StatusCode, AuthError> {
    if !auth_user.has_permission("users.delete") {
        return Err(AuthError::PermissionDenied("users.delete requis".to_string()));
    }

    // Ne pas permettre de se supprimer soi-même
    if user_id == auth_user.id {
        return Err(AuthError::ValidationError(
            "Impossible de supprimer votre propre compte".to_string(),
        ));
    }

    // Vérifier que l'utilisateur existe
    let existing: Option<(Uuid,)> = sqlx::query_as(
        r#"SELECT id FROM atlas.users WHERE id = $1"#,
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await?;

    if existing.is_none() {
        return Err(AuthError::UserNotFound);
    }

    // Supprimer l'utilisateur (cascade supprime les sessions et rôles)
    sqlx::query(r#"DELETE FROM atlas.users WHERE id = $1"#)
        .bind(user_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// PUT /users/:id/roles - Assigner des rôles à un utilisateur
async fn assign_roles(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(user_id): Path<Uuid>,
    Json(request): Json<AssignRolesRequest>,
) -> Result<Json<Vec<RoleInfo>>, AuthError> {
    if !auth_user.has_permission("roles.assign") {
        return Err(AuthError::PermissionDenied("roles.assign requis".to_string()));
    }

    // Vérifier que l'utilisateur existe
    let existing: Option<(Uuid,)> = sqlx::query_as(
        r#"SELECT id FROM atlas.users WHERE id = $1"#,
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await?;

    if existing.is_none() {
        return Err(AuthError::UserNotFound);
    }

    let now = chrono::Utc::now();
    let mut assigned_roles = Vec::new();

    for role_id in &request.roles {
        // Vérifier que le rôle existe
        let role: Option<(String, String)> = sqlx::query_as(
            r#"SELECT id, name FROM atlas.roles WHERE id = $1"#,
        )
        .bind(role_id)
        .fetch_optional(&state.pool)
        .await?;

        if let Some((id, name)) = role {
            sqlx::query(
                r#"
                INSERT INTO atlas.user_roles (user_id, role_id, assigned_by, expires_at)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, role_id) DO UPDATE SET expires_at = $4
                "#,
            )
            .bind(user_id)
            .bind(&id)
            .bind(auth_user.id)
            .bind(request.expires_at)
            .execute(&state.pool)
            .await?;

            assigned_roles.push(RoleInfo {
                id,
                name,
                assigned_at: Some(now),
                expires_at: request.expires_at,
            });
        }
    }

    Ok(Json(assigned_roles))
}

/// DELETE /users/:id/roles - Retirer tous les rôles d'un utilisateur
async fn remove_all_roles(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<StatusCode, AuthError> {
    if !auth_user.has_permission("roles.assign") {
        return Err(AuthError::PermissionDenied("roles.assign requis".to_string()));
    }

    sqlx::query(r#"DELETE FROM atlas.user_roles WHERE user_id = $1"#)
        .bind(user_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// DELETE /users/:id/roles/:role_id - Retirer un rôle spécifique
async fn remove_role(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((user_id, role_id)): Path<(Uuid, String)>,
) -> Result<StatusCode, AuthError> {
    if !auth_user.has_permission("roles.assign") {
        return Err(AuthError::PermissionDenied("roles.assign requis".to_string()));
    }

    sqlx::query(r#"DELETE FROM atlas.user_roles WHERE user_id = $1 AND role_id = $2"#)
        .bind(user_id)
        .bind(&role_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /users/:id/activate - Activer un utilisateur
async fn activate_user(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<StatusCode, AuthError> {
    if !auth_user.has_permission("users.manage") {
        return Err(AuthError::PermissionDenied("users.manage requis".to_string()));
    }

    sqlx::query(r#"UPDATE atlas.users SET is_active = TRUE, updated_at = NOW() WHERE id = $1"#)
        .bind(user_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /users/:id/deactivate - Désactiver un utilisateur
async fn deactivate_user(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<StatusCode, AuthError> {
    if !auth_user.has_permission("users.manage") {
        return Err(AuthError::PermissionDenied("users.manage requis".to_string()));
    }

    // Ne pas permettre de se désactiver soi-même
    if user_id == auth_user.id {
        return Err(AuthError::ValidationError(
            "Impossible de désactiver votre propre compte".to_string(),
        ));
    }

    sqlx::query(r#"UPDATE atlas.users SET is_active = FALSE, updated_at = NOW() WHERE id = $1"#)
        .bind(user_id)
        .execute(&state.pool)
        .await?;

    // Révoquer toutes les sessions
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());
    session_manager
        .revoke_all_sessions(user_id, "account_deactivated", None, None)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /users/:id/unlock - Déverrouiller un compte
async fn unlock_user(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<StatusCode, AuthError> {
    if !auth_user.has_permission("users.manage") {
        return Err(AuthError::PermissionDenied("users.manage requis".to_string()));
    }

    sqlx::query(
        r#"
        UPDATE atlas.users 
        SET locked_until = NULL, failed_login_attempts = 0, updated_at = NOW() 
        WHERE id = $1
        "#,
    )
    .bind(user_id)
    .execute(&state.pool)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /users/:id/reset-password - Réinitialiser le mot de passe (admin)
async fn admin_reset_password(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(user_id): Path<Uuid>,
    Json(request): Json<AdminResetPasswordRequest>,
) -> Result<StatusCode, AuthError> {
    if !auth_user.has_permission("users.manage") {
        return Err(AuthError::PermissionDenied("users.manage requis".to_string()));
    }

    request.validate().map_err(|e| AuthError::ValidationError(e.to_string()))?;

    let password_hasher = PasswordHasher::new(state.auth_config.clone());
    password_hasher.validate_password_strength(&request.new_password)?;

    let password_hash = password_hasher.hash_password(&request.new_password)?;

    sqlx::query(
        r#"
        UPDATE atlas.users 
        SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW()
        WHERE id = $2
        "#,
    )
    .bind(&password_hash)
    .bind(user_id)
    .execute(&state.pool)
    .await?;

    // Révoquer toutes les sessions
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());
    session_manager
        .revoke_all_sessions(user_id, "admin_password_reset", None, None)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// GET /users/:id/sessions - Lister les sessions d'un utilisateur
async fn list_user_sessions(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<crate::auth::types::SessionInfo>>, AuthError> {
    // Peut voir ses propres sessions ou avoir la permission
    if user_id != auth_user.id && !auth_user.has_permission("users.manage") {
        return Err(AuthError::PermissionDenied("users.manage requis".to_string()));
    }

    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());
    let current_session = if user_id == auth_user.id {
        Some(auth_user.session_id)
    } else {
        None
    };

    let sessions = session_manager.list_user_sessions(user_id, current_session).await?;

    Ok(Json(sessions))
}

/// DELETE /users/:id/sessions - Révoquer toutes les sessions d'un utilisateur
async fn revoke_user_sessions(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AuthError> {
    if !auth_user.has_permission("users.manage") {
        return Err(AuthError::PermissionDenied("users.manage requis".to_string()));
    }

    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());
    let count = session_manager
        .revoke_all_sessions(user_id, "admin_revoked", None, None)
        .await?;

    Ok(Json(serde_json::json!({
        "sessions_revoked": count
    })))
}

/// GET /users/stats - Statistiques des utilisateurs
async fn get_users_stats(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<UserStatsResponse>, AuthError> {
    if !auth_user.has_permission("users.read") {
        return Err(AuthError::PermissionDenied("users.read requis".to_string()));
    }

    let total_users: i64 = sqlx::query_scalar(r#"SELECT COUNT(*) FROM atlas.users"#)
        .fetch_one(&state.pool)
        .await?;

    let active_users: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM atlas.users WHERE is_active = TRUE"#,
    )
    .fetch_one(&state.pool)
    .await?;

    let verified_users: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM atlas.users WHERE is_verified = TRUE"#,
    )
    .fetch_one(&state.pool)
    .await?;

    let locked_accounts: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM atlas.users WHERE locked_until > NOW()"#,
    )
    .fetch_one(&state.pool)
    .await?;

    let recent_logins: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM atlas.users WHERE last_login_at > NOW() - INTERVAL '24 hours'"#,
    )
    .fetch_one(&state.pool)
    .await?;

    let users_by_role: Vec<(String, String, i64)> = sqlx::query_as(
        r#"
        SELECT r.id, r.name, COUNT(ur.user_id)::bigint as count
        FROM atlas.roles r
        LEFT JOIN atlas.user_roles ur ON r.id = ur.role_id
        GROUP BY r.id, r.name
        ORDER BY count DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(UserStatsResponse {
        total_users,
        active_users,
        verified_users,
        locked_accounts,
        recent_logins,
        users_by_role: users_by_role
            .into_iter()
            .map(|(id, name, count)| RoleCount {
                role_id: id,
                role_name: name,
                count,
            })
            .collect(),
    }))
}
