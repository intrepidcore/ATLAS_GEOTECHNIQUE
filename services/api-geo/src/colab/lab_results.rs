//! Saisie structurée des résultats de laboratoire pour les missions Colab.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{auth::middleware::AuthUser, state::AppState};

#[derive(Debug, Deserialize)]
pub struct LabResultRequest {
    pub sondage_id: Uuid,
    pub sample_code: String,
    pub depth_top_m: f64,
    pub depth_bottom_m: f64,
    #[serde(default = "empty_object")]
    pub sample: Value,
    #[serde(default = "empty_object")]
    pub tests: Value,
    pub status: Option<String>,
}

fn empty_object() -> Value {
    json!({})
}

type ApiError = (StatusCode, Json<Value>);

fn bad_request(message: impl Into<String>) -> ApiError {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({ "error": message.into() })),
    )
}

async fn is_assigned_operator(
    state: &AppState,
    user_id: Uuid,
    mission_id: Uuid,
) -> Result<bool, ApiError> {
    sqlx::query_scalar(
        r#"SELECT EXISTS(
            SELECT 1
            FROM atlas.colab_mission_assignments a
            JOIN atlas.colab_students s ON s.id = a.student_id
            WHERE a.mission_id = $1
              AND s.user_id = $2
              AND a.unassigned_at IS NULL
              AND s.deleted_at IS NULL
        )"#,
    )
    .bind(mission_id)
    .bind(user_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
    })
}

async fn require_lab_access(
    state: &AppState,
    auth: &AuthUser,
    mission_id: Uuid,
    permission: &str,
) -> Result<(), ApiError> {
    if auth.has_permission(permission) || is_assigned_operator(state, auth.id, mission_id).await? {
        return Ok(());
    }
    Err((
        StatusCode::FORBIDDEN,
        Json(json!({"error":"Cette mission n'est pas affectée à cet opérateur"})),
    ))
}

fn numeric_at<'a>(root: &'a Value, path: &[&str]) -> Option<f64> {
    path.iter()
        .try_fold(root, |value, key| value.get(*key))
        .and_then(Value::as_f64)
}

fn validate_range(
    root: &Value,
    path: &[&str],
    label: &str,
    min: f64,
    max: f64,
) -> Result<(), ApiError> {
    if let Some(value) = numeric_at(root, path) {
        if !value.is_finite() || value < min || value > max {
            return Err(bad_request(format!(
                "{} doit être compris entre {} et {}",
                label, min, max
            )));
        }
    }
    Ok(())
}

