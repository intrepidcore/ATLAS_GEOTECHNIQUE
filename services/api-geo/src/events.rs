// Types d'événements WebSocket
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsEvent {
    SondageCreated {
        id: String,
        code: String,
    },
    SondageUpdated {
        id: String,
        code: String,
    },
    SondageGeocoded {
        id: String,
        code: String,
        location_mode: String,
        adm3_name: Option<String>,
    },
    SondageDeleted {
        id: String,
    },
    SuggestionAccepted {
        suggestion_id: String,
        sondage_id: String,
        adm3_pcode: String,
    },
    SuggestionRejected {
        suggestion_id: String,
    },
    RefreshStats,
}
