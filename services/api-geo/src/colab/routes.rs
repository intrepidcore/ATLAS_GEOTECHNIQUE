//! Routes API pour Atlas Colab

use axum::{
    extract::{Multipart, Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post, put, delete},
    Json, Router,
};
use chrono::{NaiveDate, Utc};
use serde_json::json;
use sqlx::{Postgres, Row, Transaction};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;
use validator::Validate;

use crate::state::AppState;
use crate::auth::middleware::AuthUser;
use crate::auth::middleware::require_permission;
use crate::auth::password::PasswordHasher;
use crate::auth::session::SessionManager;
use crate::auth::types::AuthEventType;

use super::types::*;

#[derive(Debug, Clone, serde::Deserialize, Default)]
struct StudentsListQuery {
    include_deleted: Option<bool>,
    include_inactive: Option<bool>,
    audit_mode: Option<bool>,
}

async fn list_missions(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(filters): Query<MissionFilters>,
) -> Result<Json<MissionListResponse>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée" })),
        ));
    }

    let page = filters.page.unwrap_or(1).max(1);
    let per_page = filters.per_page.unwrap_or(12).max(1).min(100);
    let offset = (page - 1) * per_page;

    let mut conditions: Vec<String> = vec!["1=1".to_string(), "cm.deleted_at IS NULL".to_string()];

    if let Some(theme) = filters.theme {
        let t = theme.replace('\'', "''");
        conditions.push(format!("cm.theme::text = '{}'", t));
    }
    if let Some(status) = filters.status {
        let s = status.replace('\'', "''");
        conditions.push(format!("cm.status::text = '{}'", s));
    }
    if let Some(commune) = filters.commune {
        let c = commune.replace('\'', "''");
        conditions.push(format!("cm.commune ILIKE '%{}%'", c));
    }
    if let Some(region) = filters.region {
        let r = region.replace('\'', "''");
        conditions.push(format!("cm.region ILIKE '%{}%'", r));
    }
    if let Some(supervisor_id) = filters.supervisor_id {
        conditions.push(format!("cm.supervisor_id = '{}'", supervisor_id));
    }

    if let Some(maille) = filters.maille.clone() {
        let m = maille.trim();
        if !m.is_empty() {
            let is_legacy = m.to_uppercase().starts_with("TG-");
            let sql = if is_legacy {
                "SELECT id::text FROM atlas.mailles_lookup WHERE maille_code = $1 LIMIT 1"
            } else {
                "SELECT id::text FROM atlas.mailles_lookup WHERE spatial_id = $1 LIMIT 1"
            };

            let maille_id: Option<String> = sqlx::query_scalar(sql)
                .bind(m)
                .fetch_optional(&state.pool)
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": format!("Erreur DB: {}", e) })),
                    )
                })?;

            let Some(maille_id) = maille_id else {
                return Err((
                    StatusCode::NOT_FOUND,
                    Json(json!({ "error": "Maille introuvable", "maille": m })),
                ));
            };

            conditions.push(format!("cm.maille_id = '{}'", maille_id));
        }
    }
    if let Some(search) = filters.search {
        let q = search.replace('\'', "''");
        conditions.push(format!(
            "(cm.code ILIKE '%{0}%' OR cm.title ILIKE '%{0}%' OR COALESCE(cm.zone_label,'') ILIKE '%{0}%' OR COALESCE(cm.commune,'') ILIKE '%{0}%' OR COALESCE(cm.region,'') ILIKE '%{0}%')",
            q
        ));
    }

    let where_clause = conditions.join(" AND ");

    let total: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM atlas.colab_missions cm WHERE {}",
        where_clause
    ))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur DB: {}", e) })),
        )
    })?;

    let total_pages = ((total as f64) / (per_page as f64)).ceil() as i64;

    let sql = format!(
        r#"
        SELECT
          cm.id,
          cm.code,
          cm.title,
          cm.theme::text AS theme,
          cm.status::text AS status,
          cm.maille_id,
          cm.zone_label,
          cm.commune,
          cm.region,
          cm.start_date,
          cm.end_date,
          cm.expected_sondages,
          cm.supervisor_id,
          COALESCE(NULLIF(BTRIM(CONCAT(su.first_name, ' ', su.last_name)), ''), su.username) AS supervisor_name,
          (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.mission_id = cm.id AND a.unassigned_at IS NULL) AS assigned_students_count,
          (SELECT COUNT(*) FROM atlas.colab_mission_sondages ms WHERE ms.mission_id = cm.id) AS linked_sondages_count,
          (SELECT COUNT(*) FROM atlas.colab_field_logs fl WHERE fl.mission_id = cm.id) AS field_logs_count,
          (SELECT COUNT(*) FROM atlas.colab_documents d WHERE d.mission_id = cm.id) AS documents_count,
          cm.created_at,
          cm.updated_at,
          FALSE AS is_real_conflict,
          NULL::text AS conflict_holder_email,
          NULL::text AS conflict_holder_name
        FROM atlas.colab_missions cm
        LEFT JOIN atlas.colab_supervisors s ON s.id = cm.supervisor_id
        LEFT JOIN atlas.users su ON su.id = s.user_id
        WHERE {where_clause}
        ORDER BY cm.updated_at DESC
        LIMIT {per_page} OFFSET {offset}
        "#
    );

    let rows = sqlx::query(&sql)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur DB: {}", e) })),
            )
        })?;

    let missions: Vec<MissionListItem> = rows
        .iter()
        .map(|r| {
            let is_real_conflict: bool = r.try_get::<bool, _>("is_real_conflict").unwrap_or(false);
            let conflict_holder_email: Option<String> = r.try_get::<String, _>("conflict_holder_email").ok();
            let conflict_holder_name: Option<String> = r.try_get::<String, _>("conflict_holder_name").ok();

            let operational_status = if is_real_conflict {
                "blocked_conflict".to_string()
            } else {
                "ok".to_string()
            };
            let operational_reason = if is_real_conflict {
                Some("Conflit d'attribution (mission ≠ détenteur maille)".to_string())
            } else {
                None
            };

            let mission_status: String = r.get("status");
            let maille_id: Option<Uuid> = r.get("maille_id");
            let assigned_students_count: i64 = r.get("assigned_students_count");
            let issues = build_operational_issues(
                &operational_status,
                operational_reason.as_deref(),
                &mission_status,
                maille_id,
                assigned_students_count,
                None,
                None,
                None,
                conflict_holder_name.as_deref(),
                conflict_holder_email.as_deref(),
                None,
                None,
            );

            MissionListItem {
                id: r.get("id"),
                code: r.get("code"),
                title: r.get("title"),
                theme: r.get("theme"),
                status: mission_status,
                maille_id,
                zone_label: r.get("zone_label"),
                commune: r.get("commune"),
                region: r.get("region"),
                start_date: r.get("start_date"),
                end_date: r.get("end_date"),
                expected_sondages: r.get("expected_sondages"),
                supervisor_name: r.get("supervisor_name"),
                supervisor_id: r.get("supervisor_id"),
                assigned_students_count,
                linked_sondages_count: r.get("linked_sondages_count"),
                field_logs_count: r.get("field_logs_count"),
                documents_count: r.get("documents_count"),
                operational_status,
                operational_reason,
                operational_issues: issues,
                conflict_holder_email,
                conflict_holder_name,
                conflict_mission_id: if is_real_conflict { Some(r.get("id")) } else { None },
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            }
        })
        .collect();

    Ok(Json(MissionListResponse {
        missions,
        total,
        page,
        per_page,
        total_pages: total_pages.max(1),
    }))
}

async fn create_mission(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(request): Json<CreateMissionRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    request
        .validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?;

    let theme = MissionTheme::from_str(request.theme.trim()).ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Theme invalide" })),
        )
    })?;

    let expected_sondages = request.expected_sondages.unwrap_or(0).max(0);

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    // Garde anti-doublon code (missions non supprimées)
    let existing: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT id FROM atlas.colab_missions WHERE deleted_at IS NULL AND code = $1 LIMIT 1"#,
    )
    .bind(request.code.trim())
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;
    if let Some(existing_id) = existing {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Code déjà utilisé", "existing_mission_id": existing_id })),
        ));
    }

    let mission_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_missions (
            code,
            title,
            theme,
            status,
            maille_id,
            zone_label,
            commune,
            region,
            supervisor_id,
            expected_sondages,
            start_date,
            end_date,
            description,
            objectifs,
            notes_internal,
            created_by
        )
        VALUES (
            $1,
            $2,
            $3::atlas.mission_theme,
            'draft'::atlas.mission_status,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15
        )
        RETURNING id
        "#,
    )
    .bind(request.code.trim())
    .bind(request.title.trim())
    .bind(theme.as_str())
    .bind(request.maille_id)
    .bind(request.zone_label.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.commune.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.region.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.supervisor_id)
    .bind(expected_sondages)
    .bind(request.start_date)
    .bind(request.end_date)
    .bind(request.description.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.objectifs.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.notes_internal.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(auth.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;

    // Assignations initiales (idempotent)
    for student_id in request.assigned_student_ids.iter() {
        let exists_student: Option<Uuid> = sqlx::query_scalar(
            r#"SELECT id FROM atlas.colab_students WHERE id = $1 AND deleted_at IS NULL LIMIT 1"#,
        )
        .bind(student_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;

        if exists_student.is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Étudiant introuvable", "student_id": student_id })),
            ));
        }

        let _ = sqlx::query(
            r#"
            INSERT INTO atlas.colab_mission_assignments (mission_id, student_id, role)
            VALUES ($1, $2, 'membre')
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(mission_id)
        .bind(student_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;
    }

    // Si une maille est connue, on tente de synchroniser la table dérivée.
    if request.maille_id.is_some() {
        let _ = sqlx::query("SELECT atlas.sync_colab_maille_assignment_for_mission($1)")
            .bind(mission_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("Erreur sync attribution: {}", e) })),
                )
            })?;
    }

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(json!({ "success": true, "id": mission_id })))
}

