// Middlewares d'authentification et autorisation
use axum::{
    body::Body,
    extract::{Request, State},
    http::{header::AUTHORIZATION, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use std::sync::Arc;
use uuid::Uuid;

use super::error::AuthError;
use super::jwt::{Claims, JwtManager};
use super::session::SessionManager;
use crate::state::AppState;

/// Utilisateur authentifié extrait du JWT
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
    pub session_id: Uuid,
    pub claims: Claims,
}

impl AuthUser {
    pub fn from_claims(claims: Claims) -> Result<Self, AuthError> {
        Ok(Self {
            id: claims.user_id()?,
            email: claims.email.clone(),
            username: claims.username.clone(),
            roles: claims.roles.clone(),
            permissions: claims.permissions.clone(),
            session_id: claims.session_id()?,
            claims,
        })
    }

    pub fn has_permission(&self, permission: &str) -> bool {
        self.permissions.contains(&permission.to_string()) || self.is_admin()
    }

    pub fn has_any_permission(&self, permissions: &[&str]) -> bool {
        self.is_admin() || permissions.iter().any(|p| self.permissions.contains(&p.to_string()))
    }

    pub fn has_all_permissions(&self, permissions: &[&str]) -> bool {
        self.is_admin() || permissions.iter().all(|p| self.permissions.contains(&p.to_string()))
    }

    pub fn has_role(&self, role: &str) -> bool {
        self.roles.contains(&role.to_string())
    }

    pub fn is_admin(&self) -> bool {
        self.roles.contains(&"admin".to_string())
    }
}

/// Extension pour stocker l'utilisateur authentifié dans la requête
#[derive(Clone)]
pub struct AuthUserExtension(pub Option<AuthUser>);

/// Extrait le token Bearer du header Authorization
fn extract_bearer_token(req: &Request) -> Option<String> {
    req.headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| {
            if value.starts_with("Bearer ") {
                Some(value[7..].to_string())
            } else {
                None
            }
        })
}

/// Middleware d'authentification obligatoire
/// Rejette la requête si le token est absent ou invalide
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AuthError> {
    let token = extract_bearer_token(&req).ok_or(AuthError::MissingToken)?;

    // Valider le JWT
    let jwt_manager = JwtManager::new(state.auth_config.clone());
    let token_data = jwt_manager.validate_token(&token)?;
    let claims = token_data.claims;

    // Vérifier que la session est toujours active en base
    let token_hash = JwtManager::hash_token(&token);
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());
    let _session = session_manager.validate_session(&token_hash).await?;

    // Créer l'utilisateur authentifié
    let auth_user = AuthUser::from_claims(claims)?;

    // Ajouter l'utilisateur à la requête
    req.extensions_mut().insert(auth_user);

    Ok(next.run(req).await)
}

/// Middleware d'authentification optionnelle
/// Ajoute l'utilisateur si le token est présent et valide, sinon continue sans
pub async fn optional_auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Response {
    let auth_user = if let Some(token) = extract_bearer_token(&req) {
        let jwt_manager = JwtManager::new(state.auth_config.clone());
        match jwt_manager.validate_token(&token) {
            Ok(token_data) => {
                let token_hash = JwtManager::hash_token(&token);
                let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());
                
                match session_manager.validate_session(&token_hash).await {
                    Ok(_) => AuthUser::from_claims(token_data.claims).ok(),
                    Err(_) => None,
                }
            }
            Err(_) => None,
        }
    } else {
        None
    };

    if let Some(ref user) = auth_user {
        req.extensions_mut().insert(user.clone());
    }
    req.extensions_mut().insert(AuthUserExtension(auth_user));
    next.run(req).await
}

/// Middleware pour vérifier une permission spécifique
pub fn require_permission(permission: &'static str) -> impl Fn(Request, Next) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Response, AuthError>> + Send>> + Clone {
    move |req: Request, next: Next| {
        let permission = permission;
        Box::pin(async move {
            let auth_user = req
                .extensions()
                .get::<AuthUser>()
                .ok_or(AuthError::MissingToken)?;

            if !auth_user.has_permission(permission) {
                return Err(AuthError::PermissionDenied(format!(
                    "Permission requise: {}",
                    permission
                )));
            }

            Ok(next.run(req).await)
        })
    }
}

/// Middleware pour vérifier un rôle spécifique
pub fn require_role(role: &'static str) -> impl Fn(Request, Next) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Response, AuthError>> + Send>> + Clone {
    move |req: Request, next: Next| {
        let role = role;
        Box::pin(async move {
            let auth_user = req
                .extensions()
                .get::<AuthUser>()
                .ok_or(AuthError::MissingToken)?;

            if !auth_user.has_role(role) && !auth_user.is_admin() {
                return Err(AuthError::PermissionDenied(format!(
                    "Rôle requis: {}",
                    role
                )));
            }

            Ok(next.run(req).await)
        })
    }
}

