use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;

use crate::state::AppState;

pub async fn ws_handler(ws: WebSocketUpgrade, State(_state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    // Minimal WS: keep-alive + optional echo.
    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Ping(v)) => {
                let _ = socket.send(Message::Pong(v)).await;
            }
            Ok(Message::Text(t)) => {
                // Echo back to help debugging.
                let _ = socket.send(Message::Text(t)).await;
            }
            Ok(Message::Close(_)) => break,
            Ok(_) => {}
            Err(_) => break,
        }
    }
}

pub async fn ws_disabled() -> impl IntoResponse {
    (StatusCode::NOT_FOUND, "ws disabled").into_response()
}