async fn get_mission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(mission_id): Path<Uuid>,
) -> Result<Json<MissionDetail>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée" })),
        ));
    }

    let row = sqlx::query(
        r#"
        SELECT
          cm.id,
          cm.code,
          cm.title,
          cm.theme::text AS theme,
          cm.status::text AS status,
          cm.maille_id,
          cm.zone_label,
          cm.commune,
          cm.region,
          cm.start_date,
          cm.end_date,
          cm.expected_sondages,
          cm.supervisor_id,
          cm.description,
          cm.objectifs,
          cm.notes_internal,
          s.id as supervisor_id,
          su.id as supervisor_user_id,
          su.is_active as supervisor_is_active,
          COALESCE(NULLIF(BTRIM(CONCAT(su.first_name, ' ', su.last_name)), ''), su.username) AS supervisor_name,
          cm.created_by as created_by,
          cu.username as created_by_username,
          cu.email as created_by_email,
          COALESCE(NULLIF(BTRIM(CONCAT(cu.first_name, ' ', cu.last_name)), ''), cu.username) AS created_by_full_name,
          (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.mission_id = cm.id AND a.unassigned_at IS NULL) AS assigned_students_count,
          cm.created_at,
          cm.updated_at,
          FALSE AS is_real_conflict,
          NULL::text AS conflict_holder_email,
          NULL::text AS conflict_holder_name
        FROM atlas.colab_missions cm
        LEFT JOIN atlas.colab_supervisors s ON s.id = cm.supervisor_id
        LEFT JOIN atlas.users su ON su.id = s.user_id
        LEFT JOIN atlas.users cu ON cu.id = cm.created_by
        WHERE cm.id = $1 AND cm.deleted_at IS NULL
        "#,
    )
    .bind(mission_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur DB: {}", e) })),
        )
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "Mission non trouvée" }))))?;

    let assigned_students_count: i64 = row.get("assigned_students_count");
    let maille_id: Option<Uuid> = row.get("maille_id");
    let mission_status: String = row.get("status");
    let is_real_conflict: bool = row.try_get::<bool, _>("is_real_conflict").unwrap_or(false);
    let conflict_holder_email: Option<String> = row.try_get::<String, _>("conflict_holder_email").ok();
    let conflict_holder_name: Option<String> = row.try_get::<String, _>("conflict_holder_name").ok();

    let operational_status = if is_real_conflict {
        "blocked_conflict".to_string()
    } else {
        "ok".to_string()
    };
    let operational_reason = if is_real_conflict {
        Some("Conflit d'attribution (mission ≠ détenteur maille)".to_string())
    } else {
        None
    };

    let operational_issues = build_operational_issues(
        &operational_status,
        operational_reason.as_deref(),
        &mission_status,
        maille_id,
        assigned_students_count,
        None,
        None,
        None,
        conflict_holder_name.as_deref(),
        conflict_holder_email.as_deref(),
        None,
        None,
    );

    // Étudiants assignés
    let assigned_students = sqlx::query(
        r#"
        SELECT
          a.id AS assignment_id,
          s.id AS student_id,
          u.id AS user_id,
          u.username,
          (COALESCE(NULLIF(BTRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username, u.email)) AS full_name,
          s.matricule,
          s.promotion,
          a.role,
          a.assigned_at
        FROM atlas.colab_mission_assignments a
        JOIN atlas.colab_students s ON s.id = a.student_id
        JOIN atlas.users u ON u.id = s.user_id
        WHERE a.mission_id = $1 AND a.unassigned_at IS NULL
        ORDER BY a.assigned_at ASC
        "#,
    )
    .bind(mission_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur DB: {}", e) })),
        )
    })?
    .into_iter()
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
    .collect::<Vec<_>>();

    // Sondages liés
    let linked_sondages = sqlx::query(
        r#"
        SELECT
          ms.id AS link_id,
          ms.sondage_id,
          s.code AS sondage_code,
          ms.role,
          ms.linked_at
        FROM atlas.colab_mission_sondages ms
        LEFT JOIN atlas.sondages s ON s.id = ms.sondage_id
        WHERE ms.mission_id = $1
        ORDER BY ms.linked_at DESC
        "#,
    )
    .bind(mission_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur DB: {}", e) })),
        )
    })?
    .into_iter()
    .map(|r| LinkedSondage {
        link_id: r.get("link_id"),
        sondage_id: r.get("sondage_id"),
        sondage_code: r.get("sondage_code"),
        role: r.get("role"),
        linked_at: r.get("linked_at"),
    })
    .collect::<Vec<_>>();

    let supervisor_id: Option<Uuid> = row.get("supervisor_id");
    let supervisor = match supervisor_id {
        None => None,
        Some(id) => {
            let username: Option<String> = row.try_get("supervisor_name").ok();
            let user_id: Option<Uuid> = row.try_get("supervisor_user_id").ok();
            let is_active: Option<bool> = row.try_get("supervisor_is_active").ok();

            match (username, user_id, is_active) {
                (Some(full_name), Some(user_id), Some(is_active)) => Some(SupervisorSummary {
                    id,
                    user_id,
                    username: full_name.clone(),
                    full_name,
                    specialite: row.try_get("supervisor_specialite").ok(),
                    institution: row.try_get("supervisor_institution").ok(),
                    is_active,
                }),
                _ => None,
            }
        }
    };

    let created_by_id: Option<Uuid> = row.try_get("created_by").ok();
    let created_by = match created_by_id {
        None => None,
        Some(id) => {
            let username: Option<String> = row.try_get("created_by_username").ok();
            let email: Option<String> = row.try_get("created_by_email").ok();

            match (username, email) {
                (Some(username), Some(email)) => Some(UserSummary {
                    id,
                    username,
                    email,
                    full_name: row.try_get("created_by_full_name").ok(),
                }),
                _ => None,
            }
        }
    };

    Ok(Json(MissionDetail {
        id: row.get("id"),
        code: row.get("code"),
        title: row.get("title"),
        theme: row.get("theme"),
        status: mission_status,
        maille_id,
        zone_label: row.get("zone_label"),
        commune: row.get("commune"),
        region: row.get("region"),
        start_date: row.get("start_date"),
        end_date: row.get("end_date"),
        expected_sondages: row.get::<Option<i32>, _>("expected_sondages").unwrap_or(0),
        description: row.get("description"),
        objectifs: row.get("objectifs"),
        notes_internal: row.get("notes_internal"),
        supervisor,
        created_by,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        operational_status,
        operational_reason,
        operational_issues,
        conflict_holder_email,
        conflict_holder_name,
        conflict_mission_id: if is_real_conflict { Some(row.get("id")) } else { None },
        assigned_students,
        linked_sondages,
    }))
}

async fn update_mission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(mission_id): Path<Uuid>,
    Json(request): Json<UpdateMissionRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.update") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    request
        .validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?;

    let theme: Option<String> = match request.theme.as_deref() {
        None => None,
        Some(t) => {
            let t = t.trim();
            if t.is_empty() {
                None
            } else {
                MissionTheme::from_str(t)
                    .map(|th| th.as_str().to_string())
                    .ok_or_else(|| {
                        (
                            StatusCode::BAD_REQUEST,
                            Json(json!({ "error": "Theme invalide" })),
                        )
                    })
                    .map(Some)?
            }
        }
    };

    let status: Option<String> = match request.status.as_deref() {
        None => None,
        Some(s) => {
            let s = s.trim();
            if s.is_empty() {
                None
            } else {
                MissionStatus::from_str(s)
                    .map(|st| st.as_str().to_string())
                    .ok_or_else(|| {
                        (
                            StatusCode::BAD_REQUEST,
                            Json(json!({ "error": "Statut invalide" })),
                        )
                    })
                    .map(Some)?
            }
        }
    };

    let expected_sondages = request.expected_sondages.map(|v| v.max(0));

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    // Vérifier existence
    let exists: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT id FROM atlas.colab_missions WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(mission_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;
    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Mission non trouvée" }))));
    }

    let res = sqlx::query(
        r#"
        UPDATE atlas.colab_missions
        SET
          title = COALESCE($2, title),
          theme = COALESCE($3::atlas.mission_theme, theme),
          status = COALESCE($4::atlas.mission_status, status),
          maille_id = COALESCE($5, maille_id),
          zone_label = COALESCE($6, zone_label),
          commune = COALESCE($7, commune),
          region = COALESCE($8, region),
          supervisor_id = COALESCE($9, supervisor_id),
          expected_sondages = COALESCE($10, expected_sondages),
          start_date = COALESCE($11, start_date),
          end_date = COALESCE($12, end_date),
          description = COALESCE($13, description),
          objectifs = COALESCE($14, objectifs),
          notes_internal = COALESCE($15, notes_internal),
          updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(mission_id)
    .bind(request.title.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(theme)
    .bind(status)
    .bind(request.maille_id)
    .bind(request.zone_label.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.commune.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.region.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.supervisor_id)
    .bind(expected_sondages)
    .bind(request.start_date)
    .bind(request.end_date)
    .bind(request.description.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.objectifs.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.notes_internal.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Mise à jour impossible", &e))))?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Mission non trouvée" }))));
    }

    // Sync derived maille assignment if maille_id is set (or kept)
    let current_maille_id: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT maille_id FROM atlas.colab_missions WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(mission_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    if current_maille_id.is_some() {
        let _ = sqlx::query("SELECT atlas.sync_colab_maille_assignment_for_mission($1)")
            .bind(mission_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur sync attribution: {}", e) }))))?;
    }

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    Ok(Json(json!({ "success": true, "id": mission_id })))
}

async fn delete_mission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(mission_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.update") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    let updated = sqlx::query(
        r#"
        UPDATE atlas.colab_missions
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(mission_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?
    .rows_affected();

    if updated == 0 {
        // Idempotent: si déjà deleted_at, on renvoie NO_CONTENT; sinon 404.
        let exists: Option<(Uuid,)> = sqlx::query_as(
            r#"SELECT id FROM atlas.colab_missions WHERE id = $1"#,
        )
        .bind(mission_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

        tx.commit()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

        return if exists.is_some() {
            Ok(StatusCode::NO_CONTENT)
        } else {
            Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Mission non trouvée" }))))
        };
    }

    // Désattribuer tous les étudiants
    sqlx::query(
        r#"
        UPDATE atlas.colab_mission_assignments
        SET unassigned_at = NOW()
        WHERE mission_id = $1 AND unassigned_at IS NULL
        "#,
    )
    .bind(mission_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    // Soft-delete des documents liés (les fichiers restent sur disque comme pour delete_document)
    sqlx::query(
        r#"
        UPDATE atlas.colab_documents
        SET deleted_at = NOW()
        WHERE mission_id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(mission_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    Ok(StatusCode::NO_CONTENT)
}

async fn unassign_mission_maille(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(mission_id): Path<Uuid>,
) -> Result<Json<UnassignMissionMailleResponse>, (StatusCode, Json<serde_json::Value>)> {
    require_permission(&state.pool, auth.id, "colab.missions.unassign").await?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur DB: {}", e) })),
            )
        })?;

    // Idempotence: si la mission est déjà supprimée, on ne fait rien.
    let row = sqlx::query(
        r#"
        SELECT
          cm.deleted_at IS NULL AS is_active,
          cm.ex_maille_code,
          m.code AS maille_code
        FROM atlas.colab_missions cm
        LEFT JOIN atlas.mailles m ON m.id = cm.maille_id
        WHERE cm.id = $1
        "#,
    )
    .bind(mission_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur DB: {}", e) })),
        )
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "Mission non trouvée" }))))?;

    let is_active: bool = row.get("is_active");
    let existing_ex_maille_code: Option<String> = row.try_get("ex_maille_code").ok();
    let maille_code: Option<String> = row.try_get("maille_code").ok();

    if !is_active {
        tx.commit()
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("Erreur DB: {}", e) })),
                )
            })?;

        return Ok(Json(UnassignMissionMailleResponse {
            mission_id,
            ex_maille_code: existing_ex_maille_code,
            status: "already_unassigned".to_string(),
        }));
    }

    let ex_maille_code = maille_code.or(existing_ex_maille_code);

    sqlx::query(
        r#"
        UPDATE atlas.colab_missions
        SET
          ex_maille_code = COALESCE(ex_maille_code, $2),
          maille_id = NULL,
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(mission_id)
    .bind(ex_maille_code.as_deref())
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur DB: {}", e) })),
        )
    })?;

    // Sync derived table state (libère la maille si besoin)
    let _ = sqlx::query("SELECT atlas.sync_colab_maille_assignment_for_mission($1)")
        .bind(mission_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur sync attribution: {}", e) })),
            )
        })?;

    tx.commit()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur DB: {}", e) })),
            )
        })?;

    // Audit trail (BM-20): tracer l'action sensible
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());
    let _ = session_manager
        .log_auth_event(
            Some(auth.id),
            AuthEventType::MissionUnassign,
            true,
            None,
            None,
            Some(json!({
                "mission_id": mission_id,
                "ex_maille_code": ex_maille_code,
                "action": "unassign_mission_maille"
            })),
        )
        .await;

    Ok(Json(UnassignMissionMailleResponse {
        mission_id,
        ex_maille_code,
        status: "unassigned".to_string(),
    }))
}

async fn get_maille_active_missions(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(maille_id): Path<Uuid>,
) -> Result<Json<MailleActiveMissionsResponse>, (StatusCode, Json<serde_json::Value>)> {
    require_permission(&state.pool, auth.id, "colab.mailles.view_active").await?;

    // BM-18: un student ne peut consulter que ses propres missions.
    // On résout ici l'identité colab_students.id à partir de users.id.
    let student_id: Option<Uuid> = if auth.has_role("student") && !auth.is_admin() {
        let sid = sqlx::query_scalar(
            r#"
            SELECT cs.id
            FROM atlas.colab_students cs
            WHERE cs.user_id = $1 AND cs.deleted_at IS NULL
            LIMIT 1
            "#,
        )
        .bind(auth.id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur DB: {}", e) })),
            )
        })?;

        // Pas de profil student rattaché => ne rien exposer.
        if sid.is_none() {
            return Ok(Json(MailleActiveMissionsResponse {
                maille_id,
                missions: Vec::new(),
            }));
        }

        sid
    } else {
        None
    };

    let rows = if let Some(student_id) = student_id {
        sqlx::query(
            r#"
            SELECT
              cm.id AS mission_id,
              cm.code AS mission_code,
              cma.student_id AS student_id,
              cma.assigned_at AS assigned_at,
              COALESCE(NULLIF(BTRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS student_name
            FROM atlas.colab_missions cm
            LEFT JOIN atlas.colab_mission_assignments cma
              ON cma.mission_id = cm.id
             AND cma.unassigned_at IS NULL
            LEFT JOIN atlas.colab_students cs ON cs.id = cma.student_id
            LEFT JOIN atlas.users u ON u.id = cs.user_id
            WHERE cm.deleted_at IS NULL
              AND cm.maille_id = $1
              AND cma.student_id = $2
            ORDER BY cma.assigned_at DESC NULLS LAST, cm.created_at DESC
            "#,
        )
        .bind(maille_id)
        .bind(student_id)
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query(
            r#"
            SELECT
              cm.id AS mission_id,
              cm.code AS mission_code,
              cma.student_id AS student_id,
              cma.assigned_at AS assigned_at,
              COALESCE(NULLIF(BTRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS student_name
            FROM atlas.colab_missions cm
            LEFT JOIN atlas.colab_mission_assignments cma
              ON cma.mission_id = cm.id
             AND cma.unassigned_at IS NULL
            LEFT JOIN atlas.colab_students cs ON cs.id = cma.student_id
            LEFT JOIN atlas.users u ON u.id = cs.user_id
            WHERE cm.deleted_at IS NULL
              AND cm.maille_id = $1
            ORDER BY cma.assigned_at DESC NULLS LAST, cm.created_at DESC
            "#,
        )
        .bind(maille_id)
        .fetch_all(&state.pool)
        .await
    }
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur DB: {}", e) })),
        )
    })?;

    let missions = rows
        .iter()
        .map(|r| MailleActiveMissionItem {
            mission_id: r.get("mission_id"),
            mission_code: r.get("mission_code"),
            student_id: r.try_get("student_id").ok(),
            student_name: r.try_get("student_name").ok(),
            assigned_at: r.try_get("assigned_at").ok(),
        })
        .collect();

    Ok(Json(MailleActiveMissionsResponse { maille_id, missions }))
}

