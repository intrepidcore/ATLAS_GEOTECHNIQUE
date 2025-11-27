// Routes CRUD pour les rôles et permissions
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use validator::Validate;

use super::types::*;
use crate::auth::{error::AuthError, middleware::AuthUser};
use crate::state::AppState;

/// Configure les routes de gestion des rôles
pub fn roles_routes() -> Router<AppState> {
    Router::new()
        // Rôles
        .route("/roles", get(list_roles).post(create_role))
        .route("/roles/stats", get(get_roles_stats))
        .route(
            "/roles/:id",
            get(get_role).put(update_role).delete(delete_role),
        )
        .route(
            "/roles/:id/permissions",
            get(get_role_permissions)
                .put(assign_permissions)
                .delete(remove_all_permissions),
        )
        .route(
            "/roles/:id/permissions/:permission_id",
            post(add_permission).delete(remove_permission),
        )
        .route("/roles/:id/users", get(get_role_users))
        // Permissions
        .route("/permissions", get(list_permissions))
        .route("/permissions/grouped", get(list_permissions_grouped))
        .route("/permissions/:id", get(get_permission))
}

// ============================================================================
// Roles CRUD
// ============================================================================

/// GET /roles - Liste tous les rôles
async fn list_roles(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Query(query): Query<ListRolesQuery>,
) -> Result<Json<Vec<RoleResponse>>, AuthError> {
    if !auth_user.has_permission("roles.read") {
        return Err(AuthError::PermissionDenied("roles.read requis".to_string()));
    }

    let include_permissions = query.include_permissions.unwrap_or(false);
    let include_user_count = query.include_user_count.unwrap_or(false);

    let roles: Vec<DbRoleWithPermissions> = sqlx::query_as(
        r#"
        SELECT 
            r.id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
            CASE WHEN $1 THEN
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', p.id,
                            'resource', p.resource,
                            'action', p.action,
                            'description', p.description
                        )
                    ) FILTER (WHERE p.id IS NOT NULL),
                    '[]'::json
                )
            ELSE NULL END as permissions,
            CASE WHEN $2 THEN
                (SELECT COUNT(*) FROM atlas.user_roles ur WHERE ur.role_id = r.id)
            ELSE NULL END as user_count
        FROM atlas.roles r
        LEFT JOIN atlas.role_permissions rp ON r.id = rp.role_id
        LEFT JOIN atlas.permissions p ON rp.permission_id = p.id
        GROUP BY r.id
        ORDER BY r.is_system DESC, r.name ASC
        "#,
    )
    .bind(include_permissions)
    .bind(include_user_count)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(
        roles
            .into_iter()
            .map(|r| r.into_response(include_permissions, include_user_count))
            .collect(),
    ))
}

/// POST /roles - Créer un nouveau rôle
async fn create_role(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(request): Json<CreateRoleRequest>,
) -> Result<(StatusCode, Json<RoleResponse>), AuthError> {
    if !auth_user.has_permission("roles.create") {
        return Err(AuthError::PermissionDenied("roles.create requis".to_string()));
    }

    request.validate().map_err(|e| AuthError::ValidationError(e.to_string()))?;

    // Vérifier que l'ID n'existe pas
    let existing: Option<(String,)> = sqlx::query_as(
        r#"SELECT id FROM atlas.roles WHERE id = $1"#,
    )
    .bind(&request.id)
    .fetch_optional(&state.pool)
    .await?;

    if existing.is_some() {
        return Err(AuthError::ValidationError(format!(
            "Le rôle '{}' existe déjà",
            request.id
        )));
    }

    let now = chrono::Utc::now();

    // Créer le rôle
    sqlx::query(
        r#"
        INSERT INTO atlas.roles (id, name, description, is_system, created_at, updated_at)
        VALUES ($1, $2, $3, FALSE, $4, $4)
        "#,
    )
    .bind(&request.id)
    .bind(&request.name)
    .bind(&request.description)
    .bind(now)
    .execute(&state.pool)
    .await?;

    // Assigner les permissions si fournies
    let mut permissions = Vec::new();
    if let Some(permission_ids) = request.permissions {
        for perm_id in permission_ids {
            let perm: Option<DbPermission> = sqlx::query_as(
                r#"SELECT * FROM atlas.permissions WHERE id = $1"#,
            )
            .bind(&perm_id)
            .fetch_optional(&state.pool)
            .await?;

            if let Some(p) = perm {
                sqlx::query(
                    r#"
                    INSERT INTO atlas.role_permissions (role_id, permission_id, granted_by)
                    VALUES ($1, $2, $3)
                    ON CONFLICT DO NOTHING
                    "#,
                )
                .bind(&request.id)
                .bind(&p.id)
                .bind(auth_user.id)
                .execute(&state.pool)
                .await?;

                permissions.push(PermissionResponse::from(p));
            }
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(RoleResponse {
            id: request.id,
            name: request.name,
            description: request.description,
            is_system: false,
            created_at: now,
            updated_at: now,
            permissions: Some(permissions),
            user_count: Some(0),
        }),
    ))
}

