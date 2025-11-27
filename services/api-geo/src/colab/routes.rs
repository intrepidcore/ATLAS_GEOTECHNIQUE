//! Routes API pour Atlas Colab

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post, put, delete},
    Json, Router,
};
use chrono::Utc;
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;
use validator::Validate;

use crate::state::AppState;
use crate::auth::middleware::AuthUser;

use super::types::*;

/// Crée le routeur pour les routes Colab
pub fn colab_routes() -> Router<AppState> {
    Router::new()
        // Missions
        .route("/colab/missions", get(list_missions).post(create_mission))
        .route("/colab/missions/:id", get(get_mission).put(update_mission).delete(delete_mission))
        .route("/colab/missions/stats", get(get_stats))
        // Superviseurs (lecture)
        .route("/colab/supervisors", get(list_supervisors))
        // Étudiants (lecture)
        .route("/colab/students", get(list_students))
}

// ============================================================================
// Handlers Missions
// ============================================================================

/// GET /colab/missions - Liste des missions avec filtres
async fn list_missions(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(filters): Query<MissionFilters>,
) -> Result<Json<MissionListResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Vérifier permission
    if !auth.has_permission("colab.missions.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée: colab.missions.read requise" })),
        ));
    }

    let page = filters.page.unwrap_or(1).max(1);
    let per_page = filters.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    // Construire la requête avec filtres
    let mut conditions = vec!["1=1".to_string()];
    
    if let Some(ref theme) = filters.theme {
        conditions.push(format!("theme::TEXT = '{}'", theme.replace('\'', "''")));
    }
    if let Some(ref status) = filters.status {
        conditions.push(format!("status::TEXT = '{}'", status.replace('\'', "''")));
    }
    if let Some(ref commune) = filters.commune {
        conditions.push(format!("commune ILIKE '%{}%'", commune.replace('\'', "''")));
    }
    if let Some(ref region) = filters.region {
        conditions.push(format!("region ILIKE '%{}%'", region.replace('\'', "''")));
    }
    if let Some(ref search) = filters.search {
        let search_escaped = search.replace('\'', "''");
        conditions.push(format!(
            "(code ILIKE '%{}%' OR title ILIKE '%{}%')",
            search_escaped, search_escaped
        ));
    }
    if let Some(supervisor_id) = filters.supervisor_id {
        conditions.push(format!("supervisor_id = '{}'", supervisor_id));
    }

    let where_clause = conditions.join(" AND ");

    // Compter le total
    let count_query = format!(
        "SELECT COUNT(*) as count FROM atlas.colab_missions WHERE {}",
        where_clause
    );
    
    let total: i64 = sqlx::query_scalar(&count_query)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Erreur comptage missions: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur base de données: {}", e) })),
            )
        })?;

    // Récupérer les missions
    let query = format!(
        r#"
        SELECT 
            m.id,
            m.code,
            m.title,
            m.theme::TEXT as theme,
            m.status::TEXT as status,
            m.maille_id,
            m.zone_label,
            m.commune,
            m.region,
            m.start_date,
            m.end_date,
            m.expected_sondages,
            m.created_at,
            m.updated_at,
            s.id as supervisor_id,
            COALESCE(u.first_name || ' ' || u.last_name, u.username) as supervisor_name,
            (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.mission_id = m.id AND a.unassigned_at IS NULL) as assigned_students_count,
            (SELECT COUNT(*) FROM atlas.colab_mission_sondages ms WHERE ms.mission_id = m.id) as linked_sondages_count,
            (SELECT COUNT(*) FROM atlas.colab_field_logs fl WHERE fl.mission_id = m.id) as field_logs_count,
            (SELECT COUNT(*) FROM atlas.colab_documents d WHERE d.mission_id = m.id AND d.is_current = TRUE) as documents_count
        FROM atlas.colab_missions m
        LEFT JOIN atlas.colab_supervisors s ON m.supervisor_id = s.id
        LEFT JOIN atlas.users u ON s.user_id = u.id
        WHERE {}
        ORDER BY m.created_at DESC
        LIMIT {} OFFSET {}
        "#,
        where_clause, per_page, offset
    );

    let rows = sqlx::query(&query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Erreur récupération missions: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur base de données: {}", e) })),
            )
        })?;

    let missions: Vec<MissionListItem> = rows
        .iter()
        .map(|row| MissionListItem {
            id: row.get("id"),
            code: row.get("code"),
            title: row.get("title"),
            theme: row.get("theme"),
            status: row.get("status"),
            maille_id: row.get("maille_id"),
            zone_label: row.get("zone_label"),
            commune: row.get("commune"),
            region: row.get("region"),
            start_date: row.get("start_date"),
            end_date: row.get("end_date"),
            expected_sondages: row.get("expected_sondages"),
            supervisor_id: row.get("supervisor_id"),
            supervisor_name: row.get("supervisor_name"),
            assigned_students_count: row.get("assigned_students_count"),
            linked_sondages_count: row.get("linked_sondages_count"),
            field_logs_count: row.get("field_logs_count"),
            documents_count: row.get("documents_count"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect();

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;

    Ok(Json(MissionListResponse {
        missions,
        total,
        page,
        per_page,
        total_pages,
    }))
}

/// POST /colab/missions - Créer une mission
async fn create_mission(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<CreateMissionRequest>,
) -> Result<Json<MissionListItem>, (StatusCode, Json<serde_json::Value>)> {
    // Vérifier permission
    if !auth.has_permission("colab.missions.create") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée: colab.missions.create requise" })),
        ));
    }

    // Valider le payload
    if let Err(e) = payload.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("Validation échouée: {}", e) })),
        ));
    }

    // Valider le thème
    if MissionTheme::from_str(&payload.theme).is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Thème invalide. Valeurs acceptées: stabilisation, synthese, reconnaissance, etude_detaillee, controle" })),
        ));
    }

    let id = Uuid::new_v4();
    let now = Utc::now();

    // Insérer la mission
    let result = sqlx::query(
        r#"
        INSERT INTO atlas.colab_missions (
            id, code, title, theme, maille_id, zone_label, commune, region,
            supervisor_id, expected_sondages, start_date, end_date,
            description, objectifs, notes_internal, status, created_by, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4::atlas.mission_theme, $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15, 'draft'::atlas.mission_status, $16, $17, $17
        )
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(&payload.code)
    .bind(&payload.title)
    .bind(&payload.theme)
    .bind(payload.maille_id)
    .bind(&payload.zone_label)
    .bind(&payload.commune)
    .bind(&payload.region)
    .bind(payload.supervisor_id)
    .bind(payload.expected_sondages.unwrap_or(0))
    .bind(payload.start_date)
    .bind(payload.end_date)
    .bind(&payload.description)
    .bind(&payload.objectifs)
    .bind(&payload.notes_internal)
    .bind(auth.id)
    .bind(now)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Erreur création mission: {}", e);
        let error_msg = if e.to_string().contains("duplicate key") {
            "Une mission avec ce code existe déjà"
        } else {
            "Erreur lors de la création de la mission"
        };
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": error_msg, "details": e.to_string() })),
        )
    })?;

    // Retourner la mission créée
    let mission = MissionListItem {
        id,
        code: payload.code,
        title: payload.title,
        theme: payload.theme,
        status: "draft".to_string(),
        maille_id: payload.maille_id,
        zone_label: payload.zone_label,
        commune: payload.commune,
        region: payload.region,
        start_date: payload.start_date,
        end_date: payload.end_date,
        expected_sondages: payload.expected_sondages.unwrap_or(0),
        supervisor_id: payload.supervisor_id,
        supervisor_name: None,
        assigned_students_count: 0,
        linked_sondages_count: 0,
        field_logs_count: 0,
        documents_count: 0,
        created_at: now,
        updated_at: now,
    };

    tracing::info!("Mission créée: {} par {}", mission.code, auth.email);

    Ok(Json(mission))
}

