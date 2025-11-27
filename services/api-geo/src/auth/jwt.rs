// Gestion des tokens JWT
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, TokenData, Validation};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::config::AuthConfig;
use super::error::AuthError;

/// Claims du JWT
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: String,
    /// Email de l'utilisateur
    pub email: String,
    /// Username
    pub username: String,
    /// Rôles de l'utilisateur
    pub roles: Vec<String>,
    /// Permissions de l'utilisateur
    pub permissions: Vec<String>,
    /// Session ID
    pub sid: String,
    /// Issued at (timestamp)
    pub iat: i64,
    /// Expiration (timestamp)
    pub exp: i64,
    /// Not before (timestamp)
    pub nbf: i64,
    /// Issuer
    pub iss: String,
    /// Audience
    pub aud: String,
    /// JWT ID (unique identifier)
    pub jti: String,
}

impl Claims {
    pub fn user_id(&self) -> Result<Uuid, AuthError> {
        Uuid::parse_str(&self.sub).map_err(|_| AuthError::InvalidToken)
    }

    pub fn session_id(&self) -> Result<Uuid, AuthError> {
        Uuid::parse_str(&self.sid).map_err(|_| AuthError::InvalidToken)
    }

    pub fn has_permission(&self, permission: &str) -> bool {
        self.permissions.contains(&permission.to_string())
    }

    pub fn has_role(&self, role: &str) -> bool {
        self.roles.contains(&role.to_string())
    }

    pub fn has_any_permission(&self, permissions: &[&str]) -> bool {
        permissions.iter().any(|p| self.has_permission(p))
    }

    pub fn has_all_permissions(&self, permissions: &[&str]) -> bool {
        permissions.iter().all(|p| self.has_permission(p))
    }

    pub fn is_admin(&self) -> bool {
        self.has_role("admin") || self.has_permission("system.admin")
    }
}

/// Gestionnaire JWT
pub struct JwtManager {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    config: AuthConfig,
    validation: Validation,
}

impl JwtManager {
    pub fn new(config: AuthConfig) -> Self {
        let encoding_key = EncodingKey::from_secret(config.jwt_secret.as_bytes());
        let decoding_key = DecodingKey::from_secret(config.jwt_secret.as_bytes());

        let mut validation = Validation::default();
        validation.set_issuer(&[&config.jwt_issuer]);
        validation.set_audience(&[&config.jwt_audience]);
        validation.validate_exp = true;
        validation.validate_nbf = true;
        validation.leeway = 30; // 30 secondes de tolérance

        Self {
            encoding_key,
            decoding_key,
            config,
            validation,
        }
    }

    /// Génère un access token
    pub fn generate_access_token(
        &self,
        user_id: Uuid,
        email: &str,
        username: &str,
        roles: Vec<String>,
        permissions: Vec<String>,
        session_id: Uuid,
    ) -> Result<String, AuthError> {
        let now = Utc::now();
        let exp = now + Duration::seconds(self.config.access_token_ttl.as_secs() as i64);

        let claims = Claims {
            sub: user_id.to_string(),
            email: email.to_string(),
            username: username.to_string(),
            roles,
            permissions,
            sid: session_id.to_string(),
            iat: now.timestamp(),
            exp: exp.timestamp(),
            nbf: now.timestamp(),
            iss: self.config.jwt_issuer.clone(),
            aud: self.config.jwt_audience.clone(),
            jti: Uuid::new_v4().to_string(),
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|e| AuthError::InternalError(format!("JWT encode error: {}", e)))
    }

    /// Génère un refresh token (opaque, stocké en base)
    pub fn generate_refresh_token(&self) -> String {
        let random_bytes: [u8; 32] = rand::random();
        base64::Engine::encode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, random_bytes)
    }

    /// Valide et décode un access token
    pub fn validate_token(&self, token: &str) -> Result<TokenData<Claims>, AuthError> {
        decode::<Claims>(token, &self.decoding_key, &self.validation)
            .map_err(AuthError::from)
    }

    /// Hash un token pour stockage sécurisé
    pub fn hash_token(token: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Durée de validité de l'access token en secondes
    pub fn access_token_ttl_secs(&self) -> i64 {
        self.config.access_token_ttl.as_secs() as i64
    }

    /// Durée de validité du refresh token en secondes
    pub fn refresh_token_ttl_secs(&self) -> i64 {
        self.config.refresh_token_ttl.as_secs() as i64
    }
}

// Ajout de hex encoding pour le hash
mod hex {
    pub fn encode(bytes: impl AsRef<[u8]>) -> String {
        bytes.as_ref().iter().map(|b| format!("{:02x}", b)).collect()
    }
}

impl Default for JwtManager {
    fn default() -> Self {
        Self::new(AuthConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_and_validate_token() {
        let manager = JwtManager::default();
        let user_id = Uuid::new_v4();
        let session_id = Uuid::new_v4();

        let token = manager
            .generate_access_token(
                user_id,
                "test@example.com",
                "testuser",
                vec!["editor".to_string()],
                vec!["tables.read".to_string(), "tables.write".to_string()],
                session_id,
            )
            .unwrap();

        let decoded = manager.validate_token(&token).unwrap();
        assert_eq!(decoded.claims.sub, user_id.to_string());
        assert_eq!(decoded.claims.email, "test@example.com");
        assert!(decoded.claims.has_role("editor"));
        assert!(decoded.claims.has_permission("tables.read"));
        assert!(!decoded.claims.has_permission("admin.all"));
    }

    #[test]
    fn test_token_hash() {
        let token = "some_random_token_value";
        let hash = JwtManager::hash_token(token);
        
        // SHA-256 produit 64 caractères hex
        assert_eq!(hash.len(), 64);
        
        // Même token = même hash
        assert_eq!(hash, JwtManager::hash_token(token));
        
        // Token différent = hash différent
        assert_ne!(hash, JwtManager::hash_token("different_token"));
    }

    #[test]
    fn test_claims_permissions() {
        let claims = Claims {
            sub: Uuid::new_v4().to_string(),
            email: "test@example.com".to_string(),
            username: "test".to_string(),
            roles: vec!["admin".to_string()],
            permissions: vec![
                "tables.read".to_string(),
                "tables.write".to_string(),
                "system.admin".to_string(),
            ],
            sid: Uuid::new_v4().to_string(),
            iat: Utc::now().timestamp(),
            exp: (Utc::now() + Duration::hours(1)).timestamp(),
            nbf: Utc::now().timestamp(),
            iss: "test".to_string(),
            aud: "test".to_string(),
            jti: Uuid::new_v4().to_string(),
        };

        assert!(claims.is_admin());
        assert!(claims.has_any_permission(&["tables.read", "nonexistent"]));
        assert!(claims.has_all_permissions(&["tables.read", "tables.write"]));
        assert!(!claims.has_all_permissions(&["tables.read", "nonexistent"]));
    }
}
