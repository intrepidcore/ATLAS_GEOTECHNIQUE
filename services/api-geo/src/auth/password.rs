// Gestion du hachage et validation des mots de passe
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher as ArgonHasher, PasswordVerifier, SaltString},
    Argon2, Algorithm, Params, Version,
};

use super::config::AuthConfig;
use super::error::AuthError;

pub struct PasswordHasher {
    argon2: Argon2<'static>,
    config: AuthConfig,
}

impl PasswordHasher {
    pub fn new(config: AuthConfig) -> Self {
        // Configuration Argon2id recommandée par OWASP
        // m=65536 (64 MiB), t=3 (3 itérations), p=4 (4 threads parallèles)
        let params = Params::new(65536, 3, 4, None).expect("Invalid Argon2 params");
        let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
        
        Self { argon2, config }
    }

    /// Hash un mot de passe avec Argon2id
    pub fn hash_password(&self, password: &str) -> Result<String, AuthError> {
        let salt = SaltString::generate(&mut OsRng);
        let hash = self
            .argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| AuthError::InternalError(format!("Hash error: {}", e)))?;
        Ok(hash.to_string())
    }

    /// Vérifie un mot de passe contre son hash
    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool, AuthError> {
        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| AuthError::InternalError(format!("Invalid hash format: {}", e)))?;
        
        Ok(self.argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
    }

    /// Valide la force d'un mot de passe selon la configuration
    pub fn validate_password_strength(&self, password: &str) -> Result<(), AuthError> {
        let mut errors = Vec::new();

        // Longueur minimale
        if password.len() < self.config.min_password_length {
            errors.push(format!(
                "Le mot de passe doit faire au moins {} caractères",
                self.config.min_password_length
            ));
        }

        // Caractères spéciaux
        if self.config.require_special_chars {
            let has_special = password.chars().any(|c| {
                !c.is_alphanumeric() && !c.is_whitespace()
            });
            if !has_special {
                errors.push("Le mot de passe doit contenir au moins un caractère spécial".to_string());
            }
        }

        // Chiffres
        if self.config.require_digits {
            let has_digit = password.chars().any(|c| c.is_ascii_digit());
            if !has_digit {
                errors.push("Le mot de passe doit contenir au moins un chiffre".to_string());
            }
        }

        // Majuscules
        if self.config.require_uppercase {
            let has_upper = password.chars().any(|c| c.is_uppercase());
            if !has_upper {
                errors.push("Le mot de passe doit contenir au moins une majuscule".to_string());
            }
        }

        // Minuscules (toujours requis)
        let has_lower = password.chars().any(|c| c.is_lowercase());
        if !has_lower {
            errors.push("Le mot de passe doit contenir au moins une minuscule".to_string());
        }

        // Vérification des mots de passe courants
        if is_common_password(password) {
            errors.push("Ce mot de passe est trop courant".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(AuthError::WeakPassword(errors.join("; ")))
        }
    }

    /// Vérifie si le hash doit être mis à jour (paramètres obsolètes)
    pub fn needs_rehash(&self, hash: &str) -> bool {
        // Vérifie si le hash utilise les paramètres actuels
        if let Ok(parsed) = PasswordHash::new(hash) {
            // Vérifie l'algorithme - si ce n'est pas argon2id, il faut re-hasher
            if parsed.algorithm != argon2::ARGON2ID_IDENT {
                return true;
            }
            // Pour les paramètres, on vérifie via le hash string lui-même
            // Format: $argon2id$v=19$m=65536,t=3,p=4$...
            let hash_str = hash.to_string();
            if !hash_str.contains("m=65536") || !hash_str.contains("t=3") || !hash_str.contains("p=4") {
                return true;
            }
        }
        false
    }
}

/// Liste des mots de passe les plus courants à rejeter
fn is_common_password(password: &str) -> bool {
    const COMMON_PASSWORDS: &[&str] = &[
        "password", "123456", "12345678", "qwerty", "abc123",
        "monkey", "1234567", "letmein", "trustno1", "dragon",
        "baseball", "iloveyou", "master", "sunshine", "ashley",
        "bailey", "passw0rd", "shadow", "123123", "654321",
        "superman", "qazwsx", "michael", "football", "password1",
        "password123", "welcome", "welcome1", "admin", "admin123",
        "root", "toor", "pass", "test", "guest", "master",
        "changeme", "atlas", "atlas123", "Atlas2025",
    ];
    
    let lower = password.to_lowercase();
    COMMON_PASSWORDS.iter().any(|&p| lower == p.to_lowercase())
}

impl Default for PasswordHasher {
    fn default() -> Self {
        Self::new(AuthConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify() {
        let hasher = PasswordHasher::default();
        let password = "TestPassword123!";
        
        let hash = hasher.hash_password(password).unwrap();
        assert!(hash.starts_with("$argon2id$"));
        
        assert!(hasher.verify_password(password, &hash).unwrap());
        assert!(!hasher.verify_password("wrong", &hash).unwrap());
    }

    #[test]
    fn test_password_strength() {
        let hasher = PasswordHasher::default();
        
        // Trop court
        assert!(hasher.validate_password_strength("Ab1!").is_err());
        
        // Pas de majuscule
        assert!(hasher.validate_password_strength("abcdefgh1!").is_err());
        
        // Pas de chiffre
        assert!(hasher.validate_password_strength("Abcdefgh!").is_err());
        
        // Pas de caractère spécial
        assert!(hasher.validate_password_strength("Abcdefgh1").is_err());
        
        // Valide
        assert!(hasher.validate_password_strength("Abcdefgh1!").is_ok());
    }

    #[test]
    fn test_common_password() {
        let hasher = PasswordHasher::default();
        
        assert!(hasher.validate_password_strength("Password123!").is_err());
        assert!(hasher.validate_password_strength("Admin123!").is_err());
    }
}
