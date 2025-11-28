// Routes d'authentification
use axum::{
    extract::{ConnectInfo, State},
    http::{header::USER_AGENT, HeaderMap, StatusCode},
    routing::{delete, get, post},
    Json, Router,
};
use std::net::SocketAddr;
use uuid::Uuid;
use validator::Validate;

use super::error::AuthError;
use super::jwt::JwtManager;
use super::middleware::AuthUser;
use super::password::PasswordHasher;
use super::session::SessionManager;
use super::types::*;
use crate::state::AppState;

/// Configure les routes d'authentification
pub fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/auth/login", post(login))
        .route("/auth/logout", post(logout))
        .route("/auth/logout-all", post(logout_all))
        .route("/auth/refresh", post(refresh_token))
        .route("/auth/me", get(get_current_user))
        .route("/auth/sessions", get(list_sessions))
        .route("/auth/sessions/:session_id", delete(revoke_session))
        .route("/auth/change-password", post(change_password))
        .route("/auth/reset-password", post(request_password_reset))
        .route("/auth/reset-password/confirm", post(confirm_password_reset))
        .route("/auth/register/student", post(register_student))
}

/// Extrait l'adresse IP du client
fn extract_ip(headers: &HeaderMap, addr: Option<SocketAddr>) -> Option<String> {
    // Essayer X-Forwarded-For d'abord (pour les proxies)
    headers
        .get("X-Forwarded-For")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string())
        .or_else(|| {
            headers
                .get("X-Real-IP")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
        })
        .or_else(|| addr.map(|a| a.ip().to_string()))
}

/// Extrait le User-Agent
fn extract_user_agent(headers: &HeaderMap) -> Option<String> {
    headers
        .get(USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

/// POST /auth/login - Connexion utilisateur
async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    connect_info: Option<ConnectInfo<SocketAddr>>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AuthError> {
    // Valider la requête
    request.validate().map_err(|e| AuthError::ValidationError(e.to_string()))?;

    let addr = connect_info.map(|ci| ci.0);
    let ip = extract_ip(&headers, addr);
    let user_agent = extract_user_agent(&headers);
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());
    let password_hasher = PasswordHasher::new(state.auth_config.clone());

    // Chercher l'utilisateur par email
    let user: DbUser = sqlx::query_as(
        r#"SELECT * FROM atlas.users WHERE email = $1"#,
    )
    .bind(&request.email)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AuthError::InvalidCredentials)?;

    // Vérifier si le compte est verrouillé
    if let Some(locked_until) = user.locked_until {
        if locked_until > chrono::Utc::now() {
            session_manager
                .log_auth_event(
                    Some(user.id),
                    AuthEventType::LoginFailed,
                    false,
                    ip.as_deref(),
                    user_agent.as_deref(),
                    Some(serde_json::json!({ "reason": "account_locked" })),
                )
                .await?;
            return Err(AuthError::AccountLocked(locked_until.to_rfc3339()));
        }
    }

    // Vérifier si le compte est actif
    if !user.is_active {
        session_manager
            .log_auth_event(
                Some(user.id),
                AuthEventType::LoginFailed,
                false,
                ip.as_deref(),
                user_agent.as_deref(),
                Some(serde_json::json!({ "reason": "account_disabled" })),
            )
            .await?;
        return Err(AuthError::AccountDisabled);
    }

    // Vérifier le mot de passe
    let password_valid = password_hasher.verify_password(&request.password, &user.password_hash)?;
    
    if !password_valid {
        // Incrémenter le compteur d'échecs
        let new_attempts = user.failed_login_attempts + 1;
        let max_attempts = state.auth_config.max_login_attempts as i32;
        
        let locked_until = if new_attempts >= max_attempts {
            Some(chrono::Utc::now() + chrono::Duration::seconds(state.auth_config.lockout_duration.as_secs() as i64))
        } else {
            None
        };

        sqlx::query(
            r#"UPDATE atlas.users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3"#,
        )
        .bind(new_attempts)
        .bind(locked_until)
        .bind(user.id)
        .execute(&state.pool)
        .await?;

        session_manager
            .log_auth_event(
                Some(user.id),
                AuthEventType::LoginFailed,
                false,
                ip.as_deref(),
                user_agent.as_deref(),
                Some(serde_json::json!({ 
                    "reason": "invalid_password",
                    "attempts": new_attempts 
                })),
            )
            .await?;

        if locked_until.is_some() {
            session_manager
                .log_auth_event(
                    Some(user.id),
                    AuthEventType::AccountLocked,
                    true,
                    ip.as_deref(),
                    user_agent.as_deref(),
                    Some(serde_json::json!({ "locked_until": locked_until })),
                )
                .await?;
        }

        return Err(AuthError::InvalidCredentials);
    }

    // Récupérer les rôles et permissions
    let roles = session_manager.get_user_roles(user.id).await?;
    let permissions = session_manager.get_user_permissions(user.id).await?;

    // Créer la session
    let (access_token, refresh_token, session_id) = session_manager
        .create_session(
            &user,
            roles.clone(),
            permissions.clone(),
            ip.as_deref(),
            user_agent.as_deref(),
            request.device_info,
        )
        .await?;

    // Vérifier si le hash doit être mis à jour
    if password_hasher.needs_rehash(&user.password_hash) {
        if let Ok(new_hash) = password_hasher.hash_password(&request.password) {
            sqlx::query(r#"UPDATE atlas.users SET password_hash = $1 WHERE id = $2"#)
                .bind(&new_hash)
                .bind(user.id)
                .execute(&state.pool)
                .await
                .ok();
        }
    }

    Ok(Json(LoginResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: state.auth_config.access_token_ttl.as_secs() as i64,
        user: UserInfo {
            id: user.id,
            email: user.email,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            avatar_url: user.avatar_url,
            roles,
            permissions,
        },
    }))
}