/// Middleware pour vérifier que l'utilisateur est admin
pub async fn require_admin(req: Request, next: Next) -> Result<Response, AuthError> {
    let auth_user = req
        .extensions()
        .get::<AuthUser>()
        .ok_or(AuthError::MissingToken)?;

    if !auth_user.is_admin() {
        return Err(AuthError::PermissionDenied(
            "Accès administrateur requis".to_string(),
        ));
    }

    Ok(next.run(req).await)
}

/// Middleware pour vérifier les permissions de lecture (tables.read)
pub async fn require_read(req: Request, next: Next) -> Result<Response, AuthError> {
    let auth_user = req
        .extensions()
        .get::<AuthUser>()
        .ok_or(AuthError::MissingToken)?;

    if !auth_user.has_permission("tables.read") {
        return Err(AuthError::PermissionDenied(
            "Permission de lecture requise".to_string(),
        ));
    }

    Ok(next.run(req).await)
}

/// Middleware pour vérifier les permissions d'écriture (tables.write)
pub async fn require_write(req: Request, next: Next) -> Result<Response, AuthError> {
    let auth_user = req
        .extensions()
        .get::<AuthUser>()
        .ok_or(AuthError::MissingToken)?;

    if !auth_user.has_permission("tables.write") {
        return Err(AuthError::PermissionDenied(
            "Permission d'écriture requise".to_string(),
        ));
    }

    Ok(next.run(req).await)
}

/// Middleware pour vérifier les permissions DDL (schema.modify)
pub async fn require_ddl(req: Request, next: Next) -> Result<Response, AuthError> {
    let auth_user = req
        .extensions()
        .get::<AuthUser>()
        .ok_or(AuthError::MissingToken)?;

    if !auth_user.has_permission("schema.modify") {
        return Err(AuthError::PermissionDenied(
            "Permission DDL requise".to_string(),
        ));
    }

    Ok(next.run(req).await)
}

/// Middleware pour vérifier les permissions de backup
pub async fn require_backup(req: Request, next: Next) -> Result<Response, AuthError> {
    let auth_user = req
        .extensions()
        .get::<AuthUser>()
        .ok_or(AuthError::MissingToken)?;

    if !auth_user.has_any_permission(&["backup.create", "backup.restore"]) {
        return Err(AuthError::PermissionDenied(
            "Permission de backup requise".to_string(),
        ));
    }

    Ok(next.run(req).await)
}

/// Middleware pour vérifier les permissions de staging
pub async fn require_staging(req: Request, next: Next) -> Result<Response, AuthError> {
    let auth_user = req
        .extensions()
        .get::<AuthUser>()
        .ok_or(AuthError::MissingToken)?;

    if !auth_user.has_any_permission(&["staging.create", "staging.commit"]) {
        return Err(AuthError::PermissionDenied(
            "Permission de staging requise".to_string(),
        ));
    }

    Ok(next.run(req).await)
}

/// Middleware pour vérifier les permissions de gestion des utilisateurs
pub async fn require_user_management(req: Request, next: Next) -> Result<Response, AuthError> {
    let auth_user = req
        .extensions()
        .get::<AuthUser>()
        .ok_or(AuthError::MissingToken)?;

    if !auth_user.has_permission("users.manage") {
        return Err(AuthError::PermissionDenied(
            "Permission de gestion des utilisateurs requise".to_string(),
        ));
    }

    Ok(next.run(req).await)
}

/// Middleware pour vérifier les permissions de gestion des rôles
pub async fn require_role_management(req: Request, next: Next) -> Result<Response, AuthError> {
    let auth_user = req
        .extensions()
        .get::<AuthUser>()
        .ok_or(AuthError::MissingToken)?;

    if !auth_user.has_permission("roles.manage") {
        return Err(AuthError::PermissionDenied(
            "Permission de gestion des rôles requise".to_string(),
        ));
    }

    Ok(next.run(req).await)
}

/// Extracteur Axum pour obtenir l'utilisateur authentifié
#[axum::async_trait]
impl<S> axum::extract::FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or(AuthError::MissingToken)
    }
}

/// Extracteur optionnel pour l'utilisateur
pub struct OptionalAuthUser(pub Option<AuthUser>);

#[axum::async_trait]
impl<S> axum::extract::FromRequestParts<S> for OptionalAuthUser
where
    S: Send + Sync,
{
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        let user = parts
            .extensions
            .get::<AuthUserExtension>()
            .and_then(|ext| ext.0.clone())
            .or_else(|| parts.extensions.get::<AuthUser>().cloned());
        
        Ok(OptionalAuthUser(user))
    }
}
