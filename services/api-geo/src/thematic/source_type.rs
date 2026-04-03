//! Badge scientifique : normalisation `source_type` pour les propriétés GeoJSON (`/thematic/data`).

/// Provenance affichable côté UI (couleurs : mesure, ked_pedologie, kriging_global, ml_infer, deterministic, data_density).
pub fn map_source_type(
    column: &str,
    ai_parameter: bool,
    is_ked_parameter: bool,
    interp_method: Option<&str>,
) -> &'static str {
    if column == "n_sondages_20km" {
        return "data_density";
    }
    if ai_parameter {
        if let Some(m) = interp_method {
            let m = m.trim();
            if m.is_empty() {
                // fallthrough
            } else {
                let lower = m.to_ascii_lowercase();
                if lower.starts_with("ked_pedologie") {
                    return "ked_pedologie";
                }
                if lower.starts_with("ordinary_kriging") {
                    return "kriging_global";
                }
                if lower.starts_with("regression_kriging") {
                    return "ml_infer";
                }
                return "deterministic";
            }
        }
        if is_ked_parameter {
            // Valeur KED sans méthode lisible : défaut scientifique
            return "ked_pedologie";
        }
        if matches!(column, "kriging_ip" | "kriging_vbs") {
            return "kriging_global";
        }
        if column.starts_with("ai_") || column.contains("infer") {
            return "ml_infer";
        }
        return "kriging_global";
    }
    "mesure"
}