fn validate_request(request: &LabResultRequest) -> Result<(), ApiError> {
    let code = request.sample_code.trim();
    if code.is_empty() || code.len() > 100 {
        return Err(bad_request(
            "Le code échantillon est obligatoire (100 caractères maximum)",
        ));
    }
    if !request.depth_top_m.is_finite()
        || !request.depth_bottom_m.is_finite()
        || request.depth_top_m < 0.0
        || request.depth_bottom_m <= request.depth_top_m
    {
        return Err(bad_request(
            "La profondeur basse doit être strictement supérieure à la profondeur haute",
        ));
    }
    if !request.sample.is_object() || !request.tests.is_object() {
        return Err(bad_request(
            "Les blocs échantillon et essais doivent être des objets JSON",
        ));
    }
    let status = request.status.as_deref().unwrap_or("draft");
    if !matches!(status, "draft" | "complete") {
        return Err(bad_request("Statut laboratoire invalide"));
    }

    validate_range(&request.tests, &["vbs", "vbs_g100g"], "VBS", 0.0, 30.0)?;
    validate_range(&request.tests, &["atterberg", "wl_pct"], "WL", 20.0, 120.0)?;
    validate_range(&request.tests, &["atterberg", "wp_pct"], "WP", 10.0, 60.0)?;
    if let (Some(wl), Some(wp)) = (
        numeric_at(&request.tests, &["atterberg", "wl_pct"]),
        numeric_at(&request.tests, &["atterberg", "wp_pct"]),
    ) {
        if wl < wp {
            return Err(bad_request("WL doit être supérieure ou égale à WP"));
        }
    }
    validate_range(&request.tests, &["gonflement", "eg_pct"], "EG", 0.0, 20.0)?;
    validate_range(
        &request.tests,
        &["proctor", "gamma_d_max_knm3"],
        "Densité sèche Proctor",
        10.0,
        26.0,
    )?;
    validate_range(
        &request.tests,
        &["proctor", "w_opt_pct"],
        "Teneur en eau optimale",
        2.0,
        30.0,
    )?;
    validate_range(&request.tests, &["cbr", "cbr_pct"], "CBR", 0.0, 200.0)?;
    validate_range(
        &request.tests,
        &["penetrometre", "rd_mpa"],
        "Résistance dynamique",
        0.0,
        150.0,
    )?;
    validate_range(
        &request.tests,
        &["pressiometre", "em_mpa"],
        "Module pressiométrique",
        0.0,
        100.0,
    )?;
    validate_range(
        &request.tests,
        &["pressiometre", "pl_mpa"],
        "Pression limite",
        0.0,
        10.0,
    )?;
    if let Some(points) = request
        .tests
        .get("granulometrie")
        .and_then(|v| v.get("points"))
        .and_then(Value::as_array)
    {
        for point in points {
            if let Some(passing) = point.get("passant_pct").and_then(Value::as_f64) {
                if !(0.0..=100.0).contains(&passing) {
                    return Err(bad_request(
                        "Chaque passant granulométrique doit être compris entre 0 et 100 %",
                    ));
                }
            }
        }
    }
    Ok(())
}

async fn ensure_linked_sondage(
    state: &AppState,
    mission_id: Uuid,
    sondage_id: Uuid,
) -> Result<(), ApiError> {
    let linked: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM atlas.colab_mission_sondages WHERE mission_id = $1 AND sondage_id = $2)",
    )
    .bind(mission_id)
    .bind(sondage_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    if !linked {
        return Err(bad_request(
            "Le sondage sélectionné n'est pas lié à cette mission",
        ));
    }
    Ok(())
}

const RESULT_JSON_SQL: &str = r#"
    SELECT jsonb_build_object(
      'id', lr.id,
      'mission_id', lr.mission_id,
      'sondage_id', lr.sondage_id,
      'sondage_code', s.code,
      'sample_code', lr.sample_code,
      'depth_top_m', lr.depth_top_m,
      'depth_bottom_m', lr.depth_bottom_m,
      'depth_m', ROUND((lr.depth_top_m + lr.depth_bottom_m) / 2.0, 3),
      'horizon', CASE
        WHEN ((lr.depth_top_m + lr.depth_bottom_m) / 2.0) < 1 THEN 'H1 (0-1 m)'
        WHEN ((lr.depth_top_m + lr.depth_bottom_m) / 2.0) < 1.5 THEN 'H2 (1-1,5 m)'
        ELSE 'H3 (>1,5 m)'
      END,
      'sample', lr.sample,
      'tests', lr.tests,
      'status', lr.status,
      'created_at', lr.created_at,
      'updated_at', lr.updated_at
    )
    FROM atlas.colab_lab_results lr
    JOIN atlas.sondages s ON s.id = lr.sondage_id
"#;

async fn list_results(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(mission_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    require_lab_access(&state, &auth, mission_id, "colab.missions.read").await?;
    let sql = format!(
        "{} WHERE lr.mission_id = $1 ORDER BY lr.updated_at DESC",
        RESULT_JSON_SQL
    );
    let items: Vec<Value> = sqlx::query_scalar(&sql)
        .bind(mission_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
        })?;
    Ok(Json(json!({"items": items, "total": items.len()})))
}

