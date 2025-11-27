//! API Mobile pour Atlas Colab
//! 
//! Endpoints optimisés pour l'application PWA terrain

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::state::AppState;

// ============================================================================
// Types DTOs
// ============================================================================

/// Mission pour l'affichage mobile
#[derive(Debug, Serialize, FromRow)]
pub struct MobileMission {
    pub id: Uuid,
    pub code: String,
    pub title: String,
    pub theme: String,
    pub status: String,
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
    pub maille_id: Option<Uuid>,
    pub maille_label: Option<String>,
    pub commune: Option<String>,
    pub region: Option<String>,
    pub expected_sondages: i32,
    pub completed_sondages: i64,
    pub percent_done: f64,
}

/// Détail mission pour mobile
#[derive(Debug, Serialize)]
pub struct MobileMissionDetail {
    pub mission: MobileMission,
    pub supervisor_name: Option<String>,
    pub supervisor_email: Option<String>,
    pub team_members: Vec<TeamMember>,
    pub recent_sondages: Vec<MobileSondage>,
    pub bbox: Option<BoundingBox>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct TeamMember {
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    pub role: String,
}

#[derive(Debug, Serialize)]
pub struct BoundingBox {
    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
    pub center_lon: f64,
    pub center_lat: f64,
}

/// Sondage simplifié pour mobile
#[derive(Debug, Serialize, FromRow)]
pub struct MobileSondage {
    pub id: Uuid,
    pub code_sondage: Option<String>,
    pub longitude: Option<f64>,
    pub latitude: Option<f64>,
    pub profondeur_atteinte: Option<f64>,
    pub validation_status: Option<String>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Contexte carte pour une mission
#[derive(Debug, Serialize)]
pub struct MapContext {
    pub mission_id: Uuid,
    pub maille_geojson: Option<serde_json::Value>,
    pub center_lon: Option<f64>,
    pub center_lat: Option<f64>,
    pub bbox: Option<BoundingBox>,
    pub existing_sondages: Vec<SondageMarker>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SondageMarker {
    pub id: Uuid,
    pub code: Option<String>,
    pub longitude: f64,
    pub latitude: f64,
    pub status: Option<String>,
}

/// Requête de création de sondage terrain
#[derive(Debug, Deserialize)]
pub struct CreateFieldSondageRequest {
    pub longitude: f64,
    pub latitude: f64,
    pub location_accuracy_m: Option<f32>,
    pub depth_m: Option<f64>,
    pub profile_description: Option<String>,
    pub layers_count: Option<i32>,
    pub notes: Option<String>,
    pub photo_ids: Option<Vec<Uuid>>,
}

/// Réponse création sondage
#[derive(Debug, Serialize)]
pub struct CreateSondageResponse {
    pub id: Uuid,
    pub code_sondage: String,
    pub message: String,
}

/// Action de synchronisation
#[derive(Debug, Deserialize)]
pub struct SyncAction {
    pub client_id: String,
    pub action_type: String,
    pub payload: serde_json::Value,
}

/// Requête de synchronisation batch
#[derive(Debug, Deserialize)]
pub struct SyncRequest {
    pub actions: Vec<SyncAction>,
}

/// Résultat d'une action de sync
#[derive(Debug, Serialize)]
pub struct SyncActionResult {
    pub client_id: String,
    pub success: bool,
    pub server_id: Option<Uuid>,
    pub error: Option<String>,
}

/// Réponse de synchronisation
#[derive(Debug, Serialize)]
pub struct SyncResponse {
    pub results: Vec<SyncActionResult>,
    pub synced_count: usize,
    pub failed_count: usize,
}

/// Requête de création de trace GPS
#[derive(Debug, Deserialize)]
pub struct CreateTrackRequest {
    pub mission_id: Uuid,
    pub name: Option<String>,
}

/// Point de trace GPS
#[derive(Debug, Deserialize)]
pub struct TrackPoint {
    pub longitude: f64,
    pub latitude: f64,
    pub altitude_m: Option<f32>,
    pub accuracy_m: Option<f32>,
    pub recorded_at: chrono::DateTime<chrono::Utc>,
}

/// Requête d'ajout de points à une trace
#[derive(Debug, Deserialize)]
pub struct AddTrackPointsRequest {
    pub points: Vec<TrackPoint>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /colab/mobile/missions - Mes missions assignées
pub async fn get_my_missions(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let missions = sqlx::query_as::<_, MobileMission>(
        r#"
        SELECT 
            m.id,
            m.code,
            m.title,
            m.theme::text,
            m.status::text,
            m.start_date,
            m.end_date,
            m.maille_id,
            m.zone_label AS maille_label,
            m.commune,
            m.region,
            COALESCE(m.expected_sondages, 0) AS expected_sondages,
            COALESCE((SELECT COUNT(*) FROM atlas.colab_mission_sondages cms WHERE cms.mission_id = m.id), 0) AS completed_sondages,
            CASE 
                WHEN COALESCE(m.expected_sondages, 0) = 0 THEN 0.0
                ELSE ROUND(
                    (COALESCE((SELECT COUNT(*) FROM atlas.colab_mission_sondages cms WHERE cms.mission_id = m.id), 0)::numeric 
                    / m.expected_sondages::numeric) * 100, 1
                )
            END AS percent_done
        FROM atlas.colab_missions m
        WHERE m.id IN (
            SELECT mission_id FROM atlas.colab_mission_assignments WHERE student_id IN (
                SELECT id FROM atlas.colab_students WHERE user_id = $1
            )
        )
        OR m.supervisor_id IN (
            SELECT id FROM atlas.colab_supervisors WHERE user_id = $1
        )
        OR m.created_by = $1
        ORDER BY 
            CASE m.status 
                WHEN 'in_progress' THEN 1 
                WHEN 'planned' THEN 2 
                WHEN 'draft' THEN 3 
                ELSE 4 
            END,
            m.start_date DESC NULLS LAST
        "#,
    )
    .bind(auth.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(serde_json::json!({
        "missions": missions,
        "count": missions.len()
    })))
}

/// GET /colab/mobile/missions/:id - Détail mission
pub async fn get_mission_detail(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(mission_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Récupérer la mission
    let mission = sqlx::query_as::<_, MobileMission>(
        r#"
        SELECT 
            m.id,
            m.code,
            m.title,
            m.theme::text,
            m.status::text,
            m.start_date,
            m.end_date,
            m.maille_id,
            m.zone_label AS maille_label,
            m.commune,
            m.region,
            COALESCE(m.expected_sondages, 0) AS expected_sondages,
            COALESCE((SELECT COUNT(*) FROM atlas.colab_mission_sondages cms WHERE cms.mission_id = m.id), 0) AS completed_sondages,
            CASE 
                WHEN COALESCE(m.expected_sondages, 0) = 0 THEN 0.0
                ELSE ROUND(
                    (COALESCE((SELECT COUNT(*) FROM atlas.colab_mission_sondages cms WHERE cms.mission_id = m.id), 0)::numeric 
                    / m.expected_sondages::numeric) * 100, 1
                )
            END AS percent_done
        FROM atlas.colab_missions m
        WHERE m.id = $1
        "#,
    )
    .bind(mission_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Mission non trouvée" })),
        )
    })?;

