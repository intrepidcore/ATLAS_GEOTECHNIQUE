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
    pub tolerance_m: i32,
    pub planned_points: Vec<PlannedPoint>,
    pub existing_sondages: Vec<SondageMarker>,
}

/// Point de prélèvement prévisionnel (fixé à la création de la mission)
#[derive(Debug, Serialize, FromRow)]
pub struct PlannedPoint {
    pub id: Uuid,
    pub numero: i32,
    pub label: Option<String>,
    pub lat: f64,
    pub lon: f64,
    pub confirmed_sondage_id: Option<Uuid>,
}

/// Requête de confirmation d'un point de prélèvement prévu
#[derive(Debug, Deserialize)]
pub struct ConfirmSondagePointRequest {
    pub longitude: f64,
    pub latitude: f64,
    pub location_accuracy_m: Option<f32>,
    pub depth_m: Option<f64>,
    pub profile_description: Option<String>,
    pub layers_count: Option<i32>,
    pub notes: Option<String>,
}

/// Réponse de confirmation (succès ou refus hors tolérance)
#[derive(Debug, Serialize)]
pub struct ConfirmSondageResponse {
    pub id: Option<Uuid>,
    pub code_sondage: Option<String>,
    pub distance_m: f64,
    pub tolerance_m: i32,
    pub within_tolerance: bool,
    pub message: String,
}

/// Profil mobile résolu côté serveur (ADR-MOBILE-005 : jamais de rôle en dur côté app)
#[derive(Debug, Serialize)]
pub struct MobileProfile {
    pub user_id: Uuid,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
    pub is_student: bool,
    pub is_supervisor: bool,
}

/// Enregistrement d'un token de push Expo
#[derive(Debug, Deserialize)]
pub struct RegisterPushTokenRequest {
    pub expo_token: String,
    pub platform: String,
}

fn default_sondage_tolerance_m() -> i32 {
    std::env::var("ATLAS_DEFAULT_SONDAGE_TOLERANCE_M")
        .ok()
        .and_then(|v| v.parse::<i32>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(15)
}

/// Vrai si la distance mesurée est dans la tolérance de la mission (ADR-MOBILE-004).
fn is_within_tolerance(distance_m: f64, tolerance_m: i32) -> bool {
    distance_m <= tolerance_m as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tolerance_accepts_distance_under_limit() {
        assert!(is_within_tolerance(4.9, 15));
    }

    #[test]
    fn tolerance_accepts_distance_exactly_at_limit() {
        assert!(is_within_tolerance(15.0, 15));
    }

    #[test]
    fn tolerance_rejects_distance_over_limit() {
        assert!(!is_within_tolerance(15.1, 15));
    }

    #[test]
    fn default_tolerance_falls_back_to_15_when_env_absent() {
        std::env::remove_var("ATLAS_DEFAULT_SONDAGE_TOLERANCE_M");
        assert_eq!(default_sondage_tolerance_m(), 15);
    }

    #[test]
    fn default_tolerance_reads_env_override() {
        std::env::set_var("ATLAS_DEFAULT_SONDAGE_TOLERANCE_M", "25");
        assert_eq!(default_sondage_tolerance_m(), 25);
        std::env::remove_var("ATLAS_DEFAULT_SONDAGE_TOLERANCE_M");
    }

    #[test]
    fn default_tolerance_ignores_invalid_or_zero_env() {
        std::env::set_var("ATLAS_DEFAULT_SONDAGE_TOLERANCE_M", "0");
        assert_eq!(default_sondage_tolerance_m(), 15);
        std::env::set_var("ATLAS_DEFAULT_SONDAGE_TOLERANCE_M", "not-a-number");
        assert_eq!(default_sondage_tolerance_m(), 15);
        std::env::remove_var("ATLAS_DEFAULT_SONDAGE_TOLERANCE_M");
    }
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
            COALESCE((SELECT COUNT(*) FROM atlas.colab_mission_sondages cms WHERE cms.mission_id = m.id), 0)::int8 AS completed_sondages,
            (CASE 
                WHEN COALESCE(m.expected_sondages, 0) = 0 THEN 0.0
                ELSE ROUND(
                    (COALESCE((SELECT COUNT(*) FROM atlas.colab_mission_sondages cms WHERE cms.mission_id = m.id), 0)::numeric 
                    / m.expected_sondages::numeric) * 100, 1
                )
            END)::float8 AS percent_done
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
            COALESCE((SELECT COUNT(*) FROM atlas.colab_mission_sondages cms WHERE cms.mission_id = m.id), 0)::int8 AS completed_sondages,
            (CASE 
                WHEN COALESCE(m.expected_sondages, 0) = 0 THEN 0.0
                ELSE ROUND(
                    (COALESCE((SELECT COUNT(*) FROM atlas.colab_mission_sondages cms WHERE cms.mission_id = m.id), 0)::numeric 
                    / m.expected_sondages::numeric) * 100, 1
                )
            END)::float8 AS percent_done
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
            s.code AS code_sondage,
            ST_X(s.geom) AS longitude,
            ST_Y(s.geom) AS latitude,
            NULLIF(s.depth_m_max, '')::float8 AS profondeur_atteinte,
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
                ST_XMin(ST_Transform(geom, 4326)) AS min_x,
                ST_YMin(ST_Transform(geom, 4326)) AS min_y,
                ST_XMax(ST_Transform(geom, 4326)) AS max_x,
                ST_YMax(ST_Transform(geom, 4326)) AS max_y,
                ST_X(ST_Centroid(ST_Transform(geom, 4326))) AS center_lon,
                ST_Y(ST_Centroid(ST_Transform(geom, 4326))) AS center_lat
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
    // ma.geom est stocké en SRID 25231 (projection locale Togo) ; l'app mobile
    // attend du WGS84 (lon/lat) — transform obligatoire, cf. convention déjà
    // appliquée ailleurs dans exports.rs/export/service.rs.
    let maille_info: Option<(Option<serde_json::Value>, Option<f64>, Option<f64>, f64, f64, f64, f64)> = sqlx::query_as(
        r#"
        SELECT
            ST_AsGeoJSON(ST_Transform(ma.geom, 4326))::jsonb AS maille_geojson,
            ST_X(ST_Centroid(ST_Transform(ma.geom, 4326))) AS center_lon,
            ST_Y(ST_Centroid(ST_Transform(ma.geom, 4326))) AS center_lat,
            ST_XMin(ST_Transform(ma.geom, 4326)) AS min_x,
            ST_YMin(ST_Transform(ma.geom, 4326)) AS min_y,
            ST_XMax(ST_Transform(ma.geom, 4326)) AS max_x,
            ST_YMax(ST_Transform(ma.geom, 4326)) AS max_y
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
            s.code,
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

    // Points de prélèvement prévisionnels (fixés à la création de la mission)
    let planned_points = sqlx::query_as::<_, PlannedPoint>(
        r#"
        SELECT id, numero, label, lat, lon, confirmed_sondage_id
        FROM atlas.colab_mission_sondage_points
        WHERE mission_id = $1
        ORDER BY numero
        "#,
    )
    .bind(mission_id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Tolérance : celle de la mission si réglée, sinon le défaut système (jamais figée en dur)
    let tolerance_m: i32 = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT sondage_tolerance_m FROM atlas.colab_missions WHERE id = $1",
    )
    .bind(mission_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten()
    .flatten()
    .unwrap_or_else(default_sondage_tolerance_m);

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
        tolerance_m,
        planned_points,
        existing_sondages,
    }))
}

