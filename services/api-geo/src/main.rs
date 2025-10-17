use axum::{routing::{get, post, delete}, Json, Router};
use axum::http::Method;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::{cors::{Any, CorsLayer}, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod version;
mod routes;
mod config;
mod surveys;
pub mod state;

#[derive(Serialize)]
struct Health { status: &'static str }

#[derive(Deserialize, Serialize)]
struct Echo { any: serde_json::Value }

use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .init();

    // CORS permissif (dev/local). Autoriser GET/POST/DELETE/PATCH/OPTIONS et tous headers/origines
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::PATCH, Method::OPTIONS])
        .allow_headers(Any);

    // DB connexion avec retry (5 tentatives max, backoff exponentiel)
    tracing::info!("Connexion à la base de données...");
    let pool = config::pg_pool_with_retry(5).await?;
    tracing::info!("✅ DB connectée avec succès");
    
    let state = AppState { pool };

    let app = Router::new()
        .route("/healthz", get(|| async { Json(Health { status: "ok" }) }))
        .route("/version", get(version::version))
        .route("/echo", post(|Json(v): Json<serde_json::Value>| async move { Json(Echo { any: v })}))
        .route("/coverage/mailles", get(routes::get_coverage_mailles))
        .nest("/grid", routes::grid_router())
        // Survey management endpoints
        .route("/grid/locate", get(surveys::locate_maille))
        .route("/surveys", get(surveys::list_surveys).post(surveys::create_survey))
        .route("/surveys/:id", delete(surveys::delete_survey))
        .route("/surveys/:id/tests", get(surveys::list_tests))
        .route("/tests", post(surveys::create_test))
        .route("/tests/:id", delete(surveys::delete_test))
        .route("/adm1", get(surveys::list_adm1))
        .route("/adm2", get(surveys::list_adm2))
        .route("/adm3", get(surveys::list_adm3))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    let port: u16 = std::env::var("API_GEO_PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(8000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
