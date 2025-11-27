// Erreurs d'authentification
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct AuthErrorResponse {
    pub error: String,
    pub error_code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Identifiants invalides")]
    InvalidCredentials,

    #[error("Token invalide ou expiré")]
    InvalidToken,

    #[error("Token manquant")]
    MissingToken,

    #[error("Token expiré")]
    TokenExpired,

    #[error("Refresh token invalide")]
    InvalidRefreshToken,

    #[error("Session expirée ou révoquée")]
    SessionExpired,

    #[error("Compte verrouillé jusqu'à {0}")]
    AccountLocked(String),

    #[error("Compte désactivé")]
    AccountDisabled,

    #[error("Compte non vérifié")]
    AccountNotVerified,

    #[error("Permission refusée: {0}")]
    PermissionDenied(String),

    #[error("Utilisateur non trouvé")]
    UserNotFound,

    #[error("Email déjà utilisé")]
    EmailAlreadyExists,

    #[error("Nom d'utilisateur déjà utilisé")]
    UsernameAlreadyExists,

    #[error("Mot de passe trop faible: {0}")]
    WeakPassword(String),

    #[error("Token de réinitialisation invalide ou expiré")]
    InvalidResetToken,

    #[error("Changement de mot de passe trop fréquent")]
    PasswordChangeCooldown,

    #[error("Erreur de validation: {0}")]
    ValidationError(String),

    #[error("Erreur interne: {0}")]
    InternalError(String),

    #[error("Erreur base de données: {0}")]
    DatabaseError(String),
}

impl AuthError {
    pub fn error_code(&self) -> &'static str {
        match self {
            AuthError::InvalidCredentials => "INVALID_CREDENTIALS",
            AuthError::InvalidToken => "INVALID_TOKEN",
            AuthError::MissingToken => "MISSING_TOKEN",
            AuthError::TokenExpired => "TOKEN_EXPIRED",
            AuthError::InvalidRefreshToken => "INVALID_REFRESH_TOKEN",
            AuthError::SessionExpired => "SESSION_EXPIRED",
            AuthError::AccountLocked(_) => "ACCOUNT_LOCKED",
            AuthError::AccountDisabled => "ACCOUNT_DISABLED",
            AuthError::AccountNotVerified => "ACCOUNT_NOT_VERIFIED",
            AuthError::PermissionDenied(_) => "PERMISSION_DENIED",
            AuthError::UserNotFound => "USER_NOT_FOUND",
            AuthError::EmailAlreadyExists => "EMAIL_EXISTS",
            AuthError::UsernameAlreadyExists => "USERNAME_EXISTS",
            AuthError::WeakPassword(_) => "WEAK_PASSWORD",
            AuthError::InvalidResetToken => "INVALID_RESET_TOKEN",
            AuthError::PasswordChangeCooldown => "PASSWORD_CHANGE_COOLDOWN",
            AuthError::ValidationError(_) => "VALIDATION_ERROR",
            AuthError::InternalError(_) => "INTERNAL_ERROR",
            AuthError::DatabaseError(_) => "DATABASE_ERROR",
        }
    }

    pub fn status_code(&self) -> StatusCode {
        match self {
            AuthError::InvalidCredentials => StatusCode::UNAUTHORIZED,
            AuthError::InvalidToken => StatusCode::UNAUTHORIZED,
            AuthError::MissingToken => StatusCode::UNAUTHORIZED,
            AuthError::TokenExpired => StatusCode::UNAUTHORIZED,
            AuthError::InvalidRefreshToken => StatusCode::UNAUTHORIZED,
            AuthError::SessionExpired => StatusCode::UNAUTHORIZED,
            AuthError::AccountLocked(_) => StatusCode::FORBIDDEN,
            AuthError::AccountDisabled => StatusCode::FORBIDDEN,
            AuthError::AccountNotVerified => StatusCode::FORBIDDEN,
            AuthError::PermissionDenied(_) => StatusCode::FORBIDDEN,
            AuthError::UserNotFound => StatusCode::NOT_FOUND,
            AuthError::EmailAlreadyExists => StatusCode::CONFLICT,
            AuthError::UsernameAlreadyExists => StatusCode::CONFLICT,
            AuthError::WeakPassword(_) => StatusCode::BAD_REQUEST,
            AuthError::InvalidResetToken => StatusCode::BAD_REQUEST,
            AuthError::PasswordChangeCooldown => StatusCode::TOO_MANY_REQUESTS,
            AuthError::ValidationError(_) => StatusCode::BAD_REQUEST,
            AuthError::InternalError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AuthError::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let body = AuthErrorResponse {
            error: self.to_string(),
            error_code: self.error_code().to_string(),
            details: None,
        };
        (status, Json(body)).into_response()
    }
}

impl From<sqlx::Error> for AuthError {
    fn from(err: sqlx::Error) -> Self {
        tracing::error!("Database error in auth: {:?}", err);
        AuthError::DatabaseError(err.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for AuthError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        tracing::warn!("JWT error: {:?}", err);
        match err.kind() {
            jsonwebtoken::errors::ErrorKind::ExpiredSignature => AuthError::TokenExpired,
            _ => AuthError::InvalidToken,
        }
    }
}

impl From<argon2::password_hash::Error> for AuthError {
    fn from(err: argon2::password_hash::Error) -> Self {
        tracing::error!("Password hash error: {:?}", err);
        AuthError::InternalError("Erreur de hachage".to_string())
    }
}
