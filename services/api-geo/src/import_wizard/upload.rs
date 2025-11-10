// Import Wizard v2.3.0 - Upload et détection

use serde::{Deserialize, Serialize};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedProperties {
    pub encoding: String,
    pub delimiter: String,
    pub decimal: String,
    pub has_header: bool,
    pub row_count: usize,
    pub column_count: usize,
}

/// Sauvegarde le fichier uploadé temporairement
pub async fn save_temp_file(import_id: Uuid, data: &[u8]) -> Result<String, std::io::Error> {
    let file_path = format!("/tmp/atlas_import_{}.tmp", import_id);
    let mut file = fs::File::create(&file_path).await?;

    file.write_all(data).await?;

    Ok(file_path)
}

/// Détecte les propriétés du fichier (encodage, délimiteur, etc.)
pub async fn detect_file_properties(file_path: &str) -> Result<DetectedProperties, std::io::Error> {
    let content = fs::read_to_string(file_path).await?;

    // Détecter le délimiteur (simple heuristique)
    let first_line = content.lines().next().unwrap_or("");
    let delimiter = if first_line.contains(';') {
        ";"
    } else if first_line.contains('\t') {
        "\t"
    } else if first_line.contains('|') {
        "|"
    } else {
        ","
    };

    // Compter les lignes et colonnes
    let lines: Vec<&str> = content.lines().collect();
    let row_count = lines.len();
    let column_count = if !lines.is_empty() {
        lines[0].split(delimiter).count()
    } else {
        0
    };

    // Détecter le séparateur décimal (simple heuristique)
    let decimal = if content.contains(",") && content.contains(".") {
        // Si les deux sont présents, on suppose que . est le décimal
        "."
    } else if content.contains(",") {
        ","
    } else {
        "."
    };

    Ok(DetectedProperties {
        encoding: "UTF-8".to_string(), // TODO: vraie détection
        delimiter: delimiter.to_string(),
        decimal: decimal.to_string(),
        has_header: true, // TODO: vraie détection
        row_count,
        column_count,
    })
}