/// POST /auth/logout - Déconnexion (révoque la session courante)
async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
    connect_info: Option<ConnectInfo<SocketAddr>>,
    auth_user: AuthUser,
) -> Result<StatusCode, AuthError> {
    let ip = extract_ip(&headers, connect_info.map(|ci| ci.0));
    let user_agent = extract_user_agent(&headers);
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());

    session_manager
        .revoke_session(
            auth_user.session_id,
            auth_user.id,
            "user_logout",
            ip.as_deref(),
            user_agent.as_deref(),
        )
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /auth/logout-all - Déconnexion de toutes les sessions
async fn logout_all(
    State(state): State<AppState>,
    headers: HeaderMap,
    connect_info: Option<ConnectInfo<SocketAddr>>,
    auth_user: AuthUser,
) -> Result<Json<serde_json::Value>, AuthError> {
    let ip = extract_ip(&headers, connect_info.map(|ci| ci.0));
    let user_agent = extract_user_agent(&headers);
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());

    let count = session_manager
        .revoke_all_sessions(
            auth_user.id,
            "user_logout_all",
            ip.as_deref(),
            user_agent.as_deref(),
        )
        .await?;

    Ok(Json(serde_json::json!({
        "sessions_revoked": count
    })))
}

/// POST /auth/refresh - Rafraîchir le token d'accès
async fn refresh_token(
    State(state): State<AppState>,
    headers: HeaderMap,
    connect_info: Option<ConnectInfo<SocketAddr>>,
    Json(request): Json<RefreshTokenRequest>,
) -> Result<Json<RefreshResponse>, AuthError> {
    let ip = extract_ip(&headers, connect_info.map(|ci| ci.0));
    let user_agent = extract_user_agent(&headers);
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());

    let (new_access_token, _session_id) = session_manager
        .refresh_session(&request.refresh_token, ip.as_deref(), user_agent.as_deref())
        .await?;

    Ok(Json(RefreshResponse {
        access_token: new_access_token,
        token_type: "Bearer".to_string(),
        expires_in: state.auth_config.access_token_ttl.as_secs() as i64,
    }))
}

