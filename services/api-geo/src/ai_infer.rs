use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use once_cell::sync::Lazy;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::time::Duration;
use uuid::Uuid;

use crate::{auth::AuthUser, state::AppState};

static INTERNAL_INFER_HTTP: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .expect("internal infer http client")
});

#[derive(Debug, Clone, Serialize)]
pub struct MailleFeatures {
    pub maille_id: Uuid,
    pub maille_code: String,
    pub adm1_name: Option<String>,
    pub adm2_name: Option<String>,
    pub n_sondages: i64,
    pub vbs_moyen: Option<f64>,
    pub ip_moyen: Option<f64>,
    pub gonflement_cg_moyen: Option<f64>,
    pub profondeur_max_m: Option<f64>,
    pub pct_in_lama: Option<f64>,
    pub in_zone_rga_tres_fort: bool,
    pub dsm_altitude_moy_m: Option<f64>,
    pub dist_riviere_m: Option<f64>,
    pub dist_surface_eau_m: Option<f64>,
    pub data_confidence_score: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InferMailleRequest {
    pub maille_code: Option<String>,
    pub maille_id: Option<Uuid>,
    pub charge_kpa: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ValidateMailleRequest {
    pub maille_code: Option<String>,
    pub maille_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InferMailleResponse {
    pub maille_id: Uuid,
    pub maille_code: String,
    pub features: MailleFeatures,
    pub prediction: serde_json::Value,
}

pub async fn infer_maille(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<InferMailleRequest>,
) -> Result<Json<InferMailleResponse>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let features = load_features(&state, payload.maille_id, payload.maille_code.as_deref()).await?;
    let (prediction, model_version) =
        prediction_with_ml_fallback(&features, payload.charge_kpa).await;

    let response = InferMailleResponse {
        maille_id: features.maille_id,
        maille_code: features.maille_code.clone(),
        features: features.clone(),
        prediction,
    };

    let _ = sqlx::query(
        r#"
        INSERT INTO atlas.ai_infer_runs (maille_id, maille_code, model_version, features, prediction, created_by)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
        "#,
    )
    .bind(response.maille_id)
    .bind(&response.maille_code)
    .bind(model_version)
    .bind(serde_json::to_string(&response.features).unwrap_or_else(|_| "{}".to_string()))
    .bind(serde_json::to_string(&response.prediction).unwrap_or_else(|_| "{}".to_string()))
    .bind(auth.id)
    .execute(&state.pool)
    .await;

    Ok(Json(response))
}

pub async fn infer_maille_by_code(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(code): Path<String>,
) -> Result<Json<InferMailleResponse>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let features = load_features(&state, None, Some(&code)).await?;
    let (prediction, model_version) = prediction_with_ml_fallback(&features, None).await;

    let response = InferMailleResponse {
        maille_id: features.maille_id,
        maille_code: features.maille_code.clone(),
        features: features.clone(),
        prediction,
    };

    let _ = sqlx::query(
        r#"
        INSERT INTO atlas.ai_infer_runs (maille_id, maille_code, model_version, features, prediction, created_by)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
        "#,
    )
    .bind(response.maille_id)
    .bind(&response.maille_code)
    .bind(model_version)
    .bind(serde_json::to_string(&response.features).unwrap_or_else(|_| "{}".to_string()))
    .bind(serde_json::to_string(&response.prediction).unwrap_or_else(|_| "{}".to_string()))
    .bind(auth.id)
    .execute(&state.pool)
    .await;

    Ok(Json(response))
}

pub async fn get_features_by_code(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(code): Path<String>,
) -> Result<Json<MailleFeatures>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }
    let features = load_features(&state, None, Some(&code)).await?;
    Ok(Json(features))
}

