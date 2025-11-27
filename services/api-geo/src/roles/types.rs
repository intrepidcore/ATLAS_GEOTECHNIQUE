// Types pour la gestion des rôles et permissions
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use validator::Validate;

// ============================================================================
// Request Types
// ============================================================================

#[derive(Debug, Deserialize, Validate)]
pub struct CreateRoleRequest {
    #[validate(length(min = 2, max = 50, message = "ID doit faire entre 2 et 50 caractères"))]
    pub id: String,
    #[validate(length(min = 2, max = 100, message = "Nom doit faire entre 2 et 100 caractères"))]
    pub name: String,
    pub description: Option<String>,
    /// Liste des IDs de permissions à assigner
    pub permissions: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateRoleRequest {
    #[validate(length(min = 2, max = 100, message = "Nom doit faire entre 2 et 100 caractères"))]
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssignPermissionsRequest {
    pub permissions: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListRolesQuery {
    pub include_permissions: Option<bool>,
    pub include_user_count: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ListPermissionsQuery {
    pub resource: Option<String>,
}

// ============================================================================
// Response Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct RoleResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_system: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<PermissionResponse>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionResponse {
    pub id: String,
    pub resource: String,
    pub action: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PermissionsByResource {
    pub resource: String,
    pub permissions: Vec<PermissionResponse>,
}

#[derive(Debug, Serialize)]
pub struct RoleStatsResponse {
    pub total_roles: i64,
    pub system_roles: i64,
    pub custom_roles: i64,
    pub total_permissions: i64,
    pub permissions_by_resource: Vec<ResourcePermissionCount>,
}

#[derive(Debug, Serialize)]
pub struct ResourcePermissionCount {
    pub resource: String,
    pub count: i64,
}

// ============================================================================
// Database Models
// ============================================================================

#[derive(Debug, Clone, FromRow)]
pub struct DbRole {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_system: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct DbRoleWithPermissions {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_system: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub permissions: Option<serde_json::Value>,
    pub user_count: Option<i64>,
}

impl DbRoleWithPermissions {
    pub fn into_response(self, include_permissions: bool, include_user_count: bool) -> RoleResponse {
        let permissions = if include_permissions {
            self.permissions
                .and_then(|v| serde_json::from_value::<Vec<PermissionResponse>>(v).ok())
        } else {
            None
        };

        let user_count = if include_user_count {
            self.user_count
        } else {
            None
        };

        RoleResponse {
            id: self.id,
            name: self.name,
            description: self.description,
            is_system: self.is_system,
            created_at: self.created_at,
            updated_at: self.updated_at,
            permissions,
            user_count,
        }
    }
}

#[derive(Debug, Clone, FromRow)]
pub struct DbPermission {
    pub id: String,
    pub resource: String,
    pub action: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<DbPermission> for PermissionResponse {
    fn from(p: DbPermission) -> Self {
        PermissionResponse {
            id: p.id,
            resource: p.resource,
            action: p.action,
            description: p.description,
        }
    }
}
