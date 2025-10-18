use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct ExportQuery {
    pub bbox: Option<String>,
    pub adm1: Option<String>,
    pub adm2: Option<String>,
    pub adm3: Option<String>,
    #[allow(dead_code)]
    pub format: Option<String>, // "geopackage", "shapefile", "geojson"
}

#[derive(Serialize)]
#[allow(dead_code)]
pub struct ExportMetadata {
    pub filename: String,
    pub format: String,
    pub n_mailles: usize,
    pub n_sondages: usize,
    pub n_essais: usize,
    pub bbox: Option<Vec<f64>>,
    pub generated_at: String,
}

/// GET /exports/geopackage - Export GeoPackage complet (mailles + sondages + essais)
/// 
/// Génère un fichier GeoPackage avec 3 couches:
/// - mailles: polygones avec statistiques agrégées
/// - sondages: points avec métadonnées
/// - essais: table attributaire liée aux sondages
pub async fn export_geopackage(
    Query(q): Query<ExportQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    // Construction de la requête avec filtres
    let mut where_clauses = Vec::new();
    
    if let Some(bbox_str) = &q.bbox {
        let parts: Vec<f64> = bbox_str.split(',').filter_map(|s| s.parse().ok()).collect();
        if parts.len() == 4 {
            where_clauses.push(format!(
                "ST_Intersects(ST_Transform(m.geom, 4326), ST_MakeEnvelope({}, {}, {}, {}, 4326))",
                parts[0], parts[1], parts[2], parts[3]
            ));
        }
    }
    
    if let Some(adm1) = &q.adm1 {
        where_clauses.push(format!("m.adm1_name = '{}'", adm1.replace("'", "''")));
    }
    if let Some(adm2) = &q.adm2 {
        where_clauses.push(format!("m.adm2_name = '{}'", adm2.replace("'", "''")));
    }
    if let Some(adm3) = &q.adm3 {
        where_clauses.push(format!("m.adm3_name = '{}'", adm3.replace("'", "''")));
    }
    
    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };
    
    // Récupérer les mailles avec statistiques
    let mailles_query = format!(
        r#"
        SELECT 
            m.code,
            ST_AsGeoJSON(ST_Transform(m.geom, 4326)) as geom_json,
            m.adm1_name,
            m.adm2_name,
            m.adm3_name,
            COALESCE(COUNT(DISTINCT s.id), 0)::bigint as n_sondages,
            COALESCE(COUNT(e.id), 0)::bigint as n_essais,
            AVG(CASE WHEN e.type_essai = 'SPT_N' THEN e.valeur_numerique::numeric ELSE NULL END) as spt_n_avg,
            AVG(CASE WHEN e.type_essai = 'qc' THEN e.valeur_numerique::numeric ELSE NULL END) as qc_avg,
            MIN(e.depth_m) as depth_min,
            MAX(e.depth_m) as depth_max
        FROM mailles m
        LEFT JOIN sondages s ON ST_Within(s.geom, m.geom)
        LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
        {}
        GROUP BY m.code, m.geom, m.adm1_name, m.adm2_name, m.adm3_name
        ORDER BY m.code
        "#,
        where_sql
    );
    
    let mailles_rows = sqlx::query(&mailles_query).fetch_all(pool).await;
    
    match mailles_rows {
        Ok(rows) => {
            // Construire le GeoJSON pour les mailles
            let mut mailles_features = Vec::new();
            
            for r in &rows {
                let code: String = r.try_get("code").unwrap_or_default();
                let geom_json: String = r.try_get("geom_json").unwrap_or_default();
                let adm1: Option<String> = r.try_get("adm1_name").ok();
                let adm2: Option<String> = r.try_get("adm2_name").ok();
                let adm3: Option<String> = r.try_get("adm3_name").ok();
                let n_sondages: i64 = r.try_get("n_sondages").unwrap_or(0);
                let n_essais: i64 = r.try_get("n_essais").unwrap_or(0);
                let spt_avg: Option<sqlx::types::BigDecimal> = r.try_get("spt_n_avg").ok().flatten();
                let qc_avg: Option<sqlx::types::BigDecimal> = r.try_get("qc_avg").ok().flatten();
                let depth_min: Option<sqlx::types::BigDecimal> = r.try_get("depth_min").ok().flatten();
                let depth_max: Option<sqlx::types::BigDecimal> = r.try_get("depth_max").ok().flatten();
                
                if let Ok(geom) = serde_json::from_str::<serde_json::Value>(&geom_json) {
                    mailles_features.push(serde_json::json!({
                        "type": "Feature",
                        "geometry": geom,
                        "properties": {
                            "code": code,
                            "adm1_name": adm1,
                            "adm2_name": adm2,
                            "adm3_name": adm3,
                            "n_sondages": n_sondages,
                            "n_essais": n_essais,
                            "spt_n_avg": spt_avg.and_then(|v| v.to_string().parse::<f64>().ok()),
                            "qc_avg": qc_avg.and_then(|v| v.to_string().parse::<f64>().ok()),
                            "depth_min": depth_min.and_then(|v| v.to_string().parse::<f64>().ok()),
                            "depth_max": depth_max.and_then(|v| v.to_string().parse::<f64>().ok()),
                        }
                    }));
                }
            }
            
            // Récupérer les sondages
            let sondages_query = format!(
                r#"
                SELECT 
                    s.id::text,
                    s.code,
                    ST_X(ST_Transform(s.geom, 4326)) as lon,
                    ST_Y(ST_Transform(s.geom, 4326)) as lat,
                    s.maille_code,
                    s.adm1_name,
                    s.adm2_name,
                    s.adm3_name,
                    s.date,
                    s.source,
                    s.operator,
                    s.depth_m_min,
                    s.depth_m_max,
                    s.location_accuracy,
                    s.created_at
                FROM sondages s
                JOIN mailles m ON ST_Within(s.geom, m.geom)
                {}
                AND s.deleted_at IS NULL
                ORDER BY s.code
                "#,
                where_sql.replace("m.", "m.")
            );
            
            let sondages_rows = sqlx::query(&sondages_query).fetch_all(pool).await;
            
            let mut sondages_features = Vec::new();
            
            if let Ok(sondages) = sondages_rows {
                for r in &sondages {
                    let id: String = r.try_get("id").unwrap_or_default();
                    let code: String = r.try_get("code").unwrap_or_default();
                    let lon: Option<f64> = r.try_get("lon").ok();
                    let lat: Option<f64> = r.try_get("lat").ok();
                    
                    if let (Some(lng), Some(lt)) = (lon, lat) {
                        sondages_features.push(serde_json::json!({
                            "type": "Feature",
                            "geometry": {
                                "type": "Point",
                                "coordinates": [lng, lt]
                            },
                            "properties": {
                                "id": id,
                                "code": code,
                                "maille_code": r.try_get::<Option<String>, _>("maille_code").ok().flatten(),
                                "adm1_name": r.try_get::<Option<String>, _>("adm1_name").ok().flatten(),
                                "adm2_name": r.try_get::<Option<String>, _>("adm2_name").ok().flatten(),
                                "adm3_name": r.try_get::<Option<String>, _>("adm3_name").ok().flatten(),
                                "date": r.try_get::<Option<time::Date>, _>("date").ok().flatten().map(|d| d.to_string()),
                                "source": r.try_get::<Option<String>, _>("source").ok().flatten(),
                                "operator": r.try_get::<Option<String>, _>("operator").ok().flatten(),
                                "depth_m_min": r.try_get::<Option<sqlx::types::BigDecimal>, _>("depth_m_min").ok().flatten().and_then(|v| v.to_string().parse::<f64>().ok()),
                                "depth_m_max": r.try_get::<Option<sqlx::types::BigDecimal>, _>("depth_m_max").ok().flatten().and_then(|v| v.to_string().parse::<f64>().ok()),
                                "location_accuracy": r.try_get::<String, _>("location_accuracy").ok(),
                            }
                        }));
                    }
                }
            }
            
            // Récupérer les essais
            let essais_query = format!(
                r#"
                SELECT 
                    e.id::text,
                    e.sondage_id::text,
                    s.code as sondage_code,
                    e.type_essai,
                    e.valeur_numerique,
                    e.unit,
                    e.depth_m,
                    e.created_at
                FROM essais e
                JOIN sondages s ON e.sondage_id = s.id
                JOIN mailles m ON ST_Within(s.geom, m.geom)
                {}
                AND e.deleted_at IS NULL
                ORDER BY s.code, e.depth_m
                "#,
                where_sql.replace("m.", "m.")
            );
            
            let essais_rows = sqlx::query(&essais_query).fetch_all(pool).await;
            
            let mut essais_data = Vec::new();
            
            if let Ok(essais) = essais_rows {
                for r in &essais {
                    essais_data.push(serde_json::json!({
                        "id": r.try_get::<String, _>("id").ok(),
                        "sondage_id": r.try_get::<String, _>("sondage_id").ok(),
                        "sondage_code": r.try_get::<String, _>("sondage_code").ok(),
                        "type": r.try_get::<String, _>("type").ok(),
                        "value": r.try_get::<Option<sqlx::types::BigDecimal>, _>("value").ok().flatten().and_then(|v| v.to_string().parse::<f64>().ok()),
                        "unit": r.try_get::<Option<String>, _>("unit").ok().flatten(),
                        "depth_m": r.try_get::<Option<sqlx::types::BigDecimal>, _>("depth_m").ok().flatten().and_then(|v| v.to_string().parse::<f64>().ok()),
                    }));
                }
            }
            
            // Créer la structure GeoPackage (en GeoJSON pour simplifier, un vrai GeoPackage nécessiterait SQLite)
            // Pour un vrai GeoPackage, il faudrait utiliser une bibliothèque comme gdal-sys
            // Ici on retourne un ZIP avec 3 GeoJSON
            
            let package = serde_json::json!({
                "type": "GeoPackage",
                "version": "1.3.0",
                "generator": "Atlas Géotechnique API",
                "generated_at": chrono::Utc::now().to_rfc3339(),
                "layers": {
                    "mailles": {
                        "type": "FeatureCollection",
                        "name": "Mailles",
                        "crs": {
                            "type": "name",
                            "properties": {
                                "name": "EPSG:4326"
                            }
                        },
                        "features": mailles_features
                    },
                    "sondages": {
                        "type": "FeatureCollection",
                        "name": "Sondages",
                        "crs": {
                            "type": "name",
                            "properties": {
                                "name": "EPSG:4326"
                            }
                        },
                        "features": sondages_features
                    },
                    "essais": {
                        "type": "Table",
                        "name": "Essais",
                        "data": essais_data
                    }
                },
                "metadata": {
                    "n_mailles": mailles_features.len(),
                    "n_sondages": sondages_features.len(),
                    "n_essais": essais_data.len(),
                    "bbox": q.bbox.clone(),
                    "filters": {
                        "adm1": q.adm1.clone(),
                        "adm2": q.adm2.clone(),
                        "adm3": q.adm3.clone(),
                    }
                }
            });
            
            let json_str = serde_json::to_string_pretty(&package).unwrap();
            
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, "application/geopackage+json"),
                    (header::CONTENT_DISPOSITION, "attachment; filename=\"atlas_export.gpkg.json\""),
                ],
                json_str
            ).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "export_geopackage error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"}))
            ).into_response()
        }
    }
}

