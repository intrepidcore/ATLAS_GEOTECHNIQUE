//! Service **api-opti** : optimisation / aide à la décision (charge CPU) hors façade api-geo.
//! - **Campagne** : scores SQL + AG (nécessite `DATABASE_URL`).
//! - **Stratégie fondations** : entrée features JSON (inchangé).

mod campaign;

use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, Response, StatusCode};
use axum::middleware::{self, Next};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OptiCandidate {
    rank: usize,
    traitement_sol: String,
    fondation: String,
    cout_fcfa: f64,
    safety_factor: f64,
    durability_score: f64,
    fitness: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OptiResponse {
    maille_id: Uuid,
    maille_code: String,
    model_version: String,
    generations: u32,
    population_size: u32,
    best_candidates: Vec<OptiCandidate>,
}

#[derive(Deserialize)]
struct OptiStratIn {
    maille_id: Uuid,
    maille_code: String,
    features: Value,
    charge_kpa: f64,
    budget_fcfa: f64,
    generations: u32,
    population_size: u32,
}

struct FeatSlice {
    pct_in_lama: f64,
    n_sondages: i64,
}

impl FeatSlice {
    fn from_value(v: &Value) -> Self {
        Self {
            pct_in_lama: v
                .get("pct_in_lama")
                .and_then(|x| x.as_f64())
                .unwrap_or(0.0),
            n_sondages: v
                .get("n_sondages")
                .and_then(|x| x.as_i64())
                .unwrap_or(0),
        }
    }
}

fn build_candidates(f: &FeatSlice, charge_kpa: f64, budget_fcfa: f64) -> Vec<OptiCandidate> {
    let treatments = [
        ("aucun", 1.0_f64, 0.0_f64, 0.85_f64),
        ("chaux", 1.18_f64, 7_500_000.0_f64, 0.9_f64),
        ("ciment", 1.28_f64, 10_500_000.0_f64, 0.92_f64),
        ("nere_experimental", 1.14_f64, 6_500_000.0_f64, 0.88_f64),
    ];
    let foundations = [
        ("semelles_superficielles", 1.0_f64, 12_000_000.0_f64),
        ("radier", 1.22_f64, 18_500_000.0_f64),
        ("micropieux", 1.45_f64, 26_000_000.0_f64),
    ];

    let risk_multiplier = if f.pct_in_lama >= 25.0 { 1.18 } else { 1.0 };
    let data_bonus = (f.n_sondages as f64 * 0.03).clamp(0.0, 0.15);

    let mut out = Vec::new();
    for (t_name, t_safety_mult, t_cost, t_durability) in treatments {
        for (f_name, f_safety_mult, f_cost) in foundations {
            let base_safety = (2.2 - (charge_kpa / 280.0)).clamp(0.8, 2.2);
            let safety =
                (base_safety * t_safety_mult * f_safety_mult / risk_multiplier + data_bonus).clamp(0.6, 3.0);
            let cost = t_cost + f_cost + (charge_kpa * 12_000.0);
            let budget_ratio = (budget_fcfa / cost).clamp(0.2, 2.0);
            let durability = (t_durability + if f_name == "micropieux" { 0.05 } else { 0.0 }).clamp(0.5, 1.0);
            let fitness = (safety * 45.0) + (durability * 35.0) + (budget_ratio * 20.0);

            out.push(OptiCandidate {
                rank: 0,
                traitement_sol: t_name.to_string(),
                fondation: f_name.to_string(),
                cout_fcfa: (cost * 100.0).round() / 100.0,
                safety_factor: (safety * 100.0).round() / 100.0,
                durability_score: (durability * 100.0).round() / 100.0,
                fitness: (fitness * 100.0).round() / 100.0,
            });
        }
    }
    out
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

async fn opti_strategie(State(_state): State<AppState>, Json(payload): Json<OptiStratIn>) -> Json<OptiResponse> {
    let f = FeatSlice::from_value(&payload.features);
    let mut candidates = build_candidates(&f, payload.charge_kpa, payload.budget_fcfa);
    candidates.sort_by(|a, b| b.fitness.partial_cmp(&a.fitness).unwrap_or(std::cmp::Ordering::Equal));
    for (idx, c) in candidates.iter_mut().enumerate() {
        c.rank = idx + 1;
    }
    Json(OptiResponse {
        maille_id: payload.maille_id,
        maille_code: payload.maille_code,
        model_version: "api-opti-v0-genetic-inspired".to_string(),
        generations: payload.generations,
        population_size: payload.population_size,
        best_candidates: candidates.into_iter().take(5).collect(),
    })
}

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .init();

    let db_url = std::env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL requis (vue atlas.v_campaign_candidate_scores)"))?;
    let pool = PgPoolOptions::new()
        .max_connections(8)
        .connect(&db_url)
        .await?;
    let state = AppState { pool };

    let internal = Router::new()
        .route("/internal/opti/strategie", post(opti_strategie))
        .route("/internal/opti/campaign/simple", post(campaign::campaign_simple))
        .route("/internal/opti/campaign", post(campaign::campaign_ga))
        .with_state(state.clone())
        .layer(middleware::from_fn(verify_internal));

    let app = Router::new()
        .route("/healthz", get(|| async { Json(Health { status: "ok" }) }))
        .route(
            "/version",
            get(|| async {
                Json(json!({"service": "api-opti", "git": env!("GIT_HASH"), "built": env!("BUILD_TIME")}))
            }),
        )
        .merge(internal)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive());

    let port: u16 = std::env::var("API_OPTI_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8011);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("api-opti listening on {}", addr);
    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
