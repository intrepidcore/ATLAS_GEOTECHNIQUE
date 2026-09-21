//! Endpoints Atlas Colab pour le système `.atlaspack` : statut/génération/
//! téléchargement des paquets opérateur, réimport des `.atlasreturn`.
//!
//! Toutes les routes sont réservées au personnel Colab (permissions
//! `colab.missions.*`) — un opérateur/étudiant ne voit jamais, via cette
//! API, le paquet d'un autre opérateur. L'endpoint de statut de retour est
//! la seule exception : un opérateur peut vérifier l'état de SON PROPRE
//! export (`operator_user_id = auth.id`), pour permettre au mobile de
//! passer localement de l'état "exporté" à "importé au bureau" dès qu'il
//! retrouve un réseau — sans jamais rendre cela obligatoire (V1 reste
//! fonctionnelle 100% hors-ligne sans jamais appeler cet endpoint).

use axum::{
    body::Bytes,
    extract::{Multipart, Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::state::AppState;

use super::jobs::enqueue_or_refresh_package_for_student;
use super::returns::import_atlasreturn;

type ApiError = (StatusCode, Json<Value>);

fn forbidden() -> ApiError {
    (
        StatusCode::FORBIDDEN,
        Json(json!({"error": "Permission refusée"})),
    )
}

fn require_staff(auth: &AuthUser) -> Result<(), ApiError> {
    if auth.has_permission("colab.missions.read") || auth.has_permission("colab.missions.update") {
        Ok(())
    } else {
        Err(forbidden())
    }
}

fn require_staff_write(auth: &AuthUser) -> Result<(), ApiError> {
    if auth.has_permission("colab.missions.update") || auth.has_permission("colab.missions.create") {
        Ok(())
    } else {
        Err(forbidden())
    }
}

fn db_error(e: sqlx::Error) -> ApiError {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": e.to_string()})),
    )
}

#[derive(Deserialize)]
struct ListQuery {
    status: Option<String>,
}

const PACKAGE_JSON_SQL: &str = r#"
    SELECT jsonb_build_object(
        'id', p.id,
        'operator_user_id', p.operator_user_id,
        'student_id', p.student_id,
        'operator_email', u.email,
        'operator_name', TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')),
        'matricule', cs.matricule,
        'status', p.status,
        'format_version', p.format_version,
        'schema_version', p.schema_version,
        'mission_ids', p.mission_ids,
        'mission_count', COALESCE(array_length(p.mission_ids, 1), 0),
        'generated_at', p.generated_at,
        'expires_at', p.expires_at,
        'signing_key_id', p.signing_key_id,
        'package_sha256', p.package_sha256,
        'file_size_bytes', p.file_size_bytes,
        'tile_count', p.tile_count,
        'tile_zoom_min', p.tile_zoom_min,
        'tile_zoom_max', p.tile_zoom_max,
        'tiles_truncated', p.tiles_truncated,
        'tiles_truncation_reason', p.tiles_truncation_reason,
        'error', p.error,
        'created_at', p.created_at,
        'updated_at', p.updated_at
    )
    FROM atlas.atlaspack_packages p
    JOIN atlas.users u ON u.id = p.operator_user_id
    LEFT JOIN atlas.colab_students cs ON cs.id = p.student_id
"#;

/// GET /colab/atlaspack/packages — vue d'ensemble pour le personnel Colab.
async fn list_packages(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> Result<Json<Value>, ApiError> {
    require_staff(&auth)?;
    let sql = if q.status.is_some() {
        format!("{PACKAGE_JSON_SQL} WHERE p.status = $1 ORDER BY p.updated_at DESC")
    } else {
        format!("{PACKAGE_JSON_SQL} ORDER BY p.updated_at DESC")
    };
    let items: Vec<Value> = if let Some(status) = &q.status {
        sqlx::query_scalar(&sql).bind(status).fetch_all(&state.pool).await
    } else {
        sqlx::query_scalar(&sql).fetch_all(&state.pool).await
    }
    .map_err(db_error)?;
    Ok(Json(json!({"items": items, "total": items.len()})))
}

/// GET /colab/atlaspack/students/:student_id/package — statut courant pour un opérateur.
async fn get_package_for_student(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(student_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    require_staff(&auth)?;
    let sql = format!(
        "{PACKAGE_JSON_SQL} WHERE p.student_id = $1 AND p.status IN ('not_prepared','preparing','ready','stale','failed') ORDER BY p.created_at DESC LIMIT 1"
    );
    let item: Option<Value> = sqlx::query_scalar(&sql)
        .bind(student_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(db_error)?;
    match item {
        Some(v) => Ok(Json(v)),
        None => Ok(Json(json!({"status": "not_prepared", "student_id": student_id}))),
    }
}

/// POST /colab/atlaspack/students/:student_id/package/generate — (re)génère
/// le paquet d'un opérateur. Appelé automatiquement après affectation
/// (`colab::routes`), mais aussi exposé manuellement pour forcer une
/// régénération (ex: après correction d'une erreur `failed`).
async fn generate_package(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(student_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    require_staff_write(&auth)?;
    let package_id = enqueue_or_refresh_package_for_student(&state.pool, student_id, Some(auth.id))
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": format!("Génération impossible: {e}")})),
            )
        })?;
    Ok(Json(json!({"package_id": package_id, "status": "queued"})))
}

/// GET /colab/atlaspack/packages/:id/download — sert l'archive `.atlaspack`.
async fn download_package(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(package_id): Path<Uuid>,
) -> Result<Response, ApiError> {
    require_staff(&auth)?;
    let row: Option<(String, String, String)> = sqlx::query_as(
        "SELECT file_path, status, operator_user_id::text FROM atlas.atlaspack_packages WHERE id = $1",
    )
    .bind(package_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_error)?;

    let (file_path, status, _operator) = row.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Paquet introuvable"})),
        )
    })?;

    if status != "ready" && status != "stale" {
        return Err((
            StatusCode::CONFLICT,
            Json(json!({"error": format!("Paquet non téléchargeable (statut: {status})")})),
        ));
    }

    let bytes = std::fs::read(&file_path).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Fichier introuvable sur le serveur: {e}")})),
        )
    })?;

    let filename = format!("operateur-{package_id}.atlaspack");
    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/octet-stream".to_string()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{filename}\""),
            ),
        ],
        Bytes::from(bytes),
    )
        .into_response())
}

