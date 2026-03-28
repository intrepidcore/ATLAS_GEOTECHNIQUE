//! Clients HTTP optionnels vers api-infer et api-opti (microservices internes).
//! Si `ATLAS_API_INFER_URL` / `ATLAS_API_OPTI_URL` sont vides, la façade exécute le code local.

use serde_json::{json, Value};
use std::time::Duration;

fn internal_token() -> Option<String> {
    let t = std::env::var("ATLAS_INTERNAL_SERVICE_TOKEN").unwrap_or_default();
    if t.trim().is_empty() {
        None
    } else {
        Some(t)
    }
}

fn infer_base() -> Option<String> {
    let u = std::env::var("ATLAS_API_INFER_URL").unwrap_or_default();
    let u = u.trim().to_string();
    if u.is_empty() {
        None
    } else {
        Some(u.trim_end_matches('/').to_string())
    }
}

fn opti_base() -> Option<String> {
    let u = std::env::var("ATLAS_API_OPTI_URL").unwrap_or_default();
    let u = u.trim().to_string();
    if u.is_empty() {
        None
    } else {
        Some(u.trim_end_matches('/').to_string())
    }
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(900))
        .connect_timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())
}

/// Exécute le kriging GP côté api-infer si configuré ; sinon retourne `None`.
pub async fn forward_infer_kriging() -> Result<Option<Value>, String> {
    let Some(base) = infer_base() else {
        return Ok(None);
    };
    let token = internal_token().ok_or_else(|| "ATLAS_INTERNAL_SERVICE_TOKEN requis pour appeler api-infer".to_string())?;
    let client = http_client()?;
    let url = format!("{}/internal/kriging/recompute", base);
    let resp = client
        .post(&url)
        .header("X-Internal-Token", token)
        .json(&json!({}))
        .send()
        .await
        .map_err(|e| format!("infer kriging http: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("infer kriging status {}: {}", status, body));
    }
    let v: Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(Some(v))
}

/// Entraînement supervisé côté api-infer si configuré.
pub async fn forward_infer_supervised(model_version: &str, target: &str) -> Result<Option<Value>, String> {
    let Some(base) = infer_base() else {
        return Ok(None);
    };
    let token = internal_token().ok_or_else(|| "ATLAS_INTERNAL_SERVICE_TOKEN requis pour appeler api-infer".to_string())?;
    let client = http_client()?;
    let url = format!("{}/internal/supervised/train", base);
    let resp = client
        .post(&url)
        .header("X-Internal-Token", token)
        .json(&json!({
            "model_version": model_version,
            "target": target
        }))
        .send()
        .await
        .map_err(|e| format!("infer supervised http: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("infer supervised status {}: {}", status, body));
    }
    let v: Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(Some(v))
}

/// Optimisation stratégie côté api-opti si configuré. `features` = JSON des features maille.
pub async fn forward_opti_strategie(body: Value) -> Result<Option<Value>, String> {
    let Some(base) = opti_base() else {
        return Ok(None);
    };
    let token = internal_token().ok_or_else(|| "ATLAS_INTERNAL_SERVICE_TOKEN requis pour appeler api-opti".to_string())?;
    let client = http_client()?;
    let url = format!("{}/internal/opti/strategie", base);
    let resp = client
        .post(&url)
        .header("X-Internal-Token", token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("opti strategie http: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("opti strategie status {status}: {txt}"));
    }
    let v: Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(Some(v))
}
