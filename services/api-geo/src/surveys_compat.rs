// Module de compatibilité pour l'ancien endpoint /surveys/ungeocode
use crate::state::AppState;
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UngeocodedSurvey {
    pub id: Uuid,
    pub code_site: Option<String>,
    pub localite: Option<String>,
    pub adm3_code: Option<String>,
    pub ungeocoded: bool,
    pub loc_mode: String,
}

pub async fn list_ungeocode(State(state): State<AppState>) -> impl IntoResponse {
    let pool = &state.pool;

    let rows = sqlx::query_as::<_, UngeocodedSurvey>(
        r#"
        SELECT
          id,
          meta->>'code' AS code_site,
          meta->>'localite' AS localite,
          meta->>'adm3_code' AS adm3_code,
          (geom IS NULL) AS ungeocoded,
          COALESCE(loc_mode, 'spread') AS loc_mode
        FROM sondages
        WHERE geom IS NULL
        ORDER BY created_at DESC
        LIMIT 500
        "#,
    )
    .fetch_all(pool)
    .await;

    match rows {
        Ok(surveys) => Json(surveys).into_response(),
        Err(e) => {
            tracing::error!(?e, "Failed to fetch ungeocode surveys");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to fetch surveys"
                })),
            )
                .into_response()
        }
    }
}
