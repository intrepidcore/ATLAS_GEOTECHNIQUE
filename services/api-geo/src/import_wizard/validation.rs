// Import Wizard v2.3.0 - Validation métier

use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

use super::types::*;

/// Valide les données (dry-run) sans insertion en base
pub async fn validate_import(
    _file_path: &str,
    _mapping: &HashMap<String, String>,
    _geometry_config: &GeometryConfig,
    _upload_options: &UploadOptions,
    _conflict_policy: &ConflictPolicy,
    _pool: &PgPool,
) -> Result<PreviewResponse, String> {
    // TODO: Implémenter la validation complète
    // Pour l'instant, retourner un preview vide
    
    Ok(PreviewResponse {
        stats: PreviewStats {
            total_rows: 0,
            to_create: 0,
            to_update: 0,
            to_skip: 0,
            errors: 0,
            warnings: 0,
        },
        sample_rows: vec![],
        errors: vec![],
        warnings: vec![],
    })
}

/// Sauvegarde les erreurs de validation dans la base
pub async fn save_errors(
    pool: &PgPool,
    import_id: Uuid,
    errors: &[ValidationError],
) -> Result<(), String> {
    for error in errors {
        sqlx::query!(
            r#"
            INSERT INTO import_errors (import_id, row_no, column_name, error_code, message, severity, value, hint)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
            import_id,
            error.row as i32,
            error.column.as_deref(),
            error.code,
            error.message,
            match error.severity {
                ErrorSeverity::Error => "error",
                ErrorSeverity::Warning => "warning",
            },
            error.value.as_ref().map(|v| v.to_string()),
            error.hint.as_deref(),
        )
        .execute(pool)
        .await
        .map_err(|e| {
            eprintln!("[VALIDATION] Erreur sauvegarde erreur: {}", e);
            format!("Erreur sauvegarde erreur: {}", e)
        })?;
    }
    
    Ok(())
}

/// Valide les règles métier Atterberg
pub fn validate_atterberg(wl: Option<f64>, wp: Option<f64>, ip: Option<f64>) -> Vec<ValidationError> {
    let mut errors = vec![];
    
    // WL doit être entre 0 et 100
    if let Some(wl_val) = wl {
        if wl_val < 0.0 || wl_val > 100.0 {
            errors.push(ValidationError {
                row: 0,
                column: Some("wl".to_string()),
                code: "WL_OUT_OF_RANGE".to_string(),
                message: format!("WL={} hors limites (0-100%)", wl_val),
                severity: ErrorSeverity::Error,
                value: Some(serde_json::json!(wl_val)),
                hint: Some("Corriger la valeur (0-100)".to_string()),
            });
        }
    }
    
    // WP doit être entre 0 et 100
    if let Some(wp_val) = wp {
        if wp_val < 0.0 || wp_val > 100.0 {
            errors.push(ValidationError {
                row: 0,
                column: Some("wp".to_string()),
                code: "WP_OUT_OF_RANGE".to_string(),
                message: format!("WP={} hors limites (0-100%)", wp_val),
                severity: ErrorSeverity::Error,
                value: Some(serde_json::json!(wp_val)),
                hint: Some("Corriger la valeur (0-100)".to_string()),
            });
        }
    }
    
    // WP doit être <= WL
    if let (Some(wl_val), Some(wp_val)) = (wl, wp) {
        if wp_val > wl_val {
            errors.push(ValidationError {
                row: 0,
                column: Some("wp".to_string()),
                code: "WP_GT_WL".to_string(),
                message: format!("WP={} > WL={}", wp_val, wl_val),
                severity: ErrorSeverity::Error,
                value: Some(serde_json::json!(wp_val)),
                hint: Some("WP doit être ≤ WL".to_string()),
            });
        }
    }
    
    // IP doit être cohérent avec WL - WP
    if let (Some(wl_val), Some(wp_val), Some(ip_val)) = (wl, wp, ip) {
        let calculated_ip = wl_val - wp_val;
        if (ip_val - calculated_ip).abs() > 1.0 {
            errors.push(ValidationError {
                row: 0,
                column: Some("ip".to_string()),
                code: "IP_INCONSISTENT".to_string(),
                message: format!("IP={} incohérent avec WL-WP={}", ip_val, calculated_ip),
                severity: ErrorSeverity::Warning,
                value: Some(serde_json::json!(ip_val)),
                hint: Some(format!("IP devrait être proche de {:.1}", calculated_ip)),
            });
        }
    }
    
    errors
}

/// Valide les coordonnées géographiques
pub fn validate_coordinates(lon: f64, lat: f64) -> Vec<ValidationError> {
    let mut errors = vec![];
    
    // Vérifier bbox Togo
    let (min_lon, min_lat, max_lon, max_lat) = TOGO_BBOX;
    
    if lon < min_lon || lon > max_lon || lat < min_lat || lat > max_lat {
        errors.push(ValidationError {
            row: 0,
            column: Some("lon/lat".to_string()),
            code: "COORDS_OUT_OF_BBOX".to_string(),
            message: format!("Coordonnées ({}, {}) hors limites Togo", lon, lat),
            severity: ErrorSeverity::Error,
            value: Some(serde_json::json!([lon, lat])),
            hint: Some("Vérifier les coordonnées GPS".to_string()),
        });
    }
    
    // Vérifier (0,0)
    if lon == 0.0 && lat == 0.0 {
        errors.push(ValidationError {
            row: 0,
            column: Some("lon/lat".to_string()),
            code: "COORDS_ZERO".to_string(),
            message: "Coordonnées (0,0) invalides".to_string(),
            severity: ErrorSeverity::Error,
            value: Some(serde_json::json!([0.0, 0.0])),
            hint: Some("Renseigner les vraies coordonnées".to_string()),
        });
    }
    
    errors
}

/// Valide VBS
pub fn validate_vbs(vbs: Option<f64>) -> Vec<ValidationError> {
    let mut errors = vec![];
    
    if let Some(vbs_val) = vbs {
        if vbs_val < 0.0 {
            errors.push(ValidationError {
                row: 0,
                column: Some("vbs".to_string()),
                code: "VBS_NEGATIVE".to_string(),
                message: format!("VBS={} négatif", vbs_val),
                severity: ErrorSeverity::Error,
                value: Some(serde_json::json!(vbs_val)),
                hint: Some("VBS doit être ≥ 0".to_string()),
            });
        }
        
        if vbs_val > 50.0 {
            errors.push(ValidationError {
                row: 0,
                column: Some("vbs".to_string()),
                code: "VBS_TOO_HIGH".to_string(),
                message: format!("VBS={} très élevé", vbs_val),
                severity: ErrorSeverity::Warning,
                value: Some(serde_json::json!(vbs_val)),
                hint: Some("Vérifier la valeur (généralement < 50)".to_string()),
            });
        }
    }
    
    errors
}
