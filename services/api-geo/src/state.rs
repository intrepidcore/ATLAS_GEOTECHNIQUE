use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::broadcast;

use crate::auth::AuthConfig;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub admin_pool: Option<PgPool>,
    pub metrics: Arc<crate::metrics::Metrics>,
    pub ws_tx: broadcast::Sender<crate::events::WsEvent>,
    pub auth_config: AuthConfig,
}
