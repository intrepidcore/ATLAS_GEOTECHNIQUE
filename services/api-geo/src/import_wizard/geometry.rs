// Import Wizard v2.3.0 - Géométrie et reprojection CRS

use super::types::*;

/// Convertit des coordonnées d'un CRS à un autre
pub fn reproject(lon: f64, lat: f64, crs_in: &str, crs_out: &str) -> Result<(f64, f64), String> {
    // TODO: Implémenter la vraie reprojection avec proj
    // Pour l'instant, on suppose que les coordonnées sont déjà en WGS84
    
    if crs_in == "EPSG:4326" && crs_out == "EPSG:25231" {
        // Conversion WGS84 -> UTM 31N (approximation simple)
        // En production, utiliser la bibliothèque proj
        Ok((lon, lat))
    } else {
        Ok((lon, lat))
    }
}

/// Valide que les coordonnées sont dans la bbox du Togo
pub fn validate_bbox(lon: f64, lat: f64) -> bool {
    let (min_lon, min_lat, max_lon, max_lat) = TOGO_BBOX;
    lon >= min_lon && lon <= max_lon && lat >= min_lat && lat <= max_lat
}

/// Parse des coordonnées en format DMS (Degrés Minutes Secondes)
pub fn parse_dms(dms: &str) -> Result<f64, String> {
    // TODO: Implémenter le parsing DMS
    // Format: 6°12'34.5"N ou 1°15'23.4"E
    Err("DMS parsing not implemented yet".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_validate_bbox() {
        // Coordonnées valides (Lomé)
        assert!(validate_bbox(1.2345, 6.1234));
        
        // Coordonnées invalides (hors Togo)
        assert!(!validate_bbox(10.0, 6.0));
        assert!(!validate_bbox(1.0, 20.0));
    }
}