pub async fn validate_maille_prediction(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<ValidateMailleRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let features = load_features(&state, payload.maille_id, payload.maille_code.as_deref()).await?;
    let prediction = build_prediction(&features, None);
    let pred_score = prediction.get("risk_score").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let observed_proxy = (features.vbs_moyen.unwrap_or(7.0) * 3.2 + features.ip_moyen.unwrap_or(25.0) * 1.4)
        .clamp(0.0, 100.0);
    let abs_error = (pred_score - observed_proxy).abs();
    let quality = if abs_error <= 8.0 {
        "excellent"
    } else if abs_error <= 15.0 {
        "acceptable"
    } else {
        "a_recalibrer"
    };

    Ok(Json(json!({
        "maille_id": features.maille_id,
        "maille_code": features.maille_code,
        "predicted_risk_score": pred_score,
        "observed_proxy_score": (observed_proxy * 100.0).round() / 100.0,
        "absolute_error": (abs_error * 100.0).round() / 100.0,
        "quality": quality
    })))
}

pub async fn load_features(
    state: &AppState,
    maille_id: Option<Uuid>,
    maille_code: Option<&str>,
) -> Result<MailleFeatures, (StatusCode, Json<serde_json::Value>)> {
    if maille_id.is_none() && maille_code.is_none() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "maille_id ou maille_code requis" }))));
    }

    let row = sqlx::query(
        r#"
        SELECT
            v.maille_id,
            v.maille_code,
            v.adm1_name,
            v.adm2_name,
            v.n_sondages,
            v.vbs_moyen,
            v.ip_moyen,
            v.gonflement_cg_moyen,
            v.profondeur_max_m,
            v.pct_in_lama,
            (v.in_zone_rga_tres_fort = 1) AS in_zone_rga_tres_fort,
            v.dsm_altitude_moy_m,
            v.dist_riviere_m,
            v.dist_surface_eau_m,
            v.data_confidence_score
        FROM atlas.v_maille_features_ai v
        WHERE ($1::uuid IS NULL OR v.maille_id = $1::uuid)
          AND ($2::text IS NULL OR v.maille_code = $2::text)
        LIMIT 1
        "#,
    )
    .bind(maille_id)
    .bind(maille_code)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let r = row.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "Maille non trouvée" }))))?;

    Ok(MailleFeatures {
        maille_id: r.get("maille_id"),
        maille_code: r.get("maille_code"),
        adm1_name: r.try_get("adm1_name").ok(),
        adm2_name: r.try_get("adm2_name").ok(),
        n_sondages: r.get("n_sondages"),
        vbs_moyen: r.try_get("vbs_moyen").ok(),
        ip_moyen: r.try_get("ip_moyen").ok(),
        gonflement_cg_moyen: r.try_get("gonflement_cg_moyen").ok(),
        profondeur_max_m: r.try_get("profondeur_max_m").ok(),
        pct_in_lama: r.try_get("pct_in_lama").ok(),
        in_zone_rga_tres_fort: r.get("in_zone_rga_tres_fort"),
        dsm_altitude_moy_m: r.try_get("dsm_altitude_moy_m").ok(),
        dist_riviere_m: r.try_get("dist_riviere_m").ok(),
        dist_surface_eau_m: r.try_get("dist_surface_eau_m").ok(),
        data_confidence_score: r.get("data_confidence_score"),
    })
}

/// Appelle api-infer (`POST /internal/infer/maille`) si `ATLAS_API_INFER_URL` + `ATLAS_INTERNAL_SERVICE_TOKEN` sont définis ; sinon rule-based.
pub async fn prediction_with_ml_fallback(
    features: &MailleFeatures,
    charge_kpa: Option<f64>,
) -> (serde_json::Value, &'static str) {
    let base = std::env::var("ATLAS_API_INFER_URL").unwrap_or_default();
    let token = std::env::var("ATLAS_INTERNAL_SERVICE_TOKEN").unwrap_or_default();
    let base = base.trim();
    if base.is_empty() || token.trim().is_empty() {
        return (
            build_prediction(features, charge_kpa),
            "api-infer-v0-rule-based",
        );
    }
    let url = format!("{}/internal/infer/maille", base.trim_end_matches('/'));
    let body = json!({
        "features": features,
        "charge_kpa": charge_kpa,
    });
    let resp = match INTERNAL_INFER_HTTP
        .post(&url)
        .header("X-Internal-Token", token.trim())
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => {
            return (
                build_prediction(features, charge_kpa),
                "api-infer-v0-rule-based",
            );
        }
    };
    if !resp.status().is_success() {
        return (
            build_prediction(features, charge_kpa),
            "api-infer-v0-rule-based",
        );
    }
    let v: serde_json::Value = match resp.json().await {
        Ok(x) => x,
        Err(_) => {
            return (
                build_prediction(features, charge_kpa),
                "api-infer-v0-rule-based",
            );
        }
    };
    if v.get("error").is_some() {
        return (
            build_prediction(features, charge_kpa),
            "api-infer-v0-rule-based",
        );
    }
    (
        v,
        "api-infer-onnx-v1",
    )
}