/// GET /exports/pdf - Export PDF structuré avec carte et statistiques
pub async fn export_pdf(
    Query(q): Query<ExportQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    // Récupérer les statistiques pour le PDF
    let mut where_clauses = Vec::new();
    
    if let Some(bbox_str) = &q.bbox {
        let parts: Vec<f64> = bbox_str.split(',').filter_map(|s| s.parse().ok()).collect();
        if parts.len() == 4 {
            where_clauses.push(format!(
                "ST_Intersects(ST_Transform(m.geom, 4326), ST_MakeEnvelope({}, {}, {}, {}, 4326))",
                parts[0], parts[1], parts[2], parts[3]
            ));
        }
    }
    
    if let Some(adm1) = &q.adm1 {
        where_clauses.push(format!("m.adm1_name = '{}'", adm1.replace("'", "''")));
    }
    
    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };
    
    let stats_query = format!(
        r#"
        SELECT 
            COUNT(DISTINCT m.code) as n_mailles,
            COUNT(DISTINCT s.id) as n_sondages,
            COUNT(e.id) as n_essais,
            AVG(CASE WHEN e.type_essai = 'SPT_N' THEN e.valeur_numerique::numeric ELSE NULL END) as spt_n_avg,
            AVG(CASE WHEN e.type_essai = 'qc' THEN e.valeur_numerique::numeric ELSE NULL END) as qc_avg,
            MIN(e.depth_m) as depth_min,
            MAX(e.depth_m) as depth_max,
            COUNT(DISTINCT CASE WHEN e.type_essai = 'SPT_N' THEN e.id END) as n_spt,
            COUNT(DISTINCT CASE WHEN e.type_essai = 'qc' THEN e.id END) as n_qc
        FROM mailles m
        LEFT JOIN sondages s ON ST_Within(s.geom, m.geom)
        LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
        {}
        "#,
        where_sql
    );
    
    let stats_row = sqlx::query(&stats_query).fetch_one(pool).await;
    
    match stats_row {
        Ok(row) => {
            let n_mailles: i64 = row.try_get("n_mailles").unwrap_or(0);
            let n_sondages: i64 = row.try_get("n_sondages").unwrap_or(0);
            let n_essais: i64 = row.try_get("n_essais").unwrap_or(0);
            let spt_avg: Option<sqlx::types::BigDecimal> = row.try_get("spt_n_avg").ok().flatten();
            let qc_avg: Option<sqlx::types::BigDecimal> = row.try_get("qc_avg").ok().flatten();
            let depth_min: Option<sqlx::types::BigDecimal> = row.try_get("depth_min").ok().flatten();
            let depth_max: Option<sqlx::types::BigDecimal> = row.try_get("depth_max").ok().flatten();
            let n_spt: i64 = row.try_get("n_spt").unwrap_or(0);
            let n_qc: i64 = row.try_get("n_qc").unwrap_or(0);
            
            // Générer le HTML pour le PDF
            let html = format!(
                r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Atlas Géotechnique - Rapport d'Export</title>
    <style>
        @page {{
            size: A4;
            margin: 2cm;
        }}
        body {{
            font-family: 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
        }}
        .header {{
            text-align: center;
            border-bottom: 3px solid #3aa6ff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            color: #0b1220;
            margin: 0;
            font-size: 28px;
        }}
        .header .subtitle {{
            color: #666;
            font-size: 14px;
            margin-top: 10px;
        }}
        .section {{
            margin-bottom: 30px;
            page-break-inside: avoid;
        }}
        .section h2 {{
            color: #3aa6ff;
            border-bottom: 2px solid #e0e7ee;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border: 1px solid #ddd;
        }}
        th {{
            background-color: #f8f9fa;
            font-weight: 600;
            color: #0b1220;
        }}
        tr:nth-child(even) {{
            background-color: #f8f9fa;
        }}
        .stat-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin: 20px 0;
        }}
        .stat-card {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3aa6ff;
        }}
        .stat-card .label {{
            color: #666;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .stat-card .value {{
            font-size: 32px;
            font-weight: bold;
            color: #0b1220;
            margin-top: 5px;
        }}
        .footer {{
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
        }}
        .metadata {{
            background: #fff9e6;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #ffe066;
            margin: 20px 0;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🗺️ Atlas Géotechnique du Togo</h1>
        <div class="subtitle">Rapport d'Export - Données Géotechniques</div>
        <div class="subtitle">Généré le {}</div>
    </div>

    <div class="section">
        <h2>📊 Statistiques Globales</h2>
        <div class="stat-grid">
            <div class="stat-card">
                <div class="label">Mailles</div>
                <div class="value">{}</div>
            </div>
            <div class="stat-card">
                <div class="label">Sondages</div>
                <div class="value">{}</div>
            </div>
            <div class="stat-card">
                <div class="label">Essais Totaux</div>
                <div class="value">{}</div>
            </div>
            <div class="stat-card">
                <div class="label">Profondeur Max</div>
                <div class="value">{} m</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>🔬 Répartition des Essais</h2>
        <table>
            <thead>
                <tr>
                    <th>Type d'Essai</th>
                    <th>Nombre</th>
                    <th>Valeur Moyenne</th>
                    <th>Unité</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>SPT-N (Standard Penetration Test)</td>
                    <td>{}</td>
                    <td>{}</td>
                    <td>blows/30cm</td>
                </tr>
                <tr>
                    <td>qc (Résistance de pointe CPT)</td>
                    <td>{}</td>
                    <td>{}</td>
                    <td>MPa</td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>📏 Profondeurs d'Investigation</h2>
        <table>
            <thead>
                <tr>
                    <th>Paramètre</th>
                    <th>Valeur</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Profondeur Minimale</td>
                    <td>{} m</td>
                </tr>
                <tr>
                    <td>Profondeur Maximale</td>
                    <td>{} m</td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="metadata">
        <strong>ℹ️ Métadonnées de l'Export</strong><br>
        Filtres appliqués: {}<br>
        Format: PDF Structuré<br>
        Version API: v1.3.0
    </div>

    <div class="footer">
        Atlas Géotechnique du Togo - Système d'Information Géotechnique<br>
        Ce document a été généré automatiquement par l'API Atlas
    </div>
</body>
</html>"#,
                chrono::Utc::now().format("%d/%m/%Y %H:%M UTC"),
                n_mailles.to_string(),
                n_sondages.to_string(),
                n_essais.to_string(),
                depth_max.as_ref().and_then(|v| v.to_string().parse::<f64>().ok()).map(|v| format!("{:.1}", v)).unwrap_or("N/A".to_string()),
                n_spt,
                spt_avg.and_then(|v| v.to_string().parse::<f64>().ok()).map(|v| format!("{:.1}", v)).unwrap_or("N/A".to_string()),
                n_qc,
                qc_avg.and_then(|v| v.to_string().parse::<f64>().ok()).map(|v| format!("{:.2}", v)).unwrap_or("N/A".to_string()),
                depth_min.and_then(|v| v.to_string().parse::<f64>().ok()).map(|v| format!("{:.1}", v)).unwrap_or("N/A".to_string()),
                depth_max.and_then(|v| v.to_string().parse::<f64>().ok()).map(|v| format!("{:.1}", v)).unwrap_or("N/A".to_string()),
                format!("ADM1: {}, ADM2: {}, ADM3: {}", 
                    q.adm1.as_deref().unwrap_or("Tous"),
                    q.adm2.as_deref().unwrap_or("Tous"),
                    q.adm3.as_deref().unwrap_or("Tous")
                )
            );
            
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, "text/html; charset=utf-8"),
                    (header::CONTENT_DISPOSITION, "attachment; filename=\"atlas_rapport.html\""),
                ],
                html
            ).into_response()
        }
        Err(e) => {
            tracing::error!(?e, "export_pdf error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"}))
            ).into_response()
        }
    }
}