    // Récupérer le superviseur
    let supervisor: Option<(String, String)> = sqlx::query_as(
        r#"
        SELECT u.username, u.email
        FROM atlas.colab_supervisors s
        JOIN atlas.users u ON s.user_id = u.id
        JOIN atlas.colab_missions m ON m.supervisor_id = s.id
        WHERE m.id = $1
        "#,
    )
    .bind(mission_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    // Récupérer les membres de l'équipe
    let team_members = sqlx::query_as::<_, TeamMember>(
        r#"
        SELECT 
            u.id AS user_id,
            u.username,
            u.email,
            'student' AS role
        FROM atlas.colab_mission_assignments ma
        JOIN atlas.colab_students s ON ma.student_id = s.id
        JOIN atlas.users u ON s.user_id = u.id
        WHERE ma.mission_id = $1
        "#,
    )
    .bind(mission_id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Récupérer les sondages récents
    let recent_sondages = sqlx::query_as::<_, MobileSondage>(
        r#"
        SELECT 
            s.id,
            s.code_sondage,
            ST_X(s.geom) AS longitude,
            ST_Y(s.geom) AS latitude,
            s.profondeur_atteinte,
            s.validation_status::text,
            s.created_at
        FROM atlas.sondages s
        JOIN atlas.colab_mission_sondages cms ON s.id = cms.sondage_id
        WHERE cms.mission_id = $1
        ORDER BY s.created_at DESC
        LIMIT 10
        "#,
    )
    .bind(mission_id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Récupérer la bounding box de la maille
    let bbox: Option<BoundingBox> = if let Some(maille_id) = mission.maille_id {
        sqlx::query_as::<_, (f64, f64, f64, f64, f64, f64)>(
            r#"
            SELECT 
                ST_XMin(geom) AS min_x,
                ST_YMin(geom) AS min_y,
                ST_XMax(geom) AS max_x,
                ST_YMax(geom) AS max_y,
                ST_X(ST_Centroid(geom)) AS center_lon,
                ST_Y(ST_Centroid(geom)) AS center_lat
            FROM atlas.mailles
            WHERE id = $1
            "#,
        )
        .bind(maille_id)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten()
        .map(|(min_x, min_y, max_x, max_y, center_lon, center_lat)| BoundingBox {
            min_x,
            min_y,
            max_x,
            max_y,
            center_lon,
            center_lat,
        })
    } else {
        None
    };

    Ok(Json(MobileMissionDetail {
        mission,
        supervisor_name: supervisor.as_ref().map(|(name, _)| name.clone()),
        supervisor_email: supervisor.map(|(_, email)| email),
        team_members,
        recent_sondages,
        bbox,
    }))
}

/// GET /colab/mobile/missions/:id/map-context - Contexte carte
pub async fn get_map_context(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(mission_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Récupérer la mission et sa maille
    let maille_info: Option<(Option<serde_json::Value>, Option<f64>, Option<f64>, f64, f64, f64, f64)> = sqlx::query_as(
        r#"
        SELECT 
            ST_AsGeoJSON(ma.geom)::jsonb AS maille_geojson,
            ST_X(ST_Centroid(ma.geom)) AS center_lon,
            ST_Y(ST_Centroid(ma.geom)) AS center_lat,
            ST_XMin(ma.geom) AS min_x,
            ST_YMin(ma.geom) AS min_y,
            ST_XMax(ma.geom) AS max_x,
            ST_YMax(ma.geom) AS max_y
        FROM atlas.colab_missions m
        LEFT JOIN atlas.mailles ma ON m.maille_id = ma.id
        WHERE m.id = $1
        "#,
    )
    .bind(mission_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    // Récupérer les sondages existants
    let existing_sondages = sqlx::query_as::<_, SondageMarker>(
        r#"
        SELECT 
            s.id,
            s.code_sondage AS code,
            ST_X(s.geom) AS longitude,
            ST_Y(s.geom) AS latitude,
            s.validation_status::text AS status
        FROM atlas.sondages s
        JOIN atlas.colab_mission_sondages cms ON s.id = cms.sondage_id
        WHERE cms.mission_id = $1 AND s.geom IS NOT NULL
        "#,
    )
    .bind(mission_id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let (maille_geojson, center_lon, center_lat, bbox) = match maille_info {
        Some((geojson, lon, lat, min_x, min_y, max_x, max_y)) => (
            geojson,
            lon,
            lat,
            Some(BoundingBox {
                min_x,
                min_y,
                max_x,
                max_y,
                center_lon: lon.unwrap_or(0.0),
                center_lat: lat.unwrap_or(0.0),
            }),
        ),
        None => (None, None, None, None),
    };

    Ok(Json(MapContext {
        mission_id,
        maille_geojson,
        center_lon,
        center_lat,
        bbox,
        existing_sondages,
    }))
}

/// POST /colab/mobile/missions/:id/sondages - Créer un sondage terrain
pub async fn create_field_sondage(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(mission_id): Path<Uuid>,
    Json(req): Json<CreateFieldSondageRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Générer un code unique pour le sondage
    let code_sondage = format!(
        "S-{}-{:04}",
        chrono::Utc::now().format("%Y%m%d"),
        rand::random::<u16>() % 10000
    );

    // Créer le sondage
    let sondage_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.sondages (
            code_sondage,
            geom,
            profondeur_atteinte,
            observations,
            validation_status,
            location_mode,
            location_accuracy_m,
            mission_id,
            created_by
        ) VALUES (
            $1,
            ST_SetSRID(ST_MakePoint($2, $3), 4326),
            $4,
            $5,
            'draft_field',
            'gps_field',
            $6,
            $7,
            $8
        )
        RETURNING id
        "#,
    )
    .bind(&code_sondage)
    .bind(req.longitude)
    .bind(req.latitude)
    .bind(req.depth_m)
    .bind(&req.notes)
    .bind(req.location_accuracy_m)
    .bind(mission_id)
    .bind(auth.id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Erreur création sondage: {}", e) })),
        )
    })?;

    // Lier le sondage à la mission
    let ordre: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(ordre), 0) + 1 FROM atlas.colab_mission_sondages WHERE mission_id = $1",
    )
    .bind(mission_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(1);

    sqlx::query(
        r#"
        INSERT INTO atlas.colab_mission_sondages (mission_id, sondage_id, ordre)
        VALUES ($1, $2, $3)
        "#,
    )
    .bind(mission_id)
    .bind(sondage_id)
    .bind(ordre)
    .execute(&state.pool)
    .await
    .ok();

    // Créer un log de terrain
    sqlx::query(
        r#"
        INSERT INTO atlas.colab_field_logs (mission_id, user_id, log_type, content, geom)
        VALUES ($1, $2, 'avancee', $3, ST_SetSRID(ST_MakePoint($4, $5), 4326))
        "#,
    )
    .bind(mission_id)
    .bind(auth.id)
    .bind(format!("Sondage {} créé", code_sondage))
    .bind(req.longitude)
    .bind(req.latitude)
    .execute(&state.pool)
    .await
    .ok();

    Ok((
        StatusCode::CREATED,
        Json(CreateSondageResponse {
            id: sondage_id,
            code_sondage,
            message: "Sondage créé avec succès".to_string(),
        }),
    ))
}

/// POST /colab/mobile/sync - Synchronisation batch
pub async fn sync_actions(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<SyncRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let mut results = Vec::new();
    let mut synced_count = 0;
    let mut failed_count = 0;

    for action in req.actions {
        let result = process_sync_action(&state, auth.id, &action).await;
        
        match result {
            Ok(server_id) => {
                synced_count += 1;
                results.push(SyncActionResult {
                    client_id: action.client_id,
                    success: true,
                    server_id: Some(server_id),
                    error: None,
                });
            }
            Err(e) => {
                failed_count += 1;
                results.push(SyncActionResult {
                    client_id: action.client_id,
                    success: false,
                    server_id: None,
                    error: Some(e),
                });
            }
        }
    }

    Ok(Json(SyncResponse {
        results,
        synced_count,
        failed_count,
    }))
}

async fn process_sync_action(
    state: &AppState,
    user_id: Uuid,
    action: &SyncAction,
) -> Result<Uuid, String> {
    match action.action_type.as_str() {
        "create_sondage" => {
            let payload: CreateFieldSondageRequest = serde_json::from_value(action.payload.clone())
                .map_err(|e| format!("Payload invalide: {}", e))?;
            
            let mission_id: Uuid = action.payload.get("mission_id")
                .and_then(|v| v.as_str())
                .and_then(|s| Uuid::parse_str(s).ok())
                .ok_or("mission_id manquant")?;

            let code_sondage = format!(
                "S-{}-{:04}",
                chrono::Utc::now().format("%Y%m%d"),
                rand::random::<u16>() % 10000
            );

            let sondage_id: Uuid = sqlx::query_scalar(
                r#"
                INSERT INTO atlas.sondages (
                    code_sondage, geom, profondeur_atteinte, observations,
                    validation_status, location_mode, location_accuracy_m, mission_id, created_by
                ) VALUES (
                    $1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5,
                    'draft_field', 'gps_field', $6, $7, $8
                )
                RETURNING id
                "#,
            )
            .bind(&code_sondage)
            .bind(payload.longitude)
            .bind(payload.latitude)
            .bind(payload.depth_m)
            .bind(&payload.notes)
            .bind(payload.location_accuracy_m)
            .bind(mission_id)
            .bind(user_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| e.to_string())?;

            // Lier à la mission
            sqlx::query(
                "INSERT INTO atlas.colab_mission_sondages (mission_id, sondage_id, ordre) 
                 VALUES ($1, $2, (SELECT COALESCE(MAX(ordre), 0) + 1 FROM atlas.colab_mission_sondages WHERE mission_id = $1))",
            )
            .bind(mission_id)
            .bind(sondage_id)
            .execute(&state.pool)
            .await
            .ok();

            Ok(sondage_id)
        }
        "create_field_log" => {
            let mission_id: Uuid = action.payload.get("mission_id")
                .and_then(|v| v.as_str())
                .and_then(|s| Uuid::parse_str(s).ok())
                .ok_or("mission_id manquant")?;
            
            let content = action.payload.get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            
            let log_type = action.payload.get("log_type")
                .and_then(|v| v.as_str())
                .unwrap_or("note");

            let log_id: Uuid = sqlx::query_scalar(
                r#"
                INSERT INTO atlas.colab_field_logs (mission_id, user_id, log_type, content)
                VALUES ($1, $2, $3::atlas.field_log_type, $4)
                RETURNING id
                "#,
            )
            .bind(mission_id)
            .bind(user_id)
            .bind(log_type)
            .bind(content)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| e.to_string())?;

            Ok(log_id)
        }
        _ => Err(format!("Type d'action non supporté: {}", action.action_type)),
    }
}

/// POST /colab/mobile/tracks - Créer une trace GPS
pub async fn create_track(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateTrackRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let track_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_tracks (mission_id, user_id, name, started_at, is_active)
        VALUES ($1, $2, $3, NOW(), true)
        RETURNING id
        "#,
    )
    .bind(req.mission_id)
    .bind(auth.id)
    .bind(req.name.unwrap_or_else(|| format!("Trace {}", chrono::Utc::now().format("%Y-%m-%d %H:%M"))))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": track_id,
            "message": "Trace créée"
        })),
    ))
}

