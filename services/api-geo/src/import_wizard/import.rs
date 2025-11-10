// Import Wizard v2.3.0 - Import réel des données

use sqlx::PgPool;
use std::collections::HashMap;

use super::types::*;

/// Importe les données en base de données
pub async fn execute_import(
    pool: &PgPool,
    batch_id: &str,
    rows: Vec<HashMap<String, serde_json::Value>>,
    mapping: &HashMap<String, String>,
    conflict_policy: &ConflictPolicy,
) -> Result<ImportStats, String> {
    // TODO: Implémenter l'import réel
    // Pour l'instant, retourner des stats vides

    Ok(ImportStats {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
    })
}

#[derive(Debug, Clone)]
pub struct ImportStats {
    pub created: usize,
    pub updated: usize,
    pub skipped: usize,
    pub errors: usize,
}
