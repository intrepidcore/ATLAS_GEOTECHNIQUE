// Module WebSocket pour événements temps réel
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;
use tokio::sync::broadcast;
use crate::state::AppState;
use crate::events::WsEvent;

// ============================================================================
// Handler WebSocket
// ============================================================================

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (sender, mut receiver) = socket.split();
    let mut rx = state.ws_tx.subscribe();
    
    // Utiliser Arc<Mutex> pour partager le sender
    let sender = Arc::new(tokio::sync::Mutex::new(sender));
    let sender_clone = sender.clone();
    
    // Task pour envoyer les événements broadcast
    let mut send_task = tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            let json = serde_json::to_string(&event).unwrap_or_default();
            let mut sender = sender_clone.lock().await;
            if sender.send(Message::Text(json)).await.is_err() {
                break;
            }
        }
    });
    
    // Task pour recevoir les messages du client (ping/pong)
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Close(_) => break,
                Message::Ping(data) => {
                    let mut sender = sender.lock().await;
                    if sender.send(Message::Pong(data)).await.is_err() {
                        break;
                    }
                }
                _ => {}
            }
        }
    });
    
    // Attendre qu'une des tasks se termine
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }
    
    tracing::info!("WebSocket connection closed");
}

// ============================================================================
// Helper pour broadcaster un événement
// ============================================================================

pub fn broadcast_event(tx: &broadcast::Sender<WsEvent>, event: WsEvent) {
    if let Err(e) = tx.send(event) {
        tracing::warn!("Failed to broadcast event: {}", e);
    }
}
