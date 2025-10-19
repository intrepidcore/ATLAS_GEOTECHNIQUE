// ============================================================================
// Transformer: Conversion Large → Long et mapping colonnes
// ============================================================================

use super::types::*;
use anyhow::{anyhow, Result};
use chrono::NaiveDate;
use std::collections::HashMap;

// ============================================================================
// TRANSFORMATION LARGE → LONG
// ============================================================================

/// Transforme une ligne format "Large" en plusieurs lignes format "Long"
/// 
/// Exemple:
/// Input:  {"localite": "Adjengré", "1": "77.73", "1.5": "81.8", "2": "74.85"}
/// Output: [
///   {localite: "Adjengré", profondeur_m: 1.0, valeur: 77.73},
///   {localite: "Adjengré", profondeur_m: 1.5, valeur: 81.8},
///   {localite: "Adjengré", profondeur_m: 2.0, valeur: 74.85}
/// ]
pub fn transform_large_to_long(
    row: &HashMap<String, String>,
    profondeur_cols: &[String],
    type_essai: &str,
    mapping: &MappingConfig,
) -> Result<Vec<ParsedRow>> {
    let mut result = Vec::new();
    
    // Extraire les valeurs communes
    let localite = mapping.localite_col.as_ref()
        .and_then(|col| row.get(col))
        .map(|s| s.clone());
    
    let code = mapping.code_col.as_ref()
        .and_then(|col| row.get(col))
        .map(|s| s.clone());
    
    let date = mapping.date_col.as_ref()
        .and_then(|col| row.get(col))
        .and_then(|s| parse_date(s).ok());
    
    let source = mapping.source_col.as_ref()
        .and_then(|col| row.get(col))
        .map(|s| s.clone());
    
    let operator = mapping.operator_col.as_ref()
        .and_then(|col| row.get(col))
        .map(|s| s.clone());
    
    let type_sol = mapping.type_sol_col.as_ref()
        .and_then(|col| row.get(col))
        .map(|s| s.clone());
    
    let adm1 = mapping.adm1_col.as_ref()
        .and_then(|col| row.get(col))
        .map(|s| s.clone());
    
    let adm2 = mapping.adm2_col.as_ref()
        .and_then(|col| row.get(col))
        .map(|s| s.clone());
    
    let adm3 = mapping.adm3_col.as_ref()
        .and_then(|col| row.get(col))
        .map(|s| s.clone());
    
    // Pour chaque colonne de profondeur
    for (idx, prof_col) in profondeur_cols.iter().enumerate() {
        // Parser la profondeur depuis le nom de colonne
        let profondeur_m = prof_col.parse::<f64>()
            .map_err(|_| anyhow!("Colonne profondeur invalide: {}", prof_col))?;
        
        // Extraire la valeur
        if let Some(valeur_str) = row.get(prof_col) {
            // Ignorer les valeurs vides
            if valeur_str.trim().is_empty() || valeur_str == "NA" || valeur_str == "-" {
                continue;
            }
            
            let valeur = valeur_str.parse::<f64>().ok();
            
            // Vérifier si c'est une analyse qualitative
            let analyse_qualitative = if valeur.is_none() {
                Some(valeur_str.clone())
            } else {
                None
            };
            
            result.push(ParsedRow {
                row_idx: idx as i32,
                localite: localite.clone(),
                code: code.clone(),
                type_essai: type_essai.to_string(),
                profondeur_m,
                valeur,
                analyse_qualitative,
                unite: mapping.unite_col.as_ref()
                    .and_then(|col| row.get(col))
                    .map(|s| s.clone()),
                date,
                source: source.clone(),
                operator: operator.clone(),
                type_sol: type_sol.clone(),
                lon: None,
                lat: None,
                adm1: adm1.clone(),
                adm2: adm2.clone(),
                adm3: adm3.clone(),
                maille_code: None,
            });
        }
    }
    
    Ok(result)
}

// ============================================================================
// MAPPING COLONNES FORMAT LONG
// ============================================================================

