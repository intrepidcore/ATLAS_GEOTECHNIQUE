// ============================================================================
// Parser CSV/XLSX/JSON avec détection automatique
// ============================================================================

#![allow(dead_code)]

use super::types::*;
use anyhow::{anyhow, Result};
use calamine::{open_workbook_from_rs, Data as DataType, Reader, Xlsx};
use csv::ReaderBuilder;
use encoding_rs::{Encoding, ISO_8859_15, UTF_8, WINDOWS_1252};
use serde_json::Value;
use std::collections::HashMap;
use std::io::Cursor;

// ============================================================================
// DÉTECTION AUTOMATIQUE
// ============================================================================

/// Détecte le séparateur CSV (virgule, point-virgule, tabulation)
pub fn detect_csv_separator(content: &str) -> char {
    let first_lines: Vec<&str> = content.lines().take(5).collect();

    let mut counts = HashMap::new();
    for line in first_lines {
        for sep in [',', ';', '\t'] {
            *counts.entry(sep).or_insert(0) += line.matches(sep).count();
        }
    }

    // Retourner le séparateur le plus fréquent
    *counts
        .iter()
        .max_by_key(|(_, count)| *count)
        .map(|(sep, _)| sep)
        .unwrap_or(&',')
}

/// Détecte l'encodage du fichier
pub fn detect_encoding(bytes: &[u8]) -> &'static Encoding {
    // Vérifier BOM UTF-8
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return UTF_8;
    }

    // Essayer de décoder en UTF-8
    if std::str::from_utf8(bytes).is_ok() {
        return UTF_8;
    }

    // Vérifier présence de caractères Windows-1252
    let has_windows_chars = bytes.iter().any(|&b| (0x80..=0x9F).contains(&b));
    if has_windows_chars {
        return WINDOWS_1252;
    }

    // Par défaut ISO-8859-15
    ISO_8859_15
}

/// Convertit les bytes en String UTF-8
pub fn decode_to_utf8(bytes: &[u8], encoding: &'static Encoding) -> Result<String> {
    let (decoded, _, had_errors) = encoding.decode(bytes);

    if had_errors {
        return Err(anyhow!(
            "Erreur de décodage avec l'encodage {:?}",
            encoding.name()
        ));
    }

    Ok(decoded.into_owned())
}

/// Détecte la structure des données (Long vs Large)
pub fn detect_data_structure(headers: &[String]) -> DataStructure {
    // Si présence de colonnes "profondeur" ou "profondeur_m" → Long
    let has_profondeur_col = headers
        .iter()
        .any(|h| h.to_lowercase().contains("profondeur") || h.to_lowercase() == "depth_m");

    if has_profondeur_col {
        return DataStructure::Long;
    }

    // Si présence de colonnes numériques (1, 1.5, 2, etc.) → Large
    let numeric_cols: Vec<_> = headers
        .iter()
        .filter(|h| h.parse::<f64>().is_ok())
        .collect();

    if numeric_cols.len() >= 2 {
        return DataStructure::Large;
    }

    // Par défaut Long
    DataStructure::Long
}

// ============================================================================
// PARSER CSV
// ============================================================================

pub struct CsvParser {
    separator: char,
    encoding: &'static Encoding,
}

impl CsvParser {
    pub fn new(bytes: &[u8]) -> Result<Self> {
        let encoding = detect_encoding(bytes);
        let content = decode_to_utf8(bytes, encoding)?;
        let separator = detect_csv_separator(&content);

        Ok(Self {
            separator,
            encoding,
        })
    }

    pub fn parse(&self, bytes: &[u8]) -> Result<Vec<HashMap<String, String>>> {
        let content = decode_to_utf8(bytes, self.encoding)?;

        let mut reader = ReaderBuilder::new()
            .delimiter(self.separator as u8)
            .has_headers(true)
            .flexible(true) // Tolérer lignes de longueur variable
            .trim(csv::Trim::All)
            .from_reader(content.as_bytes());

        let headers = reader.headers()?.clone();
        let header_names: Vec<String> = headers.iter().map(|h| h.trim().to_string()).collect();

        let mut rows = Vec::new();

        for (idx, result) in reader.records().enumerate() {
            let record = result.map_err(|e| anyhow!("Erreur ligne {}: {}", idx + 2, e))?;

            let mut row = HashMap::new();
            for (i, field) in record.iter().enumerate() {
                if let Some(header) = header_names.get(i) {
                    // Nettoyer les valeurs
                    let value = field.trim().to_string();

                    // Ignorer les valeurs vides
                    if !value.is_empty() && value != "NA" && value != "N/A" && value != "-" {
                        row.insert(header.clone(), value);
                    }
                }
            }

            // Ignorer les lignes vides
            if !row.is_empty() {
                rows.push(row);
            }
        }

        Ok(rows)
    }

    pub fn get_headers(&self, bytes: &[u8]) -> Result<Vec<String>> {
        let content = decode_to_utf8(bytes, self.encoding)?;

        let mut reader = ReaderBuilder::new()
            .delimiter(self.separator as u8)
            .has_headers(true)
            .from_reader(content.as_bytes());

        let headers = reader.headers()?;
        Ok(headers.iter().map(|h| h.trim().to_string()).collect())
    }
}

