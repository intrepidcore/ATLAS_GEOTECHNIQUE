// RBAC (Role-Based Access Control) middleware
use axum::{extract::Request, http::StatusCode, middleware::Next, response::Response};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Role {
    Admin,  // Tous les droits
    Editor, // Lecture + Écriture (pas de DDL)
    Viewer, // Lecture seule
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub role: Role,
}

impl User {
    pub fn can_read(&self) -> bool {
        matches!(self.role, Role::Admin | Role::Editor | Role::Viewer)
    }

    pub fn can_write(&self) -> bool {
        matches!(self.role, Role::Admin | Role::Editor)
    }

    pub fn can_ddl(&self) -> bool {
        matches!(self.role, Role::Admin)
    }

    pub fn can_backup(&self) -> bool {
        matches!(self.role, Role::Admin)
    }

    pub fn can_restore(&self) -> bool {
        matches!(self.role, Role::Admin)
    }
}

/// Extrait l'utilisateur depuis les headers (à adapter selon votre système d'auth)
pub fn extract_user_from_request(req: &Request) -> Option<User> {
    // TODO: Implémenter l'extraction réelle depuis JWT, session, etc.
    // Pour l'instant, retourne un admin par défaut

    // Exemple avec header X-User-Role
    let role = req
        .headers()
        .get("X-User-Role")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| match s {
            "admin" => Some(Role::Admin),
            "editor" => Some(Role::Editor),
            "viewer" => Some(Role::Viewer),
            _ => None,
        })
        .unwrap_or(Role::Viewer); // Par défaut: viewer

    let username = req
        .headers()
        .get("X-User-Name")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("anonymous")
        .to_string();

    Some(User {
        id: uuid::Uuid::new_v4().to_string(),
        username,
        role,
    })
}

/// Middleware pour vérifier les permissions de lecture
pub async fn require_read_permission(req: Request, next: Next) -> Result<Response, StatusCode> {
    let user = extract_user_from_request(&req).ok_or(StatusCode::UNAUTHORIZED)?;

    if !user.can_read() {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(req).await)
}

/// Middleware pour vérifier les permissions d'écriture
pub async fn require_write_permission(req: Request, next: Next) -> Result<Response, StatusCode> {
    let user = extract_user_from_request(&req).ok_or(StatusCode::UNAUTHORIZED)?;

    if !user.can_write() {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(req).await)
}

/// Middleware pour vérifier les permissions DDL (admin only)
pub async fn require_admin_permission(req: Request, next: Next) -> Result<Response, StatusCode> {
    let user = extract_user_from_request(&req).ok_or(StatusCode::UNAUTHORIZED)?;

    if !user.can_ddl() {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(req).await)
}

/// Middleware pour logger l'utilisateur dans chaque requête
pub async fn log_user_middleware(req: Request, next: Next) -> Response {
    if let Some(user) = extract_user_from_request(&req) {
        tracing::info!(
            user_id = %user.id,
            username = %user.username,
            role = ?user.role,
            path = %req.uri().path(),
            method = %req.method(),
            "User request"
        );
    }

    next.run(req).await
}
