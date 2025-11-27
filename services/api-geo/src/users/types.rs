// Types pour la gestion des utilisateurs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

// ============================================================================
// Request Types
// ============================================================================

#[derive(Debug, Deserialize, Validate)]
pub struct CreateUserRequest {
    #[validate(email(message = "Email invalide"))]
    pub email: String,
    #[validate(length(min = 3, max = 50, message = "Username doit faire entre 3 et 50 caractères"))]
    pub username: String,
    #[validate(length(min = 8, message = "Mot de passe trop court (min 8 caractères)"))]
    pub password: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: Option<bool>,
    pub is_verified: Option<bool>,
    /// Rôles à assigner à l'utilisateur
    pub roles: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateUserRequest {
    #[validate(email(message = "Email invalide"))]
    pub email: Option<String>,
    #[validate(length(min = 3, max = 50, message = "Username doit faire entre 3 et 50 caractères"))]
    pub username: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: Option<bool>,
    pub is_verified: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct AssignRolesRequest {
    pub roles: Vec<String>,
    /// Date d'expiration optionnelle pour les rôles
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct ListUsersQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub search: Option<String>,
    pub role: Option<String>,
    pub is_active: Option<bool>,
    pub order_by: Option<String>,
    pub order_dir: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct AdminResetPasswordRequest {
    #[validate(length(min = 8, message = "Mot de passe trop court (min 8 caractères)"))]
    pub new_password: String,
    /// Forcer le changement au prochain login
    pub force_change: Option<bool>,
}

// ============================================================================
// Response Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub is_verified: bool,
    pub last_login_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub roles: Vec<RoleInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleInfo {
    pub id: String,
    pub name: String,
    pub assigned_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct UserListResponse {
    pub users: Vec<UserResponse>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

#[derive(Debug, Serialize)]
pub struct UserStatsResponse {
    pub total_users: i64,
    pub active_users: i64,
    pub verified_users: i64,
    pub users_by_role: Vec<RoleCount>,
    pub recent_logins: i64,
    pub locked_accounts: i64,
}

#[derive(Debug, Serialize)]
pub struct RoleCount {
    pub role_id: String,
    pub role_name: String,
    pub count: i64,
}

// ============================================================================
// Database Models
// ============================================================================

#[derive(Debug, Clone, FromRow)]
pub struct DbUserWithRoles {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub is_verified: bool,
    pub last_login_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub roles: Option<serde_json::Value>,
}

impl DbUserWithRoles {
    pub fn into_response(self) -> UserResponse {
        let roles = self
            .roles
            .and_then(|v| serde_json::from_value::<Vec<RoleInfo>>(v).ok())
            .unwrap_or_default();

        UserResponse {
            id: self.id,
            email: self.email,
            username: self.username,
            first_name: self.first_name,
            last_name: self.last_name,
            avatar_url: self.avatar_url,
            is_active: self.is_active,
            is_verified: self.is_verified,
            last_login_at: self.last_login_at,
            created_at: self.created_at,
            updated_at: self.updated_at,
            roles,
        }
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct DbRoleAssignment {
    pub role_id: String,
    pub role_name: String,
    pub assigned_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}
