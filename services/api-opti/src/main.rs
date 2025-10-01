use axum::{routing::{get, post}, Json, Router};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use rand::Rng;
use rayon::prelude::*;

#[derive(Serialize)]
struct Health { status: &'static str }

#[derive(Deserialize)]
struct Scenario { params: serde_json::Value }

#[derive(Serialize, Clone)]
struct FrontPoint { cost: f64, safety: f64, solution_id: u64 }

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/healthz", get(|| async { Json(Health { status: "ok" }) }))
        .route("/version", get(|| async { Json(serde_json::json!({"git": env!("GIT_HASH"), "built": env!("BUILD_TIME")})) }))
        .route("/echo", post(|Json(v): Json<serde_json::Value>| async move { Json(v) }))
        .route("/pareto", post(pareto))
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    let port: u16 = std::env::var("API_OPTI_PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(8000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("listening on {}", addr);
    axum::Server::bind(&addr).serve(app.into_make_service()).await?;
    Ok(())
}

async fn pareto(Json(_scenario): Json<Scenario>) -> Json<Vec<FrontPoint>> {
    // GA placeholder: generate random population and evaluate in parallel
    let n = 64usize;
    let mut rng = rand::thread_rng();
    let pop: Vec<u64> = (0..n).map(|_| rng.gen()).collect();
    let points: Vec<FrontPoint> = pop.par_iter()
        .enumerate()
        .map(|(i, _)| {
            let cost = 100.0 - (i as f64);
            let safety = (i as f64) / 100.0;
            FrontPoint { cost, safety, solution_id: i as u64 }
        })
        .collect();
    Json(points)
}
