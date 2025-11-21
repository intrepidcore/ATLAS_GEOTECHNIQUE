use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub metrics: Arc<crate::metrics::Metrics>,
    pub ws_tx: broadcast::Sender<crate::events::WsEvent>,
}
