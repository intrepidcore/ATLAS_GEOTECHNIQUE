// ============================================================================
// Validator: Validation des données importées
// ============================================================================

#![allow(dead_code)]

use super::types::*;
use anyhow::{anyhow, Result};
use chrono::Datelike;
use sha2::{Digest, Sha256};
use sqlx::{types::BigDecimal, PgPool, Row};

// ============================================================================
// VALIDATION ESSAIS
// ============================================================================

pub async fn validate_test_value(
    pool: &PgPool,
    type_essai: &str,
    valeur: f64,
    unite: Option<&str>,
) -> Result<(bool, Option<String>, Option<String>)> {
    let valeur_bd = BigDecimal::try_from(valeur).unwrap_or_default();

    let row = sqlx::query(
        r#"
        SELECT is_valid, error_msg, warning_msg
        FROM validate_test_value($1, $2, $3)
        "#,
    )
    .bind(type_essai)
    .bind(valeur_bd)
    .bind(unite)
    .fetch_one(pool)
    .await?;

    Ok((
        row.try_get::<bool, _>("is_valid").unwrap_or(false),
        row.try_get::<Option<String>, _>("error_msg").ok().flatten(),
        row.try_get::<Option<String>, _>("warning_msg")
            .ok()
            .flatten(),
    ))
}

pub async fn get_test_type_defaults(pool: &PgPool) -> Result<Vec<TestTypeDefault>> {
    let rows = sqlx::query(
        r#"
        SELECT 
            type_essai,
            default_unit,
            min_value,
            max_value,
            accepted_units,
            converter_fn,
            description
        FROM test_type_defaults
        ORDER BY type_essai
        "#,
    )
    .fetch_all(pool)
    .await?;

    let defaults = rows
        .into_iter()
        .map(|r| TestTypeDefault {
            type_essai: r.try_get("type_essai").unwrap(),
            default_unit: r.try_get("default_unit").unwrap(),
            min_value: r.try_get("min_value").ok(),
            max_value: r.try_get("max_value").ok(),
            accepted_units: r.try_get("accepted_units").ok(),
            converter_fn: r.try_get("converter_fn").ok(),
            description: r.try_get("description").ok(),
        })
        .collect();

    Ok(defaults)
}

// ============================================================================
// VALIDATION GÉOLOCALISATION
// ============================================================================

pub fn validate_geolocation(mode: &GeolocationMode, row: &ParsedRow) -> Result<()> {
    match mode {
        GeolocationMode::Exact => {
            if row.lon.is_none() || row.lat.is_none() {
                return Err(anyhow!(
                    "Coordonnées lon/lat obligatoires pour mode 'exact'"
                ));
            }

            // Vérifier plages valides (Togo)
            if let (Some(lon), Some(lat)) = (row.lon, row.lat) {
                if !(-1.0..=2.0).contains(&lon) {
                    return Err(anyhow!("Longitude hors du Togo: {}", lon));
                }
                if !(6.0..=11.5).contains(&lat) {
                    return Err(anyhow!("Latitude hors du Togo (6.0 - 11.5): {}", lat));
                }
            }
        }

        GeolocationMode::Centroid | GeolocationMode::Random => {
            if row.adm3.is_none() && row.adm2.is_none() {
                return Err(anyhow!("ADM2 minimum requis pour mode '{:?}'", mode));
            }
        }

        GeolocationMode::Unknown => {
            if row.adm2.is_none() {
                return Err(anyhow!("ADM2 obligatoire pour mode 'unknown'"));
            }
        }

        GeolocationMode::Maille => {
            if row.maille_code.is_none() {
                return Err(anyhow!("Code maille obligatoire pour mode 'maille'"));
            }
        }
    }

    Ok(())
}

// ============================================================================
// VALIDATION COMPLÈTE LIGNE
// ============================================================================

pub async fn validate_row(
    pool: &PgPool,
    row: &ParsedRow,
    mode: &GeolocationMode,
) -> (Vec<String>, Vec<String>) {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // 1. Validation identité
    if row.localite.is_none() && row.code.is_none() {
        errors.push("Localité ou code requis".to_string());
    }

    // 2. Validation profondeur
    if row.profondeur_m <= 0.0 {
        errors.push(format!("Profondeur invalide: {}", row.profondeur_m));
    }
    if row.profondeur_m > 50.0 {
        warnings.push(format!("Profondeur inhabituelle: {} m", row.profondeur_m));
    }

    // 3. Validation valeur ou analyse
    if row.valeur.is_none() && row.analyse_qualitative.is_none() {
        errors.push("Au moins valeur ou analyse_qualitative requis".to_string());
    }

    // 4. Validation type essai et plages
    if let Some(valeur) = row.valeur {
        match validate_test_value(pool, &row.type_essai, valeur, row.unite.as_deref()).await {
            Ok((is_valid, error_msg, warning_msg)) => {
                if !is_valid {
                    if let Some(msg) = error_msg {
                        errors.push(msg);
                    }
                }
                if let Some(msg) = warning_msg {
                    warnings.push(msg);
                }
            }
            Err(e) => {
                errors.push(format!("Erreur validation: {}", e));
            }
        }
    }

    // 5. Validation géolocalisation
    if let Err(e) = validate_geolocation(mode, row) {
        errors.push(e.to_string());
    }

    // 6. Validation date
    if let Some(date) = row.date {
        let now = chrono::Utc::now().naive_utc().date();
        if date > now {
            warnings.push("Date dans le futur".to_string());
        }
        if date.year() < 1950 {
            warnings.push(format!("Date très ancienne: {}", date.year()));
        }
    }

    (errors, warnings)
}

