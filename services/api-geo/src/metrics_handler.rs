// Handler pour l'endpoint /metrics
use axum::extract::State;
use axum::http::header;
use axum::response::{IntoResponse, Response};
use crate::state::AppState;

pub async fn metrics_handler(State(state): State<AppState>) -> Response {
    let body = state.metrics.to_prometheus().await;
    
    (
        [(header::CONTENT_TYPE, "text/plain; version=0.0.4")],
        body,
    )
        .into_response()
}