/// Mappe une ligne format "Long" vers ParsedRow
pub fn map_long_row(
    row: &HashMap<String, String>,
    row_idx: i32,
    mapping: &MappingConfig,
) -> Result<ParsedRow> {
    // Type d'essai (fixe ou colonne)
    let type_essai = if let Some(ref col) = mapping.type_essai_col {
        row.get(col)
            .ok_or_else(|| anyhow!("Colonne type_essai '{}' manquante", col))?
            .clone()
    } else if let Some(ref fixed) = mapping.type_essai {
        fixed.clone()
    } else {
        return Err(anyhow!("Type d'essai non spécifié"));
    };
    
    // Profondeur (obligatoire)
    let profondeur_m = mapping.profondeur_col.as_ref()
        .and_then(|col| row.get(col))
        .ok_or_else(|| anyhow!("Colonne profondeur manquante"))?
        .parse::<f64>()
        .map_err(|_| anyhow!("Profondeur invalide"))?;
    
    // Valeur (optionnelle si analyse qualitative)
    let valeur = mapping.valeur_col.as_ref()
        .and_then(|col| row.get(col))
        .and_then(|s| s.parse::<f64>().ok());
    
    // Analyse qualitative
    let analyse_qualitative = mapping.analyse_col.as_ref()
        .and_then(|col| row.get(col))
        .map(|s| s.clone());
    
    // Vérifier qu'au moins valeur OU analyse est présente
    if valeur.is_none() && analyse_qualitative.is_none() {
        return Err(anyhow!("Au moins valeur ou analyse_qualitative requis"));
    }
    
    Ok(ParsedRow {
        row_idx,
        localite: mapping.localite_col.as_ref()
            .and_then(|col| row.get(col))
            .map(|s| s.clone()),
        code: mapping.code_col.as_ref()
            .and_then(|col| row.get(col))
            .map(|s| s.clone()),
        type_essai,
        profondeur_m,
        valeur,
        analyse_qualitative,
        unite: mapping.unite_col.as_ref()
            .and_then(|col| row.get(col))
            .map(|s| s.clone()),
        date: mapping.date_col.as_ref()
            .and_then(|col| row.get(col))
            .and_then(|s| parse_date(s).ok()),
        source: mapping.source_col.as_ref()
            .and_then(|col| row.get(col))
            .map(|s| s.clone()),
        operator: mapping.operator_col.as_ref()
            .and_then(|col| row.get(col))
            .map(|s| s.clone()),
        type_sol: mapping.type_sol_col.as_ref()
            .and_then(|col| row.get(col))
            .map(|s| s.clone()),
        lon: mapping.lon_col.as_ref()
            .and_then(|col| row.get(col))
            .and_then(|s| s.parse::<f64>().ok()),
        lat: mapping.lat_col.as_ref()
            .and_then(|col| row.get(col))
            .and_then(|s| s.parse::<f64>().ok()),
        adm1: mapping.adm1_col.as_ref()
            .and_then(|col| row.get(col))
            .map(|s| s.clone()),
        adm2: mapping.adm2_col.as_ref()
            .and_then(|col| row.get(col))
            .map(|s| s.clone()),
        adm3: mapping.adm3_col.as_ref()
            .and_then(|col| row.get(col))
            .map(|s| s.clone()),
        maille_code: mapping.maille_col.as_ref()
            .and_then(|col| row.get(col))
            .map(|s| s.clone()),
    })
}

// ============================================================================
// GROUPEMENT PAR SONDAGE
// ============================================================================

/// Groupe les lignes parsées par sondage (code ou localite+date)
pub fn group_by_survey(rows: Vec<ParsedRow>) -> Vec<GroupedSurvey> {
    let mut surveys: HashMap<String, GroupedSurvey> = HashMap::new();
    
    for row in rows {
        // Générer une clé unique pour le sondage
        let key = if let Some(ref code) = row.code {
            code.clone()
        } else if let Some(ref localite) = row.localite {
            format!("{}_{}", localite, row.date.map(|d| d.to_string()).unwrap_or_default())
        } else {
            format!("UNKNOWN_{}", row.row_idx)
        };
        
        surveys.entry(key.clone()).or_insert_with(|| GroupedSurvey {
            code: row.code.clone().unwrap_or_else(|| key.clone()),
            localite: row.localite.clone(),
            date: row.date,
            source: row.source.clone(),
            operator: row.operator.clone(),
            type_sol: row.type_sol.clone(),
            lon: row.lon,
            lat: row.lat,
            adm1_id: None,
            adm2_id: None,
            adm3_id: None,
            maille_code: row.maille_code.clone(),
            tests: Vec::new(),
        });
    }
    
    surveys.into_values().collect()
}

// ============================================================================
// PARSING DATES
// ============================================================================

/// Parse une date depuis différents formats
pub fn parse_date(date_str: &str) -> Result<NaiveDate> {
    // Format ISO (YYYY-MM-DD)
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        return Ok(date);
    }
    
    // Format français (DD/MM/YYYY) - ATTENTION: ambigu
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%d/%m/%Y") {
        return Ok(date);
    }
    
    // Format US (MM/DD/YYYY) - ATTENTION: ambigu
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%m/%d/%Y") {
        return Ok(date);
    }
    
    // Format avec tirets (DD-MM-YYYY)
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%d-%m-%Y") {
        return Ok(date);
    }
    
    Err(anyhow!("Format de date non reconnu: {}. Utilisez YYYY-MM-DD", date_str))
}

// ============================================================================
// GÉNÉRATION CODE SONDAGE
// ============================================================================

/// Génère un code sondage automatique si manquant
pub fn generate_survey_code(
    localite: Option<&str>,
    adm3_pcode: Option<&str>,
    index: usize,
) -> String {
    if let Some(pcode) = adm3_pcode {
        format!("AUTO-{}-{:04}", pcode, index)
    } else if let Some(loc) = localite {
        let clean_loc = loc.chars()
            .filter(|c| c.is_alphanumeric())
            .take(8)
            .collect::<String>()
            .to_uppercase();
        format!("AUTO-{}-{:04}", clean_loc, index)
    } else {
        format!("AUTO-UNKNOWN-{:04}", index)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_date() {
        assert!(parse_date("2024-01-15").is_ok());
        assert!(parse_date("15/01/2024").is_ok());
        assert!(parse_date("01/15/2024").is_ok());
        assert!(parse_date("15-01-2024").is_ok());
        assert!(parse_date("invalid").is_err());
    }
    
    #[test]
    fn test_generate_survey_code() {
        assert_eq!(generate_survey_code(Some("Adjengré"), Some("TG040106"), 1), "AUTO-TG040106-0001");
        assert_eq!(generate_survey_code(Some("Adjengré"), None, 1), "AUTO-ADJENGRE-0001");
        assert_eq!(generate_survey_code(None, None, 1), "AUTO-UNKNOWN-0001");
    }
}