// ============================================================================
// FINGERPRINT ANTI-DOUBLON
// ============================================================================

pub fn compute_fingerprint(row: &ParsedRow) -> String {
    let key = format!(
        "{}|{}|{}|{}|{}",
        row.localite.as_deref().unwrap_or(""),
        row.date.map(|d| d.to_string()).unwrap_or_default(),
        row.type_essai,
        row.profondeur_m,
        row.valeur.map(|v| v.to_string()).unwrap_or_default()
    );

    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    let result = hasher.finalize();

    // Retourner les 16 premiers caractères du hash
    format!("{:x}", result)[..16].to_string()
}

pub async fn check_duplicate_fingerprint(pool: &PgPool, fingerprint: &str) -> Result<bool> {
    let row = sqlx::query(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM import_items 
            WHERE fingerprint = $1
        ) as exists
        "#,
    )
    .bind(fingerprint)
    .fetch_one(pool)
    .await?;

    Ok(row.try_get::<bool, _>("exists").unwrap_or(false))
}

// ============================================================================
// VALIDATION ANALYSES QUALITATIVES
// ============================================================================

const VALID_ANALYSES_VBS: &[&str] = &["Faible", "Moyen", "Forte", "Très forte"];
const VALID_ANALYSES_ATTERBERG: &[&str] = &["Faible", "Moyen", "Elevé", "Très élevé"];
const VALID_ANALYSES_GONFLEMENT: &[&str] = &["Faible", "Moyen", "Fort", "Très fort"];

pub fn validate_analyse_qualitative(type_essai: &str, analyse: &str) -> Result<String> {
    let normalized = normalize_analyse(analyse);

    let valid_values = match type_essai {
        "BleuMethylene_VBS" => VALID_ANALYSES_VBS,
        "Atterberg_WL" | "Atterberg_WP" | "Atterberg_IP" => VALID_ANALYSES_ATTERBERG,
        "PotentielGonflement_eg" => VALID_ANALYSES_GONFLEMENT,
        _ => return Ok(normalized),
    };

    // Vérifier si la valeur normalisée est dans la liste
    if valid_values
        .iter()
        .any(|&v| normalize_analyse(v) == normalized)
    {
        Ok(normalized)
    } else {
        Err(anyhow!(
            "Analyse qualitative invalide pour {}: '{}'. Valeurs acceptées: {:?}",
            type_essai,
            analyse,
            valid_values
        ))
    }
}

fn normalize_analyse(s: &str) -> String {
    s.trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

// ============================================================================
// CONVERSION UNITÉS
// ============================================================================

pub fn convert_unit(value: f64, from_unit: &str, to_unit: &str, type_essai: &str) -> Result<f64> {
    if from_unit == to_unit {
        return Ok(value);
    }

    match type_essai {
        "qc" => match (from_unit, to_unit) {
            ("kPa", "MPa") => Ok(value / 1000.0),
            ("MPa", "kPa") => Ok(value * 1000.0),
            _ => Err(anyhow!(
                "Conversion {} -> {} non supportée",
                from_unit,
                to_unit
            )),
        },
        "Proctor_gdmax" => {
            match (from_unit, to_unit) {
                ("g/cm³", "t/m³") => Ok(value), // Équivalent
                ("t/m³", "g/cm³") => Ok(value),
                _ => Err(anyhow!(
                    "Conversion {} -> {} non supportée",
                    from_unit,
                    to_unit
                )),
            }
        }
        _ => Err(anyhow!("Pas de conversion d'unité pour {}", type_essai)),
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_analyse() {
        assert_eq!(normalize_analyse("Faible"), "faible");
        assert_eq!(normalize_analyse("  Très  forte  "), "tres forte");
        assert_eq!(normalize_analyse("MOYEN"), "moyen");
    }

    #[test]
    fn test_validate_analyse_qualitative() {
        assert!(validate_analyse_qualitative("BleuMethylene_VBS", "Faible").is_ok());
        assert!(validate_analyse_qualitative("BleuMethylene_VBS", "  Très forte  ").is_ok());
        assert!(validate_analyse_qualitative("BleuMethylene_VBS", "Invalide").is_err());
    }

    #[test]
    fn test_convert_unit() {
        assert_eq!(convert_unit(1000.0, "kPa", "MPa", "qc").unwrap(), 1.0);
        assert_eq!(convert_unit(1.0, "MPa", "kPa", "qc").unwrap(), 1000.0);
        assert_eq!(
            convert_unit(2.0, "t/m³", "g/cm³", "Proctor_gdmax").unwrap(),
            2.0
        );
    }
}