async fn get_maille_state(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(maille_id): Path<Uuid>,
) -> Result<Json<MailleStateResponse>, (StatusCode, Json<serde_json::Value>)> {
    require_permission(&state.pool, auth.id, "colab.mailles.view_active").await?;

    // BM-18: un student ne peut consulter que ses propres missions.
    let student_id: Option<Uuid> = if auth.has_role("student") && !auth.is_admin() {
        sqlx::query_scalar(
            r#"
            SELECT cs.id
            FROM atlas.colab_students cs
            WHERE cs.user_id = $1 AND cs.deleted_at IS NULL
            LIMIT 1
            "#,
        )
        .bind(auth.id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur DB: {}", e) })),
            )
        })?
    } else {
        None
    };

    // Pas de profil student rattaché => ne rien exposer.
    if auth.has_role("student") && !auth.is_admin() && student_id.is_none() {
        return Ok(Json(MailleStateResponse {
            maille_id,
            has_active_mission: false,
            mission_count: 0,
        }));
    }

    let row = if let Some(student_id) = student_id {
        sqlx::query(
            r#"
            SELECT
              COUNT(DISTINCT cm.id)::bigint AS mission_count
            FROM atlas.colab_missions cm
            LEFT JOIN atlas.colab_mission_assignments cma
              ON cma.mission_id = cm.id
             AND cma.unassigned_at IS NULL
            WHERE cm.deleted_at IS NULL
              AND cm.maille_id = $1
              AND cma.student_id = $2
            "#,
        )
        .bind(maille_id)
        .bind(student_id)
        .fetch_one(&state.pool)
        .await
    } else {
        sqlx::query(
            r#"
            SELECT
              COUNT(DISTINCT cm.id)::bigint AS mission_count
            FROM atlas.colab_missions cm
            LEFT JOIN atlas.colab_mission_assignments cma
              ON cma.mission_id = cm.id
             AND cma.unassigned_at IS NULL
            WHERE cm.deleted_at IS NULL
              AND cm.maille_id = $1
            "#,
        )
        .bind(maille_id)
        .fetch_one(&state.pool)
        .await
    }
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur DB: {}", e) })),
        )
    })?;

    let mission_count: i64 = row.try_get("mission_count").unwrap_or(0);
    Ok(Json(MailleStateResponse {
        maille_id,
        has_active_mission: mission_count > 0,
        mission_count,
    }))
}

async fn reassign_mission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(mission_id): Path<Uuid>,
    Json(request): Json<ReassignMissionRequest>,
) -> Result<Json<ReassignMissionResponse>, (StatusCode, Json<serde_json::Value>)> {
    require_permission(&state.pool, auth.id, "colab.missions.reassign").await?;

    request
        .validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur DB: {}", e) })),
            )
        })?;

    // Charger la mission source (active)
    let src = sqlx::query(
        r#"
        SELECT
          cm.code,
          cm.title,
          cm.theme::text AS theme,
          cm.status::text AS status,
          cm.maille_id,
          cm.zone_label,
          cm.commune,
          cm.region,
          cm.supervisor_id,
          cm.expected_sondages,
          cm.start_date,
          cm.end_date,
          cm.description,
          cm.objectifs,
          cm.notes_internal,
          m.code AS maille_code
        FROM atlas.colab_missions cm
        LEFT JOIN atlas.mailles m ON m.id = cm.maille_id
        WHERE cm.id = $1 AND cm.deleted_at IS NULL
        "#,
    )
    .bind(mission_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur DB: {}", e) })),
        )
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "Mission non trouvée" }))))?;

    let old_code: String = src.get("code");
    let title: String = src.get("title");
    let theme: String = src.get("theme");
    let status: String = src.get("status");
    let zone_label: Option<String> = src.try_get("zone_label").ok();
    let commune: Option<String> = src.try_get("commune").ok();
    let region: Option<String> = src.try_get("region").ok();
    let supervisor_id: Option<Uuid> = src.try_get("supervisor_id").ok();
    let expected_sondages: i32 = src.try_get::<i32, _>("expected_sondages").unwrap_or(0);
    let start_date: Option<NaiveDate> = src.try_get("start_date").ok();
    let end_date: Option<NaiveDate> = src.try_get("end_date").ok();
    let description: Option<String> = src.try_get("description").ok();
    let objectifs: Option<String> = src.try_get("objectifs").ok();
    let notes_internal: Option<String> = src.try_get("notes_internal").ok();
    let maille_code: Option<String> = src.try_get("maille_code").ok();

    // Vérifier student existant
    let exists_student: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT id FROM atlas.colab_students WHERE id = $1 AND deleted_at IS NULL LIMIT 1"#,
    )
    .bind(request.student_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Réattribution impossible", &e))))?;

    if exists_student.is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Étudiant introuvable", "student_id": request.student_id })),
        ));
    }

    // BM-16: éviter doublon actif sur la même maille
    let already_active: Option<i64> = sqlx::query_scalar(
        r#"
        SELECT 1
        FROM atlas.colab_missions cm
        JOIN atlas.colab_mission_assignments cma
          ON cma.mission_id = cm.id
         AND cma.unassigned_at IS NULL
        WHERE cm.deleted_at IS NULL
          AND cm.maille_id = $1
          AND cma.student_id = $2
        LIMIT 1
        "#,
    )
    .bind(request.new_maille_id)
    .bind(request.student_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur DB: {}", e) })),
        )
    })?;

    if already_active.is_some() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Mission déjà active pour cet étudiant sur cette maille" })),
        ));
    }

    // Soft-delete mission source et conserver ex_maille_code
    sqlx::query(
        r#"
        UPDATE atlas.colab_missions
        SET
          ex_maille_code = COALESCE(ex_maille_code, $2),
          maille_id = NULL,
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(mission_id)
    .bind(maille_code.as_deref())
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur DB: {}", e) })),
        )
    })?;

    // Générer un nouveau code mission (unique)
    let suffix = Uuid::new_v4().to_string();
    let suffix = suffix.split('-').next().unwrap_or("r");
    let mut new_code = format!("{}-R{}", old_code, suffix);
    if new_code.len() > 50 {
        new_code.truncate(50);
    }

    // Créer la nouvelle mission
    let new_mission_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_missions (
          code,
          title,
          theme,
          status,
          maille_id,
          zone_label,
          commune,
          region,
          supervisor_id,
          expected_sondages,
          start_date,
          end_date,
          description,
          objectifs,
          notes_internal,
          reassigned_from,
          created_by
        )
        VALUES (
          $1,
          $2,
          $3::atlas.mission_theme,
          $4::atlas.mission_status,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17
        )
        RETURNING id
        "#,
    )
    .bind(new_code.trim())
    .bind(title.trim())
    .bind(theme.as_str())
    .bind(status.as_str())
    .bind(request.new_maille_id)
    .bind(zone_label)
    .bind(commune)
    .bind(region)
    .bind(supervisor_id)
    .bind(expected_sondages)
    .bind(start_date)
    .bind(end_date)
    .bind(description)
    .bind(objectifs)
    .bind(notes_internal)
    .bind(mission_id)
    .bind(auth.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Réattribution impossible", &e))))?;

    // Assigner l'étudiant
    sqlx::query(
        r#"
        INSERT INTO atlas.colab_mission_assignments (mission_id, student_id, role)
        VALUES ($1, $2, 'membre')
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(new_mission_id)
    .bind(request.student_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Réattribution impossible", &e))))?;

    // Sync derived maille assignment
    let _ = sqlx::query("SELECT atlas.sync_colab_maille_assignment_for_mission($1)")
        .bind(new_mission_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur sync attribution: {}", e) })),
            )
        })?;

    tx.commit()
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Erreur DB: {}", e) })),
            )
        })?;

    // Audit trail (BM-20): tracer l'action sensible
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());
    let _ = session_manager
        .log_auth_event(
            Some(auth.id),
            AuthEventType::MissionReassign,
            true,
            None,
            None,
            Some(json!({
                "old_mission_id": mission_id,
                "new_mission_id": new_mission_id,
                "new_maille_id": request.new_maille_id,
                "student_id": request.student_id,
                "action": "reassign_mission"
            })),
        )
        .await;

    Ok(Json(ReassignMissionResponse {
        old_mission_id: mission_id,
        new_mission_id,
        new_maille_id: request.new_maille_id,
        status: "reassigned".to_string(),
    }))
}

async fn resolve_conflict() -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({ "error": "Not implemented" })),
    )
}

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

    let total_missions: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM atlas.colab_missions WHERE deleted_at IS NULL")
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let status_rows = sqlx::query(
        r#"
        SELECT status::text AS status, COUNT(*)::bigint AS count
        FROM atlas.colab_missions
        WHERE deleted_at IS NULL
        GROUP BY status
        ORDER BY count DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur DB: {}", e) })),
        )
    })?;

    let missions_by_status: Vec<StatusCount> = status_rows
        .iter()
        .map(|r| StatusCount {
            status: r.get("status"),
            count: r.get::<i64, _>("count"),
        })
        .collect();

    let theme_rows = sqlx::query(
        r#"
        SELECT theme::text AS theme, COUNT(*)::bigint AS count
        FROM atlas.colab_missions
        WHERE deleted_at IS NULL
        GROUP BY theme
        ORDER BY count DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur DB: {}", e) })),
        )
    })?;

    let missions_by_theme: Vec<ThemeCount> = theme_rows
        .iter()
        .map(|r| ThemeCount {
            theme: r.get("theme"),
            count: r.get::<i64, _>("count"),
        })
        .collect();

    let total_students: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM atlas.colab_students s
        JOIN atlas.users u ON u.id = s.user_id
        WHERE s.deleted_at IS NULL
          AND u.deleted_at IS NULL
          AND u.is_active = TRUE
        "#,
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let total_supervisors: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM atlas.colab_supervisors s
        JOIN atlas.users u ON u.id = s.user_id
        WHERE s.deleted_at IS NULL
          AND u.deleted_at IS NULL
          AND u.is_active = TRUE
        "#,
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let total_field_logs: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM atlas.colab_field_logs",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let total_documents: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM atlas.colab_documents WHERE deleted_at IS NULL")
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
            COALESCE(NULLIF(BTRIM(u.first_name || ' ' || u.last_name), ''), u.username, u.email) as full_name,
            s.specialite,
            s.institution,
            u.is_active
        FROM atlas.colab_supervisors s
        JOIN atlas.users u ON s.user_id = u.id
        WHERE u.deleted_at IS NULL
          AND s.deleted_at IS NULL
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
            is_active: r.get("is_active"),
        })
        .collect();

    Ok(Json(supervisors))
}