/// POST /colab/mobile/tracks/:id/points - Ajouter des points à une trace
pub async fn add_track_points(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(track_id): Path<Uuid>,
    Json(req): Json<AddTrackPointsRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Récupérer le dernier numéro de séquence
    let last_seq: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(sequence_num), 0) FROM atlas.colab_track_points WHERE track_id = $1",
    )
    .bind(track_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let mut seq = last_seq;
    for point in &req.points {
        seq += 1;
        sqlx::query(
            r#"
            INSERT INTO atlas.colab_track_points (track_id, geom, altitude_m, accuracy_m, recorded_at, sequence_num)
            VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7)
            "#,
        )
        .bind(track_id)
        .bind(point.longitude)
        .bind(point.latitude)
        .bind(point.altitude_m)
        .bind(point.accuracy_m)
        .bind(point.recorded_at)
        .bind(seq)
        .execute(&state.pool)
        .await
        .ok();
    }

    Ok(Json(serde_json::json!({
        "added": req.points.len(),
        "total_points": seq
    })))
}

/// POST /colab/mobile/tracks/:id/stop - Arrêter une trace
pub async fn stop_track(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(track_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    sqlx::query(
        r#"
        UPDATE atlas.colab_tracks 
        SET is_active = false, ended_at = NOW()
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(track_id)
    .bind(auth.id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(serde_json::json!({
        "message": "Trace arrêtée"
    })))
}

// ============================================================================
// Router
// ============================================================================

pub fn mobile_routes() -> Router<AppState> {
    Router::new()
        // Missions
        .route("/mobile/missions", get(get_my_missions))
        .route("/mobile/missions/:id", get(get_mission_detail))
        .route("/mobile/missions/:id/map-context", get(get_map_context))
        .route("/mobile/missions/:id/sondages", post(create_field_sondage))
        // Synchronisation
        .route("/mobile/sync", post(sync_actions))
        // Traces GPS
        .route("/mobile/tracks", post(create_track))
        .route("/mobile/tracks/:id/points", post(add_track_points))
        .route("/mobile/tracks/:id/stop", post(stop_track))
}
