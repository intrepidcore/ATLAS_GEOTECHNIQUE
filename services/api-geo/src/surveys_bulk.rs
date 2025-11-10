// Bulk import handler for CSV/XLSX
use crate::state::AppState;
use crate::surveys::{get_test_unit, validate_test, validate_togo_bounds, TestInput};
use axum::{extract::State, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use sqlx::types::Uuid;
use std::str::FromStr;

#[derive(Deserialize, Debug)]
pub struct BulkSurveyRow {
    pub code: Option<String>,
    pub date: Option<String>,
    pub source: Option<String>,
    pub operator: Option<String>,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    #[allow(dead_code)]
    pub adm3_code: Option<String>,
    pub test_type: String,
    pub test_value: f64,
    pub test_depth_m: f64,
    pub notes: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct BulkImportRequest {
    pub rows: Vec<BulkSurveyRow>,
    #[allow(dead_code)]
    pub snap_to_grid: Option<bool>,
}

#[derive(Serialize)]
pub struct BulkImportResponse {
    pub created: usize,
    pub rejected: usize,
    pub errors: Vec<BulkError>,
}

#[derive(Serialize)]
pub struct BulkError {
    pub row: usize,
    pub code: Option<String>,
    pub error: String,
}

/// POST /surveys/bulk
pub async fn bulk_import_surveys(
    State(state): State<AppState>,
    Json(payload): Json<BulkImportRequest>,
) -> impl IntoResponse {
    let pool = &state.pool;

    let mut created = 0;
    let mut rejected = 0;
    let mut errors = Vec::new();

    // Grouper par code de sondage
    let mut surveys_map: std::collections::HashMap<String, Vec<(usize, &BulkSurveyRow)>> =
        std::collections::HashMap::new();

    for (idx, row) in payload.rows.iter().enumerate() {
        let code = row.code.clone().unwrap_or_else(|| format!("BULK-{}", idx));
        surveys_map.entry(code).or_default().push((idx, row));
    }

    // Traiter chaque sondage
    for (code, rows) in surveys_map.iter() {
        // Prendre les métadonnées de la première ligne
        let (first_idx, first_row) = rows[0];

        // Validation coordonnées
        let (lon, lat) = match (first_row.lon, first_row.lat) {
            (Some(lon), Some(lat)) => {
                if let Err(e) = validate_togo_bounds(lon, lat) {
                    errors.push(BulkError {
                        row: first_idx,
                        code: Some(code.clone()),
                        error: e,
                    });
                    rejected += 1;
                    continue;
                }
                (Some(lon), Some(lat))
            }
            _ => (None, None),
        };

        // Validation essais
        let mut tests = Vec::new();
        let mut has_error = false;

        for (idx, row) in rows {
            let test = TestInput {
                test_type: row.test_type.clone(),
                value: row.test_value,
                depth_m: row.test_depth_m,
            };

            if let Err(e) = validate_test(&test) {
                errors.push(BulkError {
                    row: *idx,
                    code: Some(code.clone()),
                    error: e,
                });
                has_error = true;
                break;
            }

            tests.push(test);
        }

        if has_error {
            rejected += 1;
            continue;
        }

        if tests.is_empty() {
            errors.push(BulkError {
                row: first_idx,
                code: Some(code.clone()),
                error: "Au moins 1 essai requis".to_string(),
            });
            rejected += 1;
            continue;
        }

        // Transaction pour ce sondage
        let mut tx = match pool.begin().await {
            Ok(t) => t,
            Err(e) => {
                errors.push(BulkError {
                    row: first_idx,
                    code: Some(code.clone()),
                    error: format!("Transaction error: {:?}", e),
                });
                rejected += 1;
                continue;
            }
        };

        // Créer sondage
        let sondage_id = Uuid::new_v4();

        let insert_query = if let (Some(lon), Some(lat)) = (lon, lat) {
            format!(
                r#"
                INSERT INTO sondages (
                    id, code, geom, location_accuracy, is_geocoded,
                    date, source, operator, notes, created_at
                )
                VALUES (
                    $1, $2, ST_Transform(ST_SetSRID(ST_MakePoint({}, {}), 4326), 25231), 
                    'exact', TRUE,
                    $3::date, $4, $5, $6, now()
                )
                "#,
                lon, lat
            )
        } else {
            r#"
            INSERT INTO sondages (
                id, code, geom, location_accuracy, is_geocoded,
                date, source, operator, notes, created_at
            )
            VALUES (
                $1, $2, NULL, 'unknown', FALSE,
                $3::date, $4, $5, $6, now()
            )
            "#
            .to_string()
        };

        let insert_result = sqlx::query(&insert_query)
            .bind(sondage_id)
            .bind(code)
            .bind(&first_row.date)
            .bind(&first_row.source)
            .bind(&first_row.operator)
            .bind(&first_row.notes)
            .execute(&mut *tx)
            .await;

        if let Err(e) = insert_result {
            let _ = tx.rollback().await;
            errors.push(BulkError {
                row: first_idx,
                code: Some(code.clone()),
                error: format!("Insert sondage error: {:?}", e),
            });
            rejected += 1;
            continue;
        }

        // Insérer essais
        let mut test_error = false;
        for test in &tests {
            let test_id = Uuid::new_v4();
            let unit = get_test_unit(&test.test_type);
            let value_bd = sqlx::types::BigDecimal::from_str(&test.value.to_string()).unwrap();
            let depth_bd = sqlx::types::BigDecimal::from_str(&test.depth_m.to_string()).unwrap();

            let test_result = sqlx::query(
                r#"
                INSERT INTO essais (id, sondage_id, type_essai, valeur_numerique, unit, depth_m, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, now())
                "#
            )
            .bind(test_id)
            .bind(sondage_id)
            .bind(&test.test_type)
            .bind(value_bd)
            .bind(unit)
            .bind(depth_bd)
            .execute(&mut *tx)
            .await;

            if test_result.is_err() {
                test_error = true;
                break;
            }
        }

        if test_error {
            let _ = tx.rollback().await;
            errors.push(BulkError {
                row: first_idx,
                code: Some(code.clone()),
                error: "Insert tests error".to_string(),
            });
            rejected += 1;
            continue;
        }

        // Commit
        if let Err(e) = tx.commit().await {
            errors.push(BulkError {
                row: first_idx,
                code: Some(code.clone()),
                error: format!("Commit error: {:?}", e),
            });
            rejected += 1;
            continue;
        }

        created += 1;
    }

    Json(BulkImportResponse {
        created,
        rejected,
        errors,
    })
    .into_response()
}