async fn create_supervisor(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(request): Json<CreateSupervisorRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.supervisors.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    request
        .validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // Email unique (comptes non supprimés)
    let existing_email: Option<(Uuid,)> = sqlx::query_as(
        r#"
        SELECT s.id
        FROM atlas.users u
        JOIN atlas.colab_supervisors s ON s.user_id = u.id
        WHERE u.deleted_at IS NULL
          AND s.deleted_at IS NULL
          AND u.email = $1
        LIMIT 1
        "#,
    )
    .bind(&request.email)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;
    if let Some((existing_supervisor_id,)) = existing_email {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Email déjà utilisé", "existing_supervisor_id": existing_supervisor_id })),
        ));
    }

    // Garde anti-doublon téléphone (comptes non supprimés)
    if let Some(tel) = request.telephone.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        let exists_tel: Option<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT s.id
            FROM atlas.users u
            JOIN atlas.colab_supervisors s ON s.user_id = u.id
            WHERE u.deleted_at IS NULL
              AND s.deleted_at IS NULL
              AND u.telephone IS NOT NULL
              AND BTRIM(u.telephone) <> ''
              AND u.telephone = $1
            LIMIT 1
            "#,
        )
        .bind(tel)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;
        if let Some((existing_supervisor_id,)) = exists_tel {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Téléphone déjà utilisé", "existing_supervisor_id": existing_supervisor_id })),
            ));
        }
    }

    // Générer username unique à partir de l'email
    let base = request.email.split('@').next().unwrap_or("user");
    let username = ensure_unique_username(&mut tx, base)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;

    // Générer un mot de passe temporaire
    let token = Uuid::new_v4().to_string().replace('-', "");
    let suffix: String = token.chars().take(8).collect();
    let temp_password = format!("A{}!a1", suffix);
    let password_hasher = PasswordHasher::new(state.auth_config.clone());
    let password_hash = password_hasher
        .hash_password(&temp_password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let user_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.users (email, username, password_hash, first_name, last_name, telephone, is_active, is_verified)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE)
        RETURNING id
        "#,
    )
    .bind(request.email.trim())
    .bind(&username)
    .bind(&password_hash)
    .bind(request.first_name.trim())
    .bind(request.last_name.trim())
    .bind(request.telephone.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;

    // Assigner le rôle "supervisor"
    sqlx::query(
        r#"
        INSERT INTO atlas.user_roles (user_id, role_id)
        VALUES ($1, 'supervisor')
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;

    let supervisor_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_supervisors (
            user_id, specialite, institution, titre, departement, telephone, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(request.specialite.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.institution.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.titre.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.departement.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.telephone.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.notes.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(json!({
        "success": true,
        "supervisor_id": supervisor_id,
        "user_id": user_id,
        "temp_password": temp_password
    })))
}

async fn update_supervisor(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(supervisor_id): Path<Uuid>,
    Json(request): Json<UpdateSupervisorRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.supervisors.update") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    request
        .validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let user_id: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT user_id FROM atlas.colab_supervisors WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(supervisor_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let Some(user_id) = user_id else {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Superviseur non trouvé" }))));
    };

    // Mise à jour user
    let res_user = sqlx::query(
        r#"
        UPDATE atlas.users
        SET
            email = COALESCE($2, email),
            first_name = COALESCE($3, first_name),
            last_name = COALESCE($4, last_name),
            telephone = COALESCE($5, telephone),
            is_active = COALESCE($6, is_active),
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(user_id)
    .bind(request.email.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.first_name.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.last_name.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.telephone.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.is_active)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Mise à jour impossible", &e))))?;

    if res_user.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Utilisateur non trouvé" }))));
    }

    // Mise à jour superviseur
    sqlx::query(
        r#"
        UPDATE atlas.colab_supervisors
        SET
            titre = COALESCE($2, titre),
            institution = COALESCE($3, institution),
            departement = COALESCE($4, departement),
            specialite = COALESCE($5, specialite),
            telephone = COALESCE($6, telephone),
            notes = COALESCE($7, notes),
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(supervisor_id)
    .bind(request.titre.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.institution.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.departement.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.specialite.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.telephone.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.notes.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Mise à jour impossible", &e))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(json!({ "success": true, "supervisor_id": supervisor_id })))
}

async fn delete_supervisor(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(supervisor_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.supervisors.delete") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let user_id: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT user_id FROM atlas.colab_supervisors WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(supervisor_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let Some(user_id) = user_id else {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Superviseur non trouvé" }))));
    };

    sqlx::query(
        r#"UPDATE atlas.colab_supervisors SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(supervisor_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Suppression impossible", &e))))?;

    sqlx::query(
        r#"UPDATE atlas.users SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Suppression impossible", &e))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(json!({ "success": true, "supervisor_id": supervisor_id, "deactivated": true })))
}

async fn create_student(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(request): Json<CreateStudentRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.students.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    request
        .validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // Email unique (comptes non supprimés)
    let existing_email: Option<(Uuid,)> = sqlx::query_as(
        r#"
        SELECT s.id
        FROM atlas.users u
        JOIN atlas.colab_students s ON s.user_id = u.id
        WHERE u.deleted_at IS NULL
          AND s.deleted_at IS NULL
          AND u.email = $1
        LIMIT 1
        "#,
    )
    .bind(&request.email)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;
    if let Some((existing_student_id,)) = existing_email {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Email déjà utilisé", "existing_student_id": existing_student_id })),
        ));
    }

    // Garde anti-doublon téléphone (comptes non supprimés)
    if let Some(tel) = request.telephone.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        let exists_tel: Option<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT s.id
            FROM atlas.users u
            JOIN atlas.colab_students s ON s.user_id = u.id
            WHERE u.deleted_at IS NULL
              AND s.deleted_at IS NULL
              AND u.telephone IS NOT NULL
              AND BTRIM(u.telephone) <> ''
              AND u.telephone = $1
            LIMIT 1
            "#,
        )
        .bind(tel)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;
        if let Some((existing_student_id,)) = exists_tel {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Téléphone déjà utilisé", "existing_student_id": existing_student_id })),
            ));
        }
    }

    // Générer username unique à partir de l'email
    let base = request.email.split('@').next().unwrap_or("user");
    let username = ensure_unique_username(&mut tx, base)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;

    // Générer un mot de passe temporaire
    let token = Uuid::new_v4().to_string().replace('-', "");
    let suffix: String = token.chars().take(8).collect();
    let temp_password = format!("A{}!a1", suffix);
    let password_hasher = PasswordHasher::new(state.auth_config.clone());
    let password_hash = password_hasher
        .hash_password(&temp_password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let user_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.users (email, username, password_hash, first_name, last_name, telephone, is_active, is_verified, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE, $7)
        RETURNING id
        "#,
    )
    .bind(&request.email)
    .bind(&username)
    .bind(&password_hash)
    .bind(&request.first_name)
    .bind(&request.last_name)
    .bind(request.telephone.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(auth.id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;

    // Assigner le rôle student
    sqlx::query(
        r#"
        INSERT INTO atlas.user_roles (user_id, role_id)
        VALUES ($1, 'student')
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;

    let student_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_students (user_id, matricule, promotion, filiere, etablissement, niveau, age)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(request.matricule.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(&request.promotion)
    .bind(request.filiere.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.etablissement.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.niveau.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.age)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Création impossible", &e))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(json!({
        "success": true,
        "student_id": student_id,
        "user_id": user_id,
        "temp_password": temp_password
    })))
}

async fn update_student(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(student_id): Path<Uuid>,
    Json(request): Json<UpdateStudentRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.students.update") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    request
        .validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // Charger user_id
    let user_id: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT user_id FROM atlas.colab_students WHERE id = $1"#,
    )
    .bind(student_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let Some(user_id) = user_id else {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Étudiant non trouvé" }))));
    };

    // Garde anti-doublon téléphone
    if let Some(tel) = request.telephone.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        let exists_tel: Option<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT id
            FROM atlas.users
            WHERE deleted_at IS NULL
              AND telephone IS NOT NULL
              AND BTRIM(telephone) <> ''
              AND telephone = $1
              AND id <> $2
            LIMIT 1
            "#,
        )
        .bind(tel)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Mise à jour impossible", &e))))?;
        if exists_tel.is_some() {
            return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "Téléphone déjà utilisé" }))));
        }
    }

    // Update users
    sqlx::query(
        r#"
        UPDATE atlas.users
        SET
          email = COALESCE($2, email),
          first_name = COALESCE($3, first_name),
          last_name = COALESCE($4, last_name),
          telephone = COALESCE($5, telephone),
          is_active = COALESCE($6, is_active),
          updated_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
        "#,
    )
    .bind(user_id)
    .bind(request.email.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.first_name.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.last_name.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.telephone.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.is_active)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Mise à jour impossible", &e))))?;

    // Update colab_students
    sqlx::query(
        r#"
        UPDATE atlas.colab_students
        SET
          matricule = COALESCE($2, matricule),
          promotion = COALESCE($3, promotion),
          filiere = COALESCE($4, filiere),
          etablissement = COALESCE($5, etablissement),
          niveau = COALESCE($6, niveau),
          age = COALESCE($7, age),
          updated_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
        "#,
    )
    .bind(student_id)
    .bind(request.matricule.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.promotion.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.filiere.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.etablissement.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.niveau.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(request.age)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Mise à jour impossible", &e))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(json!({ "success": true, "student_id": student_id })))
}

async fn delete_student(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.students.delete") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    // Blocage si missions/mailles actives
    let active_missions: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM atlas.colab_mission_assignments WHERE student_id = $1 AND unassigned_at IS NULL",
    )
    .bind(student_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);
    let active_mailles: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(DISTINCT cm.maille_id)
        FROM atlas.colab_mission_assignments a
        JOIN atlas.colab_missions cm ON cm.id = a.mission_id
        WHERE a.student_id = $1
          AND a.unassigned_at IS NULL
          AND cm.deleted_at IS NULL
          AND cm.maille_id IS NOT NULL
        "#,
    )
    .bind(student_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    if active_missions > 0 || active_mailles > 0 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "Suppression impossible: étudiant encore lié à des missions/mailles actives",
                "active_missions": active_missions,
                "active_mailles": active_mailles
            })),
        ));
    }

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let user_id: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT user_id FROM atlas.colab_students WHERE id = $1"#,
    )
    .bind(student_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let Some(user_id) = user_id else {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Étudiant non trouvé" }))));
    };

    sqlx::query(
        r#"UPDATE atlas.colab_students SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(student_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Suppression impossible", &e))))?;

    sqlx::query(
        r#"UPDATE atlas.users SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Suppression impossible", &e))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(json!({ "success": true, "student_id": student_id, "deactivated": true })))
}

async fn get_student_prefs() -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({ "error": "Not implemented" })),
    )
}

async fn update_student_prefs() -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({ "error": "Not implemented" })),
    )
}

