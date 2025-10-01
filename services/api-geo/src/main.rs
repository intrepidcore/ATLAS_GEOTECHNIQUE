use axum::{routing::{get, post}, Json, Router};
use axum::http::Method;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::{cors::{Any, CorsLayer}, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod version;
mod routes;
mod config;
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

    // CORS permissif (dev/local). Autoriser GET/POST/OPTIONS et tous headers/origines
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    // DB check (optional pool not stored yet)
    let pool = match config::pg_pool().await {
        Ok(p) => { tracing::info!("DB connectivité ok"); p },
        Err(e) => {
            tracing::warn!("DB indisponible au démarrage: {e:?}");
            // on continue, mais certaines routes échoueront si DB requise
            // pour rester robuste, on tente quand même de créer un pool (peut échouer plus tard)
            config::pg_pool().await?
        }
    };
    let state = AppState { pool };

    let app = Router::new()
        .route("/healthz", get(|| async { Json(Health { status: "ok" }) }))
        .route("/version", get(version::version))
        .route("/echo", post(|Json(v): Json<serde_json::Value>| async move { Json(Echo { any: v })}))
        .route("/coverage/mailles", get(routes::get_coverage_mailles))
        .nest("/grid", routes::grid_router())
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
