use axum::{routing::{get, post, delete}, Json, Router};
use axum::http::Method;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::{cors::{Any, CorsLayer}, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod version;
mod routes;
mod config;
mod surveys;
mod surveys_extended;
mod surveys_bulk;
mod surveys_adm;
mod geotechnical;
mod audit;
mod neighbors;
mod exports;
mod import_bulk;
mod import_wizard;
mod thematic;
mod geocoding;
mod cells_labs;
mod surveys_compat;
pub mod state;

#[derive(Serialize)]
struct Health { status: &'static str }

#[derive(Deserialize, Serialize)]
struct Echo { any: serde_json::Value }

use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Charger le fichier .env (ignore l'erreur si absent, utile pour Docker)
    let _ = dotenvy::dotenv();
    
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .init();

    // CORS permissif (dev/local). Autoriser localhost:8080 et 127.0.0.1:8080
    use axum::http::header::{AUTHORIZATION, CONTENT_TYPE, ACCEPT};
    
    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:8080".parse::<axum::http::HeaderValue>().unwrap(),
            "http://127.0.0.1:8080".parse::<axum::http::HeaderValue>().unwrap(),
        ])
        .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::PATCH, Method::PUT, Method::OPTIONS])
        .allow_headers([AUTHORIZATION, CONTENT_TYPE, ACCEPT])
        .allow_credentials(true);

    // DB connexion avec retry (5 tentatives max, backoff exponentiel)
    tracing::info!("Connexion à la base de données...");
    let pool = config::pg_pool_with_retry(5).await?;
    tracing::info!("✅ DB connectée avec succès");
    
    let state = AppState { pool };

    let app = Router::new()
        .route("/healthz", get(|| async { Json(Health { status: "ok" }) }))
        .route("/version", get(version::version))
        .route("/echo", post(|Json(v): Json<serde_json::Value>| async move { Json(Echo { any: v })}))
        .route("/coverage/mailles", get(routes::get_coverage_mailles))
        .nest("/grid", routes::grid_router())
        // Survey management endpoints
        .route("/grid/locate", get(surveys::locate_maille))
        .route("/surveys", get(surveys::list_surveys).post(surveys_extended::create_survey_v2))
        .route("/surveys/legacy", post(surveys::create_survey))
        .route("/surveys/bulk", post(surveys_bulk::bulk_import_surveys))
        .route("/surveys/nearby", get(surveys::get_nearby_surveys))
        .route("/surveys/:id", get(surveys::get_survey).put(surveys::update_survey).delete(surveys::delete_survey))
        .route("/surveys/:id/geocode", post(surveys_adm::geocode_survey))
        .route("/surveys/:id/tests", get(surveys::list_tests))
        .route("/tests", post(surveys::create_test))
        .route("/tests/:id", delete(surveys::delete_test))
        // Geotechnical enriched endpoints
        .route("/surveys/geotech", post(geotechnical::create_survey_geotech))
        .route("/surveys/:id/geotech", get(geotechnical::get_survey_geotech))
        .route("/classifications/:sondage_id", get(geotechnical::list_classifications))
        // ADM-based surveys (without coordinates)
        .route("/surveys/adm", post(surveys_adm::create_survey_adm))
        .route("/surveys/ungeocode", get(surveys_compat::list_ungeocode))
        // Cell labs data (panneau gauche)
        .route("/cells/:code/labs", get(cells_labs::get_cell_labs))
        .route("/cells/:code/complete", get(cells_labs::get_cell_complete))
        .route("/adm/:level", get(routes::list_adm_zones))
        .route("/adm1", get(surveys::list_adm1))
        .route("/adm2", get(surveys::list_adm2))
        .route("/adm3", get(surveys::list_adm3))
        // Audit log endpoints
        .route("/audit", get(audit::list_audit_logs))
        .route("/audit/export/csv", get(audit::export_audit_csv))
        // Export endpoints
        .route("/exports/geopackage", get(exports::export_geopackage))
        .route("/exports/pdf", get(exports::export_pdf))
        // Import bulk endpoints
        .merge(import_bulk::configure())
        // Import wizard v2.3.0 endpoints
        .merge(import_wizard::configure())
        // Thematic maps endpoints
        .route("/thematic/data", get(thematic::get_thematic_data))
        .route("/thematic/classify", post(thematic::classify_data))
        .route("/thematic/configs", get(thematic::list_configs).post(thematic::create_config))
        .route("/thematic/configs/:id", get(thematic::get_config).delete(thematic::delete_config))
        .route("/thematic/palettes", get(thematic::list_palettes))
        // Geocoding endpoints
        .route("/geocode/suggestions", get(geocoding::list_suggestions))
        .route("/geocode/suggestions/:id/accept", post(geocoding::accept_suggestion))
        .route("/geocode/suggestions/:id/reject", post(geocoding::reject_suggestion))
        .route("/geocode/suggestions/:id/update", post(geocoding::update_suggestion))
        .route("/geocode/apply-accepted", post(geocoding::apply_accepted))
        .route("/geocode/stats", get(geocoding::get_stats))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    let port: u16 = std::env::var("API_GEO_PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(8000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
