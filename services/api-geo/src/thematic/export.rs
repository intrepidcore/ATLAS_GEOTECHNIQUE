use crate::state::AppState;
use axum::{
    extract::State,
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::io::{Cursor, Write};
use zip::{write::FileOptions, ZipWriter};

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ClassBreakDto {
    pub index: i32,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub color: String,
    pub label: String,
}

#[derive(Debug, Deserialize)]
pub struct FiltersDto {
    pub adm1: Option<String>,
    pub adm2: Option<String>,
    pub adm3: Option<String>,
    pub min_sondages: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct ThematicExportRequest {
    pub parameter_id: String,
    pub parameter_label: String,
    pub unit: String,
    pub map_type: String,
    pub classes: Vec<ClassBreakDto>,
    pub filters: FiltersDto,
}

#[derive(Debug, Serialize)]
struct GeoJsonFeature {
    #[serde(rename = "type")]
    feature_type: String,
    geometry: serde_json::Value,
    properties: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct GeoJsonCollection {
    #[serde(rename = "type")]
    collection_type: String,
    features: Vec<GeoJsonFeature>,
}

// ============================================================================
// EXPORT QGIS HANDLER
// ============================================================================

pub async fn export_qgis_package(
    State(state): State<AppState>,
    Json(req): Json<ThematicExportRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let pool = &state.pool;
    
    tracing::info!("Export QGIS request: parameter={}, filters={:?}", req.parameter_id, req.filters);

    // 1. Récupérer les données des mailles avec géométrie
    let column = parameter_to_column(&req.parameter_id);
    
    let mut query = format!(
        r#"
        SELECT 
            code,
            ST_AsGeoJSON(geom)::text as geom_json,
            CAST({} AS DOUBLE PRECISION) as value,
            n_sondages,
            adm1_name,
            adm2_name,
            adm3_name
        FROM mailles_geotechnique_stats_wgs84
        WHERE {} IS NOT NULL
        "#,
        column, column
    );

    // Ajouter les filtres
    let mut params: Vec<String> = Vec::new();
    let mut param_idx = 1;

    if let Some(ref adm1) = req.filters.adm1 {
        query.push_str(&format!(
            " AND EXISTS (SELECT 1 FROM adm2_tg a2 WHERE a2.name = adm2_name AND a2.adm1_name = ${})",
            param_idx
        ));
        params.push(adm1.clone());
        param_idx += 1;
    }
    if let Some(ref adm2) = req.filters.adm2 {
        query.push_str(&format!(" AND adm2_name = ${}", param_idx));
        params.push(adm2.clone());
        param_idx += 1;
    }
    if let Some(ref adm3) = req.filters.adm3 {
        query.push_str(&format!(" AND adm3_name = ${}", param_idx));
        params.push(adm3.clone());
        param_idx += 1;
    }
    if let Some(min_sondages) = req.filters.min_sondages {
        query.push_str(&format!(" AND n_sondages >= {}", min_sondages));
    }

    query.push_str(" ORDER BY code");

    // Exécuter la requête
    let mut sql_query = sqlx::query(&query);
    for p in &params {
        sql_query = sql_query.bind(p);
    }

    let rows = sql_query
        .fetch_all(pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error in QGIS export: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e))
        })?;

    // 2. Construire le GeoJSON
    let mut features = Vec::new();

    for row in rows {
        let code: String = row.get("code");
        let geom_json: String = row.get("geom_json");
        let value: Option<f64> = row.get("value");
        let n_sondages: Option<i64> = row.get("n_sondages");
        let adm1: Option<String> = row.get("adm1_name");
        let adm2: Option<String> = row.get("adm2_name");
        let adm3: Option<String> = row.get("adm3_name");

        if let Some(v) = value {
            // Trouver la classe correspondante
            let mut class_idx = -1i32;
            let mut class_label = String::new();
            let mut class_color = String::from("#000000");

            for c in &req.classes {
                let ok_min = c.min.map(|m| v >= m).unwrap_or(true);
                let ok_max = c.max.map(|m| v < m).unwrap_or(true);
                if ok_min && ok_max {
                    class_idx = c.index;
                    class_label = c.label.clone();
                    class_color = c.color.clone();
                    break;
                }
            }

            let geometry: serde_json::Value = serde_json::from_str(&geom_json)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("JSON parse error: {}", e)))?;

            let mut props = serde_json::Map::new();
            props.insert("code".into(), serde_json::json!(code));
            props.insert("value".into(), serde_json::json!(v));
            props.insert("n_sondages".into(), serde_json::json!(n_sondages));
            props.insert("class_idx".into(), serde_json::json!(class_idx));
            props.insert("class_label".into(), serde_json::json!(class_label));
            props.insert("color".into(), serde_json::json!(class_color));
            props.insert("adm1".into(), serde_json::json!(adm1));
            props.insert("adm2".into(), serde_json::json!(adm2));
            props.insert("adm3".into(), serde_json::json!(adm3));

            features.push(GeoJsonFeature {
                feature_type: "Feature".into(),
                geometry,
                properties: props,
            });
        }
    }

    let geojson = GeoJsonCollection {
        collection_type: "FeatureCollection".into(),
        features,
    };

    let geojson_str = serde_json::to_string_pretty(&geojson)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("JSON error: {}", e)))?;

    // 3. Construire le style QML
    let qml = build_qml_style(&req);

    // 4. README
    let readme = format!(
        r#"Atlas Géotechnique Togo - Export QGIS
=====================================

Paramètre : {} ({})
Unité : {}
Type de carte : {}

Filtres appliqués :
- Région (ADM1) : {}
- Préfecture (ADM2) : {}
- Commune (ADM3) : {}
- Sondages minimum : {}

Instructions :
1. Dans QGIS, ajouter la couche "mailles_thematique.geojson"
2. Clic droit sur la couche > Propriétés > Symbologie
3. Charger le style : Cliquer sur "Style" > "Charger le style" > Sélectionner "style.qml"

Classes :
{}

Généré le : {}
"#,
        req.parameter_label,
        req.parameter_id,
        req.unit,
        req.map_type,
        req.filters.adm1.as_deref().unwrap_or("Toutes"),
        req.filters.adm2.as_deref().unwrap_or("Toutes"),
        req.filters.adm3.as_deref().unwrap_or("Toutes"),
        req.filters.min_sondages.map(|n| n.to_string()).unwrap_or("Aucun".into()),
        req.classes.iter().map(|c| format!("  - Classe {} : {} ({})", c.index, c.label, c.color)).collect::<Vec<_>>().join("\n"),
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    );

    // 5. Créer le ZIP en mémoire
    let mut buf = Vec::new();
    {
        let cursor = Cursor::new(&mut buf);
        let mut zip = ZipWriter::new(cursor);
        let options = FileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o644);

        // GeoJSON
        zip.start_file("mailles_thematique.geojson", options)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("ZIP error: {}", e)))?;
        zip.write_all(geojson_str.as_bytes())
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("ZIP write error: {}", e)))?;

        // QML Style
        zip.start_file("style.qml", options)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("ZIP error: {}", e)))?;
        zip.write_all(qml.as_bytes())
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("ZIP write error: {}", e)))?;

        // README
        zip.start_file("README.txt", options)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("ZIP error: {}", e)))?;
        zip.write_all(readme.as_bytes())
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("ZIP write error: {}", e)))?;

        zip.finish()
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("ZIP finish error: {}", e)))?;
    }

    // 6. Retourner le ZIP
    let filename = format!("atlas_{}_qgis.zip", req.parameter_id);
    let content_disposition = format!("attachment; filename=\"{}\"", filename);
    
    Ok((
        [
            (header::CONTENT_TYPE, "application/zip".to_string()),
            (header::CONTENT_DISPOSITION, content_disposition),
        ],
        buf,
    ))
}