fn build_operational_issues(
    operational_status: &str,
    operational_reason: Option<&str>,
    mission_status: &str,
    maille_id: Option<Uuid>,
    assigned_students_count: i64,
    primary_student_uuid: Option<Uuid>,
    primary_student_matricule: Option<&str>,
    primary_student_adm_code_pref_1: Option<&str>,
    conflict_holder_name: Option<&str>,
    conflict_holder_email: Option<&str>,
    conflict_holder_student_uuid: Option<Uuid>,
    conflict_mission_id: Option<Uuid>,
) -> Vec<OperationalIssue> {
    let mut issues: Vec<OperationalIssue> = vec![];

    let is_active = matches!(mission_status, "planned" | "in_progress");
    let is_draft = mission_status == "draft";
    let is_not_assignable = matches!(mission_status, "completed" | "archived" | "cancelled" | "suspended");

    if is_not_assignable {
        issues.push(OperationalIssue {
            code: "mission_not_assignable_status".to_string(),
            severity: OperationalIssueSeverity::Blocked,
            scope: OperationalIssueScope::Mission,
            message: format!("Mission non assignable (statut: {})", mission_status),
            actions: vec![OperationalAction {
                code: "open_mission".to_string(),
                label: "Ouvrir la mission".to_string(),
                payload: Some(json!({ "action": "open_mission" })),
            }],
        });
    }

    if assigned_students_count > 0 && primary_student_uuid.is_none() {
        issues.push(OperationalIssue {
            code: "missing_primary_student".to_string(),
            severity: if is_active {
                OperationalIssueSeverity::Blocked
            } else {
                OperationalIssueSeverity::Warning
            },
            scope: OperationalIssueScope::Assignment,
            message: "Étudiant principal introuvable".to_string(),
            actions: vec![OperationalAction {
                code: "change_student".to_string(),
                label: "Choisir un étudiant".to_string(),
                payload: Some(json!({ "action": "change_student" })),
            }],
        });
    }

    if maille_id.is_none() {
        issues.push(OperationalIssue {
            code: "missing_mission_maille".to_string(),
            severity: if is_active {
                OperationalIssueSeverity::Blocked
            } else {
                OperationalIssueSeverity::Warning
            },
            scope: OperationalIssueScope::Mission,
            message: "Maille manquante".to_string(),
            actions: vec![OperationalAction {
                code: "edit_mission_maille".to_string(),
                label: "Associer une maille".to_string(),
                payload: Some(json!({ "action": "edit_mission_maille" })),
            }],
        });
    }

    if assigned_students_count == 0 {
        issues.push(OperationalIssue {
            code: "no_assigned_student".to_string(),
            severity: if is_active {
                OperationalIssueSeverity::Blocked
            } else {
                OperationalIssueSeverity::Warning
            },
            scope: OperationalIssueScope::Assignment,
            message: "Aucun étudiant affecté".to_string(),
            actions: vec![OperationalAction {
                code: "assign_student".to_string(),
                label: "Assigner un étudiant".to_string(),
                payload: Some(json!({ "action": "assign_student" })),
            }],
        });
    }

    if let Some(student_id) = primary_student_uuid {
        if primary_student_adm_code_pref_1
            .map(|m| m.trim().is_empty())
            .unwrap_or(true)
        {
            issues.push(OperationalIssue {
                code: "missing_student_adm_code".to_string(),
                severity: if is_active {
                    OperationalIssueSeverity::Blocked
                } else {
                    OperationalIssueSeverity::Warning
                },
                scope: OperationalIssueScope::Student,
                message: "ADM code manquant".to_string(),
                actions: vec![
                    OperationalAction {
                        code: "edit_student".to_string(),
                        label: "Compléter ADM".to_string(),
                        payload: Some(json!({ "action": "edit_student_adm", "student_id": student_id })),
                    },
                    OperationalAction {
                        code: "change_student".to_string(),
                        label: "Changer l’étudiant".to_string(),
                        payload: Some(json!({ "action": "change_student" })),
                    },
                ],
            });
        }
    }

    if conflict_holder_student_uuid.is_some() && primary_student_uuid.is_some() {
        let who = conflict_holder_name
            .or(conflict_holder_email)
            .unwrap_or("un autre étudiant");
        issues.push(OperationalIssue {
            code: "maille_held_by_other_student".to_string(),
            severity: if is_active {
                OperationalIssueSeverity::Blocked
            } else {
                OperationalIssueSeverity::Warning
            },
            scope: OperationalIssueScope::Maille,
            message: format!("Maille déjà tenue par {}", who),
            actions: {
                let mut a = vec![];
                if !is_draft {
                    a.push(OperationalAction {
                        code: "resolve_takeover".to_string(),
                        label: "Reprendre la maille".to_string(),
                        payload: Some(json!({
                            "action": "takeover",
                            "conflict_mission_id": conflict_mission_id,
                            "holder_student_id": conflict_holder_student_uuid
                        })),
                    });
                }
                a.push(OperationalAction {
                    code: "resolve_change_maille".to_string(),
                    label: "Changer la maille".to_string(),
                    payload: Some(json!({ "action": "change_maille" })),
                });
                if let Some(holder_student_id) = conflict_holder_student_uuid {
                    a.push(OperationalAction {
                        code: "resolve_assign_holder".to_string(),
                        label: "Assigner le détenteur".to_string(),
                        payload: Some(json!({ "action": "assign_holder", "student_id": holder_student_id })),
                    });
                } else {
                    a.push(OperationalAction {
                        code: "resolve_change_student".to_string(),
                        label: "Changer l’étudiant".to_string(),
                        payload: Some(json!({ "action": "change_student" })),
                    });
                }
                a
            },
        });
    }

    if issues.is_empty()
        && matches!(operational_status, "action_required" | "blocked_conflict" | "blocked")
    {
        if let Some(reason) = operational_reason {
            let reason = reason.trim();
            if !reason.is_empty() {
                issues.push(OperationalIssue {
                    code: "operational_reason".to_string(),
                    severity: OperationalIssueSeverity::Warning,
                    scope: OperationalIssueScope::Mission,
                    message: reason.to_string(),
                    actions: vec![OperationalAction {
                        code: "open_mission".to_string(),
                        label: "Ouvrir la mission".to_string(),
                        payload: Some(json!({ "action": "open_mission" })),
                    }],
                });
            }
        }
    }

    issues
}

fn map_db_creation_error(context: &str, e: &sqlx::Error) -> serde_json::Value {
    let mut user_message = context.to_string();

    if let Some(db) = e.as_database_error() {
        if let Some(code) = db.code() {
            // 23505 = unique_violation
            if code == "23505" {
                if let Some(constraint) = db.constraint() {
                    let c = constraint.to_lowercase();
                    if c.contains("email") {
                        user_message = "Email déjà utilisé".to_string();
                    } else if c.contains("username") {
                        user_message = "Nom d’utilisateur déjà utilisé".to_string();
                    } else if c.contains("matricule") {
                        user_message = "Matricule déjà utilisé".to_string();
                    } else if c.contains("mission") && c.contains("code") {
                        user_message = "Une mission avec ce code existe déjà".to_string();
                    }
                } else {
                    user_message = "Valeur déjà existante".to_string();
                }
            }

            // 23503 = foreign_key_violation
            if code == "23503" {
                user_message = "Référence invalide (objet lié introuvable)".to_string();
            }

            // 23502 = not_null_violation
            if code == "23502" {
                user_message = "Champ requis manquant".to_string();
            }

            // 23514 = check_violation
            if code == "23514" {
                user_message = "Valeur invalide (contrainte)".to_string();
            }
        }
    }

    json!({ "error": user_message, "details": e.to_string() })
}

fn sanitize_username_base(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.chars() {
        if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
            out.push(c);
        } else {
            out.push('_');
        }
        if out.len() >= 50 {
            break;
        }
    }
    let out = out.trim_matches('_').to_string();
    if out.len() < 3 {
        "user".to_string()
    } else {
        out
    }
}

async fn ensure_unique_username(
    tx: &mut Transaction<'_, Postgres>,
    base: &str,
) -> Result<String, sqlx::Error> {
    let mut candidate = sanitize_username_base(base);
    loop {
        let exists: Option<(Uuid,)> = sqlx::query_as(r#"SELECT id FROM atlas.users WHERE username = $1"#)
            .bind(&candidate)
            .fetch_optional(&mut **tx)
            .await?;

        if exists.is_none() {
            return Ok(candidate);
        }

        let suffix = Uuid::new_v4().to_string();
        let suffix = suffix.split('-').next().unwrap_or("x");
        let mut trimmed = candidate;
        if trimmed.len() > 41 {
            trimmed.truncate(41);
        }
        candidate = format!("{}_{}", trimmed, suffix);
    }
}

/// Crée le routeur pour les routes Colab
pub fn colab_routes() -> Router<AppState> {
    Router::new()
        // Missions
        .route("/colab/missions", get(list_missions).post(create_mission))
        .route("/colab/missions/:id", get(get_mission).put(update_mission).delete(delete_mission))
        .route("/colab/missions/:id/maille", delete(unassign_mission_maille))
        .route("/colab/missions/:id/reassign", post(reassign_mission))
        .route("/colab/missions/:id/resolve-conflict", post(resolve_conflict))
        .route("/colab/missions/stats", get(get_stats))
        .route("/colab/mailles/:id/missions", get(get_maille_active_missions))
        .route("/colab/mailles/:id/state", get(get_maille_state))
        // Documents
        .route("/colab/documents", get(list_documents).post(upload_document))
        .route("/colab/documents/:id", delete(delete_document))
        .route("/colab/documents/:id/download", get(download_document))
        // Suggest (autocomplétion)
        .route("/colab/mailles/suggest", get(suggest_mailles))
        .route("/colab/mailles/resolve", get(resolve_maille))
        .route("/colab/communes/suggest", get(suggest_communes))
        .route("/colab/regions/suggest", get(suggest_regions))
        .route("/colab/students/suggest", get(suggest_students))
        .route("/colab/supervisors/suggest", get(suggest_supervisors))
        // Superviseurs
        .route("/colab/supervisors", get(list_supervisors).post(create_supervisor))
        .route(
            "/colab/supervisors/:id",
            get(get_supervisor).put(update_supervisor).delete(delete_supervisor),
        )
        // Étudiants
        .route("/colab/students", get(list_students).post(create_student))
        .route("/colab/students/duplicates", get(list_student_duplicates))
        .route("/colab/students/:id/stats", get(get_student_stats))
        .route(
            "/colab/students/:id",
            get(get_student).put(update_student).delete(delete_student),
        )
        .route(
            "/colab/students/:id/prefs",
            get(get_student_prefs).put(update_student_prefs),
        )
        // Notifications email (orchestrées par script local)
        .route("/colab/notify/jobs", get(list_notify_jobs).post(create_notify_job))
        .route("/colab/notify/jobs/:id", get(get_notify_job))
        .route("/colab/notify/jobs/:id/cancel", post(cancel_notify_job))
        // Attributions & Notifications (mailles ↔ étudiants)
        .route("/colab/attributions/summary", get(get_attributions_summary))
        .route("/colab/attributions", get(list_attributions))
        .route("/colab/attributions/assign", post(assign_attribution))
        // Alias API "stable" (Phase B2): assign/unassign
        .route("/colab/assign", post(assign_attribution))
        .route("/colab/assign/:id", delete(unassign_assignment))
        .route("/colab/attributions/notify", post(enqueue_attributions_notifications))
        .route("/colab/attributions/notifications/history", get(list_attributions_notification_history))
}

// ============================================================================
// Handlers Resolve Maille
// ============================================================================

/// GET /colab/mailles/resolve?lat=..&lon=..
async fn resolve_maille(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let lat: f64 = params
        .get("lat")
        .and_then(|s| s.parse::<f64>().ok())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({ "error": "lat requis" }))))?;
    let lon: f64 = params
        .get("lon")
        .and_then(|s| s.parse::<f64>().ok())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({ "error": "lon requis" }))))?;

    // atlas.mailles.geom est en SRID 25231 dans la base. Les coordonnées du navigateur sont en WGS84 (4326).
    // On transforme le point dans le SRID des mailles pour éviter un mismatch SRID (erreur PostGIS).
    let row = sqlx::query(
        r#"
        SELECT
            id,
            code,
            NULL::text AS adm1_name,
            adm2_name,
            NULL::text AS adm3_name
        FROM atlas.mailles
        WHERE ST_Contains(
            geom,
            ST_Transform(ST_SetSRID(ST_Point($1, $2), 4326), 25231)
        )
        LIMIT 1
        "#,
    )
    .bind(lon)
    .bind(lat)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    let Some(row) = row else {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Aucune maille trouvée" }))));
    };

    Ok(Json(json!({
        "id": row.get::<Uuid, _>("id"),
        "code": row.get::<String, _>("code"),
        "adm1_name": row.try_get::<String, _>("adm1_name").ok(),
        "adm2_name": row.try_get::<String, _>("adm2_name").ok(),
        "adm3_name": row.try_get::<String, _>("adm3_name").ok(),
    })))
}

// ============================================================================
// Handlers Attributions & Notifications
// ============================================================================

#[derive(Debug, Clone, serde::Deserialize)]
struct AttributionsQuery {
    student: Option<String>,
    notif_status: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Clone, serde::Deserialize)]
struct EnqueueAttributionsNotificationsRequest {
    assignment_ids: Vec<Uuid>,
    include_bbox: Option<bool>,
    include_instructions: Option<bool>,
}

async fn get_attributions_summary(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    // Source de vérité: missions + affectations de mission (pas uniquement colab_student_prefs)
    let total_missions: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM atlas.colab_missions WHERE deleted_at IS NULL AND maille_id IS NOT NULL",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let total_students: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM atlas.colab_students WHERE deleted_at IS NULL",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    // Couverture (missions réellement affectées à un étudiant via colab_mission_assignments)
    let missions_with_student: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT mission_id) FROM atlas.v_colab_mission_attributions WHERE student_uuid IS NOT NULL",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    // Attributions “sync” (lignes ayant un assignment_id, donc notifiables)
    let total_assignments: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM atlas.v_colab_mission_attributions WHERE assignment_id IS NOT NULL",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let pending_notifications: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM atlas.v_colab_mission_attributions
        WHERE assignment_id IS NOT NULL
          AND COALESCE(notification_status, 'never') = 'pending'
        "#,
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    Ok(Json(json!({
        "total_missions": total_missions,
        "total_students": total_students,
        "missions_with_student": missions_with_student,
        "total_assignments": total_assignments,
        "pending_notifications": pending_notifications
    })))
}