/// GET /auth/me - Récupérer l'utilisateur courant
async fn get_current_user(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<UserInfo>, AuthError> {
    // Récupérer les infos fraîches depuis la base
    let user: DbUser = sqlx::query_as(
        r#"SELECT * FROM atlas.users WHERE id = $1"#,
    )
    .bind(auth_user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AuthError::UserNotFound)?;

    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());
    let roles = session_manager.get_user_roles(user.id).await?;
    let permissions = session_manager.get_user_permissions(user.id).await?;

    Ok(Json(UserInfo {
        id: user.id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
        roles,
        permissions,
    }))
}

/// GET /auth/sessions - Lister les sessions actives
async fn list_sessions(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<Vec<SessionInfo>>, AuthError> {
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());
    let sessions = session_manager
        .list_user_sessions(auth_user.id, Some(auth_user.session_id))
        .await?;

    Ok(Json(sessions))
}

/// DELETE /auth/sessions/:session_id - Révoquer une session spécifique
async fn revoke_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    connect_info: Option<ConnectInfo<SocketAddr>>,
    auth_user: AuthUser,
    axum::extract::Path(session_id): axum::extract::Path<Uuid>,
) -> Result<StatusCode, AuthError> {
    let ip = extract_ip(&headers, connect_info.map(|ci| ci.0));
    let user_agent = extract_user_agent(&headers);
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());

    session_manager
        .revoke_session(
            session_id,
            auth_user.id,
            "user_revoked",
            ip.as_deref(),
            user_agent.as_deref(),
        )
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /auth/change-password - Changer le mot de passe
async fn change_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    connect_info: Option<ConnectInfo<SocketAddr>>,
    auth_user: AuthUser,
    Json(request): Json<ChangePasswordRequest>,
) -> Result<StatusCode, AuthError> {
    request.validate().map_err(|e| AuthError::ValidationError(e.to_string()))?;

    let ip = extract_ip(&headers, connect_info.map(|ci| ci.0));
    let user_agent = extract_user_agent(&headers);
    let password_hasher = PasswordHasher::new(state.auth_config.clone());
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());

    // Récupérer l'utilisateur
    let user: DbUser = sqlx::query_as(
        r#"SELECT * FROM atlas.users WHERE id = $1"#,
    )
    .bind(auth_user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AuthError::UserNotFound)?;

    // Vérifier le cooldown
    if let Some(password_changed_at) = user.password_changed_at {
        let cooldown = chrono::Duration::seconds(state.auth_config.password_change_cooldown.as_secs() as i64);
        if chrono::Utc::now() - password_changed_at < cooldown {
            return Err(AuthError::PasswordChangeCooldown);
        }
    }

    // Vérifier l'ancien mot de passe
    if !password_hasher.verify_password(&request.current_password, &user.password_hash)? {
        session_manager
            .log_auth_event(
                Some(auth_user.id),
                AuthEventType::PasswordChange,
                false,
                ip.as_deref(),
                user_agent.as_deref(),
                Some(serde_json::json!({ "reason": "invalid_current_password" })),
            )
            .await?;
        return Err(AuthError::InvalidCredentials);
    }

    // Valider le nouveau mot de passe
    password_hasher.validate_password_strength(&request.new_password)?;

    // Hasher le nouveau mot de passe
    let new_hash = password_hasher.hash_password(&request.new_password)?;

    // Mettre à jour en base
    sqlx::query(
        r#"UPDATE atlas.users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2"#,
    )
    .bind(&new_hash)
    .bind(auth_user.id)
    .execute(&state.pool)
    .await?;

    // Révoquer toutes les autres sessions
    session_manager
        .revoke_all_sessions(
            auth_user.id,
            "password_changed",
            ip.as_deref(),
            user_agent.as_deref(),
        )
        .await?;

    session_manager
        .log_auth_event(
            Some(auth_user.id),
            AuthEventType::PasswordChange,
            true,
            ip.as_deref(),
            user_agent.as_deref(),
            None,
        )
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /auth/reset-password - Demander une réinitialisation de mot de passe
async fn request_password_reset(
    State(state): State<AppState>,
    headers: HeaderMap,
    connect_info: Option<ConnectInfo<SocketAddr>>,
    Json(request): Json<ResetPasswordRequest>,
) -> Result<Json<serde_json::Value>, AuthError> {
    request.validate().map_err(|e| AuthError::ValidationError(e.to_string()))?;

    let ip = extract_ip(&headers, connect_info.map(|ci| ci.0));
    let user_agent = extract_user_agent(&headers);
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());

    // Chercher l'utilisateur (ne pas révéler s'il existe ou non)
    let user: Option<DbUser> = sqlx::query_as(
        r#"SELECT * FROM atlas.users WHERE email = $1 AND is_active = TRUE"#,
    )
    .bind(&request.email)
    .fetch_optional(&state.pool)
    .await?;

    if let Some(user) = user {
        // Générer un token de reset
        let reset_token = JwtManager::new(state.auth_config.clone()).generate_refresh_token();
        let token_hash = JwtManager::hash_token(&reset_token);
        let expires_at = chrono::Utc::now() + chrono::Duration::hours(1);

        // Invalider les anciens tokens
        sqlx::query(
            r#"UPDATE atlas.password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL"#,
        )
        .bind(user.id)
        .execute(&state.pool)
        .await?;

        // Créer le nouveau token
        sqlx::query(
            r#"
            INSERT INTO atlas.password_reset_tokens (user_id, token_hash, expires_at, ip_address)
            VALUES ($1, $2, $3, $4::inet)
            "#,
        )
        .bind(user.id)
        .bind(&token_hash)
        .bind(expires_at)
        .bind(ip.as_deref())
        .execute(&state.pool)
        .await?;

        session_manager
            .log_auth_event(
                Some(user.id),
                AuthEventType::PasswordResetRequest,
                true,
                ip.as_deref(),
                user_agent.as_deref(),
                None,
            )
            .await?;

        // TODO: Envoyer l'email avec le token
        // Pour l'instant, on log le token (à retirer en production!)
        tracing::info!(
            "Password reset token for {}: {} (expires: {})",
            user.email,
            reset_token,
            expires_at
        );
    }

    // Toujours retourner succès pour ne pas révéler si l'email existe
    Ok(Json(serde_json::json!({
        "message": "Si cet email existe, un lien de réinitialisation a été envoyé"
    })))
}

