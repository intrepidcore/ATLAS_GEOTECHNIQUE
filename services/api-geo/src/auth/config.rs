// Configuration de l'authentification
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct AuthConfig {
    /// Clé secrète pour signer les JWT (doit être >= 32 bytes)
    pub jwt_secret: String,
    /// Durée de validité du token d'accès
    pub access_token_ttl: Duration,
    /// Durée de validité du refresh token
    pub refresh_token_ttl: Duration,
    /// Issuer du JWT
    pub jwt_issuer: String,
    /// Audience du JWT
    pub jwt_audience: String,
    /// Nombre max de tentatives de login avant verrouillage
    pub max_login_attempts: u32,
    /// Durée de verrouillage du compte après max tentatives
    pub lockout_duration: Duration,
    /// Durée minimale entre deux changements de mot de passe
    pub password_change_cooldown: Duration,
    /// Longueur minimale du mot de passe
    pub min_password_length: usize,
    /// Exiger des caractères spéciaux dans le mot de passe
    pub require_special_chars: bool,
    /// Exiger des chiffres dans le mot de passe
    pub require_digits: bool,
    /// Exiger des majuscules dans le mot de passe
    pub require_uppercase: bool,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "CHANGE_ME_IN_PRODUCTION_32_BYTES_MIN".to_string()),
            access_token_ttl: Duration::from_secs(
                std::env::var("JWT_ACCESS_TTL_SECS")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(3600), // 1 heure par défaut
            ),
            refresh_token_ttl: Duration::from_secs(
                std::env::var("JWT_REFRESH_TTL_SECS")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(604800), // 7 jours par défaut
            ),
            jwt_issuer: std::env::var("JWT_ISSUER").unwrap_or_else(|_| "atlas-api".to_string()),
            jwt_audience: std::env::var("JWT_AUDIENCE").unwrap_or_else(|_| "atlas-ui".to_string()),
            max_login_attempts: std::env::var("MAX_LOGIN_ATTEMPTS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(5),
            lockout_duration: Duration::from_secs(
                std::env::var("LOCKOUT_DURATION_SECS")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(900), // 15 minutes par défaut
            ),
            password_change_cooldown: Duration::from_secs(
                std::env::var("PASSWORD_CHANGE_COOLDOWN_SECS")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(86400), // 24 heures par défaut
            ),
            min_password_length: std::env::var("MIN_PASSWORD_LENGTH")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(8),
            require_special_chars: std::env::var("REQUIRE_SPECIAL_CHARS")
                .ok()
                .map(|s| s == "true" || s == "1")
                .unwrap_or(true),
            require_digits: std::env::var("REQUIRE_DIGITS")
                .ok()
                .map(|s| s == "true" || s == "1")
                .unwrap_or(true),
            require_uppercase: std::env::var("REQUIRE_UPPERCASE")
                .ok()
                .map(|s| s == "true" || s == "1")
                .unwrap_or(true),
        }
    }
}

impl AuthConfig {
    pub fn new() -> Self {
        Self::default()
    }

    /// Valide que la configuration est correcte
    pub fn validate(&self) -> Result<(), String> {
        if self.jwt_secret.len() < 32 {
            return Err("JWT_SECRET doit faire au moins 32 caractères".to_string());
        }
        if self.access_token_ttl.as_secs() < 60 {
            return Err("access_token_ttl doit être >= 60 secondes".to_string());
        }
        if self.refresh_token_ttl <= self.access_token_ttl {
            return Err("refresh_token_ttl doit être > access_token_ttl".to_string());
        }
        if self.min_password_length < 8 {
            return Err("min_password_length doit être >= 8".to_string());
        }
        Ok(())
    }
}