// ============================================================================
// PARSER XLSX
// ============================================================================

pub struct XlsxParser;

impl XlsxParser {
    pub fn parse(bytes: &[u8]) -> Result<Vec<HashMap<String, String>>> {
        // Créer curseur mémoire
        let cursor = Cursor::new(bytes);

        // Ouvrir workbook
        let mut workbook: Xlsx<_> =
            open_workbook_from_rs(cursor).map_err(|e| anyhow!("Erreur ouverture XLSX: {}", e))?;

        // Lire première feuille
        let sheet_names = workbook.sheet_names();
        if sheet_names.is_empty() {
            return Err(anyhow!("Fichier XLSX vide (aucune feuille)"));
        }

        let sheet_name = sheet_names[0].clone();
        let range = workbook
            .worksheet_range(&sheet_name)
            .map_err(|e| anyhow!("Erreur lecture feuille: {}", e))?;

        // Extraire en-têtes (première ligne non vide)
        let mut rows_iter = range.rows();
        let headers_row = rows_iter
            .next()
            .ok_or_else(|| anyhow!("Aucune ligne trouvée dans la feuille"))?;

        let headers: Vec<String> = headers_row
            .iter()
            .map(Self::cell_to_string)
            .collect();

        if headers.is_empty() || headers.iter().all(|h| h.is_empty()) {
            return Err(anyhow!("En-têtes vides"));
        }

        // Convertir lignes → HashMap
        let mut rows = Vec::new();
        for row in rows_iter {
            // Skip lignes vides
            if row.iter().all(|cell| matches!(cell, DataType::Empty)) {
                continue;
            }

            let mut map = HashMap::new();
            for (i, cell) in row.iter().enumerate() {
                if let Some(header) = headers.get(i) {
                    if !header.is_empty() {
                        map.insert(header.clone(), Self::cell_to_string(cell));
                    }
                }
            }

            // Ne garder que les lignes avec au moins un champ
            if !map.is_empty() {
                rows.push(map);
            }
        }

        Ok(rows)
    }

    pub fn get_headers(bytes: &[u8]) -> Result<Vec<String>> {
        let cursor = Cursor::new(bytes);
        let mut workbook: Xlsx<_> =
            open_workbook_from_rs(cursor).map_err(|e| anyhow!("Erreur ouverture XLSX: {}", e))?;

        let sheet_names = workbook.sheet_names();
        if sheet_names.is_empty() {
            return Err(anyhow!("Fichier XLSX vide"));
        }

        let sheet_name = sheet_names[0].clone();
        let range = workbook
            .worksheet_range(&sheet_name)
            .map_err(|e| anyhow!("Erreur lecture feuille: {}", e))?;

        let headers_row = range
            .rows()
            .next()
            .ok_or_else(|| anyhow!("Aucune ligne trouvée"))?;

        Ok(headers_row
            .iter()
            .map(Self::cell_to_string)
            .collect())
    }

    /// Convertir cellule Excel en String
    fn cell_to_string(cell: &DataType) -> String {
        match cell {
            DataType::Int(i) => i.to_string(),
            DataType::Float(f) => {
                // Éviter notation scientifique pour petits nombres
                if f.abs() < 1e6 && f.fract() == 0.0 {
                    format!("{:.0}", f)
                } else {
                    f.to_string()
                }
            }
            DataType::String(s) => s.clone(),
            DataType::Bool(b) => b.to_string(),
            DataType::DateTime(dt) => {
                // Convertir Excel DateTime (nombre de jours depuis 1900)
                // Approximation simple pour dates récentes
                format!("{}", dt)
            }
            DataType::DateTimeIso(s) => s.clone(),
            DataType::DurationIso(s) => s.clone(),
            DataType::Error(e) => format!("#ERROR: {:?}", e),
            DataType::Empty => String::new(),
        }
    }
}

// ============================================================================
// PARSER JSON
// ============================================================================

pub struct JsonParser;

impl JsonParser {
    pub fn parse(bytes: &[u8]) -> Result<Vec<HashMap<String, String>>> {
        use serde_json::Value;

        // Déserialiser JSON
        let value: Value =
            serde_json::from_slice(bytes).map_err(|e| anyhow!("Erreur parsing JSON: {}", e))?;

        // Vérifier que c'est un array
        let array = value.as_array().ok_or_else(|| {
            anyhow!("Le JSON doit être un array d'objets. Format attendu: [{{...}}, {{...}}]")
        })?;

        if array.is_empty() {
            return Err(anyhow!("Array JSON vide"));
        }

        // Convertir chaque objet
        let mut rows = Vec::new();
        for (idx, item) in array.iter().enumerate() {
            let obj = item.as_object().ok_or_else(|| {
                anyhow!("Ligne {} : chaque élément doit être un objet JSON", idx + 1)
            })?;

            let mut map = HashMap::new();
            for (key, val) in obj {
                // Convertir toutes valeurs en String
                let str_val = Self::value_to_string(val);
                if !str_val.is_empty() {
                    map.insert(key.clone(), str_val);
                }
            }

            if !map.is_empty() {
                rows.push(map);
            }
        }

        if rows.is_empty() {
            return Err(anyhow!("Aucune ligne valide trouvée dans le JSON"));
        }

        Ok(rows)
    }