async fn list_attributions(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<AttributionsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let limit = query.limit.unwrap_or(200).max(1).min(1000);
    let mut conditions: Vec<String> = vec!["1=1".to_string()];

    if let Some(student) = query.student {
        let s = student.replace('\'', "''");
        conditions.push(format!(
            "(v.full_name ILIKE '%{0}%' OR v.email ILIKE '%{0}%' OR COALESCE(v.student_id,'') ILIKE '%{0}%' OR v.maille_code ILIKE '%{0}%' OR v.mission_code ILIKE '%{0}%')",
            s
        ));
    }
    if let Some(notif_status) = query.notif_status {
        let st = notif_status.replace('\'', "''");
        // Statut dérivé:
        // - unassigned: pas d'étudiant affecté à la mission
        // - skipped: étudiant affecté mais non notifiable (attribution maille manquante / prefs incomplètes)
        // - never: assignment_id présent mais jamais notifié
        conditions.push(format!(
            "(CASE WHEN v.assignment_id IS NULL AND v.student_uuid IS NULL THEN 'unassigned' WHEN v.assignment_id IS NULL THEN 'skipped' ELSE COALESCE(v.notification_status, 'never') END) = '{}'",
            st
        ));
    }

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        r#"
        SELECT
            v.mission_id,
            v.mission_code,
            v.mission_title,
            v.mission_status,
            v.maille_id,
            v.maille_code,
            v.student_uuid,
            v.student_id,
            v.full_name,
            v.email,
            v.assignment_id,
            v.adm_code_used,
            v.pref_rank_used,
            v.assigned_at,
            CASE
              WHEN v.assignment_id IS NULL AND v.student_uuid IS NULL THEN 'unassigned'
              WHEN v.assignment_id IS NULL THEN 'skipped'
              ELSE COALESCE(v.notification_status, 'never')
            END AS notification_status,
            v.notification_requested_at,
            v.notification_sent_at,
            v.notification_error
        FROM atlas.v_colab_mission_attributions v
        WHERE {}
        ORDER BY v.assigned_at DESC NULLS LAST
        LIMIT {}
        "#,
        where_clause,
        limit
    );

    let rows = sqlx::query(&sql)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let assignment_id: Option<Uuid> = r.try_get::<Uuid, _>("assignment_id").ok();
            let student_uuid: Option<Uuid> = r.try_get::<Uuid, _>("student_uuid").ok();
            let email: Option<String> = r.try_get::<String, _>("email").ok();
            let notification_status: String = r.get::<String, _>("notification_status");
            let notification_error: Option<String> = r.try_get::<String, _>("notification_error").ok();

            let (attribution_status, status_reason) = if assignment_id.is_none() {
                if student_uuid.is_some() {
                    (
                        "assigned_not_notifiable",
                        Some("Étudiant affecté mais non notifiable (attribution maille manquante / prefs incomplètes)"),
                    )
                } else {
                    (
                        "unassigned",
                        Some("Aucun étudiant affecté à la mission"),
                    )
                }
            } else if email.as_ref().map(|s| s.trim().is_empty()).unwrap_or(true) {
                (
                    "assigned_not_notifiable",
                    Some("Étudiant affecté mais email manquant"),
                )
            } else if notification_status == "sent" {
                ("notified", Some("Notification déjà envoyée"))
            } else if notification_status == "failed" {
                ("error", Some("Dernier envoi en échec"))
            } else if notification_status == "pending" {
                ("notifiable", Some("Notification en attente (job en cours)"))
            } else if notification_error.is_some() {
                ("error", Some("Erreur notification"))
            } else {
                ("notifiable", Some("Prêt à notifier"))
            };

            json!({
                "mission_id": r.get::<Uuid, _>("mission_id"),
                "mission_code": r.get::<String, _>("mission_code"),
                "mission_title": r.get::<String, _>("mission_title"),
                "mission_status": r.get::<String, _>("mission_status"),
                "maille_id": r.get::<Uuid, _>("maille_id"),
                "maille_code": r.get::<String, _>("maille_code"),
                "student_uuid": student_uuid,
                "student_id": r.try_get::<String, _>("student_id").ok(),
                "full_name": r.try_get::<String, _>("full_name").ok(),
                "email": email,
                "assignment_id": assignment_id,
                "adm_code_used": r.try_get::<String, _>("adm_code_used").ok(),
                "pref_rank_used": r.try_get::<i32, _>("pref_rank_used").ok(),
                "assigned_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("assigned_at").ok(),
                "notification_status": notification_status,
                "notification_requested_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("notification_requested_at").ok(),
                "notification_sent_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("notification_sent_at").ok(),
                "notification_error": notification_error,

                "attribution_status": attribution_status,
                "status_reason": status_reason,
            })
        })
        .collect();

    Ok(Json(json!({ "items": items, "total": items.len() })))
}

async fn enqueue_attributions_notifications(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<EnqueueAttributionsNotificationsRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    if req.assignment_ids.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "assignment_ids requis" }))));
    }

    let params = json!({
        "assignment_ids": req.assignment_ids,
        "options": {
            "include_bbox": req.include_bbox.unwrap_or(true),
            "include_instructions": req.include_instructions.unwrap_or(true)
        }
    });

    let job_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_email_jobs (job_type, status, created_by, params)
        VALUES ('maille_bbox_gmail', 'pending', $1, $2)
        RETURNING id
        "#,
    )
    .bind(auth.id)
    .bind(&params)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur création job: {}", e) }))))?;

    // Logs par assignment
    for aid in &req.assignment_ids {
        let _ = sqlx::query(
            r#"
            INSERT INTO atlas.colab_maille_notification_logs (
                assignment_id, email_job_id, status, options, requested_by
            ) VALUES ($1, $2, 'pending', $3, $4)
            "#,
        )
        .bind(aid)
        .bind(job_id)
        .bind(json!({
            "include_bbox": req.include_bbox.unwrap_or(true),
            "include_instructions": req.include_instructions.unwrap_or(true)
        }))
        .bind(auth.id)
        .execute(&state.pool)
        .await;
    }

    // Job log
    let _ = sqlx::query(
        r#"
        INSERT INTO atlas.colab_email_job_logs (job_id, level, message, details)
        VALUES ($1, 'info', 'Attributions enqueued', $2)
        "#,
    )
    .bind(job_id)
    .bind(&params)
    .execute(&state.pool)
    .await;

    Ok(Json(json!({ "success": true, "job_id": job_id })))
}

async fn list_attributions_notification_history(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let rows = sqlx::query(
        r#"
        SELECT
            l.id,
            l.assignment_id,
            l.email_job_id,
            l.status,
            l.options,
            l.requested_at,
            l.sent_at,
            l.error,
            d.student_id,
            d.full_name,
            d.email,
            d.maille_code
        FROM atlas.colab_maille_notification_logs l
        JOIN atlas.v_colab_mission_attributions d ON d.assignment_id = l.assignment_id
        ORDER BY l.requested_at DESC
        LIMIT 500
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<Uuid, _>("id"),
                "assignment_id": r.get::<Uuid, _>("assignment_id"),
                "email_job_id": r.try_get::<Uuid, _>("email_job_id").ok(),
                "status": r.get::<String, _>("status"),
                "options": r.get::<serde_json::Value, _>("options"),
                "requested_at": r.get::<chrono::DateTime<chrono::Utc>, _>("requested_at"),
                "sent_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("sent_at").ok(),
                "error": r.try_get::<String, _>("error").ok(),
                "student_id": r.get::<String, _>("student_id"),
                "full_name": r.get::<String, _>("full_name"),
                "email": r.try_get::<String, _>("email").ok(),
                "maille_code": r.get::<String, _>("maille_code"),
            })
        })
        .collect();

    Ok(Json(json!({ "items": items, "total": items.len() })))
}

// ============================================================================
// Handlers Notifier (Email Jobs)
// ============================================================================

#[derive(Debug, Clone, serde::Deserialize)]
struct NotifyJobsQuery {
    limit: Option<i64>,
}

#[derive(Debug, Clone, serde::Deserialize)]
struct CreateNotifyJobRequest {
    job_type: Option<String>,
    params: Option<serde_json::Value>,
}

async fn cancel_notify_job(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(job_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let res = sqlx::query(
        r#"
        UPDATE atlas.colab_email_jobs
        SET status = 'cancelled', finished_at = NOW(), error = NULL
        WHERE id = $1 AND status = 'pending'
        "#,
    )
    .bind(job_id)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "Job non annulable (statut non pending ou introuvable)" }))));
    }

    let _ = sqlx::query(
        r#"
        INSERT INTO atlas.colab_email_job_logs (job_id, level, message, details)
        VALUES ($1, 'info', 'Job annulé', $2)
        "#,
    )
    .bind(job_id)
    .bind(json!({ "cancelled_by": auth.id }))
    .execute(&state.pool)
    .await;

    Ok(Json(json!({ "success": true, "job_id": job_id })))
}

// ============================================================================
// Handlers Attribution inline (unassigned -> assign)
// ============================================================================

#[derive(Debug, Clone, serde::Deserialize)]
struct AssignAttributionRequest {
    mission_id: Uuid,
    student_id: Uuid,
}

async fn assign_attribution(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<AssignAttributionRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.update") && !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    // B1: verrouillage métier
    // - mission doit avoir une maille
    // - mission doit être assignable (pas clôturée)
    // - une maille ne peut pas être occupée par 2 missions actives
    let mission_row = sqlx::query(
        r#"
        SELECT
            maille_id,
            status::text AS status
        FROM atlas.colab_missions
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(req.mission_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    let mission_row = mission_row.ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({ "error": "Mission non trouvée" })))
    })?;

    let mission_status: String = mission_row
        .try_get("status")
        .unwrap_or_else(|_| "draft".to_string());
    let maille_id: Option<Uuid> = mission_row.try_get("maille_id").ok();

    if maille_id.is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Attribution impossible: la mission n'a pas de maille" })),
        ));
    }

    if matches!(mission_status.as_str(), "completed" | "archived" | "cancelled" | "suspended") {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("Attribution impossible: mission '{}'", mission_status) })),
        ));
    }

    let maille_id = maille_id.unwrap();
    let conflict: Option<Uuid> = sqlx::query_scalar(
        r#"
        SELECT cm.id
        FROM atlas.colab_missions cm
        JOIN atlas.colab_mission_assignments a
          ON a.mission_id = cm.id
         AND a.unassigned_at IS NULL
        WHERE cm.deleted_at IS NULL
          AND cm.maille_id = $1
          AND cm.id <> $2
          AND cm.status IN ('planned'::atlas.mission_status, 'in_progress'::atlas.mission_status)
        LIMIT 1
        "#,
    )
    .bind(maille_id)
    .bind(req.mission_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    if let Some(conflict_mission_id) = conflict {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "Conflit maille: une autre mission active occupe déjà cette maille",
                "conflict_mission_id": conflict_mission_id
            })),
        ));
    }

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    // Close existing active assignment(s) for this mission (only one maille per mission anyway)
    let _ = sqlx::query(
        r#"
        UPDATE atlas.colab_mission_assignments
        SET unassigned_at = NOW()
        WHERE mission_id = $1 AND unassigned_at IS NULL
        "#,
    )
    .bind(req.mission_id)
    .execute(&mut *tx)
    .await;

    // Insert new assignment
    let assignment_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_mission_assignments (mission_id, student_id, role)
        VALUES ($1, $2, 'membre')
        RETURNING id
        "#,
    )
    .bind(req.mission_id)
    .bind(req.student_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(map_db_creation_error("Attribution impossible", &e))))?;

    // Sync derived table colab_maille_assignments from missions
    let _ = sqlx::query("SELECT atlas.sync_colab_maille_assignment_for_mission($1)")
        .bind(req.mission_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur sync attribution: {}", e) }))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    Ok(Json(json!({ "success": true, "assignment_id": assignment_id })))
}

async fn unassign_assignment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(assignment_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.update") && !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    let mission_id: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT mission_id FROM atlas.colab_mission_assignments WHERE id = $1"#,
    )
    .bind(assignment_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    let mission_id = mission_id.ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({ "error": "Affectation introuvable" })))
    })?;

    let res = sqlx::query(
        r#"
        UPDATE atlas.colab_mission_assignments
        SET unassigned_at = NOW()
        WHERE id = $1 AND unassigned_at IS NULL
        "#,
    )
    .bind(assignment_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    if res.rows_affected() == 0 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Affectation déjà clôturée" })),
        ));
    }

    let _ = sqlx::query("SELECT atlas.sync_colab_maille_assignment_for_mission($1)")
        .bind(mission_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur sync attribution: {}", e) }))))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur DB: {}", e) }))))?;

    Ok(Json(json!({ "success": true, "assignment_id": assignment_id })))
}

