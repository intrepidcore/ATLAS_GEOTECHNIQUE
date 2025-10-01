use axum::{routing::{get, post}, Json, Router};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Serialize)]
struct Health { status: &'static str }

#[derive(Deserialize)]
struct PredictIn { features: Vec<f32> }

#[derive(Serialize)]
struct PredictOut { y_hat: Option<f32>, note: String }

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
        .route("/predict", post(predict))
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    let port: u16 = std::env::var("API_INFER_PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(8000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("listening on {}", addr);
    axum::Server::bind(&addr).serve(app.into_make_service()).await?;
    Ok(())
}

async fn predict(Json(_inp): Json<PredictIn>) -> (StatusCode, Json<PredictOut>) {
    let model_path = std::env::var("MODEL_PATH").ok();
    if model_path.is_none() {
        return (StatusCode::NOT_IMPLEMENTED, Json(PredictOut { y_hat: None, note: "MODEL_PATH absent: stub 501".into() }));
    }
    // TODO: Charger le runtime ONNX et appliquer le modèle
    (StatusCode::OK, Json(PredictOut { y_hat: None, note: "Prédiction stub".into() }))
}
