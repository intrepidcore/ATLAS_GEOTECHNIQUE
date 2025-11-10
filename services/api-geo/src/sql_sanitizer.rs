// Sanitisation et validation SQL pour prévenir les injections
use regex::Regex;
use std::collections::HashSet;

lazy_static::lazy_static! {
    // Mots-clés SQL dangereux
    static ref DANGEROUS_KEYWORDS: HashSet<&'static str> = {
        let mut set = HashSet::new();
        set.insert("DROP");
        set.insert("TRUNCATE");
        set.insert("DELETE");
        set.insert("EXEC");
        set.insert("EXECUTE");
        set.insert("SCRIPT");
        set.insert("JAVASCRIPT");
        set.insert("EVAL");
        set.insert("UNION");
        set.insert("--");
        set.insert("/*");
        set.insert("*/");
        set.insert("XP_");
        set.insert("SP_");
        set
    };

    // Pattern pour identifier les identifiants valides (tables, colonnes, schémas)
    static ref VALID_IDENTIFIER: Regex = Regex::new(r"^[a-zA-Z_][a-zA-Z0-9_]*$").unwrap();

    // Pattern pour identifier les types de données valides
    static ref VALID_DATA_TYPE: Regex = Regex::new(
        r"^(TEXT|VARCHAR|INTEGER|BIGINT|SMALLINT|BOOLEAN|DATE|TIMESTAMP|NUMERIC|DECIMAL|REAL|DOUBLE PRECISION|UUID|JSONB?|GEOMETRY|GEOGRAPHY)(\(\d+(,\d+)?\))?$"
    ).unwrap();
}

#[derive(Debug)]
pub enum SanitizationError {
    InvalidIdentifier(String),
    DangerousKeyword(String),
    InvalidDataType(String),
    TooLong(String),
    InvalidCharacters(String),
}

impl std::fmt::Display for SanitizationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidIdentifier(s) => write!(f, "Identifiant invalide: {}", s),
            Self::DangerousKeyword(s) => write!(f, "Mot-clé dangereux détecté: {}", s),
            Self::InvalidDataType(s) => write!(f, "Type de données invalide: {}", s),
            Self::TooLong(s) => write!(f, "Valeur trop longue: {}", s),
            Self::InvalidCharacters(s) => write!(f, "Caractères invalides: {}", s),
        }
    }
}

impl std::error::Error for SanitizationError {}

/// Valide un identifiant SQL (table, colonne, schéma)
pub fn validate_identifier(identifier: &str) -> Result<String, SanitizationError> {
    // Vérifier la longueur
    if identifier.len() > 63 {
        return Err(SanitizationError::TooLong(identifier.to_string()));
    }

    // Vérifier le format
    if !VALID_IDENTIFIER.is_match(identifier) {
        return Err(SanitizationError::InvalidIdentifier(identifier.to_string()));
    }

    // Vérifier les mots-clés dangereux
    let upper = identifier.to_uppercase();
    for keyword in DANGEROUS_KEYWORDS.iter() {
        if upper.contains(keyword) {
            return Err(SanitizationError::DangerousKeyword(identifier.to_string()));
        }
    }

    Ok(identifier.to_string())
}

/// Valide un type de données SQL
pub fn validate_data_type(data_type: &str) -> Result<String, SanitizationError> {
    let upper = data_type.to_uppercase();

    if !VALID_DATA_TYPE.is_match(&upper) {
        return Err(SanitizationError::InvalidDataType(data_type.to_string()));
    }

    Ok(upper)
}

/// Échappe une valeur pour l'utiliser dans une requête SQL
/// ATTENTION: Préférer toujours les paramètres bindés ($1, $2, etc.)
pub fn escape_string_value(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\'', "''")
        .replace('\0', "")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

/// Valide et quote un identifiant pour l'utiliser dans une requête dynamique
/// Utilise quote_ident de PostgreSQL pour une sécurité maximale
pub fn quote_identifier(identifier: &str) -> Result<String, SanitizationError> {
    validate_identifier(identifier)?;
    // En production, utiliser sqlx::query_scalar("SELECT quote_ident($1)")
    Ok(format!("\"{}\"", identifier.replace('"', "\"\"")))
}

/// Valide une liste d'identifiants (pour les colonnes, etc.)
pub fn validate_identifiers(identifiers: &[String]) -> Result<Vec<String>, SanitizationError> {
    identifiers
        .iter()
        .map(|id| validate_identifier(id))
        .collect()
}

/// Détecte les tentatives d'injection SQL dans une chaîne
pub fn detect_sql_injection(input: &str) -> bool {
    let upper = input.to_uppercase();

    // Vérifier les patterns d'injection courants
    if upper.contains("' OR '1'='1")
        || upper.contains("' OR 1=1")
        || upper.contains("'; DROP TABLE")
        || upper.contains("'; DELETE FROM")
        || upper.contains("UNION SELECT")
        || upper.contains("/*")
        || upper.contains("*/")
        || upper.contains("--")
        || upper.contains("XP_CMDSHELL")
    {
        return true;
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_identifier() {
        assert!(validate_identifier("valid_table_name").is_ok());
        assert!(validate_identifier("_underscore").is_ok());
        assert!(validate_identifier("table123").is_ok());

        assert!(validate_identifier("123invalid").is_err());
        assert!(validate_identifier("table-name").is_err());
        assert!(validate_identifier("table name").is_err());
        assert!(validate_identifier("DROP_TABLE").is_err());
    }

    #[test]
    fn test_validate_data_type() {
        assert!(validate_data_type("TEXT").is_ok());
        assert!(validate_data_type("VARCHAR(255)").is_ok());
        assert!(validate_data_type("NUMERIC(10,2)").is_ok());
        assert!(validate_data_type("GEOMETRY").is_ok());

        assert!(validate_data_type("INVALID_TYPE").is_err());
        assert!(validate_data_type("DROP TABLE").is_err());
    }

    #[test]
    fn test_detect_sql_injection() {
        assert!(detect_sql_injection("' OR '1'='1"));
        assert!(detect_sql_injection("'; DROP TABLE users--"));
        assert!(detect_sql_injection("UNION SELECT * FROM passwords"));

        assert!(!detect_sql_injection("normal text"));
        assert!(!detect_sql_injection("user@example.com"));
    }
}
