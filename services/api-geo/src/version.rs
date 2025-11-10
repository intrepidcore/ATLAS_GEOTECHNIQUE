use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct Version {
    git: &'static str,
    built: &'static str,
}

pub async fn version() -> Json<Version> {
    Json(Version {
        git: env!("GIT_HASH"),
        built: env!("BUILD_TIME"),
    })
}