async fn create_result(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(mission_id): Path<Uuid>,
    Json(request): Json<LabResultRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    require_lab_access(&state, &auth, mission_id, "colab.missions.update").await?;
    validate_request(&request)?;
    ensure_linked_sondage(&state, mission_id, request.sondage_id).await?;
    let id: Uuid = sqlx::query_scalar(
        r#"INSERT INTO atlas.colab_lab_results
           (mission_id, sondage_id, sample_code, depth_top_m, depth_bottom_m, sample, tests, status, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id"#,
    )
    .bind(mission_id).bind(request.sondage_id).bind(request.sample_code.trim())
    .bind(request.depth_top_m).bind(request.depth_bottom_m).bind(request.sample).bind(request.tests)
    .bind(request.status.as_deref().unwrap_or("draft")).bind(auth.id)
    .fetch_one(&state.pool).await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("Enregistrement impossible: {}", e)}))))?;
    let sql = format!("{} WHERE lr.id = $1", RESULT_JSON_SQL);
    let item: Value = sqlx::query_scalar(&sql)
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
        })?;
    Ok((StatusCode::CREATED, Json(item)))
}

async fn update_result(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((mission_id, result_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<LabResultRequest>,
) -> Result<Json<Value>, ApiError> {
    require_lab_access(&state, &auth, mission_id, "colab.missions.update").await?;
    validate_request(&request)?;
    ensure_linked_sondage(&state, mission_id, request.sondage_id).await?;
    let affected = sqlx::query(
        r#"UPDATE atlas.colab_lab_results SET sondage_id=$3, sample_code=$4, depth_top_m=$5,
           depth_bottom_m=$6, sample=$7, tests=$8, status=$9, updated_at=now()
           WHERE id=$1 AND mission_id=$2"#,
    )
    .bind(result_id)
    .bind(mission_id)
    .bind(request.sondage_id)
    .bind(request.sample_code.trim())
    .bind(request.depth_top_m)
    .bind(request.depth_bottom_m)
    .bind(request.sample)
    .bind(request.tests)
    .bind(request.status.as_deref().unwrap_or("draft"))
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Mise à jour impossible: {}", e)})),
        )
    })?;
    if affected.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error":"Résultat introuvable"})),
        ));
    }
    let sql = format!("{} WHERE lr.id = $1", RESULT_JSON_SQL);
    let item: Value = sqlx::query_scalar(&sql)
        .bind(result_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
        })?;
    Ok(Json(item))
}

async fn delete_result(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((mission_id, result_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, ApiError> {
    require_lab_access(&state, &auth, mission_id, "colab.missions.update").await?;
    let result = sqlx::query("DELETE FROM atlas.colab_lab_results WHERE id=$1 AND mission_id=$2")
        .bind(result_id)
        .bind(mission_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
        })?;
    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error":"Résultat introuvable"})),
        ));
    }
    Ok(Json(json!({"success": true})))
}

pub fn lab_result_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/colab/missions/:mission_id/lab-results",
            get(list_results).post(create_result),
        )
        .route(
            "/colab/missions/:mission_id/lab-results/:result_id",
            put(update_result).delete(delete_result),
        )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_request() -> LabResultRequest {
        LabResultRequest {
            sondage_id: Uuid::nil(),
            sample_code: "S1-ECH-01".into(),
            depth_top_m: 0.0,
            depth_bottom_m: 1.0,
            sample: json!({"remanie":"non"}),
            tests: json!({"atterberg":{"wl_pct":45.0,"wp_pct":22.0}}),
            status: Some("complete".into()),
        }
    }

    #[test]
    fn accepts_consistent_lab_result() {
        assert!(validate_request(&valid_request()).is_ok());
    }

    #[test]
    fn rejects_invalid_atterberg_relation() {
        let mut request = valid_request();
        request.tests = json!({"atterberg":{"wl_pct":20.0,"wp_pct":30.0}});
        assert!(validate_request(&request).is_err());
    }

    #[test]
    fn rejects_out_of_range_granulometry() {
        let mut request = valid_request();
        request.tests = json!({"granulometrie":{"points":[{"passant_pct":101.0}]}});
        assert!(validate_request(&request).is_err());
    }
}