/// GET /roles/:id - Récupérer un rôle
async fn get_role(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(role_id): Path<String>,
) -> Result<Json<RoleResponse>, AuthError> {
    if !auth_user.has_permission("roles.read") {
        return Err(AuthError::PermissionDenied("roles.read requis".to_string()));
    }

    let role: DbRoleWithPermissions = sqlx::query_as(
        r#"
        SELECT 
            r.id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', p.id,
                        'resource', p.resource,
                        'action', p.action,
                        'description', p.description
                    )
                ) FILTER (WHERE p.id IS NOT NULL),
                '[]'::json
            ) as permissions,
            (SELECT COUNT(*) FROM atlas.user_roles ur WHERE ur.role_id = r.id) as user_count
        FROM atlas.roles r
        LEFT JOIN atlas.role_permissions rp ON r.id = rp.role_id
        LEFT JOIN atlas.permissions p ON rp.permission_id = p.id
        WHERE r.id = $1
        GROUP BY r.id
        "#,
    )
    .bind(&role_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AuthError::ValidationError(format!("Rôle '{}' non trouvé", role_id)))?;

    Ok(Json(role.into_response(true, true)))
}

/// PUT /roles/:id - Mettre à jour un rôle
async fn update_role(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(role_id): Path<String>,
    Json(request): Json<UpdateRoleRequest>,
) -> Result<Json<RoleResponse>, AuthError> {
    if !auth_user.has_permission("roles.update") {
        return Err(AuthError::PermissionDenied("roles.update requis".to_string()));
    }

    request.validate().map_err(|e| AuthError::ValidationError(e.to_string()))?;

    // Vérifier que le rôle existe et n'est pas système
    let existing: Option<DbRole> = sqlx::query_as(
        r#"SELECT * FROM atlas.roles WHERE id = $1"#,
    )
    .bind(&role_id)
    .fetch_optional(&state.pool)
    .await?;

    let existing = existing.ok_or_else(|| {
        AuthError::ValidationError(format!("Rôle '{}' non trouvé", role_id))
    })?;

    if existing.is_system {
        return Err(AuthError::ValidationError(
            "Impossible de modifier un rôle système".to_string(),
        ));
    }

    // Mettre à jour
    let name = request.name.unwrap_or(existing.name);
    let description = request.description.or(existing.description);

    sqlx::query(
        r#"
        UPDATE atlas.roles 
        SET name = $1, description = $2, updated_at = NOW()
        WHERE id = $3
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(&role_id)
    .execute(&state.pool)
    .await?;

    // Récupérer le rôle mis à jour
    let role: DbRoleWithPermissions = sqlx::query_as(
        r#"
        SELECT 
            r.id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', p.id,
                        'resource', p.resource,
                        'action', p.action,
                        'description', p.description
                    )
                ) FILTER (WHERE p.id IS NOT NULL),
                '[]'::json
            ) as permissions,
            (SELECT COUNT(*) FROM atlas.user_roles ur WHERE ur.role_id = r.id) as user_count
        FROM atlas.roles r
        LEFT JOIN atlas.role_permissions rp ON r.id = rp.role_id
        LEFT JOIN atlas.permissions p ON rp.permission_id = p.id
        WHERE r.id = $1
        GROUP BY r.id
        "#,
    )
    .bind(&role_id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(role.into_response(true, true)))
}

