// Module Import/Export pour CSV et GeoJSON
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportRequest {
    pub format: ExportFormat,
    pub tables: Vec<String>,
    pub include_geometry: bool,
    pub srid: Option<i32>, // Pour GeoJSON
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Csv,
    GeoJson,
    Sql,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub filename: String,
    pub size_bytes: i64,
    pub row_count: i64,
    pub download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRequest {
    pub format: ImportFormat,
    pub target_table: String,
    pub create_staging: bool,
    pub mapping: Option<Vec<ColumnMapping>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImportFormat {
    Csv,
    GeoJson,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnMapping {
    pub source_column: String,
    pub target_column: String,
    pub transform: Option<String>, // Expression SQL optionnelle
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub staging_id: Option<String>,
    pub rows_imported: i64,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Exporter une table en CSV
pub async fn export_to_csv(
    pool: &PgPool,
    schema: &str,
    table: &str,
) -> Result<String, sqlx::Error> {
    let query = format!("SELECT * FROM {}.{}", schema, table);
    let rows = sqlx::query(&query).fetch_all(pool).await?;

    if rows.is_empty() {
        return Ok(String::new());
    }

    let mut csv = String::new();

    // Header
    let columns: Vec<String> = rows[0]
        .columns()
        .iter()
        .map(|c| c.name().to_string())
        .collect();
    csv.push_str(&columns.join(","));
    csv.push('\n');

    // Rows
    for row in &rows {
        let values: Vec<String> = (0..row.columns().len())
            .map(|i| {
                let value: Option<String> = row.try_get(i).ok();
                value
                    .map(|v| {
                        // Escape quotes et virgules
                        if v.contains(',') || v.contains('"') || v.contains('\n') {
                            format!("\"{}\"", v.replace('"', "\"\""))
                        } else {
                            v
                        }
                    })
                    .unwrap_or_default()
            })
            .collect();
        csv.push_str(&values.join(","));
        csv.push('\n');
    }

    Ok(csv)
}

/// Exporter une table en GeoJSON
pub async fn export_to_geojson(
    pool: &PgPool,
    schema: &str,
    table: &str,
    geom_column: &str,
    srid: i32,
) -> Result<String, sqlx::Error> {
    // Utiliser ST_AsGeoJSON pour convertir la géométrie
    let query = format!(
        r#"
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', jsonb_agg(
                jsonb_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON({}, {})::jsonb,
                    'properties', to_jsonb(row) - '{}'
                )
            )
        )
        FROM (SELECT * FROM {}.{}) row
        "#,
        geom_column, srid, geom_column, schema, table
    );

    let result: serde_json::Value = sqlx::query_scalar(&query).fetch_one(pool).await?;

    Ok(serde_json::to_string_pretty(&result).unwrap_or_else(|_| result.to_string()))
}

/// Importer un CSV dans un staging
pub async fn import_csv_to_staging(
    pool: &PgPool,
    staging_id: &str,
    csv_data: &str,
    mapping: Option<&[ColumnMapping]>,
) -> Result<ImportResult, sqlx::Error> {
    let mut rows_imported = 0;
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Parser CSV (simple, sans dépendance externe)
    let lines: Vec<&str> = csv_data.lines().collect();
    
    if lines.is_empty() {
        return Ok(ImportResult {
            staging_id: Some(staging_id.to_string()),
            rows_imported: 0,
            errors: vec!["Fichier CSV vide".to_string()],
            warnings: vec![],
        });
    }

    // Header
    let header: Vec<&str> = lines[0].split(',').map(|s| s.trim()).collect();

    // Déterminer les colonnes cibles
    let target_columns = if let Some(map) = mapping {
        map.iter()
            .map(|m| m.target_column.as_str())
            .collect::<Vec<_>>()
    } else {
        header.clone()
    };

    // Construire la requête d'insertion
    let placeholders: Vec<String> = (1..=target_columns.len())
        .map(|i| format!("${}", i))
        .collect();

    let insert_sql = format!(
        "INSERT INTO staging.{} ({}) VALUES ({})",
        staging_id,
        target_columns.join(", "),
        placeholders.join(", ")
    );

    // Insérer les lignes
    for (line_num, line) in lines.iter().skip(1).enumerate() {
        let values: Vec<&str> = line.split(',').map(|s| s.trim()).collect();

        if values.len() != header.len() {
            errors.push(format!("Ligne {}: nombre de colonnes incorrect", line_num + 2));
            continue;
        }

        // Appliquer le mapping et les transformations
        let mapped_values: Vec<String> = if let Some(map) = mapping {
            map.iter()
                .map(|m| {
                    let source_idx = header
                        .iter()
                        .position(|&h| h == m.source_column)
                        .unwrap_or(0);
                    values.get(source_idx).unwrap_or(&"").to_string()
                })
                .collect()
        } else {
            values.iter().map(|v| v.to_string()).collect()
        };

        // Insérer (simplifié - dans la vraie implémentation, utiliser des paramètres)
        match execute_insert(pool, &insert_sql, &mapped_values).await {
            Ok(_) => rows_imported += 1,
            Err(e) => errors.push(format!("Ligne {}: {}", line_num + 2, e)),
        }
    }

    if rows_imported > 10000 {
        warnings.push(format!("Import volumineux: {} lignes", rows_imported));
    }

    Ok(ImportResult {
        staging_id: Some(staging_id.to_string()),
        rows_imported,
        errors,
        warnings,
    })
}

/// Helper pour exécuter une insertion (simplifié)
async fn execute_insert(
    pool: &PgPool,
    sql: &str,
    values: &[String],
) -> Result<(), sqlx::Error> {
    // Dans une vraie implémentation, utiliser des paramètres bindés
    // Pour l'instant, version simplifiée
    let values_str = values
        .iter()
        .map(|v| format!("'{}'", v.replace('\'', "''")))
        .collect::<Vec<_>>()
        .join(", ");
    
    let final_sql = sql.replace(
        &(1..=values.len())
            .map(|i| format!("${}", i))
            .collect::<Vec<_>>()
            .join(", "),
        &values_str,
    );

    sqlx::query(&final_sql).execute(pool).await?;
    Ok(())
}

/// Importer un GeoJSON dans un staging
pub async fn import_geojson_to_staging(
    pool: &PgPool,
    staging_id: &str,
    geojson_data: &str,
    geom_column: &str,
    srid: i32,
) -> Result<ImportResult, sqlx::Error> {
    let mut rows_imported = 0;
    let mut errors = Vec::new();

    // Parser GeoJSON
    let geojson: serde_json::Value = match serde_json::from_str(geojson_data) {
        Ok(v) => v,
        Err(e) => {
            return Ok(ImportResult {
                staging_id: Some(staging_id.to_string()),
                rows_imported: 0,
                errors: vec![format!("GeoJSON invalide: {}", e)],
                warnings: vec![],
            });
        }
    };

    let features = geojson["features"].as_array().ok_or_else(|| {
        sqlx::Error::Protocol("GeoJSON doit contenir un tableau 'features'".to_string())
    })?;

    for (idx, feature) in features.iter().enumerate() {
        let geometry = &feature["geometry"];
        let properties = &feature["properties"];

        // Convertir geometry en WKT ou utiliser ST_GeomFromGeoJSON
        let geom_json = serde_json::to_string(geometry).unwrap_or_default();

        // Construire INSERT (simplifié)
        let insert_sql = format!(
            "INSERT INTO staging.{} ({}, properties) VALUES (ST_SetSRID(ST_GeomFromGeoJSON($1), {}), $2)",
            staging_id, geom_column, srid
        );

        match sqlx::query(&insert_sql)
            .bind(&geom_json)
            .bind(properties)
            .execute(pool)
            .await
        {
            Ok(_) => rows_imported += 1,
            Err(e) => errors.push(format!("Feature {}: {}", idx + 1, e)),
        }
    }

    Ok(ImportResult {
        staging_id: Some(staging_id.to_string()),
        rows_imported,
        errors,
        warnings: vec![],
    })
}
