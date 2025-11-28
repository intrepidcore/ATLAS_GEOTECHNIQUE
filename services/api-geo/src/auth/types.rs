// Types pour l'authentification
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

// ============================================================================
// Request Types
// ============================================================================

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email(message = "Email invalide"))]
    pub email: String,
    #[validate(length(min = 1, message = "Mot de passe requis"))]
    pub password: String,
    /// Informations optionnelles sur le device
    pub device_info: Option<DeviceInfo>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(email(message = "Email invalide"))]
    pub email: String,
    #[validate(length(min = 3, max = 50, message = "Username doit faire entre 3 et 50 caractères"))]
    #[validate(regex(path = "USERNAME_REGEX", message = "Username invalide (lettres, chiffres, _ et - uniquement)"))]
    pub username: String,
    #[validate(length(min = 8, message = "Mot de passe trop court (min 8 caractères)"))]
    pub password: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

lazy_static::lazy_static! {
    static ref USERNAME_REGEX: regex::Regex = regex::Regex::new(r"^[a-zA-Z0-9_-]+$").unwrap();
}

#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ChangePasswordRequest {
    #[validate(length(min = 1, message = "Mot de passe actuel requis"))]
    pub current_password: String,
    #[validate(length(min = 8, message = "Nouveau mot de passe trop court (min 8 caractères)"))]
    pub new_password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ResetPasswordRequest {
    #[validate(email(message = "Email invalide"))]
    pub email: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ConfirmResetPasswordRequest {
    pub token: String,
    #[validate(length(min = 8, message = "Nouveau mot de passe trop court (min 8 caractères)"))]
    pub new_password: String,
}

/// Inscription étudiant (self-service)
#[derive(Debug, Deserialize, Validate)]
pub struct RegisterStudentRequest {
    #[validate(email(message = "Email invalide"))]
    pub email: String,
    #[validate(length(min = 8, message = "Mot de passe trop court (min 8 caractères)"))]
    pub password: String,
    #[validate(length(min = 1, message = "Prénom requis"))]
    pub first_name: String,
    #[validate(length(min = 1, message = "Nom requis"))]
    pub last_name: String,
    pub phone: Option<String>,
    pub student_info: StudentInfo,
}

#[derive(Debug, Deserialize, Validate)]
pub struct StudentInfo {
    #[validate(length(min = 1, message = "Matricule requis"))]
    pub matricule: String,
    #[validate(length(min = 1, message = "Établissement requis"))]
    pub school: String,
    #[validate(length(min = 1, message = "Filière requise"))]
    pub program: String,
    pub level: String, // L3, M1, M2
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub user_agent: Option<String>,
    pub platform: Option<String>,
    pub browser: Option<String>,
    pub device_type: Option<String>,
}

// ============================================================================
// Response Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub user: UserInfo,
}

#[derive(Debug, Serialize)]
pub struct RefreshResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub avatar_url: Option<String>,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct SessionInfo {
    pub id: Uuid,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_activity_at: DateTime<Utc>,
    pub is_current: bool,
}

// ============================================================================
// Database Models
// ============================================================================

#[derive(Debug, Clone, FromRow)]
pub struct DbUser {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub password_hash: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub is_verified: bool,
    pub failed_login_attempts: i32,
    pub locked_until: Option<DateTime<Utc>>,
    pub last_login_at: Option<DateTime<Utc>>,
    pub last_login_ip: Option<String>,
    pub password_changed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
}

#[derive(Debug, Clone, FromRow)]
pub struct DbSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub refresh_token_hash: Option<String>,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
    pub device_info: Option<serde_json::Value>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub refresh_expires_at: Option<DateTime<Utc>>,
    pub last_activity_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoked_reason: Option<String>,
}

#[derive(Debug, Clone, FromRow)]
pub struct DbRole {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_system: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct DbPermission {
    pub id: String,
    pub resource: String,
    pub action: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct DbUserRole {
    pub user_id: Uuid,
    pub role_id: String,
    pub assigned_at: DateTime<Utc>,
    pub assigned_by: Option<Uuid>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow)]
pub struct DbPasswordResetToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub ip_address: Option<String>,
}

// ============================================================================
// Auth Audit Event Types
// ============================================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthEventType {
    Login,
    LoginFailed,
    Logout,
    TokenRefresh,
    PasswordChange,
    PasswordResetRequest,
    PasswordResetComplete,
    AccountLocked,
    AccountUnlocked,
    SessionRevoked,
    SessionExpired,
}

impl AuthEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            AuthEventType::Login => "login",
            AuthEventType::LoginFailed => "login_failed",
            AuthEventType::Logout => "logout",
            AuthEventType::TokenRefresh => "token_refresh",
            AuthEventType::PasswordChange => "password_change",
            AuthEventType::PasswordResetRequest => "password_reset_request",
            AuthEventType::PasswordResetComplete => "password_reset_complete",
            AuthEventType::AccountLocked => "account_locked",
            AuthEventType::AccountUnlocked => "account_unlocked",
            AuthEventType::SessionRevoked => "session_revoked",
            AuthEventType::SessionExpired => "session_expired",
        }
    }
}
