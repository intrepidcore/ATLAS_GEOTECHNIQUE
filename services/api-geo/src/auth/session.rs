// Gestion des sessions utilisateur
use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::config::AuthConfig;
use super::error::AuthError;
use super::jwt::JwtManager;
use super::types::{AuthEventType, DbSession, DbUser, DeviceInfo, SessionInfo};

pub struct SessionManager {
    pool: PgPool,
    jwt_manager: JwtManager,
    config: AuthConfig,
}

impl SessionManager {
    pub fn new(pool: PgPool, config: AuthConfig) -> Self {
        let jwt_manager = JwtManager::new(config.clone());
        Self {
            pool,
            jwt_manager,
            config,
        }
    }

    /// Crée une nouvelle session pour un utilisateur
    pub async fn create_session(
        &self,
        user: &DbUser,
        roles: Vec<String>,
        permissions: Vec<String>,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
        device_info: Option<DeviceInfo>,
    ) -> Result<(String, String, Uuid), AuthError> {
        let session_id = Uuid::new_v4();
        let now = Utc::now();
        let access_expires = now + Duration::seconds(self.config.access_token_ttl.as_secs() as i64);
        let refresh_expires = now + Duration::seconds(self.config.refresh_token_ttl.as_secs() as i64);

        // Générer les tokens
        let access_token = self.jwt_manager.generate_access_token(
            user.id,
            &user.email,
            &user.username,
            roles,
            permissions,
            session_id,
        )?;

        let refresh_token = self.jwt_manager.generate_refresh_token();

        // Hasher les tokens pour stockage
        let access_token_hash = JwtManager::hash_token(&access_token);
        let refresh_token_hash = JwtManager::hash_token(&refresh_token);

        // Sérialiser device_info
        let device_info_json = device_info.map(|d| serde_json::to_value(d).ok()).flatten();

        // Insérer la session en base
        sqlx::query(
            r#"
            INSERT INTO atlas.sessions (
                id, user_id, token_hash, refresh_token_hash,
                user_agent, ip_address, device_info,
                is_active, expires_at, refresh_expires_at,
                created_at, last_activity_at
            ) VALUES ($1, $2, $3, $4, $5, $6::inet, $7, TRUE, $8, $9, $10, $10)
            "#,
        )
        .bind(session_id)
        .bind(user.id)
        .bind(&access_token_hash)
        .bind(&refresh_token_hash)
        .bind(user_agent)
        .bind(ip_address)
        .bind(&device_info_json)
        .bind(access_expires)
        .bind(refresh_expires)
        .bind(now)
        .execute(&self.pool)
        .await?;

        // Log l'événement
        self.log_auth_event(
            Some(user.id),
            AuthEventType::Login,
            true,
            ip_address,
            user_agent,
            Some(serde_json::json!({ "session_id": session_id })),
        )
        .await?;

        // Mettre à jour last_login de l'utilisateur
        sqlx::query(
            r#"
            UPDATE atlas.users 
            SET last_login_at = $1, last_login_ip = $2::inet, failed_login_attempts = 0
            WHERE id = $3
            "#,
        )
        .bind(now)
        .bind(ip_address)
        .bind(user.id)
        .execute(&self.pool)
        .await?;

        Ok((access_token, refresh_token, session_id))
    }

    /// Rafraîchit un access token avec un refresh token
    pub async fn refresh_session(
        &self,
        refresh_token: &str,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<(String, Uuid), AuthError> {
        let refresh_token_hash = JwtManager::hash_token(refresh_token);

        // Trouver la session
        let session: DbSession = sqlx::query_as(
            r#"
            SELECT s.* FROM atlas.sessions s
            WHERE s.refresh_token_hash = $1
            AND s.is_active = TRUE
            AND s.refresh_expires_at > NOW()
            "#,
        )
        .bind(&refresh_token_hash)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AuthError::InvalidRefreshToken)?;

        // Récupérer l'utilisateur
        let user: DbUser = sqlx::query_as(
            r#"SELECT * FROM atlas.users WHERE id = $1 AND is_active = TRUE"#,
        )
        .bind(session.user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AuthError::UserNotFound)?;

        // Récupérer les rôles et permissions actuels
        let roles = self.get_user_roles(user.id).await?;
        let permissions = self.get_user_permissions(user.id).await?;

        // Générer un nouveau access token
        let new_access_token = self.jwt_manager.generate_access_token(
            user.id,
            &user.email,
            &user.username,
            roles,
            permissions,
            session.id,
        )?;

        let new_access_token_hash = JwtManager::hash_token(&new_access_token);
        let new_expires = Utc::now() + Duration::seconds(self.config.access_token_ttl.as_secs() as i64);

        // Mettre à jour la session
        sqlx::query(
            r#"
            UPDATE atlas.sessions 
            SET token_hash = $1, expires_at = $2, last_activity_at = NOW()
            WHERE id = $3
            "#,
        )
        .bind(&new_access_token_hash)
        .bind(new_expires)
        .bind(session.id)
        .execute(&self.pool)
        .await?;

        // Log l'événement
        self.log_auth_event(
            Some(user.id),
            AuthEventType::TokenRefresh,
            true,
            ip_address,
            user_agent,
            Some(serde_json::json!({ "session_id": session.id })),
        )
        .await?;

        Ok((new_access_token, session.id))
    }

