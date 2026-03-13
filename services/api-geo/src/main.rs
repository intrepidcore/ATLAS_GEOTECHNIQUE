use axum::http::Method;
use axum::{
    extract::{Query, State},
    middleware,
    routing::{delete, get, patch, post},
    response::IntoResponse,
    Json, Router,
};
use axum::http::header;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tower_http::set_header::SetResponseHeaderLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod audit;
pub mod auth;
mod routes;
mod colab;
mod export;
mod cells_labs;
mod cells_kpi;
mod config;
mod db_manager;
mod events;
mod dsm;
mod exports;
mod geocode_manual;
mod geocode_suggestions;
mod geocoding;
mod geotechnical;
mod health;
mod import_bulk;
mod import_wizard;
mod layers;
mod metrics;
mod metrics_handler;
mod neighbors;
mod observability;
mod rbac;
pub mod roles;
mod search_service;
mod sondages;
mod sondages_geocode;
mod sql_sanitizer;
mod stats_global;
pub mod users;
mod websocket;

use metrics_handler::metrics_handler;
pub mod state;
mod surveys;
mod surveys_adm;
mod surveys_bulk;
mod surveys_canon;
mod surveys_compat;
mod surveys_extended;
mod surveys_unified;
mod thematic;
mod version;

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

#[derive(Deserialize, Serialize)]
struct Echo {
    any: serde_json::Value,
}

#[derive(Deserialize)]
struct UnifiedSearchQuery {
    q: String,
    limit: Option<i64>,
}

