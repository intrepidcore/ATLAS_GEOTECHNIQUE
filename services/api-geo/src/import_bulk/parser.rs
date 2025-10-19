// ============================================================================
// Parser CSV/XLSX/JSON avec détection automatique
// ============================================================================

#![allow(dead_code)]

use super::types::*;
use anyhow::{anyhow, Result};
use csv::ReaderBuilder;
use encoding_rs::{Encoding, UTF_8, WINDOWS_1252, ISO_8859_15};
use std::collections::HashMap;

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
    *counts.iter()
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
    let has_windows_chars = bytes.iter().any(|&b| b >= 0x80 && b <= 0x9F);
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
        return Err(anyhow!("Erreur de décodage avec l'encodage {:?}", encoding.name()));
    }
    
    Ok(decoded.into_owned())
}

/// Détecte la structure des données (Long vs Large)
pub fn detect_data_structure(headers: &[String]) -> DataStructure {
    // Si présence de colonnes "profondeur" ou "profondeur_m" → Long
    let has_profondeur_col = headers.iter()
        .any(|h| h.to_lowercase().contains("profondeur") || h.to_lowercase() == "depth_m");
    
    if has_profondeur_col {
        return DataStructure::Long;
    }
    
    // Si présence de colonnes numériques (1, 1.5, 2, etc.) → Large
    let numeric_cols: Vec<_> = headers.iter()
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
        
        Ok(Self { separator, encoding })
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
        let header_names: Vec<String> = headers.iter()
            .map(|h| h.trim().to_string())
            .collect();
        
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
// PARSER XLSX (TODO Phase 3)
// ============================================================================

pub struct XlsxParser;

impl XlsxParser {
    pub fn parse(_bytes: &[u8]) -> Result<Vec<HashMap<String, String>>> {
        Err(anyhow!("XLSX parsing not implemented yet - Phase 3"))
    }
    
    pub fn get_headers(_bytes: &[u8]) -> Result<Vec<String>> {
        Err(anyhow!("XLSX parsing not implemented yet - Phase 3"))
    }
}

// ============================================================================
// PARSER JSON (TODO Phase 3)
// ============================================================================

pub struct JsonParser;

impl JsonParser {
    pub fn parse(_bytes: &[u8]) -> Result<Vec<HashMap<String, String>>> {
        Err(anyhow!("JSON parsing not implemented yet - Phase 3"))
    }
}

// ============================================================================
// PARSER UNIFIÉ
// ============================================================================

pub fn parse_file(
    bytes: &[u8],
    format: &FileFormat,
) -> Result<Vec<HashMap<String, String>>> {
    match format {
        FileFormat::Csv => {
            let parser = CsvParser::new(bytes)?;
            parser.parse(bytes)
        }
        FileFormat::Xlsx => XlsxParser::parse(bytes),
        FileFormat::Json => JsonParser::parse(bytes),
    }
}

pub fn get_file_headers(
    bytes: &[u8],
    format: &FileFormat,
) -> Result<Vec<String>> {
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
        || trimmed.starts_with('@') {
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
        let headers_long = vec!["localite".to_string(), "profondeur_m".to_string(), "valeur".to_string()];
        assert_eq!(detect_data_structure(&headers_long), DataStructure::Long);
        
        let headers_large = vec!["localite".to_string(), "1".to_string(), "1.5".to_string(), "2".to_string()];
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