/// GET /colab/missions/:id - Détail d'une mission
async fn get_mission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<MissionDetail>, (StatusCode, Json<serde_json::Value>)> {
    // Vérifier permission
    if !auth.has_permission("colab.missions.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée: colab.missions.read requise" })),
        ));
    }

    // Récupérer la mission
    let row = sqlx::query(
        r#"
        SELECT 
            m.*,
            m.theme::TEXT as theme_str,
            m.status::TEXT as status_str,
            s.id as sup_id,
            s.user_id as sup_user_id,
            u_sup.username as sup_username,
            COALESCE(u_sup.first_name || ' ' || u_sup.last_name, u_sup.username) as sup_full_name,
            sup.specialite as sup_specialite,
            sup.institution as sup_institution,
            u_creator.id as creator_id,
            u_creator.username as creator_username,
            u_creator.email as creator_email,
            COALESCE(u_creator.first_name || ' ' || u_creator.last_name, u_creator.username) as creator_full_name
        FROM atlas.colab_missions m
        LEFT JOIN atlas.colab_supervisors s ON m.supervisor_id = s.id
        LEFT JOIN atlas.users u_sup ON s.user_id = u_sup.id
        LEFT JOIN atlas.colab_supervisors sup ON s.id = sup.id
        LEFT JOIN atlas.users u_creator ON m.created_by = u_creator.id
        WHERE m.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur base de données: {}", e) })),
        )
    })?;

    let row = row.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Mission non trouvée" })),
        )
    })?;

    // Récupérer les étudiants assignés
    let students_rows = sqlx::query(
        r#"
        SELECT 
            a.id as assignment_id,
            a.student_id,
            s.user_id,
            u.username,
            COALESCE(u.first_name || ' ' || u.last_name, u.username) as full_name,
            s.matricule,
            s.promotion,
            a.role,
            a.assigned_at
        FROM atlas.colab_mission_assignments a
        JOIN atlas.colab_students s ON a.student_id = s.id
        JOIN atlas.users u ON s.user_id = u.id
        WHERE a.mission_id = $1 AND a.unassigned_at IS NULL
        ORDER BY a.assigned_at
        "#,
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let assigned_students: Vec<AssignedStudent> = students_rows
        .iter()
        .map(|r| AssignedStudent {
            assignment_id: r.get("assignment_id"),
            student_id: r.get("student_id"),
            user_id: r.get("user_id"),
            username: r.get("username"),
            full_name: r.get("full_name"),
            matricule: r.get("matricule"),
            promotion: r.get("promotion"),
            role: r.get("role"),
            assigned_at: r.get("assigned_at"),
        })
        .collect();

    // Récupérer les sondages liés
    let sondages_rows = sqlx::query(
        r#"
        SELECT 
            ms.id as link_id,
            ms.sondage_id,
            s.code as sondage_code,
            ms.role,
            ms.linked_at
        FROM atlas.colab_mission_sondages ms
        JOIN atlas.sondages s ON ms.sondage_id = s.id
        WHERE ms.mission_id = $1
        ORDER BY ms.linked_at
        "#,
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let linked_sondages: Vec<LinkedSondage> = sondages_rows
        .iter()
        .map(|r| LinkedSondage {
            link_id: r.get("link_id"),
            sondage_id: r.get("sondage_id"),
            sondage_code: r.get("sondage_code"),
            role: r.get("role"),
            linked_at: r.get("linked_at"),
        })
        .collect();

    // Construire le superviseur
    let supervisor = if let Some(sup_id) = row.get::<Option<Uuid>, _>("sup_id") {
        Some(SupervisorSummary {
            id: sup_id,
            user_id: row.get("sup_user_id"),
            username: row.get("sup_username"),
            full_name: row.get("sup_full_name"),
            specialite: row.get("sup_specialite"),
            institution: row.get("sup_institution"),
        })
    } else {
        None
    };

    // Construire le créateur
    let created_by = if let Some(creator_id) = row.get::<Option<Uuid>, _>("creator_id") {
        Some(UserSummary {
            id: creator_id,
            username: row.get("creator_username"),
            email: row.get("creator_email"),
            full_name: row.get("creator_full_name"),
        })
    } else {
        None
    };

    let mission = MissionDetail {
        id: row.get("id"),
        code: row.get("code"),
        title: row.get("title"),
        theme: row.get("theme_str"),
        status: row.get("status_str"),
        maille_id: row.get("maille_id"),
        zone_label: row.get("zone_label"),
        commune: row.get("commune"),
        region: row.get("region"),
        start_date: row.get("start_date"),
        end_date: row.get("end_date"),
        expected_sondages: row.get("expected_sondages"),
        description: row.get("description"),
        objectifs: row.get("objectifs"),
        notes_internal: row.get("notes_internal"),
        supervisor,
        created_by,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        assigned_students,
        linked_sondages,
    };

    Ok(Json(mission))
}

/// PUT /colab/missions/:id - Mettre à jour une mission
async fn update_mission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateMissionRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // Vérifier permission
    if !auth.has_permission("colab.missions.update") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée: colab.missions.update requise" })),
        ));
    }

    // Vérifier que la mission existe
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM atlas.colab_missions WHERE id = $1)")
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur base de données: {}", e) })),
            )
        })?;

    if !exists {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Mission non trouvée" })),
        ));
    }

    // Construire la requête de mise à jour dynamique
    let mut updates = vec!["updated_at = NOW()".to_string()];
    let mut param_idx = 2;

    if let Some(ref title) = payload.title {
        updates.push(format!("title = ${}", param_idx));
        param_idx += 1;
    }
    if let Some(ref theme) = payload.theme {
        if MissionTheme::from_str(theme).is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Thème invalide" })),
            ));
        }
        updates.push(format!("theme = ${}::atlas.mission_theme", param_idx));
        param_idx += 1;
    }
    if let Some(ref status) = payload.status {
        if MissionStatus::from_str(status).is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Statut invalide" })),
            ));
        }
        updates.push(format!("status = ${}::atlas.mission_status", param_idx));
        param_idx += 1;
    }

    // Pour simplifier, on fait une mise à jour complète avec COALESCE
    let result = sqlx::query(
        r#"
        UPDATE atlas.colab_missions SET
            title = COALESCE($2, title),
            theme = COALESCE($3::atlas.mission_theme, theme),
            status = COALESCE($4::atlas.mission_status, status),
            zone_label = COALESCE($5, zone_label),
            commune = COALESCE($6, commune),
            region = COALESCE($7, region),
            supervisor_id = COALESCE($8, supervisor_id),
            expected_sondages = COALESCE($9, expected_sondages),
            start_date = COALESCE($10, start_date),
            end_date = COALESCE($11, end_date),
            description = COALESCE($12, description),
            objectifs = COALESCE($13, objectifs),
            notes_internal = COALESCE($14, notes_internal),
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(&payload.title)
    .bind(&payload.theme)
    .bind(&payload.status)
    .bind(&payload.zone_label)
    .bind(&payload.commune)
    .bind(&payload.region)
    .bind(payload.supervisor_id)
    .bind(payload.expected_sondages)
    .bind(payload.start_date)
    .bind(payload.end_date)
    .bind(&payload.description)
    .bind(&payload.objectifs)
    .bind(&payload.notes_internal)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur mise à jour: {}", e) })),
        )
    })?;

    tracing::info!("Mission {} mise à jour par {}", id, auth.email);

    Ok(Json(json!({ "success": true, "id": id })))
}

