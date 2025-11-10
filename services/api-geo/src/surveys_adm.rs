// Module pour la gestion des sondages sans coordonnées (rattachés à un niveau ADM)
// Permet de créer des sondages "unknown" et de les géocoder ultérieurement

use crate::state::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::{types::Uuid, Row};

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LocationMode {
    Exact,
    Unknown,
    Centroid,
    Random,
}

impl LocationMode {
    fn as_str(&self) -> &str {
        match self {
            LocationMode::Exact => "exact",
            LocationMode::Unknown => "unknown",
            LocationMode::Centroid => "centroid",
            LocationMode::Random => "random",
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateSurveyAdmRequest {
    pub adm_level: String, // "ADM1", "ADM2", "ADM3"
    pub adm_id: i32,       // GID de l'entité ADM
    pub location_mode: LocationMode,
    pub survey: SurveyInfo,
    pub tests: Vec<TestInfo>,
}

#[derive(Debug, Deserialize)]
pub struct SurveyInfo {
    pub code: Option<String>,
    pub date: Option<NaiveDate>,
    pub source: Option<String>,
    pub operator: Option<String>,
    pub notes: Option<String>,
    pub type_sol: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TestInfo {
    #[serde(rename = "type")]
    pub test_type: String,
    pub value: f64,
    pub depth_m: f64,
    pub unit: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateSurveyAdmResponse {
    pub id: String,
    pub code: String,
    pub location_mode: String,
    pub is_geocoded: bool,
    pub location_accuracy: String,
    pub maille_code: Option<String>,
    pub n_tests: usize,
}

#[derive(Debug, Deserialize)]
pub struct GeocodeRequest {
    #[serde(flatten)]
    pub mode: GeocodeMode,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum GeocodeMode {
    Coordinates {
        lon: f64,
        lat: f64,
    },
    AdmBased {
        location_mode: LocationMode,
        adm_level: String,
        adm_id: i32,
    },
}

#[derive(Debug, Serialize)]
pub struct GeocodeResponse {
    pub id: String,
    pub code: String,
    pub location_mode: String,
    pub is_geocoded: bool,
    pub location_accuracy: String,
    pub maille_code: Option<String>,
    pub lon: Option<f64>,
    pub lat: Option<f64>,
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /surveys/adm - Créer un sondage rattaché à un niveau ADM
pub async fn create_survey_adm(
    State(state): State<AppState>,
    Json(payload): Json<CreateSurveyAdmRequest>,
) -> impl IntoResponse {
    let pool = &state.pool;

    // Valider l'ADM level
    if !["ADM1", "ADM2", "ADM3"].contains(&payload.adm_level.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "adm_level must be ADM1, ADM2, or ADM3"})),
        )
            .into_response();
    }

    // Utiliser directement le GID
    let adm_gid = payload.adm_id;

    // Démarrer une transaction
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!(?e, "Failed to begin transaction");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "database error"})),
            )
                .into_response();
        }
    };

    // Générer un code si non fourni
    let survey_code = match &payload.survey.code {
        Some(c) => c.clone(),
        None => format!(
            "ADM-{}-{}",
            payload.adm_level,
            Uuid::new_v4().to_string()[..8].to_uppercase()
        ),
    };

    // Créer le sondage selon le mode de localisation
    let (survey_id, _geom_wkt, is_geocoded, location_accuracy, maille_code) = match payload
        .location_mode
    {
        LocationMode::Unknown => {
            // Mode unknown: pas de geom, pas de maille
            let survey_id = Uuid::new_v4();

            let query = format!(
                r#"
                INSERT INTO sondages (
                    id, code, date, source, operator, notes, type_sol,
                    location_mode, is_geocoded, location_accuracy,
                    {}_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
                "#,
                payload.adm_level.to_lowercase()
            );

            if let Err(e) = sqlx::query(&query)
                .bind(survey_id)
                .bind(&survey_code)
                .bind(payload.survey.date)
                .bind(&payload.survey.source)
                .bind(&payload.survey.operator)
                .bind(&payload.survey.notes)
                .bind(&payload.survey.type_sol)
                .bind("unknown")
                .bind(false)
                .bind("unknown")
                .bind(adm_gid)
                .execute(&mut *tx)
                .await
            {
                tracing::error!(?e, "Failed to insert survey (unknown mode)");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "failed to create survey"})),
                )
                    .into_response();
            }

            (survey_id, None, false, "unknown".to_string(), None)
        }

        LocationMode::Centroid => {
            // Mode centroid: calculer le centroïde de l'ADM
            let survey_id = Uuid::new_v4();

            let geom_result: Result<(String, Option<String>), sqlx::Error> = sqlx::query_as(
                r#"
                SELECT 
                    ST_AsText(get_adm_centroid($1, $2)) AS geom_wkt,
                    m.code AS maille_code
                FROM get_adm_centroid($1, $2) AS geom
                LEFT JOIN mailles m ON ST_Contains(m.geom, geom)
                "#,
            )
            .bind(&payload.adm_level)
            .bind(adm_gid)
            .fetch_one(&mut *tx)
            .await;

            let (geom_wkt, maille_code) = match geom_result {
                Ok((wkt, code)) => (wkt, code),
                Err(e) => {
                    tracing::error!(?e, "Failed to compute centroid");
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({"error": "failed to compute centroid"})),
                    )
                        .into_response();
                }
            };

            let location_accuracy = format!("centroid_{}", payload.adm_level.to_lowercase());

            let query = format!(
                r#"
                INSERT INTO sondages (
                    id, code, date, source, operator, notes, type_sol,
                    geom, location_mode, is_geocoded, location_accuracy,
                    {}_id, maille_code, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeomFromText($8, 25231), $9, $10, $11, $12, $13, now())
                "#,
                payload.adm_level.to_lowercase()
            );

            if let Err(e) = sqlx::query(&query)
                .bind(survey_id)
                .bind(&survey_code)
                .bind(payload.survey.date)
                .bind(&payload.survey.source)
                .bind(&payload.survey.operator)
                .bind(&payload.survey.notes)
                .bind(&payload.survey.type_sol)
                .bind(&geom_wkt)
                .bind("centroid")
                .bind(true)
                .bind(&location_accuracy)
                .bind(adm_gid)
                .bind(&maille_code)
                .execute(&mut *tx)
                .await
            {
                tracing::error!(?e, "Failed to insert survey (centroid mode)");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "failed to create survey"})),
                )
                    .into_response();
            }

            (
                survey_id,
                Some(geom_wkt),
                true,
                location_accuracy,
                maille_code,
            )
        }

        LocationMode::Random => {
            // Mode random: générer un point aléatoire dans l'ADM
            let survey_id = Uuid::new_v4();

            let geom_result: Result<(String, Option<String>), sqlx::Error> = sqlx::query_as(
                r#"
                SELECT 
                    ST_AsText(get_adm_random_point($1, $2, $3)) AS geom_wkt,
                    m.code AS maille_code
                FROM get_adm_random_point($1, $2, $3) AS geom
                LEFT JOIN mailles m ON ST_Contains(m.geom, geom)
                "#,
            )
            .bind(&payload.adm_level)
            .bind(adm_gid)
            .bind(&survey_code) // Seed déterministe
            .fetch_one(&mut *tx)
            .await;

            let (geom_wkt, maille_code) = match geom_result {
                Ok((wkt, code)) => (wkt, code),
                Err(e) => {
                    tracing::error!(?e, "Failed to generate random point");
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({"error": "failed to generate random point"})),
                    )
                        .into_response();
                }
            };

            let location_accuracy = format!("random_{}", payload.adm_level.to_lowercase());

            let query = format!(
                r#"
                INSERT INTO sondages (
                    id, code, date, source, operator, notes, type_sol,
                    geom, location_mode, is_geocoded, location_accuracy,
                    {}_id, maille_code, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeomFromText($8, 25231), $9, $10, $11, $12, $13, now())
                "#,
                payload.adm_level.to_lowercase()
            );

            if let Err(e) = sqlx::query(&query)
                .bind(survey_id)
                .bind(&survey_code)
                .bind(payload.survey.date)
                .bind(&payload.survey.source)
                .bind(&payload.survey.operator)
                .bind(&payload.survey.notes)
                .bind(&payload.survey.type_sol)
                .bind(&geom_wkt)
                .bind("random")
                .bind(true)
                .bind(&location_accuracy)
                .bind(adm_gid)
                .bind(&maille_code)
                .execute(&mut *tx)
                .await
            {
                tracing::error!(?e, "Failed to insert survey (random mode)");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "failed to create survey"})),
                )
                    .into_response();
            }

            (
                survey_id,
                Some(geom_wkt),
                true,
                location_accuracy,
                maille_code,
            )
        }

        LocationMode::Exact => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "use POST /surveys for exact coordinates"})),
            )
                .into_response();
        }
    };

    // Insérer les essais
    for test in &payload.tests {
        let test_id = Uuid::new_v4();
        let unit = test
            .unit
            .clone()
            .unwrap_or_else(|| match test.test_type.as_str() {
                "SPT_N" => "coups/30cm".to_string(),
                "qc" => "MPa".to_string(),
                _ => "".to_string(),
            });

        if let Err(e) = sqlx::query(
            r#"
            INSERT INTO essais (id, sondage_id, type_essai, valeur_numerique, unit, depth_m, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, now())
            "#
        )
        .bind(test_id)
        .bind(survey_id)
        .bind(&test.test_type)
        .bind(test.value)
        .bind(&unit)
        .bind(test.depth_m)
        .execute(&mut *tx)
        .await
        {
            tracing::error!(?e, "Failed to insert test");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "failed to insert tests"})),
            ).into_response();
        }
    }

    // Commit la transaction
    if let Err(e) = tx.commit().await {
        tracing::error!(?e, "Failed to commit transaction");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "failed to commit"})),
        )
            .into_response();
    }

    let response = CreateSurveyAdmResponse {
        id: survey_id.to_string(),
        code: survey_code,
        location_mode: payload.location_mode.as_str().to_string(),
        is_geocoded,
        location_accuracy,
        maille_code,
        n_tests: payload.tests.len(),
    };

    (StatusCode::CREATED, Json(response)).into_response()
}

