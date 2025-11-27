// RBAC (Role-Based Access Control) - Rétrocompatibilité et utilitaires
// Le nouveau système d'authentification est dans le module `auth`
// Ce module est conservé pour la rétrocompatibilité avec le code existant

use axum::{extract::Request, http::StatusCode, middleware::Next, response::Response};
use serde::{Deserialize, Serialize};

use crate::auth::middleware::AuthUser;

/// Rôles legacy - mappés vers le nouveau système
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Role {
    Admin,  // Tous les droits
    Editor, // Lecture + Écriture (pas de DDL)
    Viewer, // Lecture seule
}

impl Role {
    /// Convertit depuis les rôles du nouveau système
    pub fn from_roles(roles: &[String]) -> Self {
        if roles.contains(&"admin".to_string()) {
            Role::Admin
        } else if roles.contains(&"editor".to_string()) || roles.contains(&"data_manager".to_string()) {
            Role::Editor
        } else {
            Role::Viewer
        }
    }
}

/// Utilisateur legacy - wrapper autour de AuthUser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub role: Role,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub permissions: Vec<String>,
}

impl User {
    /// Crée un User legacy depuis un AuthUser
    pub fn from_auth_user(auth_user: &AuthUser) -> Self {
        Self {
            id: auth_user.id.to_string(),
            username: auth_user.username.clone(),
            role: Role::from_roles(&auth_user.roles),
            permissions: auth_user.permissions.clone(),
        }
    }

    pub fn can_read(&self) -> bool {
        matches!(self.role, Role::Admin | Role::Editor | Role::Viewer)
            || self.permissions.contains(&"tables.read".to_string())
    }

    pub fn can_write(&self) -> bool {
        matches!(self.role, Role::Admin | Role::Editor)
            || self.permissions.contains(&"tables.write".to_string())
    }

    pub fn can_ddl(&self) -> bool {
        matches!(self.role, Role::Admin)
            || self.permissions.contains(&"schema.modify".to_string())
    }

    pub fn can_backup(&self) -> bool {
        matches!(self.role, Role::Admin)
            || self.permissions.contains(&"backup.create".to_string())
    }

    pub fn can_restore(&self) -> bool {
        matches!(self.role, Role::Admin)
            || self.permissions.contains(&"backup.restore".to_string())
    }

    pub fn has_permission(&self, permission: &str) -> bool {
        matches!(self.role, Role::Admin) || self.permissions.contains(&permission.to_string())
    }
}

/// Extrait l'utilisateur depuis la requête
/// Utilise le nouveau système JWT si disponible, sinon fallback sur les headers legacy
pub fn extract_user_from_request(req: &Request) -> Option<User> {
    // Essayer d'abord le nouveau système (AuthUser dans les extensions)
    if let Some(auth_user) = req.extensions().get::<AuthUser>() {
        return Some(User::from_auth_user(auth_user));
    }

    // Fallback: headers legacy pour rétrocompatibilité
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
        .unwrap_or(Role::Viewer);

    let username = req
        .headers()
        .get("X-User-Name")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("anonymous")
        .to_string();

    let id = req
        .headers()
        .get("X-User-Id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    Some(User {
        id,
        username,
        role,
        permissions: Vec::new(),
    })
}

/// Middleware pour vérifier les permissions de lecture
/// Utilise le nouveau système si AuthUser est présent
pub async fn require_read_permission(req: Request, next: Next) -> Result<Response, StatusCode> {
    let user = extract_user_from_request(&req).ok_or(StatusCode::UNAUTHORIZED)?;

    if !user.can_read() {
        tracing::warn!(
            user_id = %user.id,
            username = %user.username,
            "Read permission denied"
        );
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(req).await)
}

/// Middleware pour vérifier les permissions d'écriture
pub async fn require_write_permission(req: Request, next: Next) -> Result<Response, StatusCode> {
    let user = extract_user_from_request(&req).ok_or(StatusCode::UNAUTHORIZED)?;

    if !user.can_write() {
        tracing::warn!(
            user_id = %user.id,
            username = %user.username,
            "Write permission denied"
        );
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(req).await)
}

/// Middleware pour vérifier les permissions DDL (admin only)
pub async fn require_admin_permission(req: Request, next: Next) -> Result<Response, StatusCode> {
    let user = extract_user_from_request(&req).ok_or(StatusCode::UNAUTHORIZED)?;

    if !user.can_ddl() {
        tracing::warn!(
            user_id = %user.id,
            username = %user.username,
            "Admin permission denied"
        );
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(req).await)
}

/// Middleware pour vérifier les permissions de backup
pub async fn require_backup_permission(req: Request, next: Next) -> Result<Response, StatusCode> {
    let user = extract_user_from_request(&req).ok_or(StatusCode::UNAUTHORIZED)?;

    if !user.can_backup() {
        tracing::warn!(
            user_id = %user.id,
            username = %user.username,
            "Backup permission denied"
        );
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(req).await)
}

/// Middleware pour logger l'utilisateur dans chaque requête
pub async fn log_user_middleware(req: Request, next: Next) -> Response {
    if let Some(user) = extract_user_from_request(&req) {
        tracing::debug!(
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

/// Crée un middleware qui vérifie une permission spécifique
pub fn require_permission(
    permission: &'static str,
) -> impl Fn(Request, Next) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Response, StatusCode>> + Send>>
       + Clone {
    move |req: Request, next: Next| {
        Box::pin(async move {
            let user = extract_user_from_request(&req).ok_or(StatusCode::UNAUTHORIZED)?;

            if !user.has_permission(permission) {
                tracing::warn!(
                    user_id = %user.id,
                    username = %user.username,
                    permission = %permission,
                    "Permission denied"
                );
                return Err(StatusCode::FORBIDDEN);
            }

            Ok(next.run(req).await)
        })
    }
}