/// DELETE /colab/missions/:id - Supprimer une mission
async fn delete_mission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // Vérifier permission
    if !auth.has_permission("colab.missions.delete") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée: colab.missions.delete requise" })),
        ));
    }

    let result = sqlx::query("DELETE FROM atlas.colab_missions WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur suppression: {}", e) })),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Mission non trouvée" })),
        ));
    }

    tracing::info!("Mission {} supprimée par {}", id, auth.email);

    Ok(Json(json!({ "success": true, "deleted": id })))
}

/// GET /colab/missions/stats - Statistiques Colab
async fn get_stats(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<ColabStats>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée" })),
        ));
    }

    // Compter les missions par statut
    let status_rows = sqlx::query(
        "SELECT status::TEXT as status, COUNT(*) as count FROM atlas.colab_missions GROUP BY status"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let missions_by_status: Vec<StatusCount> = status_rows
        .iter()
        .map(|r| StatusCount {
            status: r.get("status"),
            count: r.get("count"),
        })
        .collect();

    // Compter les missions par thème
    let theme_rows = sqlx::query(
        "SELECT theme::TEXT as theme, COUNT(*) as count FROM atlas.colab_missions GROUP BY theme"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let missions_by_theme: Vec<ThemeCount> = theme_rows
        .iter()
        .map(|r| ThemeCount {
            theme: r.get("theme"),
            count: r.get("count"),
        })
        .collect();

    // Totaux
    let total_missions: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM atlas.colab_missions")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let total_students: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM atlas.colab_students")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let total_supervisors: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM atlas.colab_supervisors")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let total_field_logs: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM atlas.colab_field_logs")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let total_documents: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM atlas.colab_documents")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    Ok(Json(ColabStats {
        total_missions,
        missions_by_status,
        missions_by_theme,
        total_students,
        total_supervisors,
        total_field_logs,
        total_documents,
    }))
}