/// POST /surveys/{id}/geocode - Géocoder un sondage existant
pub async fn geocode_survey(
    State(state): State<AppState>,
    Path(survey_id): Path<String>,
    Json(payload): Json<GeocodeRequest>,
) -> impl IntoResponse {
    let pool = &state.pool;

    // Parser l'ID du sondage
    let survey_uuid = match Uuid::parse_str(&survey_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "invalid survey_id format"})),
            )
                .into_response();
        }
    };

    // Vérifier que le sondage existe
    let survey_code: Option<String> =
        match sqlx::query_scalar("SELECT code FROM sondages WHERE id = $1 AND deleted_at IS NULL")
            .bind(survey_uuid)
            .fetch_optional(pool)
            .await
        {
            Ok(Some(code)) => Some(code),
            Ok(None) => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({"error": "survey not found"})),
                )
                    .into_response();
            }
            Err(e) => {
                tracing::error!(?e, "Failed to fetch survey");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "database error"})),
                )
                    .into_response();
            }
        };

    let survey_code = survey_code.unwrap();

    // Géocoder selon le mode
    let (geom_wkt, location_mode, location_accuracy, maille_code, lon, lat) = match payload.mode {
        GeocodeMode::Coordinates { lon, lat } => {
            // Coordonnées exactes
            let geom_wkt = format!("POINT({} {})", lon, lat);

            // Trouver la maille
            let maille_code: Option<String> = sqlx::query_scalar(
                r#"
                SELECT m.code
                FROM mailles m
                WHERE ST_Contains(m.geom, ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 25231))
                LIMIT 1
                "#
            )
            .bind(lon)
            .bind(lat)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

            (
                geom_wkt,
                "exact",
                "exact".to_string(),
                maille_code,
                Some(lon),
                Some(lat),
            )
        }

        GeocodeMode::AdmBased {
            location_mode,
            adm_level,
            adm_id,
        } => {
            // Valider l'ADM level
            if !["ADM1", "ADM2", "ADM3"].contains(&adm_level.as_str()) {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({"error": "adm_level must be ADM1, ADM2, or ADM3"})),
                )
                    .into_response();
            }

            // Utiliser directement le GID
            let adm_gid = adm_id;

            match location_mode {
                LocationMode::Centroid => {
                    let result: Result<(String, Option<String>), sqlx::Error> = sqlx::query_as(
                        r#"
                        SELECT 
                            ST_AsText(get_adm_centroid($1, $2)) AS geom_wkt,
                            m.code AS maille_code
                        FROM get_adm_centroid($1, $2) AS geom
                        LEFT JOIN mailles m ON ST_Contains(m.geom, geom)
                        "#,
                    )
                    .bind(&adm_level)
                    .bind(adm_gid)
                    .fetch_one(pool)
                    .await;

                    let (geom_wkt, maille_code) = match result {
                        Ok((wkt, code)) => (wkt, code),
                        Err(e) => {
                            tracing::error!(?e, "Failed to compute centroid");
                            return (
                                StatusCode::INTERNAL_SERVER_ERROR,
                                Json(serde_json::json!({"error": "failed to compute centroid"})),
                            )
                                .into_response();
                        }
                    };

                    let location_accuracy = format!("centroid_{}", adm_level.to_lowercase());
                    (
                        geom_wkt,
                        "centroid",
                        location_accuracy,
                        maille_code,
                        None,
                        None,
                    )
                }

                LocationMode::Random => {
                    let result: Result<(String, Option<String>), sqlx::Error> = sqlx::query_as(
                        r#"
                        SELECT 
                            ST_AsText(get_adm_random_point($1, $2, $3)) AS geom_wkt,
                            m.code AS maille_code
                        FROM get_adm_random_point($1, $2, $3) AS geom
                        LEFT JOIN mailles m ON ST_Contains(m.geom, geom)
                        "#,
                    )
                    .bind(&adm_level)
                    .bind(adm_gid)
                    .bind(&survey_code)
                    .fetch_one(pool)
                    .await;

                    let (geom_wkt, maille_code) = match result {
                        Ok((wkt, code)) => (wkt, code),
                        Err(e) => {
                            tracing::error!(?e, "Failed to generate random point");
                            return (
                                StatusCode::INTERNAL_SERVER_ERROR,
                                Json(
                                    serde_json::json!({"error": "failed to generate random point"}),
                                ),
                            )
                                .into_response();
                        }
                    };

                    let location_accuracy = format!("random_{}", adm_level.to_lowercase());
                    (
                        geom_wkt,
                        "random",
                        location_accuracy,
                        maille_code,
                        None,
                        None,
                    )
                }

                _ => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({"error": "invalid location_mode"})),
                    )
                        .into_response();
                }
            }
        }
    };

    // Mettre à jour le sondage
    if let Err(e) = sqlx::query(
        r#"
        UPDATE sondages
        SET geom = ST_GeomFromText($1, 25231),
            location_mode = $2,
            is_geocoded = TRUE,
            location_accuracy = $3,
            maille_code = $4,
            updated_at = now()
        WHERE id = $5
        "#,
    )
    .bind(&geom_wkt)
    .bind(location_mode)
    .bind(&location_accuracy)
    .bind(&maille_code)
    .bind(survey_uuid)
    .execute(pool)
    .await
    {
        tracing::error!(?e, "Failed to update survey");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "failed to geocode survey"})),
        )
            .into_response();
    }

    let response = GeocodeResponse {
        id: survey_id,
        code: survey_code,
        location_mode: location_mode.to_string(),
        is_geocoded: true,
        location_accuracy: location_accuracy.to_string(),
        maille_code,
        lon,
        lat,
    };

    (StatusCode::OK, Json(response)).into_response()
}