async fn create_notify_job(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateNotifyJobRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let job_type = req.job_type.unwrap_or_else(|| "maille_bbox_gmail".to_string());
    let params = req.params.unwrap_or_else(|| json!({}));

    let job_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO atlas.colab_email_jobs (job_type, status, created_by, params)
        VALUES ($1, 'pending', $2, $3)
        RETURNING id
        "#,
    )
    .bind(&job_type)
    .bind(auth.id)
    .bind(&params)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur création job: {}", e) })),
        )
    })?;

    sqlx::query(
        r#"
        INSERT INTO atlas.colab_email_job_logs (job_id, level, message, details)
        VALUES ($1, 'info', 'Job créé', $2)
        "#,
    )
    .bind(job_id)
    .bind(json!({ "job_type": job_type, "created_by": auth.id }))
    .execute(&state.pool)
    .await
    .ok();

    let row = sqlx::query(
        r#"
        SELECT
            id,
            job_type,
            status,
            created_by,
            created_at,
            started_at,
            finished_at,
            error,
            params
        FROM atlas.colab_email_jobs
        WHERE id = $1
        "#,
    )
    .bind(job_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur lecture job: {}", e) })),
        )
    })?;

    Ok(Json(json!({
        "job": {
            "id": row.get::<Uuid, _>("id"),
            "job_type": row.get::<String, _>("job_type"),
            "status": row.get::<String, _>("status"),
            "created_by": row.get::<Option<Uuid>, _>("created_by"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "started_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("started_at"),
            "finished_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("finished_at"),
            "error": row.get::<Option<String>, _>("error"),
            "params": row.get::<serde_json::Value, _>("params"),
        }
    })))
}

async fn list_notify_jobs(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<NotifyJobsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let limit = query.limit.unwrap_or(50).max(1).min(200);

    let rows = sqlx::query(
        r#"
        SELECT
            id,
            job_type,
            status,
            created_by,
            created_at,
            started_at,
            finished_at,
            error,
            params
        FROM atlas.colab_email_jobs
        ORDER BY created_at DESC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur listing jobs: {}", e) })),
        )
    })?;

    let jobs: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<Uuid, _>("id"),
                "job_type": row.get::<String, _>("job_type"),
                "status": row.get::<String, _>("status"),
                "created_by": row.get::<Option<Uuid>, _>("created_by"),
                "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                "started_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("started_at"),
                "finished_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("finished_at"),
                "error": row.get::<Option<String>, _>("error"),
                "params": row.get::<serde_json::Value, _>("params"),
            })
        })
        .collect();

    Ok(Json(json!({ "jobs": jobs, "total": jobs.len() })))
}

async fn get_notify_job(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(job_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.notify.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let row = sqlx::query(
        r#"
        SELECT
            id,
            job_type,
            status,
            created_by,
            created_at,
            started_at,
            finished_at,
            error,
            params
        FROM atlas.colab_email_jobs
        WHERE id = $1
        "#,
    )
    .bind(job_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Erreur lecture job: {}", e) })),
        )
    })?;

    let Some(row) = row else {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Job introuvable" }))));
    };

    let logs = sqlx::query(
        r#"
        SELECT level, message, details, created_at
        FROM atlas.colab_email_job_logs
        WHERE job_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(job_id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let logs: Vec<serde_json::Value> = logs
        .iter()
        .map(|r| {
            json!({
                "level": r.get::<String, _>("level"),
                "message": r.get::<String, _>("message"),
                "details": r.get::<serde_json::Value, _>("details"),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            })
        })
        .collect();

    Ok(Json(json!({
        "job": {
            "id": row.get::<Uuid, _>("id"),
            "job_type": row.get::<String, _>("job_type"),
            "status": row.get::<String, _>("status"),
            "created_by": row.get::<Option<Uuid>, _>("created_by"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "started_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("started_at"),
            "finished_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("finished_at"),
            "error": row.get::<Option<String>, _>("error"),
            "params": row.get::<serde_json::Value, _>("params"),
        },
        "logs": logs
    })))
}

// ============================================================================
// Handlers Documents
// ============================================================================

#[derive(Debug, Clone, serde::Deserialize)]
struct DocumentsQuery {
    mission_id: Option<Uuid>,
    sondage_id: Option<Uuid>,
    document_type: Option<String>,
}

/// GET /colab/documents?mission_id=...&document_type=...
async fn list_documents(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<DocumentsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let mut conditions = vec!["d.deleted_at IS NULL".to_string()];
    if let Some(mission_id) = params.mission_id {
        conditions.push(format!("d.mission_id = '{}'", mission_id));
    }
    if let Some(sondage_id) = params.sondage_id {
        conditions.push(format!("d.sondage_id = '{}'", sondage_id));
    }
    if let Some(document_type) = params.document_type {
        conditions.push(format!("d.document_type::TEXT = '{}'", document_type.replace('\'', "''")));
    }

    let where_clause = conditions.join(" AND ");

    let query = format!(
        r#"
        SELECT
            d.id,
            d.mission_id,
            d.uploaded_by,
            d.title,
            d.document_type::TEXT as document_type,
            d.description,
            d.file_path,
            d.file_name,
            d.file_size_bytes,
            d.mime_type,
            d.sondage_id,
            d.version,
            d.is_current,
            d.uploaded_at,
            d.notes
        FROM atlas.colab_documents d
        WHERE {}
        ORDER BY d.uploaded_at DESC
        "#,
        where_clause
    );

    let rows = sqlx::query(&query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    let documents: Vec<ColabDocument> = rows
        .iter()
        .map(|r| ColabDocument {
            id: r.get("id"),
            mission_id: r.get("mission_id"),
            uploaded_by: r.get("uploaded_by"),
            title: r.get("title"),
            document_type: r.get("document_type"),
            description: r.get("description"),
            file_path: r.get("file_path"),
            file_name: r.get("file_name"),
            file_size_bytes: r.get("file_size_bytes"),
            mime_type: r.get("mime_type"),
            sondage_id: r.get("sondage_id"),
            version: r.get("version"),
            is_current: r.get("is_current"),
            uploaded_at: r.get("uploaded_at"),
            notes: r.get("notes"),
        })
        .collect();

    Ok(Json(json!({ "documents": documents, "total": documents.len() })))
}

/// GET /colab/supervisors/:id - Détail d'un superviseur
async fn get_supervisor(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(supervisor_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.supervisors.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let row = sqlx::query(
        r#"
        SELECT
            s.id,
            s.user_id,
            u.username,
            u.email,
            COALESCE(u.first_name || ' ' || u.last_name, u.username) as full_name,
            u.telephone,
            u.is_active,
            s.specialite,
            s.institution,
            s.titre,
            s.departement,
            s.notes
        FROM atlas.colab_supervisors s
        JOIN atlas.users u ON s.user_id = u.id
        WHERE s.id = $1 AND s.deleted_at IS NULL AND u.deleted_at IS NULL
        "#,
    )
    .bind(supervisor_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur: {}", e) }))))?;

    let row = row.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "Superviseur non trouvé" }))))?;

    Ok(Json(json!({
        "id": row.get::<Uuid,_>("id"),
        "user_id": row.get::<Uuid,_>("user_id"),
        "username": row.get::<String,_>("username"),
        "email": row.get::<String,_>("email"),
        "full_name": row.get::<String,_>("full_name"),
        "telephone": row.get::<Option<String>,_>("telephone"),
        "is_active": row.get::<bool,_>("is_active"),
        "specialite": row.get::<Option<String>,_>("specialite"),
        "institution": row.get::<Option<String>,_>("institution"),
        "titre": row.get::<Option<String>,_>("titre"),
        "departement": row.get::<Option<String>,_>("departement"),
        "notes": row.get::<Option<String>,_>("notes"),
    })))
}

/// GET /colab/students/:id - Détail d'un étudiant
async fn get_student(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.students.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let row = sqlx::query(
        r#"
        SELECT
            s.id,
            s.user_id,
            u.username,
            u.email,
            COALESCE(u.first_name || ' ' || u.last_name, u.username) as full_name,
            u.telephone,
            u.is_active,
            s.matricule,
            s.promotion,
            s.filiere,
            s.etablissement,
            s.niveau,
            s.age,
            (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.student_id = s.id AND a.unassigned_at IS NULL) as active_missions,
            (
                SELECT LEAST(1, COUNT(DISTINCT cm.maille_id))
                FROM atlas.colab_mission_assignments a
                JOIN atlas.colab_missions cm ON cm.id = a.mission_id
                WHERE a.student_id = s.id
                  AND a.unassigned_at IS NULL
                  AND cm.deleted_at IS NULL
                  AND cm.maille_id IS NOT NULL
            ) as active_mailles
        FROM atlas.colab_students s
        JOIN atlas.users u ON s.user_id = u.id
        WHERE s.id = $1 AND s.deleted_at IS NULL AND u.deleted_at IS NULL
        "#,
    )
    .bind(student_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur: {}", e) }))))?;

    let row = row.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "Étudiant non trouvé" }))))?;

    Ok(Json(json!({
        "id": row.get::<Uuid,_>("id"),
        "user_id": row.get::<Uuid,_>("user_id"),
        "username": row.get::<String,_>("username"),
        "email": row.get::<String,_>("email"),
        "full_name": row.get::<String,_>("full_name"),
        "telephone": row.get::<Option<String>,_>("telephone"),
        "is_active": row.get::<bool,_>("is_active"),
        "matricule": row.get::<Option<String>,_>("matricule"),
        "promotion": row.get::<String,_>("promotion"),
        "filiere": row.get::<Option<String>,_>("filiere"),
        "etablissement": row.get::<Option<String>,_>("etablissement"),
        "niveau": row.get::<Option<String>,_>("niveau"),
        "age": row.get::<Option<i32>,_>("age"),
        "active_missions": row.get::<i64,_>("active_missions"),
        "active_mailles": row.get::<i64,_>("active_mailles"),
    })))
}

/// GET /colab/students - Liste des étudiants
async fn list_students(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<StudentsListQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.students.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let audit_mode = query.audit_mode.unwrap_or(false);
    let include_deleted = audit_mode || query.include_deleted.unwrap_or(false);
    let include_inactive = audit_mode || query.include_inactive.unwrap_or(false);

    let mut conditions: Vec<String> = vec!["1=1".to_string()];
    if !include_deleted {
        conditions.push("s.deleted_at IS NULL".to_string());
        conditions.push("u.deleted_at IS NULL".to_string());
    }
    if !include_inactive {
        conditions.push("u.is_active = TRUE".to_string());
    }
    let where_clause = conditions.join(" AND ");

    let sql = format!(
        r#"
        SELECT 
            s.id,
            s.user_id,
            u.username,
            u.email,
            COALESCE(u.first_name || ' ' || u.last_name, u.username) as full_name,
            u.telephone,
            s.deleted_at as student_deleted_at,
            u.deleted_at as user_deleted_at,
            s.matricule,
            s.promotion,
            s.filiere,
            s.etablissement,
            s.niveau,
            s.age,
            u.is_active,
            (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.student_id = s.id AND a.unassigned_at IS NULL) as active_missions,
            (
                SELECT LEAST(1, COUNT(DISTINCT cm.maille_id))
                FROM atlas.colab_mission_assignments a
                JOIN atlas.colab_missions cm ON cm.id = a.mission_id
                WHERE a.student_id = s.id
                  AND a.unassigned_at IS NULL
                  AND cm.deleted_at IS NULL
                  AND cm.maille_id IS NOT NULL
            ) as active_mailles
        FROM atlas.colab_students s
        JOIN atlas.users u ON s.user_id = u.id
        WHERE {}
        ORDER BY s.promotion DESC, full_name
        "#,
        where_clause
    );

    let rows = sqlx::query(&sql)
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
                "telephone": r.get::<Option<String>, _>("telephone"),
                "deleted_at": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("student_deleted_at"),
                "user_deleted_at": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("user_deleted_at"),
                "matricule": r.get::<Option<String>, _>("matricule"),
                "promotion": r.get::<String, _>("promotion"),
                "filiere": r.get::<Option<String>, _>("filiere"),
                "etablissement": r.get::<Option<String>, _>("etablissement"),
                "niveau": r.get::<Option<String>, _>("niveau"),
                "age": r.get::<Option<i32>, _>("age"),
                "is_active": r.get::<bool, _>("is_active"),
                "active_missions": r.get::<i64, _>("active_missions"),
                "active_mailles": r.get::<i64, _>("active_mailles"),
            })
        })
        .collect();

    Ok(Json(json!({ "students": students, "total": students.len() })))
}