/// DELETE /roles/:id - Supprimer un rôle
async fn delete_role(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(role_id): Path<String>,
) -> Result<StatusCode, AuthError> {
    if !auth_user.has_permission("roles.delete") {
        return Err(AuthError::PermissionDenied("roles.delete requis".to_string()));
    }

    // Vérifier que le rôle existe et n'est pas système
    let existing: Option<DbRole> = sqlx::query_as(
        r#"SELECT * FROM atlas.roles WHERE id = $1"#,
    )
    .bind(&role_id)
    .fetch_optional(&state.pool)
    .await?;

    let existing = existing.ok_or_else(|| {
        AuthError::ValidationError(format!("Rôle '{}' non trouvé", role_id))
    })?;

    if existing.is_system {
        return Err(AuthError::ValidationError(
            "Impossible de supprimer un rôle système".to_string(),
        ));
    }

    // Vérifier qu'aucun utilisateur n'a ce rôle
    let user_count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM atlas.user_roles WHERE role_id = $1"#,
    )
    .bind(&role_id)
    .fetch_one(&state.pool)
    .await?;

    if user_count > 0 {
        return Err(AuthError::ValidationError(format!(
            "Impossible de supprimer le rôle '{}': {} utilisateur(s) l'utilisent",
            role_id, user_count
        )));
    }

    // Supprimer le rôle (cascade supprime les role_permissions)
    sqlx::query(r#"DELETE FROM atlas.roles WHERE id = $1"#)
        .bind(&role_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Role Permissions Management
// ============================================================================

/// GET /roles/:id/permissions - Récupérer les permissions d'un rôle
async fn get_role_permissions(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(role_id): Path<String>,
) -> Result<Json<Vec<PermissionResponse>>, AuthError> {
    if !auth_user.has_permission("roles.read") {
        return Err(AuthError::PermissionDenied("roles.read requis".to_string()));
    }

    let permissions: Vec<DbPermission> = sqlx::query_as(
        r#"
        SELECT p.* FROM atlas.permissions p
        JOIN atlas.role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = $1
        ORDER BY p.resource, p.action
        "#,
    )
    .bind(&role_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(permissions.into_iter().map(PermissionResponse::from).collect()))
}

/// PUT /roles/:id/permissions - Remplacer toutes les permissions d'un rôle
async fn assign_permissions(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(role_id): Path<String>,
    Json(request): Json<AssignPermissionsRequest>,
) -> Result<Json<Vec<PermissionResponse>>, AuthError> {
    if !auth_user.has_permission("roles.manage") {
        return Err(AuthError::PermissionDenied("roles.manage requis".to_string()));
    }

    // Vérifier que le rôle existe
    let existing: Option<DbRole> = sqlx::query_as(
        r#"SELECT * FROM atlas.roles WHERE id = $1"#,
    )
    .bind(&role_id)
    .fetch_optional(&state.pool)
    .await?;

    if existing.is_none() {
        return Err(AuthError::ValidationError(format!(
            "Rôle '{}' non trouvé",
            role_id
        )));
    }

    // Supprimer les anciennes permissions
    sqlx::query(r#"DELETE FROM atlas.role_permissions WHERE role_id = $1"#)
        .bind(&role_id)
        .execute(&state.pool)
        .await?;

    // Ajouter les nouvelles permissions
    let mut assigned = Vec::new();
    for perm_id in &request.permissions {
        let perm: Option<DbPermission> = sqlx::query_as(
            r#"SELECT * FROM atlas.permissions WHERE id = $1"#,
        )
        .bind(perm_id)
        .fetch_optional(&state.pool)
        .await?;

        if let Some(p) = perm {
            sqlx::query(
                r#"
                INSERT INTO atlas.role_permissions (role_id, permission_id, granted_by)
                VALUES ($1, $2, $3)
                "#,
            )
            .bind(&role_id)
            .bind(&p.id)
            .bind(auth_user.id)
            .execute(&state.pool)
            .await?;

            assigned.push(PermissionResponse::from(p));
        }
    }

    // Mettre à jour updated_at du rôle
    sqlx::query(r#"UPDATE atlas.roles SET updated_at = NOW() WHERE id = $1"#)
        .bind(&role_id)
        .execute(&state.pool)
        .await?;

    Ok(Json(assigned))
}

/// DELETE /roles/:id/permissions - Retirer toutes les permissions d'un rôle
async fn remove_all_permissions(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(role_id): Path<String>,
) -> Result<StatusCode, AuthError> {
    if !auth_user.has_permission("roles.manage") {
        return Err(AuthError::PermissionDenied("roles.manage requis".to_string()));
    }

    sqlx::query(r#"DELETE FROM atlas.role_permissions WHERE role_id = $1"#)
        .bind(&role_id)
        .execute(&state.pool)
        .await?;

    sqlx::query(r#"UPDATE atlas.roles SET updated_at = NOW() WHERE id = $1"#)
        .bind(&role_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /roles/:id/permissions/:permission_id - Ajouter une permission à un rôle
async fn add_permission(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((role_id, permission_id)): Path<(String, String)>,
) -> Result<StatusCode, AuthError> {
    if !auth_user.has_permission("roles.manage") {
        return Err(AuthError::PermissionDenied("roles.manage requis".to_string()));
    }

    // Vérifier que le rôle et la permission existent
    let role_exists: Option<(String,)> = sqlx::query_as(
        r#"SELECT id FROM atlas.roles WHERE id = $1"#,
    )
    .bind(&role_id)
    .fetch_optional(&state.pool)
    .await?;

    if role_exists.is_none() {
        return Err(AuthError::ValidationError(format!(
            "Rôle '{}' non trouvé",
            role_id
        )));
    }

    let perm_exists: Option<(String,)> = sqlx::query_as(
        r#"SELECT id FROM atlas.permissions WHERE id = $1"#,
    )
    .bind(&permission_id)
    .fetch_optional(&state.pool)
    .await?;

    if perm_exists.is_none() {
        return Err(AuthError::ValidationError(format!(
            "Permission '{}' non trouvée",
            permission_id
        )));
    }

    sqlx::query(
        r#"
        INSERT INTO atlas.role_permissions (role_id, permission_id, granted_by)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(&role_id)
    .bind(&permission_id)
    .bind(auth_user.id)
    .execute(&state.pool)
    .await?;

    sqlx::query(r#"UPDATE atlas.roles SET updated_at = NOW() WHERE id = $1"#)
        .bind(&role_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::CREATED)
}

/// DELETE /roles/:id/permissions/:permission_id - Retirer une permission d'un rôle
async fn remove_permission(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((role_id, permission_id)): Path<(String, String)>,
) -> Result<StatusCode, AuthError> {
    if !auth_user.has_permission("roles.manage") {
        return Err(AuthError::PermissionDenied("roles.manage requis".to_string()));
    }

    sqlx::query(
        r#"DELETE FROM atlas.role_permissions WHERE role_id = $1 AND permission_id = $2"#,
    )
    .bind(&role_id)
    .bind(&permission_id)
    .execute(&state.pool)
    .await?;

    sqlx::query(r#"UPDATE atlas.roles SET updated_at = NOW() WHERE id = $1"#)
        .bind(&role_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// GET /roles/:id/users - Récupérer les utilisateurs ayant ce rôle
async fn get_role_users(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(role_id): Path<String>,
) -> Result<Json<Vec<serde_json::Value>>, AuthError> {
    if !auth_user.has_permission("roles.read") {
        return Err(AuthError::PermissionDenied("roles.read requis".to_string()));
    }

    let users: Vec<(uuid::Uuid, String, String, Option<String>, Option<String>, bool)> = sqlx::query_as(
        r#"
        SELECT u.id, u.email, u.username, u.first_name, u.last_name, u.is_active
        FROM atlas.users u
        JOIN atlas.user_roles ur ON u.id = ur.user_id
        WHERE ur.role_id = $1
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        ORDER BY u.username
        "#,
    )
    .bind(&role_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(
        users
            .into_iter()
            .map(|(id, email, username, first_name, last_name, is_active)| {
                serde_json::json!({
                    "id": id,
                    "email": email,
                    "username": username,
                    "first_name": first_name,
                    "last_name": last_name,
                    "is_active": is_active
                })
            })
            .collect(),
    ))
}

// ============================================================================
// Permissions
// ============================================================================

/// GET /permissions - Liste toutes les permissions
async fn list_permissions(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Query(query): Query<ListPermissionsQuery>,
) -> Result<Json<Vec<PermissionResponse>>, AuthError> {
    if !auth_user.has_permission("roles.read") {
        return Err(AuthError::PermissionDenied("roles.read requis".to_string()));
    }

    let permissions: Vec<DbPermission> = if let Some(resource) = query.resource {
        sqlx::query_as(
            r#"SELECT * FROM atlas.permissions WHERE resource = $1 ORDER BY action"#,
        )
        .bind(&resource)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as(
            r#"SELECT * FROM atlas.permissions ORDER BY resource, action"#,
        )
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(permissions.into_iter().map(PermissionResponse::from).collect()))
}

/// GET /permissions/grouped - Liste les permissions groupées par ressource
async fn list_permissions_grouped(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<Vec<PermissionsByResource>>, AuthError> {
    if !auth_user.has_permission("roles.read") {
        return Err(AuthError::PermissionDenied("roles.read requis".to_string()));
    }

    let permissions: Vec<DbPermission> = sqlx::query_as(
        r#"SELECT * FROM atlas.permissions ORDER BY resource, action"#,
    )
    .fetch_all(&state.pool)
    .await?;

    // Grouper par ressource
    let mut grouped: std::collections::HashMap<String, Vec<PermissionResponse>> =
        std::collections::HashMap::new();

    for perm in permissions {
        grouped
            .entry(perm.resource.clone())
            .or_default()
            .push(PermissionResponse::from(perm));
    }

    let mut result: Vec<PermissionsByResource> = grouped
        .into_iter()
        .map(|(resource, permissions)| PermissionsByResource {
            resource,
            permissions,
        })
        .collect();

    result.sort_by(|a, b| a.resource.cmp(&b.resource));

    Ok(Json(result))
}

/// GET /permissions/:id - Récupérer une permission
async fn get_permission(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(permission_id): Path<String>,
) -> Result<Json<PermissionResponse>, AuthError> {
    if !auth_user.has_permission("roles.read") {
        return Err(AuthError::PermissionDenied("roles.read requis".to_string()));
    }

    let permission: DbPermission = sqlx::query_as(
        r#"SELECT * FROM atlas.permissions WHERE id = $1"#,
    )
    .bind(&permission_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| {
        AuthError::ValidationError(format!("Permission '{}' non trouvée", permission_id))
    })?;

    Ok(Json(PermissionResponse::from(permission)))
}

/// GET /roles/stats - Statistiques des rôles
async fn get_roles_stats(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<RoleStatsResponse>, AuthError> {
    if !auth_user.has_permission("roles.read") {
        return Err(AuthError::PermissionDenied("roles.read requis".to_string()));
    }

    let total_roles: i64 = sqlx::query_scalar(r#"SELECT COUNT(*) FROM atlas.roles"#)
        .fetch_one(&state.pool)
        .await?;

    let system_roles: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM atlas.roles WHERE is_system = TRUE"#,
    )
    .fetch_one(&state.pool)
    .await?;

    let total_permissions: i64 = sqlx::query_scalar(r#"SELECT COUNT(*) FROM atlas.permissions"#)
        .fetch_one(&state.pool)
        .await?;

    let permissions_by_resource: Vec<(String, i64)> = sqlx::query_as(
        r#"
        SELECT resource, COUNT(*)::bigint as count
        FROM atlas.permissions
        GROUP BY resource
        ORDER BY count DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(RoleStatsResponse {
        total_roles,
        system_roles,
        custom_roles: total_roles - system_roles,
        total_permissions,
        permissions_by_resource: permissions_by_resource
            .into_iter()
            .map(|(resource, count)| ResourcePermissionCount { resource, count })
            .collect(),
    }))
}