    /// Convertir Value JSON en String
    fn value_to_string(val: &serde_json::Value) -> String {
        match val {
            Value::String(s) => s.clone(),
            Value::Number(n) => {
                // Préserver les entiers sans décimales
                if let Some(i) = n.as_i64() {
                    i.to_string()
                } else if let Some(u) = n.as_u64() {
                    u.to_string()
                } else if let Some(f) = n.as_f64() {
                    if f.fract() == 0.0 && f.abs() < 1e15 {
                        format!("{:.0}", f)
                    } else {
                        f.to_string()
                    }
                } else {
                    n.to_string()
                }
            }
            Value::Bool(b) => b.to_string(),
            Value::Null => String::new(),
            Value::Array(arr) => {
                // Convertir array en string séparé par virgules
                arr.iter()
                    .map(Self::value_to_string)
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
                    .join(", ")
            }
            Value::Object(_) => {
                // Sérialiser objets imbriqués en JSON compact
                serde_json::to_string(val).unwrap_or_default()
            }
        }
    }
}

// ============================================================================
// PARSER UNIFIÉ
// ============================================================================

pub fn parse_file(bytes: &[u8], format: &FileFormat) -> Result<Vec<HashMap<String, String>>> {
    match format {
        FileFormat::Csv => {
            let parser = CsvParser::new(bytes)?;
            parser.parse(bytes)
        }
        FileFormat::Xlsx => XlsxParser::parse(bytes),
        FileFormat::Json => JsonParser::parse(bytes),
    }
}

pub fn get_file_headers(bytes: &[u8], format: &FileFormat) -> Result<Vec<String>> {
    match format {
        FileFormat::Csv => {
            let parser = CsvParser::new(bytes)?;
            parser.get_headers(bytes)
        }
        FileFormat::Xlsx => XlsxParser::get_headers(bytes),
        FileFormat::Json => Ok(vec![]), // JSON n'a pas d'en-têtes fixes
    }
}

// ============================================================================
// DÉTECTION FORMAT FICHIER
// ============================================================================

pub fn detect_file_format(filename: &str, bytes: &[u8]) -> FileFormat {
    // Par extension
    if filename.ends_with(".xlsx") || filename.ends_with(".xls") {
        return FileFormat::Xlsx;
    }
    if filename.ends_with(".json") {
        return FileFormat::Json;
    }

    // Par contenu (magic bytes)
    if bytes.starts_with(b"PK") {
        // ZIP/XLSX
        return FileFormat::Xlsx;
    }
    if bytes.starts_with(b"{") || bytes.starts_with(b"[") {
        return FileFormat::Json;
    }

    // Par défaut CSV
    FileFormat::Csv
}

// ============================================================================
// VALIDATION CSV INJECTION
// ============================================================================

/// Neutralise les formules Excel/CSV injection
pub fn sanitize_csv_value(value: &str) -> String {
    let trimmed = value.trim();

    // Si commence par =, +, -, @ → préfixer avec '
    if trimmed.starts_with('=')
        || trimmed.starts_with('+')
        || trimmed.starts_with('-')
        || trimmed.starts_with('@')
    {
        format!("'{}", trimmed)
    } else {
        trimmed.to_string()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_csv_separator() {
        let csv_comma = "col1,col2,col3\nval1,val2,val3";
        assert_eq!(detect_csv_separator(csv_comma), ',');

        let csv_semicolon = "col1;col2;col3\nval1;val2;val3";
        assert_eq!(detect_csv_separator(csv_semicolon), ';');

        let csv_tab = "col1\tcol2\tcol3\nval1\tval2\tval3";
        assert_eq!(detect_csv_separator(csv_tab), '\t');
    }

    #[test]
    fn test_detect_data_structure() {
        let headers_long = vec![
            "localite".to_string(),
            "profondeur_m".to_string(),
            "valeur".to_string(),
        ];
        assert_eq!(detect_data_structure(&headers_long), DataStructure::Long);

        let headers_large = vec![
            "localite".to_string(),
            "1".to_string(),
            "1.5".to_string(),
            "2".to_string(),
        ];
        assert_eq!(detect_data_structure(&headers_large), DataStructure::Large);
    }

    #[test]
    fn test_sanitize_csv_injection() {
        assert_eq!(sanitize_csv_injection("=SUM(A1:A10)"), "'=SUM(A1:A10)");
        assert_eq!(sanitize_csv_injection("+1234"), "'+1234");
        assert_eq!(sanitize_csv_injection("-1234"), "'-1234");
        assert_eq!(sanitize_csv_injection("@username"), "'@username");
        assert_eq!(sanitize_csv_injection("normal value"), "normal value");
    }
}