    /// Valide une session à partir du token hash
    pub async fn validate_session(&self, token_hash: &str) -> Result<DbSession, AuthError> {
        let session: DbSession = sqlx::query_as(
            r#"
            SELECT * FROM atlas.sessions
            WHERE token_hash = $1
            AND is_active = TRUE
            AND expires_at > NOW()
            "#,
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AuthError::SessionExpired)?;

        // Mettre à jour last_activity
        sqlx::query(
            r#"UPDATE atlas.sessions SET last_activity_at = NOW() WHERE id = $1"#,
        )
        .bind(session.id)
        .execute(&self.pool)
        .await?;

        Ok(session)
    }

    /// Révoque une session spécifique
    pub async fn revoke_session(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        reason: &str,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<(), AuthError> {
        let result = sqlx::query(
            r#"
            UPDATE atlas.sessions 
            SET is_active = FALSE, revoked_at = NOW(), revoked_reason = $1
            WHERE id = $2 AND user_id = $3
            "#,
        )
        .bind(reason)
        .bind(session_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AuthError::SessionExpired);
        }

        self.log_auth_event(
            Some(user_id),
            AuthEventType::SessionRevoked,
            true,
            ip_address,
            user_agent,
            Some(serde_json::json!({ "session_id": session_id, "reason": reason })),
        )
        .await?;

        Ok(())
    }

    /// Révoque toutes les sessions d'un utilisateur (logout global)
    pub async fn revoke_all_sessions(
        &self,
        user_id: Uuid,
        reason: &str,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<i64, AuthError> {
        let result = sqlx::query(
            r#"
            UPDATE atlas.sessions 
            SET is_active = FALSE, revoked_at = NOW(), revoked_reason = $1
            WHERE user_id = $2 AND is_active = TRUE
            "#,
        )
        .bind(reason)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        let count = result.rows_affected() as i64;

        self.log_auth_event(
            Some(user_id),
            AuthEventType::Logout,
            true,
            ip_address,
            user_agent,
            Some(serde_json::json!({ "sessions_revoked": count, "reason": reason })),
        )
        .await?;

        Ok(count)
    }

    /// Liste les sessions actives d'un utilisateur
    pub async fn list_user_sessions(
        &self,
        user_id: Uuid,
        current_session_id: Option<Uuid>,
    ) -> Result<Vec<SessionInfo>, AuthError> {
        let sessions: Vec<DbSession> = sqlx::query_as(
            r#"
            SELECT * FROM atlas.sessions
            WHERE user_id = $1 AND is_active = TRUE AND expires_at > NOW()
            ORDER BY last_activity_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(sessions
            .into_iter()
            .map(|s| SessionInfo {
                id: s.id,
                user_agent: s.user_agent,
                ip_address: s.ip_address,
                created_at: s.created_at,
                last_activity_at: s.last_activity_at,
                is_current: current_session_id.map(|id| id == s.id).unwrap_or(false),
            })
            .collect())
    }

    /// Nettoie les sessions expirées
    pub async fn cleanup_expired_sessions(&self) -> Result<i64, AuthError> {
        let result = sqlx::query(
            r#"
            UPDATE atlas.sessions 
            SET is_active = FALSE, revoked_at = NOW(), revoked_reason = 'expired'
            WHERE is_active = TRUE AND expires_at < NOW()
            "#,
        )
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() as i64)
    }

    /// Récupère les rôles d'un utilisateur
    pub async fn get_user_roles(&self, user_id: Uuid) -> Result<Vec<String>, AuthError> {
        let roles: Vec<(String,)> = sqlx::query_as(
            r#"
            SELECT r.id FROM atlas.roles r
            JOIN atlas.user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = $1
            AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(roles.into_iter().map(|(id,)| id).collect())
    }

    /// Récupère les permissions d'un utilisateur
    pub async fn get_user_permissions(&self, user_id: Uuid) -> Result<Vec<String>, AuthError> {
        let permissions: Vec<(String,)> = sqlx::query_as(
            r#"
            SELECT DISTINCT p.id FROM atlas.permissions p
            JOIN atlas.role_permissions rp ON p.id = rp.permission_id
            JOIN atlas.user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = $1
            AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(permissions.into_iter().map(|(id,)| id).collect())
    }

    /// Log un événement d'authentification
    pub async fn log_auth_event(
        &self,
        user_id: Option<Uuid>,
        event_type: AuthEventType,
        success: bool,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
        details: Option<serde_json::Value>,
    ) -> Result<Uuid, AuthError> {
        let id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO atlas.auth_audit_log 
            (id, user_id, event_type, success, ip_address, user_agent, details, created_at)
            VALUES ($1, $2, $3, $4, $5::inet, $6, $7, NOW())
            "#,
        )
        .bind(id)
        .bind(user_id)
        .bind(event_type.as_str())
        .bind(success)
        .bind(ip_address)
        .bind(user_agent)
        .bind(details)
        .execute(&self.pool)
        .await?;

        Ok(id)
    }

    pub fn jwt_manager(&self) -> &JwtManager {
        &self.jwt_manager
    }

    pub fn config(&self) -> &AuthConfig {
        &self.config
    }
}