fn build_prediction(features: &MailleFeatures, charge_kpa: Option<f64>) -> serde_json::Value {
    let vbs = features.vbs_moyen.unwrap_or(7.0);
    let ip = features.ip_moyen.unwrap_or(25.0);
    let cg = features.gonflement_cg_moyen.unwrap_or(4.0);
    let charge = charge_kpa.unwrap_or(150.0);

    // Moteur règles géotechnique v0 (BRGM adapté contexte togolais).
    let mut facteurs: Vec<String> = Vec::new();
    let vbs_score = match vbs {
        x if x >= 8.0 => {
            facteurs.push("VBS tres eleve (>=8 g/100g)".to_string());
            100.0
        }
        x if x >= 5.0 => {
            facteurs.push("VBS eleve (5-8 g/100g)".to_string());
            75.0
        }
        x if x >= 2.5 => {
            facteurs.push("VBS modere (2.5-5 g/100g)".to_string());
            50.0
        }
        _ => {
            facteurs.push("VBS faible ou non mesure".to_string());
            25.0
        }
    };
    let ip_score = match ip {
        x if x >= 50.0 => {
            facteurs.push("IP tres eleve (>=50%)".to_string());
            100.0
        }
        x if x >= 35.0 => {
            facteurs.push("IP eleve (35-50%)".to_string());
            75.0
        }
        x if x >= 20.0 => {
            facteurs.push("IP modere (20-35%)".to_string());
            45.0
        }
        _ => 20.0,
    };
    let cg_score = match cg {
        x if x >= 10.0 => {
            facteurs.push("Potentiel de gonflement tres eleve".to_string());
            100.0
        }
        x if x >= 5.0 => {
            facteurs.push("Potentiel de gonflement eleve".to_string());
            60.0
        }
        _ => 30.0,
    };

    let mut risk_score: f64 = (vbs_score * 0.45_f64) + (ip_score * 0.30_f64) + (cg_score * 0.15_f64);
    if features.pct_in_lama.unwrap_or(0.0) >= 25.0 || features.in_zone_rga_tres_fort {
        facteurs.push("Contexte geologique Lama / zone RGA tres fort".to_string());
        risk_score += 10.0;
    }
    risk_score = risk_score.clamp(0.0, 100.0);

    let classe_rga = if risk_score >= 80.0 {
        "tres_fort"
    } else if risk_score >= 60.0 {
        "fort"
    } else if risk_score >= 40.0 {
        "moyen"
    } else {
        "faible"
    };

    let bearing_capacity_kpa: f64 = (220.0_f64 - (risk_score * 1.1_f64)).max(60.0_f64);
    let settlement_risk = ((charge / bearing_capacity_kpa) * 100.0).clamp(0.0, 100.0);
    let confidence = ((features.data_confidence_score as f64) / 100.0).clamp(0.1, 0.95);

    json!({
        "model_version": "api-infer-v0-rule-based",
        "risk_score": (risk_score * 100.0).round() / 100.0,
        "rga_class": classe_rga,
        "norme_appliquee": "BRGM-RGA adapte contexte togolais",
        "facteurs_determinants": facteurs,
        "data_confidence": features.data_confidence_score,
        "estimated_bearing_capacity_kpa": (bearing_capacity_kpa * 100.0).round() / 100.0,
        "estimated_settlement_risk_pct": (settlement_risk * 100.0).round() / 100.0,
        "confidence": (confidence * 100.0).round() / 100.0
    })
}
