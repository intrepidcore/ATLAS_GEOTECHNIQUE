use axum::{
    http::StatusCode,
    http::HeaderMap,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use axum::routing::get;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login))
        .route("/me", get(me))
        .route("/refresh", post(refresh))
        .route("/logout", post(logout))
        .route("/logout-all", post(logout_all))
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user: LoginUser,
}

#[derive(Debug, Serialize)]
pub struct LoginUser {
    pub id: String,
    pub email: String,
    pub username: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub is_active: bool,
    pub is_verified: bool,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

async fn login(Json(req): Json<LoginRequest>) -> impl IntoResponse {
    let desktop_mode = std::env::var("ATLAS_DESKTOP")
        .map(|v| v.trim() == "1" || v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if !desktop_mode {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error":"auth disabled"})),
        )
            .into_response();
    }

    let email = req.email.trim().to_string();
    let username = email
        .split('@')
        .next()
        .unwrap_or("user")
        .to_string();

    Json(LoginResponse {
        access_token: "desktop-dev-token".to_string(),
        refresh_token: "desktop-dev-refresh".to_string(),
        user: LoginUser {
            id: "00000000-0000-0000-0000-000000000000".to_string(),
            email,
            username,
            first_name: None,
            last_name: None,
            is_active: true,
            is_verified: true,
        },
    })
    .into_response()
}

async fn me(headers: HeaderMap) -> impl IntoResponse {
    let desktop_mode = std::env::var("ATLAS_DESKTOP")
        .map(|v| v.trim() == "1" || v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if !desktop_mode {
        return (StatusCode::NOT_FOUND, Json(json!({"error":"auth disabled"}))).into_response();
    }

    let token_ok = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|t| t == "desktop-dev-token")
        .unwrap_or(false);

    if !token_ok {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"invalid token"})),
        )
            .into_response();
    }

    Json(json!({
        "id": "00000000-0000-0000-0000-000000000000",
        "email": "admin@local",
        "username": "admin",
        "first_name": null,
        "last_name": null,
        "is_active": true,
        "is_verified": true
    }))
    .into_response()
}

async fn refresh(Json(_req): Json<RefreshRequest>) -> impl IntoResponse {
    let desktop_mode = std::env::var("ATLAS_DESKTOP")
        .map(|v| v.trim() == "1" || v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if !desktop_mode {
        return (StatusCode::NOT_FOUND, Json(json!({"error":"auth disabled"}))).into_response();
    }

    Json(json!({"access_token":"desktop-dev-token"}))
        .into_response()
}

async fn logout() -> impl IntoResponse {
    let desktop_mode = std::env::var("ATLAS_DESKTOP")
        .map(|v| v.trim() == "1" || v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if !desktop_mode {
        return (StatusCode::NOT_FOUND, Json(json!({"error":"auth disabled"}))).into_response();
    }

    Json(json!({"ok":true})).into_response()
}

async fn logout_all() -> impl IntoResponse {
    let desktop_mode = std::env::var("ATLAS_DESKTOP")
        .map(|v| v.trim() == "1" || v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if !desktop_mode {
        return (StatusCode::NOT_FOUND, Json(json!({"error":"auth disabled"}))).into_response();
    }

    Json(json!({"sessions_revoked":1})).into_response()
}