use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Charger le fichier .env (ignore l'erreur si absent, utile pour Docker)
    let _ = dotenvy::dotenv();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            "debug,hyper=info,sqlx=warn",
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // CORS
    // - Desktop/Tauri dev: le frontend tourne sur http://localhost:1420 (ou 127.0.0.1)
    //   et fait des appels cross-origin vers l'API. Certaines requêtes utilisent des
    //   credentials (cookies / auth), donc on DOIT éviter allow_origin(Any).
    // - Docker/dev: si CORS_ORIGINS est défini, on l'utilise.
    use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
    use axum::http::{HeaderValue, Method};
    use tower_http::cors::Any;

    let is_desktop = std::env::var("ATLAS_DESKTOP")
        .map(|v| v.trim() == "1" || v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let cors_origins_env = std::env::var("CORS_ORIGINS")
        .ok()
        .map(|s| {
            s.split(',')
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
                .collect::<Vec<_>>()
        })
        .filter(|v| !v.is_empty());

    let cors = if let Some(origins) = cors_origins_env {
        let mut allowed: Vec<HeaderValue> = Vec::new();
        for o in origins {
            if let Ok(h) = HeaderValue::from_str(&o) {
                allowed.push(h);
            }
        }

        CorsLayer::new()
            .allow_origin(allowed)
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::DELETE,
                Method::PATCH,
                Method::PUT,
                Method::OPTIONS,
            ])
            .allow_headers([AUTHORIZATION, CONTENT_TYPE, ACCEPT])
            .allow_credentials(true)
    } else if is_desktop {
        CorsLayer::new()
            .allow_origin([
                "http://localhost:1420".parse::<HeaderValue>().unwrap(),
                "http://127.0.0.1:1420".parse::<HeaderValue>().unwrap(),
                // compat dev UI standalone
                "http://localhost:5173".parse::<HeaderValue>().unwrap(),
                "http://127.0.0.1:5173".parse::<HeaderValue>().unwrap(),
            ])
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::DELETE,
                Method::PATCH,
                Method::PUT,
                Method::OPTIONS,
            ])
            .allow_headers([AUTHORIZATION, CONTENT_TYPE, ACCEPT])
            .allow_credentials(true)
    } else {
        CorsLayer::new()
            .allow_origin(Any) // Dev/local permissif
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::DELETE,
                Method::PATCH,
                Method::PUT,
                Method::OPTIONS,
            ])
            .allow_headers([AUTHORIZATION, CONTENT_TYPE, ACCEPT])
            .allow_credentials(false) // Any ne supporte pas credentials
    };

    // DB connexion avec retry (5 tentatives max, backoff exponentiel)
    tracing::info!("Connexion à la base de données...");
    let pool = config::pg_pool_with_retry(5).await?;
    tracing::info!("✅ DB connectée avec succès");

    // Note: Les migrations sont gérées manuellement via scripts SQL
    // sqlx::migrate!() désactivé car les migrations sont déjà appliquées

    // Initialiser les metrics
    let metrics = std::sync::Arc::new(metrics::Metrics::new());
    tracing::info!("✅ Metrics Prometheus initialisées");

    // Créer le canal broadcast pour WebSocket
    let (ws_tx, _) = tokio::sync::broadcast::channel(100);
    tracing::info!("✅ WebSocket broadcast channel créé");

    // Initialiser la configuration auth
    let auth_config = auth::AuthConfig::new();
    if let Err(e) = auth_config.validate() {
        tracing::warn!("⚠️ Configuration auth invalide: {}. Utilisation des valeurs par défaut.", e);
    }
    tracing::info!("✅ Configuration auth initialisée");

    let state = AppState {
        pool,
        metrics: metrics.clone(),
        ws_tx,
        auth_config,
    };

    // NOTE: On expose les routes à la racine ET sous /api pour rester compatible
    // avec le frontend (fallback API_BASE_URL = origin + /api) et les reverse proxies.
    let mut base_api = Router::new()
        .route("/healthz", get(health::health_check_simple))
        .route("/health", get(health::health_check))
        .route("/ping", get(|| async { "pong" }))
        .route("/metrics", get(metrics_handler))
        .route("/version", get(version::version))
        .route(
            "/echo",
            post(|Json(v): Json<serde_json::Value>| async move { Json(Echo { any: v }) }),
        )
        // WebSocket endpoint
        .route("/ws", get(websocket::ws_handler))
        // Routes publiques pour export cartographique
        .route("/export/cells/adm", get(thematic::get_adm_cells))
        .route("/coverage/mailles", get(routes::get_coverage_mailles))
        .route("/coverage/adm-boundaries", get(routes::get_coverage_adm_boundaries))
        .route("/coverage/mailles-dsm", get(dsm::get_coverage_mailles_dsm))
        .route("/maille/:code", get(routes::get_maille_by_code))
        .route("/mailles/:code", get(routes::get_maille_lookup))
        .route("/search/legacy/:code", get(routes::legacy_lookup))
        .route(
            "/search/unified",
            get(|State(state): State<AppState>, Query(params): Query<UnifiedSearchQuery>| async move {
                let limit = params.limit.unwrap_or(20).clamp(1, 50);
                match search_service::unified_search(&state.pool, &params.q, limit).await {
                    Ok(items) => (axum::http::StatusCode::OK, Json(items)).into_response(),
                    Err(e) => {
                        tracing::error!(?e, "unified_search error");
                        (
                            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                            Json(serde_json::json!({"error": "search_failed", "detail": e.to_string()})),
                        )
                            .into_response()
                    }
                }
            }),
        )
        .route("/adm-neighbors", get(routes::get_adm_neighbors))
        .nest("/grid", routes::grid_router())
        // Context layers endpoints (public - read-only)
        .route("/layers/geologie", get(layers::get_geologie))
        .route("/layers/pedologie", get(layers::get_pedologie))
        .route("/layers/risque-gonflement", get(layers::get_risque_gonflement))
        // Layer styles endpoints (from database catalog)
        .route("/layers/styles", get(layers::get_all_layer_styles))
        .route("/layers/:layer_type/styles", get(layers::get_layer_styles))
        // Survey management endpoints
        .route("/grid/locate", get(surveys::locate_maille))
        // Unified surveys endpoints (AVANT /surveys/:id pour éviter conflit)
        .route(
            "/surveys/unified",
            get(surveys_unified::list_unified_surveys),
        )
        .route(
            "/surveys/unified/stats",
            get(surveys_unified::get_unified_stats),
        )
        .route(
            "/surveys/unified/refresh",
            post(surveys_unified::refresh_unified_view),
        )
        .route(
            "/surveys",
            get(surveys::list_surveys).post(surveys_extended::create_survey_v2),
        )
        .route("/surveys/legacy", post(surveys::create_survey))
        .route("/surveys/bulk", post(surveys_bulk::bulk_import_surveys))
        .route("/surveys/nearby", get(surveys::get_nearby_surveys))
        .route(
            "/surveys/:id",
            get(surveys::get_survey)
                .put(surveys::update_survey)
                .delete(surveys::delete_survey),
        )
        .route("/surveys/:id/geocode", post(surveys_adm::geocode_survey))
        .route("/surveys/:id/tests", get(surveys::list_tests))
        .route("/tests", post(surveys::create_test))
        .route("/tests/:id", delete(surveys::delete_test))
        // Geotechnical enriched endpoints
        .route(
            "/surveys/geotech",
            post(geotechnical::create_survey_geotech),
        )
        .route(
            "/surveys/:id/geotech",
            get(geotechnical::get_survey_geotech),
        )
        .route(
            "/classifications/:sondage_id",
            get(geotechnical::list_classifications),
        )

        // ADM-based surveys (without coordinates)
        .route("/surveys/adm", post(surveys_adm::create_survey_adm))
        .route("/surveys/ungeocode", get(surveys_compat::list_ungeocode))
        // Cell labs data (panneau gauche)
        .route("/cells/:code/labs", get(cells_labs::get_cell_labs))
        .route("/cells/:code/complete", get(cells_labs::get_cell_complete))
        .route("/cells/:code/test-kpi", get(cells_kpi::test_kpi_endpoint))
        // Stats globales agrégées (panneau Vue globale)
        .route("/stats/global", get(stats_global::get_global_stats))
        .route("/adm0/geojson", get(surveys::get_adm0_geojson))
        .route("/adm-geojson", get(surveys::get_adm_geojson))
        .route("/adm1", get(surveys::list_adm1))
        .route("/adm2", get(surveys::list_adm2))
        .route("/adm3/test", get(surveys_adm::test_adm3_endpoint))
        .route("/adm3/geojson", get(surveys_adm::get_adm3_geojson))
        .route("/adm3", get(surveys::list_adm3))
        .route("/adm/:level", get(routes::list_adm_zones))
        .route("/adm/:level/:id", get(routes::get_adm_boundary_geojson))
        // Note: /adm-neighbors déplacé vers routes publiques (avant auth middleware)
        // Audit log endpoints
        .route("/audit", get(audit::list_audit_logs))
        .route("/audit/export/csv", get(audit::export_audit_csv))
        // Orchestrateur export (web|hq)
        .route("/export", post(exports::create_export))
        .route("/export/jobs/:id", get(exports::get_export_job))
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
        .route("/thematic/export/qgis", post(thematic::export_qgis_package))
        .route(
            "/thematic/configs",
            get(thematic::list_configs).post(thematic::create_config),
        )
        .route(
            "/thematic/configs/:id",
            get(thematic::get_config).delete(thematic::delete_config),
        )
        .route("/thematic/palettes", get(thematic::list_palettes))
        // Geocoding endpoints
        .route("/geocode/suggestions", get(geocoding::list_suggestions))
        .route(
            "/geocode/suggestions/:id/accept",
            post(geocoding::accept_suggestion),
        )
        .route(
            "/geocode/suggestions/:id/reject",
            post(geocoding::reject_suggestion),
        )
        .route("/geocode/apply-accepted", post(geocoding::apply_accepted))
        .route("/geocode/stats", get(geocoding::get_stats))
        .route(
            "/geocode/status/:schema/:table",
            get(db_manager::routes::geocode_status_handler),
        )
        // Manual geocoding endpoints
        .route(
            "/geocode/manual",
            get(geocode_manual::list_without_geometry),
        )
        .route("/geocode/manual/:id", post(geocode_manual::update_geometry))
        .route(
            "/geocode/manual/stats",
            get(geocode_manual::get_manual_stats),
        )
        // Unified geocoding endpoint (NEW)
        .route("/sondages/:id/geocode", post(sondages_geocode::geocode_sondage))
        // New suggestions endpoints (adapted to current schema)
        .route("/suggestions", get(geocode_suggestions::list_suggestions))
        .route("/suggestions/stats", get(geocode_suggestions::get_suggestions_stats))
        .route("/suggestions/:id/accept", post(geocode_suggestions::accept_suggestion))
        .route("/suggestions/:id/reject", post(geocode_suggestions::reject_suggestion))
        .route("/suggestions/auto-geocode", post(geocode_suggestions::auto_geocode_suggestions))
        // Surveys canoniques (unifiés)
        .route("/surveys-canon", get(surveys_canon::list_surveys))
        .route(
            "/surveys-canon/stats",
            get(surveys_canon::get_surveys_stats),
        )
        .route("/surveys-canon/resolve", get(surveys_canon::resolve_alias))
        .route("/surveys-canon/:id", get(surveys_canon::get_survey))
        .route(
            "/surveys-canon/:id/geometry",
            patch(surveys_canon::update_geometry),
        )
        .route(
            "/surveys-canon/:id/adm3-candidates",
            get(surveys_canon::get_adm3_candidates),
        )
        // Sondages individuels (géocodage unitaire)
        .route("/sondages", get(sondages::list_sondages))
        .route("/sondages/stats", get(sondages::get_sondages_stats))
        .route("/sondages/:id", get(sondages::get_sondage))
        .route("/sondages/:id/details", get(sondages::get_sondage_details))
        .route(
            "/sondages/:id/geometry",
            patch(sondages::update_sondage_geometry),
        )
        .route(
            "/sondages/:id/adm3-candidates",
            get(sondages::get_adm3_candidates),
        );

        // Database Manager endpoints (ADMIN ONLY)
        // ==========================================================================
        // Toutes les routes /db/* sont protégées par require_admin
        let db_manager_routes = Router::new()
            .route(
                "/types",
                get(db_manager::routes::get_postgres_types_handler),
            )
            .route("/schema", get(db_manager::routes::get_schema_handler))
            .route(
                "/table/:schema/:table",
                get(db_manager::routes::get_table_info_handler),
            )
            .route(
                "/table/:schema/:table/data",
                get(db_manager::routes::get_table_data_handler),
            )
            .route(
                "/table/:schema/:table/select",
                post(db_manager::routes::select_rows_handler),
            )
            .route(
                "/table/:schema/:table/select-bbox",
                post(db_manager::routes::select_bbox_handler),
            )
            .route(
                "/table/:schema/:table/extent",
                post(db_manager::routes::extent_by_ids_handler),
            )
            .route(
                "/table/:schema/:table/extent-related",
                post(db_manager::routes::extent_by_related_handler),
            )
            .route(
                "/table/:schema/:table/row",
                post(db_manager::routes::add_row_handler),
            )
            .route(
                "/table/:schema/:table/row/:id/:column",
                axum::routing::put(db_manager::routes::update_cell_handler),
            )
            .route(
                "/table/:schema/:table/rows",
                delete(db_manager::routes::delete_rows_handler),
            )
            .route(
                "/table/:schema/:table/staging",
                post(db_manager::routes::create_staging_handler),
            )
            .route(
                "/staging/:id/operation",
                post(db_manager::routes::apply_staging_operation_handler),
            )
            .route(
                "/staging/:id/validate",
                get(db_manager::routes::validate_staging_handler),
            )
            .route(
                "/staging/:id/preview",
                get(db_manager::routes::preview_staging_handler),
            )
            .route(
                "/staging/:id/commit",
                post(db_manager::routes::commit_staging_handler),
            )
            .route(
                "/staging/:id",
                delete(db_manager::routes::cancel_staging_handler),
            )
            .route(
                "/table/:schema/:table/column",
                post(db_manager::routes::add_column_handler),
            )
            .route(
                "/table/:schema/:table/column/:column",
                delete(db_manager::routes::delete_column_handler),
            )
            .route(
                "/table/:schema/:table/column/:column/impact",
                get(db_manager::routes::analyze_column_impact_handler),
            )
            .route(
                "/table/:schema/:table/column/dryrun",
                post(db_manager::routes::dryrun_add_column_handler),
            )
            .route(
                "/table/:schema/:table/column/:column/dryrun",
                get(db_manager::routes::dryrun_delete_column_handler),
            )
            .route(
                "/table/:schema/:table/audit",
                get(db_manager::routes::get_audit_log_handler),
            )
            .route(
                "/table/:schema/:table/audit/stats",
                get(db_manager::routes::get_audit_stats_handler),
            )
            .route(
                "/backup",
                post(db_manager::routes::create_backup_handler)
                    .get(db_manager::routes::list_backups_handler),
            )
            .route(
                "/backup/:id/restore",
                post(db_manager::routes::restore_backup_handler),
            )
            .route(
                "/backup/:id",
                delete(db_manager::routes::delete_backup_handler),
            )
            .layer(middleware::from_fn(auth::middleware::require_admin))
            .with_state(state.clone());

        base_api = base_api.nest("/db", db_manager_routes);
        // ==========================================================================
        // Authentication & Authorization routes (RBAC)
        // ==========================================================================
        base_api = base_api
            .merge(auth::routes::auth_routes())
            // Users management (requires authentication)
            .merge(
                users::routes::users_routes()
                    .layer(middleware::from_fn_with_state(
                        state.clone(),
                        auth::middleware::auth_middleware,
                    )),
            )
            // Roles management (requires authentication)
            .merge(
                roles::routes::roles_routes()
                    .layer(middleware::from_fn_with_state(
                        state.clone(),
                        auth::middleware::auth_middleware,
                    )),
            )
            // ==========================================================================
            // Atlas Colab routes (requires authentication)
            // ==========================================================================
            .merge(
                colab::routes::colab_routes()
                    .merge(export::export_routes())
                    .route_layer(middleware::from_fn_with_state(
                        state.clone(),
                        auth::middleware::auth_middleware,
                    )),
            )
            // ==========================================================================
            // Atlas Colab Mobile/PWA routes (requires authentication)
            // ==========================================================================
            .nest(
                "/colab",
                colab::mobile::mobile_routes()
                    .merge(colab::comments::comments_routes())
                    .merge(colab::qa::qa_routes())
                    .layer(middleware::from_fn_with_state(
                        state.clone(),
                        auth::middleware::auth_middleware,
                    )),
            )
            .layer(middleware::from_fn_with_state(
                state.clone(),
                auth::middleware::optional_auth_middleware,
            ));

    let app = Router::new()
        .nest("/", base_api.clone())
        .nest("/api", base_api)
        // Fallback explicite pour les routes non reconnues (retourne 404)
        .fallback(|| async {
            (
                axum::http::StatusCode::NOT_FOUND,
                axum::Json(serde_json::json!({
                    "error": "Route non trouvée",
                    "error_code": "NOT_FOUND"
                }))
            )
        })
        .layer(SetResponseHeaderLayer::overriding(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/json; charset=utf-8"),
        ))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    tracing::info!("✅ Router configuré avec {} routes", "toutes");
    tracing::debug!("Route /metrics ajoutée avec handler metrics_handler");

    let port: u16 = std::env::var("API_GEO_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
