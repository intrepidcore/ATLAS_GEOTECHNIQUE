//! Service **api-infer** : charge CPU (Python sklearn / GP) isolée de la façade api-geo.
//! Auth interne : header `X-Internal-Token` = `ATLAS_INTERNAL_SERVICE_TOKEN`.

use axum::body::Body;
use axum::http::{Request, Response, StatusCode};
use axum::middleware::{self, Next};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::Write;
use std::net::SocketAddr;
use std::process::{Command, Stdio};
use tokio::net::TcpListener;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

#[derive(Deserialize)]
struct SupervisedIn {
    #[serde(default = "default_model")]
    model_version: String,
    #[serde(default = "default_target")]
    target: String,
}

fn default_model() -> String {
    "supervised_ml_gb_v2_context".to_string()
}

fn default_target() -> String {
    "rga_predictor".to_string()
}

fn script_path(name: &str) -> String {
    if let Ok(dir) = std::env::var("ATLAS_SCRIPTS_DIR") {
        let dir = dir.trim_end_matches('/');
        return format!("{dir}/{name}");
    }
    format!(
        "{}/../../scripts/{name}",
        env!("CARGO_MANIFEST_DIR")
    )
}

fn python_candidates() -> Vec<&'static str> {
    if cfg!(windows) {
        vec!["python", "py"]
    } else {
        vec!["python3", "python"]
    }
}

fn run_python_stdin_json(script: String, stdin_json: String) -> Result<Value, String> {
    let mut last_err = String::new();
    for exe in python_candidates() {
        let mut child = match Command::new(exe)
            .arg(&script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                last_err = format!("{exe}: {e}");
                continue;
            }
        };
        if let Some(mut sin) = child.stdin.take() {
            let _ = sin.write_all(stdin_json.as_bytes());
        }
        let out = match child.wait_with_output() {
            Ok(o) => o,
            Err(e) => {
                last_err = format!("{exe}: {e}");
                continue;
            }
        };
        let stdout = String::from_utf8_lossy(&out.stdout).to_string();
        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
        if !out.status.success() {
            return Err(format!("python infer failed: {stderr}\n{stdout}"));
        }
        return serde_json::from_str(&stdout).map_err(|e| format!("invalid json: {e}: {stdout}"));
    }
    Err(format!("python infer spawn failed: {last_err}"))
}

fn run_python_json(args: &[String]) -> Result<Value, String> {
    let mut last_err = String::new();
    let mut out_opt = None;
    for exe in python_candidates() {
        match Command::new(exe).args(args).output() {
            Ok(out) => {
                out_opt = Some(out);
                break;
            }
            Err(e) => {
                last_err = format!("{exe}: {e}");
            }
        }
    }
    let out = out_opt.ok_or_else(|| format!("python execution failed: {last_err}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if !out.status.success() {
        return Err(format!("python failed: {stderr}\n{stdout}"));
    }
    serde_json::from_str(&stdout).map_err(|e| format!("invalid json from python: {e}: {stdout}"))
}

async fn verify_internal(req: Request<Body>, next: Next) -> Result<Response<Body>, StatusCode> {
    let expected = std::env::var("ATLAS_INTERNAL_SERVICE_TOKEN").unwrap_or_default();
    if expected.trim().is_empty() {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    let got = req
        .headers()
        .get("X-Internal-Token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if got != expected {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(next.run(req).await)
}

async fn kriging_recompute() -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let db_url = std::env::var("DATABASE_URL").map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "DATABASE_URL missing" })),
        )
    })?;
    let script = script_path("kriging_gp_global_interpolate.py");
    let args = vec![
        script,
        "--database-url".into(),
        db_url,
        "--method".into(),
        "kriging_gp_global_v1".into(),
    ];
    let j = tokio::task::spawn_blocking(move || run_python_json(&args))
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("join: {}", e) })),
            )
        })?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e }))))?;
    Ok(Json(j))
}

async fn infer_maille_onnx(Json(body): Json<Value>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let script = script_path("onnx_maille_infer.py");
    let stdin_json = serde_json::to_string(&body).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("body: {}", e) })),
        )
    })?;
    let j = tokio::task::spawn_blocking(move || run_python_stdin_json(script, stdin_json))
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("join: {}", e) })),
            )
        })?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e }))))?;
    Ok(Json(j))
}

async fn supervised_train(Json(body): Json<SupervisedIn>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let db_url = std::env::var("DATABASE_URL").map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "DATABASE_URL missing" })),
        )
    })?;
    let script = script_path("supervised_rga_train_infer.py");
    let model_version = body.model_version;
    let target = body.target;
    let args = vec![
        script,
        "--database-url".into(),
        db_url,
        "--model-version".into(),
        model_version.clone(),
        "--target".into(),
        target.clone(),
    ];
    let j = tokio::task::spawn_blocking(move || run_python_json(&args))
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("join: {}", e) })),
            )
        })?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e }))))?;
    Ok(Json(j))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .init();

    let internal = Router::new()
        .route("/internal/kriging/recompute", post(kriging_recompute))
        .route("/internal/supervised/train", post(supervised_train))
        .route("/internal/infer/maille", post(infer_maille_onnx))
        .layer(middleware::from_fn(verify_internal));

    let app = Router::new()
        .route("/healthz", get(|| async { Json(Health { status: "ok" }) }))
        .route(
            "/version",
            get(|| async {
                Json(json!({"service": "api-infer", "git": env!("GIT_HASH"), "built": env!("BUILD_TIME")}))
            }),
        )
        .merge(internal)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive());

    let port: u16 = std::env::var("API_INFER_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8010);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("api-infer listening on {}", addr);
    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