async fn list_student_duplicates(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.students.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let rows = sqlx::query(
        r#"
        SELECT
            u.telephone,
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
            s.age,
            u.is_active,
            (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.student_id = s.id AND a.unassigned_at IS NULL) as active_missions,
            (
                SELECT LEAST(1, COUNT(DISTINCT cm.maille_id))
                FROM atlas.colab_mission_assignments a
                JOIN atlas.colab_missions cm ON cm.id = a.mission_id
                WHERE a.student_id = s.id
                  AND a.unassigned_at IS NULL
                  AND cm.deleted_at IS NULL
                  AND cm.maille_id IS NOT NULL
            ) as active_mailles
        FROM atlas.colab_students s
        JOIN atlas.users u ON s.user_id = u.id
        JOIN (
            SELECT telephone
            FROM atlas.users
            WHERE deleted_at IS NULL
              AND telephone IS NOT NULL
              AND BTRIM(telephone) <> ''
            GROUP BY telephone
            HAVING COUNT(*) > 1
        ) dup ON dup.telephone = u.telephone
        WHERE s.deleted_at IS NULL
          AND u.deleted_at IS NULL
        ORDER BY u.telephone, full_name
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Erreur: {}", e) }))))?;

    let mut map: std::collections::BTreeMap<String, Vec<serde_json::Value>> = std::collections::BTreeMap::new();
    for r in rows.iter() {
        let tel: String = r.get("telephone");
        let item = json!({
            "id": r.get::<Uuid, _>("id"),
            "user_id": r.get::<Uuid, _>("user_id"),
            "username": r.get::<String, _>("username"),
            "email": r.get::<String, _>("email"),
            "full_name": r.get::<String, _>("full_name"),
            "telephone": Some(tel.clone()),
            "matricule": r.get::<Option<String>, _>("matricule"),
            "promotion": r.get::<String, _>("promotion"),
            "filiere": r.get::<Option<String>, _>("filiere"),
            "etablissement": r.get::<Option<String>, _>("etablissement"),
            "niveau": r.get::<Option<String>, _>("niveau"),
            "age": r.get::<Option<i32>, _>("age"),
            "is_active": r.get::<bool, _>("is_active"),
            "active_missions": r.get::<i64, _>("active_missions"),
            "active_mailles": r.get::<i64, _>("active_mailles"),
        });
        map.entry(tel).or_default().push(item);
    }

    let groups: Vec<serde_json::Value> = map
        .into_iter()
        .map(|(telephone, students)| json!({ "telephone": telephone, "students": students }))
        .collect();

    Ok(Json(json!(groups)))
}

async fn get_student_stats(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.students.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Permission refusée" }))));
    }

    let exists: Option<i64> = sqlx::query_scalar(
        r#"
        SELECT 1::bigint
        FROM atlas.colab_students s
        JOIN atlas.users u ON u.id = s.user_id
        WHERE s.id = $1
          AND s.deleted_at IS NULL
          AND u.deleted_at IS NULL
        "#,
    )
    .bind(student_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Étudiant non trouvé" }))));
    }

    let active_missions: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM atlas.colab_mission_assignments a
        WHERE a.student_id = $1
          AND a.unassigned_at IS NULL
        "#,
    )
    .bind(student_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let active_mailles: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(DISTINCT cm.maille_id)
        FROM atlas.colab_mission_assignments a
        JOIN atlas.colab_missions cm ON cm.id = a.mission_id
        WHERE a.student_id = $1
          AND a.unassigned_at IS NULL
          AND cm.deleted_at IS NULL
          AND cm.maille_id IS NOT NULL
        "#,
    )
    .bind(student_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let rows = sqlx::query(
        r#"
        SELECT
          m.id AS maille_id,
          m.code AS maille_code,
          m.spatial_id AS spatial_id,
          cm.title AS mission_title,
          a.assigned_at AS assigned_at
        FROM atlas.colab_mission_assignments a
        JOIN atlas.colab_missions cm ON cm.id = a.mission_id
        JOIN atlas.mailles m ON m.id = cm.maille_id
        WHERE a.student_id = $1
          AND a.unassigned_at IS NULL
          AND cm.deleted_at IS NULL
          AND cm.maille_id IS NOT NULL
        ORDER BY a.assigned_at DESC
        "#,
    )
    .bind(student_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    let mailles_detail: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "maille_id": r.get::<Uuid, _>("maille_id"),
                "maille_code": r.get::<String, _>("maille_code"),
                "spatial_id": r.get::<Option<String>, _>("spatial_id"),
                "mission_title": r.get::<String, _>("mission_title"),
                "assigned_at": r.get::<chrono::DateTime<chrono::Utc>, _>("assigned_at"),
            })
        })
        .collect();

    Ok(Json(json!({
        "student_id": student_id,
        "active_missions": active_missions,
        "active_mailles": active_mailles,
        "mailles_detail": mailles_detail,
    })))
}

// ============================================================================
// Handlers Documents (upload/download/delete) - restaurés
// ============================================================================

/// POST /colab/documents (multipart)
async fn upload_document(
    State(state): State<AppState>,
    auth: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.update") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let mut mission_id: Option<Uuid> = None;
    let mut title: Option<String> = None;
    let mut document_type: Option<String> = None;
    let mut description: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;
    let mut mime_type: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("Multipart invalide: {}", e)}))))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            file_name = field.file_name().map(|s| s.to_string());
            mime_type = field.content_type().map(|s| s.to_string());
            let bytes = field
                .bytes()
                .await
                .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("Fichier invalide: {}", e)}))))?;
            file_bytes = Some(bytes.to_vec());
        } else {
            let value = field
                .text()
                .await
                .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("Champ invalide: {}", e)}))))?;
            match name.as_str() {
                "mission_id" => {
                    mission_id = value.parse::<Uuid>().ok();
                }
                "title" => title = Some(value),
                "document_type" => document_type = Some(value),
                "description" => description = Some(value),
                _ => {}
            }
        }
    }

    let mission_id = mission_id.ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"error":"mission_id requis"})))
    })?;
    let title = title.unwrap_or_default();
    if title.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"title requis"}))));
    }
    let document_type = document_type.unwrap_or_else(|| "autre".to_string());
    let file_bytes = file_bytes.ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"error":"file requis"})))
    })?;

    // vérifier mission non supprimée
    let exists: Option<(Uuid,)> = sqlx::query_as(
        r#"SELECT id FROM atlas.colab_missions WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(mission_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur DB: {}", e)}))))?;

    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Mission non trouvée"}))));
    }

    let doc_id = Uuid::new_v4();
    let stored_name = format!("{}_{}", doc_id, file_name.clone().unwrap_or_else(|| "document".to_string()));
    let storage_dir = "./data/colab_documents";
    fs::create_dir_all(storage_dir)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur storage: {}", e)}))))?;
    let file_path = format!("{}/{}", storage_dir, stored_name);
    let mut f = fs::File::create(&file_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur écriture: {}", e)}))))?;
    f.write_all(&file_bytes)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur écriture: {}", e)}))))?;

    sqlx::query(
        r#"
        INSERT INTO atlas.colab_documents (
          id, mission_id, uploaded_by, title, document_type, description,
          file_path, file_name, file_size_bytes, mime_type, is_current, version, uploaded_at
        ) VALUES (
          $1, $2, $3, $4, $5::atlas.document_type, $6,
          $7, $8, $9, $10, TRUE, 1, NOW()
        )
        "#,
    )
    .bind(doc_id)
    .bind(mission_id)
    .bind(auth.id)
    .bind(title.trim())
    .bind(&document_type)
    .bind(description.as_deref())
    .bind(&file_path)
    .bind(file_name.clone().unwrap_or_else(|| stored_name.clone()))
    .bind(file_bytes.len() as i64)
    .bind(mime_type.as_deref())
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error":"Upload impossible", "details": e.to_string()}))))?;

    Ok(Json(json!({"success": true, "id": doc_id})))
}

/// GET /colab/documents/:id/download
async fn download_document(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(document_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let row = sqlx::query(
        r#"SELECT file_path, file_name, mime_type FROM atlas.colab_documents WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(document_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    let row = row.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error":"Document non trouvé"}))))?;
    let file_path: String = row.get("file_path");
    let file_name: String = row.get("file_name");
    let mime_type: Option<String> = row.get("mime_type");

    let bytes = fs::read(&file_path)
        .await
        .map_err(|e| (StatusCode::NOT_FOUND, Json(json!({"error": format!("Fichier introuvable: {}", e)}))))?;

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"{}\"", file_name)
            .parse()
            .unwrap(),
    );
    headers.insert(
        header::CONTENT_TYPE,
        mime_type
            .unwrap_or_else(|| "application/octet-stream".to_string())
            .parse()
            .unwrap(),
    );

    Ok((headers, bytes))
}

/// DELETE /colab/documents/:id - soft delete
async fn delete_document(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(document_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.update") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let res = sqlx::query(
        r#"UPDATE atlas.colab_documents SET deleted_at = NOW(), is_current = FALSE WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(document_id)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Document non trouvé"}))));
    }

    Ok(Json(json!({"success": true, "deleted": document_id})))
}

// ============================================================================
// Suggest (autocomplétion) - restauré
// ============================================================================

/// GET /colab/mailles/suggest?q=TG-0
async fn suggest_mailles(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<MailleSuggestItem>>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let q = params.get("q").cloned().unwrap_or_default();
    let q = format!("%{}%", q);

    let rows = sqlx::query(
        r#"
        SELECT
            id,
            code,
            NULL::text AS adm1_name,
            adm2_name,
            NULL::text AS adm3_name
        FROM atlas.mailles
        WHERE code ILIKE $1
        ORDER BY code
        LIMIT 10
        "#,
    )
    .bind(&q)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    let out = rows
        .iter()
        .map(|r| MailleSuggestItem {
            id: r.get("id"),
            code: r.get("code"),
            adm1_name: r.try_get("adm1_name").ok(),
            adm2_name: r.try_get("adm2_name").ok(),
            adm3_name: r.try_get("adm3_name").ok(),
        })
        .collect();

    Ok(Json(out))
}

#[derive(Debug, serde::Deserialize)]
struct SuggestTextQuery {
    q: String,
}

/// GET /colab/communes/suggest?q=lom
async fn suggest_communes(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<SuggestTextQuery>,
) -> Result<Json<Vec<String>>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }
    let q = format!("%{}%", params.q);
    let rows = sqlx::query_scalar(
        r#"
        SELECT DISTINCT commune
        FROM atlas.colab_missions
        WHERE deleted_at IS NULL
          AND commune IS NOT NULL
          AND commune ILIKE $1
        ORDER BY commune
        LIMIT 10
        "#,
    )
    .bind(&q)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    Ok(Json(rows.into_iter().filter_map(|x: Option<String>| x).collect()))
}

/// GET /colab/regions/suggest?q=mar
async fn suggest_regions(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<SuggestTextQuery>,
) -> Result<Json<Vec<String>>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }
    let q = format!("%{}%", params.q);
    let rows = sqlx::query_scalar(
        r#"
        SELECT DISTINCT region
        FROM atlas.colab_missions
        WHERE deleted_at IS NULL
          AND region IS NOT NULL
          AND region ILIKE $1
        ORDER BY region
        LIMIT 10
        "#,
    )
    .bind(&q)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    Ok(Json(rows.into_iter().filter_map(|x: Option<String>| x).collect()))
}

/// GET /colab/students/suggest?q=jo
async fn suggest_students(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<UserSuggestItem>>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let q = params.get("q").cloned().unwrap_or_default();
    let q = format!("%{}%", q);

    let rows = sqlx::query(
        r#"
        SELECT s.id, COALESCE(u.first_name || ' ' || u.last_name, u.username) AS full_name,
               s.promotion
        FROM atlas.colab_students s
        JOIN atlas.users u ON s.user_id = u.id
        WHERE u.is_active = TRUE
          AND u.deleted_at IS NULL
          AND s.deleted_at IS NULL
          AND (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.username ILIKE $1)
        ORDER BY full_name
        LIMIT 10
        "#,
    )
    .bind(&q)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    let out = rows
        .iter()
        .map(|r| {
            let id: Uuid = r.get("id");
            let full_name: String = r.get("full_name");
            let promotion: Option<String> = r.get("promotion");
            let label = if let Some(p) = promotion {
                format!("{} ({})", full_name, p)
            } else {
                full_name
            };
            UserSuggestItem { id, label }
        })
        .collect();

    Ok(Json(out))
}

/// GET /colab/supervisors/suggest?q=al
async fn suggest_supervisors(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<UserSuggestItem>>, (StatusCode, Json<serde_json::Value>)> {
    if !auth.has_permission("colab.missions.create") {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Permission refusée"}))));
    }

    let q = params.get("q").cloned().unwrap_or_default();
    let q = format!("%{}%", q);

    let rows = sqlx::query(
        r#"
        SELECT s.id, COALESCE(u.first_name || ' ' || u.last_name, u.username) AS full_name
        FROM atlas.colab_supervisors s
        JOIN atlas.users u ON s.user_id = u.id
        WHERE u.is_active = TRUE
          AND u.deleted_at IS NULL
          AND s.deleted_at IS NULL
          AND (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.username ILIKE $1)
        ORDER BY full_name
        LIMIT 10
        "#,
    )
    .bind(&q)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur: {}", e)}))))?;

    let out = rows
        .iter()
        .map(|r| UserSuggestItem {
            id: r.get("id"),
            label: r.get::<String, _>("full_name"),
        })
        .collect();

    Ok(Json(out))
}