/// POST /auth/reset-password/confirm - Confirmer la réinitialisation
async fn confirm_password_reset(
    State(state): State<AppState>,
    headers: HeaderMap,
    connect_info: Option<ConnectInfo<SocketAddr>>,
    Json(request): Json<ConfirmResetPasswordRequest>,
) -> Result<StatusCode, AuthError> {
    request.validate().map_err(|e| AuthError::ValidationError(e.to_string()))?;

    let ip = extract_ip(&headers, connect_info.map(|ci| ci.0));
    let user_agent = extract_user_agent(&headers);
    let password_hasher = PasswordHasher::new(state.auth_config.clone());
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());

    let token_hash = JwtManager::hash_token(&request.token);

    // Trouver le token
    let reset_token: DbPasswordResetToken = sqlx::query_as(
        r#"
        SELECT * FROM atlas.password_reset_tokens
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
        "#,
    )
    .bind(&token_hash)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AuthError::InvalidResetToken)?;

    // Valider le nouveau mot de passe
    password_hasher.validate_password_strength(&request.new_password)?;

    // Hasher le nouveau mot de passe
    let new_hash = password_hasher.hash_password(&request.new_password)?;

    // Mettre à jour le mot de passe
    sqlx::query(
        r#"
        UPDATE atlas.users 
        SET password_hash = $1, password_changed_at = NOW(), failed_login_attempts = 0, locked_until = NULL
        WHERE id = $2
        "#,
    )
    .bind(&new_hash)
    .bind(reset_token.user_id)
    .execute(&state.pool)
    .await?;

    // Marquer le token comme utilisé
    sqlx::query(
        r#"UPDATE atlas.password_reset_tokens SET used_at = NOW() WHERE id = $1"#,
    )
    .bind(reset_token.id)
    .execute(&state.pool)
    .await?;

    // Révoquer toutes les sessions
    session_manager
        .revoke_all_sessions(
            reset_token.user_id,
            "password_reset",
            ip.as_deref(),
            user_agent.as_deref(),
        )
        .await?;

    session_manager
        .log_auth_event(
            Some(reset_token.user_id),
            AuthEventType::PasswordResetComplete,
            true,
            ip.as_deref(),
            user_agent.as_deref(),
            None,
        )
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /auth/register/student - Inscription étudiant (self-service)
async fn register_student(
    State(state): State<AppState>,
    headers: HeaderMap,
    connect_info: Option<ConnectInfo<SocketAddr>>,
    Json(request): Json<RegisterStudentRequest>,
) -> Result<Json<serde_json::Value>, AuthError> {
    // Valider la requête
    request.validate().map_err(|e| AuthError::ValidationError(e.to_string()))?;
    request.student_info.validate().map_err(|e| AuthError::ValidationError(e.to_string()))?;

    let password_hasher = PasswordHasher::new(state.auth_config.clone());

    // Vérifier si l'email existe déjà
    let existing: Option<DbUser> = sqlx::query_as(
        r#"SELECT * FROM atlas.users WHERE email = $1"#,
    )
    .bind(&request.email)
    .fetch_optional(&state.pool)
    .await?;

    if existing.is_some() {
        return Err(AuthError::ValidationError("Un compte existe déjà avec cet email".to_string()));
    }

    // Générer le username à partir de l'email
    let username = request.email.split('@').next().unwrap_or(&request.email).to_string();

    // Hasher le mot de passe
    let password_hash = password_hasher.hash_password(&request.password)?;

    // Créer l'utilisateur dans une transaction
    let mut tx = state.pool.begin().await?;

    // Insérer l'utilisateur
    let user_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.users (email, username, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ($1, $2, $3, $4, $5, true, false)
        RETURNING id
        "#,
    )
    .bind(&request.email)
    .bind(&username)
    .bind(&password_hash)
    .bind(&request.first_name)
    .bind(&request.last_name)
    .fetch_one(&mut *tx)
    .await?;

    // Assigner le rôle "student"
    sqlx::query(
        r#"
        INSERT INTO atlas.user_roles (user_id, role_id)
        VALUES ($1, 'student')
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // Créer la fiche étudiant dans colab_students
    sqlx::query(
        r#"
        INSERT INTO atlas.colab_students (user_id, matricule, etablissement, filiere, niveau, telephone)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(user_id)
    .bind(&request.student_info.matricule)
    .bind(&request.student_info.school)
    .bind(&request.student_info.program)
    .bind(&request.student_info.level)
    .bind(&request.phone)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Logger l'événement
    let addr = connect_info.map(|ci| ci.0);
    let ip = extract_ip(&headers, addr);
    let user_agent = extract_user_agent(&headers);
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());

    session_manager
        .log_auth_event(
            Some(user_id),
            AuthEventType::Login,
            true,
            ip.as_deref(),
            user_agent.as_deref(),
            Some(serde_json::json!({ "type": "student_registration" })),
        )
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Compte créé avec succès. Vous pouvez maintenant vous connecter.",
        "user_id": user_id
    })))
}