// ============================================================================
// Handlers Superviseurs
// ============================================================================

/// GET /colab/supervisors - Liste des superviseurs
async fn list_supervisors(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<SupervisorSummary>>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.supervisors.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée" })),
        ));
    }

    let rows = sqlx::query(
        r#"
        SELECT 
            s.id,
            s.user_id,
            u.username,
            COALESCE(u.first_name || ' ' || u.last_name, u.username) as full_name,
            s.specialite,
            s.institution
        FROM atlas.colab_supervisors s
        JOIN atlas.users u ON s.user_id = u.id
        WHERE u.is_active = TRUE
        ORDER BY full_name
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur: {}", e) })),
        )
    })?;

    let supervisors: Vec<SupervisorSummary> = rows
        .iter()
        .map(|r| SupervisorSummary {
            id: r.get("id"),
            user_id: r.get("user_id"),
            username: r.get("username"),
            full_name: r.get("full_name"),
            specialite: r.get("specialite"),
            institution: r.get("institution"),
        })
        .collect();

    Ok(Json(supervisors))
}

// ============================================================================
// Handlers Étudiants
// ============================================================================

/// GET /colab/students - Liste des étudiants
async fn list_students(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.students.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée" })),
        ));
    }

    let rows = sqlx::query(
        r#"
        SELECT 
            s.id,
            s.user_id,
            u.username,
            u.email,
            COALESCE(u.first_name || ' ' || u.last_name, u.username) as full_name,
            s.matricule,
            s.promotion,
            s.filiere,
            s.etablissement,
            s.niveau,
            u.is_active,
            (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.student_id = s.id AND a.unassigned_at IS NULL) as active_missions
        FROM atlas.colab_students s
        JOIN atlas.users u ON s.user_id = u.id
        ORDER BY s.promotion DESC, full_name
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur: {}", e) })),
        )
    })?;

    let students: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<Uuid, _>("id"),
                "user_id": r.get::<Uuid, _>("user_id"),
                "username": r.get::<String, _>("username"),
                "email": r.get::<String, _>("email"),
                "full_name": r.get::<String, _>("full_name"),
                "matricule": r.get::<Option<String>, _>("matricule"),
                "promotion": r.get::<String, _>("promotion"),
                "filiere": r.get::<Option<String>, _>("filiere"),
                "etablissement": r.get::<Option<String>, _>("etablissement"),
                "niveau": r.get::<Option<String>, _>("niveau"),
                "is_active": r.get::<bool, _>("is_active"),
                "active_missions": r.get::<i64, _>("active_missions"),
            })
        })
        .collect();

    Ok(Json(json!({ "students": students, "total": students.len() })))
}
