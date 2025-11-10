// Types pour le gestionnaire de base de données
use serde::{Deserialize, Serialize};
use sqlx::types::chrono::{DateTime, Utc};
use std::collections::HashMap;

// ============================================================================
// Schema & Table Info
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseSchema {
    pub schemas: Vec<SchemaInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SchemaInfo {
    pub name: String,
    pub tables: Vec<TableInfo>,
    pub views: Vec<ViewInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    pub schema: String,
    pub row_count: i64,
    pub has_geom: bool,
    pub geom_column: Option<String>,
    pub geom_type: Option<String>,
    pub srid: Option<i32>,
    pub columns: Vec<ColumnInfo>,
    pub primary_keys: Vec<String>,
    pub foreign_keys: Vec<ForeignKeyInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ViewInfo {
    pub name: String,
    pub schema: String,
    pub is_materialized: bool,
    pub definition: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub column_default: Option<String>,
    pub character_maximum_length: Option<i32>,
    pub numeric_precision: Option<i32>,
    pub numeric_scale: Option<i32>,
    pub is_primary_key: bool,
    pub is_foreign_key: bool,
    pub ui_order: Option<i32>,
    pub ui_visible: bool,
    pub ui_label: Option<String>,
    pub ui_unit: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ForeignKeyInfo {
    pub column_name: String,
    pub foreign_table_schema: String,
    pub foreign_table_name: String,
    pub foreign_column_name: String,
}

// ============================================================================
// Table Data
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct TableDataResponse {
    pub table_name: String,
    pub schema_name: String,
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<HashMap<String, serde_json::Value>>,
    pub total_count: i64,
    pub offset: i64,
    pub limit: i64,
}

#[derive(Debug, Deserialize)]
pub struct TableDataQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub filter: Option<String>,
    pub order_by: Option<String>,
    pub order_dir: Option<String>,
}

// ============================================================================
// Selection
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SelectionRequest {
    pub filter: String,
    pub filter_type: SelectionFilterType,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SelectionFilterType {
    Regex,
    SqlFilter,
    Expression,
}

#[derive(Debug, Serialize)]
pub struct SelectionResponse {
    pub ids: Vec<String>,
    pub count: i64,
    pub bbox: Option<BBox>,
}

#[derive(Debug, Serialize)]
pub struct BBox {
    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
    pub srid: i32,
}

// ============================================================================
// Staging
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StagingInfo {
    pub staging_id: String,
    pub table_name: String,
    pub schema_name: String,
    pub created_at: DateTime<Utc>,
    pub reason: Option<String>,
    pub row_count: i64,
    pub operations_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateStagingRequest {
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StagingRowOperation {
    pub op: RowOperation,
    pub data: HashMap<String, serde_json::Value>,
    pub row_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RowOperation {
    Insert,
    Update,
    Delete,
}

#[derive(Debug, Serialize)]
pub struct StagingValidationResult {
    pub is_valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
}

#[derive(Debug, Serialize)]
pub struct ValidationError {
    pub row_id: Option<String>,
    pub column: Option<String>,
    pub error_type: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ValidationWarning {
    pub message: String,
    pub affected_rows: i64,
}

#[derive(Debug, Serialize)]
pub struct StagingPreview {
    pub staging_id: String,
    pub operations: Vec<PreviewOperation>,
    pub summary: PreviewSummary,
}

#[derive(Debug, Serialize)]
pub struct PreviewOperation {
    pub op: RowOperation,
    pub row_id: Option<String>,
    pub before: Option<HashMap<String, serde_json::Value>>,
    pub after: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Serialize)]
pub struct PreviewSummary {
    pub inserts: i64,
    pub updates: i64,
    pub deletes: i64,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct CommitResult {
    pub success: bool,
    pub rows_affected: i64,
    pub audit_id: String,
}

// ============================================================================
// Column Operations
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct AddColumnRequest {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub default_value: Option<String>,
    pub character_length: Option<i32>,
    pub ui_label: Option<String>,
    pub ui_unit: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteColumnRequest {
    pub mode: DeleteMode,
    pub confirm_token: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DeleteMode {
    Soft,
    Hard,
}

#[derive(Debug, Serialize)]
pub struct ColumnImpactAnalysis {
    pub column_name: String,
    pub affected_rows: i64,
    pub dependent_views: Vec<String>,
    pub dependent_materialized_views: Vec<String>,
    pub dependent_functions: Vec<String>,
    pub dependent_triggers: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReorderColumnsRequest {
    pub column_order: Vec<String>,
}

// ============================================================================
// Audit
// ============================================================================

#[derive(Debug, Serialize)]
pub struct AuditLog {
    pub id: String,
    pub table_name: String,
    pub schema_name: String,
    pub operation: String,
    pub user_id: Option<String>,
    pub sql_query: Option<String>,
    pub rows_affected: i64,
    pub staging_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub operation: Option<String>,
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
}

// ============================================================================
// Backup
// ============================================================================

#[derive(Debug, Serialize)]
pub struct BackupInfo {
    pub backup_id: String,
    pub tables: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub size_bytes: i64,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBackupRequest {
    pub tables: Vec<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RestoreResult {
    pub success: bool,
    pub tables_restored: Vec<String>,
    pub errors: Vec<String>,
}

// ============================================================================
// Error Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct DbManagerError {
    pub error_type: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

impl DbManagerError {
    pub fn new(error_type: &str, message: &str) -> Self {
        Self {
            error_type: error_type.to_string(),
            message: message.to_string(),
            details: None,
        }
    }

    pub fn with_details(error_type: &str, message: &str, details: serde_json::Value) -> Self {
        Self {
            error_type: error_type.to_string(),
            message: message.to_string(),
            details: Some(details),
        }
    }
}