/// POST /colab/mobile/missions/:id/sondage-points/:point_id/confirm
/// Confirme un point de prélèvement prévu. La tolérance est revalidée ici,
/// côté serveur, en distance réelle (PostGIS geography) — le client ne fait
/// jamais foi seul (ADR-MOBILE-004).
pub async fn confirm_sondage_point(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((mission_id, point_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<ConfirmSondagePointRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let point: Option<(f64, f64)> = sqlx::query_as(
        "SELECT lat, lon FROM atlas.colab_mission_sondage_points WHERE id = $1 AND mission_id = $2",
    )
    .bind(point_id)
    .bind(mission_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))))?;

    let (planned_lat, planned_lon) = point.ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Point prévisionnel introuvable" })))
    })?;

    let tolerance_m: i32 = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT sondage_tolerance_m FROM atlas.colab_missions WHERE id = $1",
    )
    .bind(mission_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten()
    .flatten()
    .unwrap_or_else(default_sondage_tolerance_m);

    // Distance orthodromique réelle en mètres (geography), pas une approximation Pythagore.
    let distance_m: f64 = sqlx::query_scalar(
        r#"
        SELECT ST_Distance(
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
        )
        "#,
    )
    .bind(planned_lon)
    .bind(planned_lat)
    .bind(req.longitude)
    .bind(req.latitude)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))))?;

    if !is_within_tolerance(distance_m, tolerance_m) {
        return Ok((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ConfirmSondageResponse {
                id: None,
                code_sondage: None,
                distance_m,
                tolerance_m,
                within_tolerance: false,
                message: format!(
                    "Hors tolérance : {:.0} m du point prévu (tolérance {} m)",
                    distance_m, tolerance_m
                ),
            }),
        ));
    }

    let code_sondage = format!(
        "S-{}-{:04}",
        chrono::Utc::now().format("%Y%m%d"),
        rand::random::<u16>() % 10000
    );

    let sondage_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.sondages (
            code, geom, depth_m_max, notes,
            validation_status, location_mode, location_accuracy_m, mission_id, meta
        ) VALUES (
            $1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5,
            'draft_field', 'gps_field', $6, $7, $8
        )
        RETURNING id
        "#,
    )
    .bind(&code_sondage)
    .bind(req.longitude)
    .bind(req.latitude)
    .bind(req.depth_m.map(|d| d.to_string()))
    .bind(&req.notes)
    .bind(req.location_accuracy_m)
    .bind(mission_id)
    .bind(serde_json::json!({ "created_by": auth.id }))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": format!("Erreur création sondage: {}", e) }))))?;

    sqlx::query(
        "INSERT INTO atlas.colab_mission_sondages (mission_id, sondage_id) VALUES ($1, $2)
         ON CONFLICT (mission_id, sondage_id) DO NOTHING",
    )
    .bind(mission_id)
    .bind(sondage_id)
    .execute(&state.pool)
    .await
    .ok();

    sqlx::query(
        r#"
        UPDATE atlas.colab_mission_sondage_points
        SET confirmed_sondage_id = $1, confirmed_at = NOW(), confirmed_by = $2
        WHERE id = $3
        "#,
    )
    .bind(sondage_id)
    .bind(auth.id)
    .bind(point_id)
    .execute(&state.pool)
    .await
    .ok();

    let _ = req.profile_description;
    let _ = req.layers_count;

    Ok((
        StatusCode::CREATED,
        Json(ConfirmSondageResponse {
            id: Some(sondage_id),
            code_sondage: Some(code_sondage),
            distance_m,
            tolerance_m,
            within_tolerance: true,
            message: "Point confirmé, sondage créé".to_string(),
        }),
    ))
}

