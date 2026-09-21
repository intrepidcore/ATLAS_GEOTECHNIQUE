// Import Wizard v2.3.0 - Mapping et inférence automatique

use std::collections::HashMap;

/// Infère automatiquement le mapping des colonnes
pub fn infer_mapping(columns: &[String]) -> HashMap<String, String> {
    let mut mapping = HashMap::new();

    for col in columns {
        let col_lower = col.to_lowercase();

        // Longitude
        if matches_pattern(
            &col_lower,
            &["lon", "longitude", "x", "est", "e", "easting"],
        ) {
            mapping.insert("lon".to_string(), col.clone());
        }

        // Latitude
        if matches_pattern(
            &col_lower,
            &["lat", "latitude", "y", "nord", "n", "northing"],
        ) {
            mapping.insert("lat".to_string(), col.clone());
        }

        // Code sondage
        if matches_pattern(
            &col_lower,
            &[
                "code",
                "code_site",
                "code_sondage",
                "site_code",
                "survey_code",
            ],
        ) {
            mapping.insert("code".to_string(), col.clone());
        }

        // Profondeur
        if matches_pattern(&col_lower, &["depth", "prof", "profondeur", "z", "depth_m"]) {
            mapping.insert("depth_m".to_string(), col.clone());
        }

        // WL
        if matches_pattern(&col_lower, &["wl", "limite_liquide", "liquid_limit"]) {
            mapping.insert("wl".to_string(), col.clone());
        }

        // WP
        if matches_pattern(&col_lower, &["wp", "limite_plastique", "plastic_limit"]) {
            mapping.insert("wp".to_string(), col.clone());
        }

        // IP
        if matches_pattern(&col_lower, &["ip", "indice_plasticite", "plasticity_index"]) {
            mapping.insert("ip".to_string(), col.clone());
        }

        // VBS
        if matches_pattern(&col_lower, &["vbs", "bleu", "methylene"]) {
            mapping.insert("vbs".to_string(), col.clone());
        }

        // Date
        if matches_pattern(&col_lower, &["date", "date_sondage", "survey_date"]) {
            mapping.insert("date".to_string(), col.clone());
        }

        // Localité
        if matches_pattern(&col_lower, &["localite", "locality", "location", "lieu"]) {
            mapping.insert("localite".to_string(), col.clone());
        }
    }

    mapping
}

/// Un alias correspond-il au nom de colonne ?
///
/// La recherche en sous-chaîne pure était fausse : les alias d'une seule
/// lettre (« x », « e », « n », « y », « z ») se retrouvent dans presque tous
/// les noms de colonnes. « depth_m » contient « e » et était donc mappé en
/// longitude — en écrasant la vraie colonne, puisque la boucle passe après.
/// Les alias courts ne valent désormais qu'en égalité ou en jeton complet.
fn matches_pattern(value: &str, patterns: &[&str]) -> bool {
    let normalised: String = value
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect();
    let tokens: Vec<&str> = normalised.split('_').filter(|t| !t.is_empty()).collect();

    patterns.iter().any(|p| {
        normalised == *p || tokens.contains(p) || (p.len() >= 3 && normalised.contains(p))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_infer_mapping() {
        let columns = vec![
            "code_site".to_string(),
            "longitude".to_string(),
            "latitude".to_string(),
            "depth_m".to_string(),
            "wl".to_string(),
            "wp".to_string(),
        ];

        let mapping = infer_mapping(&columns);

        assert_eq!(mapping.get("code"), Some(&"code_site".to_string()));
        assert_eq!(mapping.get("lon"), Some(&"longitude".to_string()));
        assert_eq!(mapping.get("lat"), Some(&"latitude".to_string()));
        assert_eq!(mapping.get("depth_m"), Some(&"depth_m".to_string()));
        assert_eq!(mapping.get("wl"), Some(&"wl".to_string()));
        assert_eq!(mapping.get("wp"), Some(&"wp".to_string()));
    }
}