// ============================================================================
// HELPERS
// ============================================================================

fn parameter_to_column(param_id: &str) -> &str {
    match param_id {
        "n_sondages" => "n_sondages",
        "n_echantillons" => "n_echantillons",
        "n_essais_total" => "n_essais_geo",
        "vbs_avg" => "vbs_avg",
        "ip_avg" => "ip_avg",
        "wl_avg" => "wl_avg",
        "wp_avg" => "wp_avg",
        "eg_avg" => "eg_avg",
        "eg_max" => "eg_max",
        "eg_min" => "eg_min",
        "gamma_d_max_avg" => "gamma_d_max_avg",
        "w_opt_avg" => "w_opt_avg",
        "passant_80um_avg" => "passant_80um_avg",
        "passant_2mm_avg" => "passant_2mm_avg",
        "passant_20mm_avg" => "passant_20mm_avg",
        _ => "n_sondages"
    }
}

fn build_qml_style(req: &ThematicExportRequest) -> String {
    let mut categories = String::new();
    
    for c in &req.classes {
        // Convertir la couleur hex en RGB
        let color = &c.color;
        let r = u8::from_str_radix(&color[1..3], 16).unwrap_or(0);
        let g = u8::from_str_radix(&color[3..5], 16).unwrap_or(0);
        let b = u8::from_str_radix(&color[5..7], 16).unwrap_or(0);
        
        categories.push_str(&format!(
            r#"        <category symbol="{}" value="{}" label="{}" render="true"/>
"#,
            c.index, c.index, c.label
        ));
    }

    let mut symbols = String::new();
    for c in &req.classes {
        let color = &c.color;
        let r = u8::from_str_radix(&color[1..3], 16).unwrap_or(0);
        let g = u8::from_str_radix(&color[3..5], 16).unwrap_or(0);
        let b = u8::from_str_radix(&color[5..7], 16).unwrap_or(0);
        
        symbols.push_str(&format!(
            r#"        <symbol name="{}" type="fill" clip_to_extent="1" force_rhr="0" alpha="0.8">
          <layer pass="0" class="SimpleFill" enabled="1" locked="0">
            <prop k="color" v="{},{},{},200"/>
            <prop k="style" v="solid"/>
            <prop k="outline_color" v="35,35,35,255"/>
            <prop k="outline_style" v="solid"/>
            <prop k="outline_width" v="0.26"/>
          </layer>
        </symbol>
"#,
            c.index, r, g, b
        ));
    }

    format!(
        r#"<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>
<qgis version="3.28" styleCategories="AllStyleCategories">
  <renderer-v2 type="categorizedSymbol" attr="class_idx" symbollevels="0" enableorderby="0">
    <categories>
{}    </categories>
    <symbols>
{}    </symbols>
  </renderer-v2>
  <labeling type="simple">
    <settings calloutType="simple">
      <text-style fieldName="class_label" fontSize="8" fontFamily="Sans Serif"/>
    </settings>
  </labeling>
</qgis>
"#,
        categories, symbols
    )
}