/// GET /colab/mobile/profile — profil + rôle + permissions résolus serveur
pub async fn get_profile(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let names: Option<(Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT first_name, last_name FROM atlas.users WHERE id = $1",
    )
    .bind(auth.id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    let is_student: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM atlas.colab_students WHERE user_id = $1 AND deleted_at IS NULL)",
    )
    .bind(auth.id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(false);

    let is_supervisor: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM atlas.colab_supervisors WHERE user_id = $1)",
    )
    .bind(auth.id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(false);

    Ok(Json(MobileProfile {
        user_id: auth.id,
        email: auth.email.clone(),
        first_name: names.as_ref().and_then(|n| n.0.clone()),
        last_name: names.as_ref().and_then(|n| n.1.clone()),
        roles: auth.roles.clone(),
        permissions: auth.permissions.clone(),
        is_student,
        is_supervisor,
    }))
}

/// POST /colab/mobile/push-tokens — enregistre/rafraîchit un token Expo Push
pub async fn register_push_token(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<RegisterPushTokenRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    if req.platform != "ios" && req.platform != "android" {
        return Err((StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "platform doit être ios ou android" }))));
    }

    sqlx::query(
        r#"
        INSERT INTO atlas.colab_mobile_push_tokens (user_id, expo_token, platform)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, expo_token) DO UPDATE SET last_seen_at = NOW()
        "#,
    )
    .bind(auth.id)
    .bind(&req.expo_token)
    .bind(&req.platform)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))))?;

    Ok(Json(serde_json::json!({ "message": "Token enregistré" })))
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
            code,
            geom,
            depth_m_max,
            notes,
            validation_status,
            location_mode,
            location_accuracy_m,
            mission_id,
            meta
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
    .bind(req.depth_m.map(|d| d.to_string()))
    .bind(&req.notes)
    .bind(req.location_accuracy_m)
    .bind(mission_id)
    .bind(serde_json::json!({ "created_by": auth.id }))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Erreur création sondage: {}", e) })),
        )
    })?;

    // Lier le sondage à la mission
    sqlx::query(
        r#"
        INSERT INTO atlas.colab_mission_sondages (mission_id, sondage_id)
        VALUES ($1, $2)
        ON CONFLICT (mission_id, sondage_id) DO NOTHING
        "#,
    )
    .bind(mission_id)
    .bind(sondage_id)
    .execute(&state.pool)
    .await
    .ok();

    // Créer un log de terrain
    sqlx::query(
        r#"
        INSERT INTO atlas.colab_field_logs (mission_id, author_id, log_type, content, longitude, latitude)
        VALUES ($1, $2, 'avancee', $3, $4, $5)
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
                    code, geom, depth_m_max, notes,
                    validation_status, location_mode, location_accuracy_m, mission_id, meta
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
            .bind(payload.depth_m.map(|d| d.to_string()))
            .bind(&payload.notes)
            .bind(payload.location_accuracy_m)
            .bind(mission_id)
            .bind(serde_json::json!({ "created_by": user_id }))
            .fetch_one(&state.pool)
            .await
            .map_err(|e| e.to_string())?;

            // Lier à la mission
            sqlx::query(
                "INSERT INTO atlas.colab_mission_sondages (mission_id, sondage_id) VALUES ($1, $2)
                 ON CONFLICT (mission_id, sondage_id) DO NOTHING",
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
                INSERT INTO atlas.colab_field_logs (mission_id, author_id, log_type, content)
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
        .route(
            "/mobile/missions/:id/sondage-points/:point_id/confirm",
            post(confirm_sondage_point),
        )
        // Synchronisation
        .route("/mobile/sync", post(sync_actions))
        // Traces GPS
        .route("/mobile/tracks", post(create_track))
        .route("/mobile/tracks/:id/points", post(add_track_points))
        .route("/mobile/tracks/:id/stop", post(stop_track))
        // Profil et push
        .route("/mobile/profile", get(get_profile))
        .route("/mobile/push-tokens", post(register_push_token))
}