/// GET /surveys/ungeocode - Liste des sondages non géocodés
pub async fn list_ungeocode_surveys(State(state): State<AppState>) -> impl IntoResponse {
    let pool = &state.pool;

    let surveys = match sqlx::query!(
        r#"
        SELECT 
            s.id,
            s.code,
            s.date_sondage as date,
            s.localite as source,
            s.adm1 as adm1_name,
            s.adm2 as adm2_name,
            s.adm3 as adm3_name,
            s.created_at,
            0::bigint as "n_essais!"
        FROM sondages_non_geocodes s
        ORDER BY s.created_at DESC
        "#
    )
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!(?e, "Failed to fetch ungeocode surveys");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "database error"})),
            )
                .into_response();
        }
    };

    let result: Vec<serde_json::Value> = surveys
        .into_iter()
        .map(|row| {
            serde_json::json!({
                "id": row.id,
                "code": row.code,
                "date": row.date,
                "source": row.source,
                "adm1_name": row.adm1_name,
                "adm2_name": row.adm2_name,
                "adm3_name": row.adm3_name,
                "n_essais": row.n_essais
            })
        })
        .collect();

    (StatusCode::OK, Json(result)).into_response()
}

/// GET /adm3 - Liste des zones ADM3 pour le dropdown
pub async fn list_adm3(State(state): State<AppState>) -> impl IntoResponse {
    let pool = &state.pool;

    #[derive(sqlx::FromRow, serde::Serialize)]
    struct Adm3Row {
        gid: i32,
        code: Option<String>,
        name: Option<String>,
        adm2_name: Option<String>,
        adm1_name: Option<String>,
    }

    let adm3s = match sqlx::query_as::<_, Adm3Row>(
        r#"
        SELECT DISTINCT 
            gid,
            adm3_pcode as code,
            adm3_fr as name,
            adm2_fr as adm2_name,
            adm1_fr as adm1_name
        FROM adm3
        WHERE adm3_fr IS NOT NULL
        ORDER BY adm3_fr
        "#,
    )
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!(?e, "Failed to fetch ADM3 list");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "database error"})),
            )
                .into_response();
        }
    };

    (StatusCode::OK, Json(adm3s)).into_response()
}