/// GET /colab/atlaspack/returns — liste des exports terrain reçus (bureau).
async fn list_returns(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Value>, ApiError> {
    require_staff(&auth)?;
    let items: Vec<Value> = sqlx::query_scalar(
        r#"SELECT jsonb_build_object(
            'id', r.id, 'package_id', r.package_id, 'operator_user_id', r.operator_user_id,
            'operator_email', u.email, 'generated_at', r.generated_at,
            'missions_count', r.missions_count, 'sondages_count', r.sondages_count,
            'essais_count', r.essais_count, 'attachments_count', r.attachments_count,
            'size_bytes', r.size_bytes, 'sha256', r.sha256, 'status', r.status,
            'rejection_reason', r.rejection_reason, 'received_at', r.received_at, 'applied_at', r.applied_at
        )
        FROM atlas.atlaspack_returns r
        JOIN atlas.users u ON u.id = r.operator_user_id
        ORDER BY r.received_at DESC"#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(db_error)?;
    Ok(Json(json!({"items": items, "total": items.len()})))
}

/// GET /colab/atlaspack/returns/:export_id/status — poll léger, accessible
/// par l'opérateur lui-même (usage mobile, opportuniste, jamais requis).
async fn return_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(export_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let row: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT operator_user_id, status FROM atlas.atlaspack_returns WHERE id = $1",
    )
    .bind(export_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_error)?;

    match row {
        Some((operator_user_id, status)) => {
            if operator_user_id != auth.id && !auth.has_permission("colab.missions.read") {
                return Err(forbidden());
            }
            Ok(Json(json!({"export_id": export_id, "status": status})))
        }
        None => Ok(Json(json!({"export_id": export_id, "status": "unknown"}))),
    }
}

/// POST /colab/atlaspack/returns/import — upload multipart d'un `.atlasreturn`.
async fn import_return(
    State(state): State<AppState>,
    auth: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<Value>, ApiError> {
    require_staff_write(&auth)?;

    let mut file_bytes: Option<Vec<u8>> = None;
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Formulaire invalide: {e}")})),
        )
    })? {
        if field.name() == Some("file") {
            let data = field.bytes().await.map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": format!("Lecture fichier échouée: {e}")})),
                )
            })?;
            file_bytes = Some(data.to_vec());
        }
    }

    let bytes = file_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Champ 'file' manquant (fichier .atlasreturn)"})),
        )
    })?;

    let summary = import_atlasreturn(&state.pool, &bytes, auth.id)
        .await
        .map_err(|e| {
            (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({"error": e.to_string()})),
            )
        })?;

    Ok(Json(json!({
        "export_id": summary.export_id,
        "already_imported": summary.already_imported,
        "missions_count": summary.missions_count,
        "sondages_count": summary.sondages_count,
        "essais_count": summary.essais_count,
        "resultats_count": summary.resultats_count,
        "attachments_count": summary.attachments_count,
        "warnings": summary.warnings,
    })))
}

pub fn atlaspack_routes() -> Router<AppState> {
    Router::new()
        .route("/colab/atlaspack/packages", get(list_packages))
        .route("/colab/atlaspack/packages/:id/download", get(download_package))
        .route(
            "/colab/atlaspack/students/:student_id/package",
            get(get_package_for_student),
        )
        .route(
            "/colab/atlaspack/students/:student_id/package/generate",
            post(generate_package),
        )
        .route("/colab/atlaspack/returns", get(list_returns))
        .route("/colab/atlaspack/returns/import", post(import_return))
        .route("/colab/atlaspack/returns/:export_id/status", get(return_status))
}
