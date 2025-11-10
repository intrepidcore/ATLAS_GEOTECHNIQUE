// Import Wizard v2.3.0 - Types et structures de données

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use uuid::Uuid;

// ============================================================================
// STEP 1: Upload & Détection
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateImportRequest {
    pub filename: String,
    pub size: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateImportResponse {
    pub id: Uuid,
    pub batch_id: Option<String>,
    pub status: ImportStatus,
    pub upload_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadOptions {
    pub encoding: Option<String>,      // UTF-8, ISO-8859-1, Windows-1252
    pub delimiter: Option<String>,     // auto, ',', ';', '\t', '|'
    pub decimal: Option<String>,       // '.' ou ','
    pub thousands: Option<String>,     // '' ou ' ' ou ','
    pub skip_rows: Option<usize>,      // Nombre de lignes à ignorer
    pub trim_spaces: Option<bool>,     // Réduire espaces multiples
    pub empty_as_null: Option<bool>,   // Champs vides → NULL
}

impl Default for UploadOptions {
    fn default() -> Self {
        Self {
            encoding: Some("UTF-8".to_string()),
            delimiter: Some("auto".to_string()),
            decimal: Some(".".to_string()),
            thousands: None,
            skip_rows: Some(0),
            trim_spaces: Some(true),
            empty_as_null: Some(true),
        }
    }
}

// ============================================================================
// STEP 2: Mapping & Presets
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldMapping {
    pub atlas_field: String,
    pub file_column: Option<String>,
    pub field_type: FieldType,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldType {
    Text,
    Number,
    Date,
    Boolean,
    Geometry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MappingPreset {
    pub name: String,
    pub description: String,
    pub mappings: Vec<FieldMapping>,
    pub conflict_policy: ConflictPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConflictPolicy {
    Skip,       // Ignorer les doublons
    Update,     // Mettre à jour si plus récent
    Duplicate,  // Créer un doublon avec suffixe
}

// ============================================================================
// STEP 3: Géométrie & CRS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeometryConfig {
    pub mode: GeometryMode,
    pub crs_in: String,              // EPSG:4326, EPSG:25231, etc.
    pub crs_out: String,             // Toujours EPSG:25231 pour Atlas
    pub validate_bbox: bool,         // Vérifier limites Togo
    pub reject_invalid: bool,        // Rejeter (0,0) ou NULL
    pub dms_format: Option<bool>,    // Support Degrés Minutes Secondes
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GeometryMode {
    PointXY,        // Colonnes X/Y
    PointLonLat,    // Colonnes Lon/Lat
    PointEN,        // Colonnes E/N (UTM)
    WKT,            // Colonne WKT
    EWKT,           // Colonne EWKT
    None,           // Pas de géométrie
}

impl Default for GeometryConfig {
    fn default() -> Self {
        Self {
            mode: GeometryMode::PointLonLat,
            crs_in: "EPSG:4326".to_string(),
            crs_out: "EPSG:25231".to_string(),
            validate_bbox: true,
            reject_invalid: true,
            dms_format: Some(false),
        }
    }
}

// Bbox Togo
pub const TOGO_BBOX: (f64, f64, f64, f64) = (-0.15, 6.10, 1.81, 11.14); // (min_lon, min_lat, max_lon, max_lat)

// ============================================================================
// STEP 4: Preview & Validation
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewRequest {
    pub mapping: HashMap<String, String>,
    pub geometry_config: GeometryConfig,
    pub upload_options: UploadOptions,
    pub conflict_policy: ConflictPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewResponse {
    pub stats: PreviewStats,
    pub sample_rows: Vec<PreviewRow>,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewStats {
    pub total_rows: usize,
    pub to_create: usize,
    pub to_update: usize,
    pub to_skip: usize,
    pub errors: usize,
    pub warnings: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewRow {
    pub row: usize,
    pub data: HashMap<String, serde_json::Value>,
    pub action: RowAction,
    pub status: RowStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RowAction {
    Create,
    Update,
    Skip,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RowStatus {
    Valid,
    Error,
    Warning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub row: usize,
    pub column: Option<String>,
    pub code: String,
    pub message: String,
    pub severity: ErrorSeverity,
    pub value: Option<serde_json::Value>,
    pub hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ErrorSeverity {
    Error,
    Warning,
}

// ============================================================================
// STEP 5: Import & Journal
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitRequest {
    pub recalculate_grids: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitResponse {
    pub batch_id: Option<String>,
    pub status: ImportStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImportStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Undone,
}

impl std::fmt::Display for ImportStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ImportStatus::Pending => write!(f, "pending"),
            ImportStatus::Running => write!(f, "running"),
            ImportStatus::Completed => write!(f, "completed"),
            ImportStatus::Failed => write!(f, "failed"),
            ImportStatus::Undone => write!(f, "undone"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEvent {
    pub event: String,  // "progress" | "complete" | "error"
    pub data: ProgressData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressData {
    pub current: usize,
    pub total: usize,
    pub message: String,
    pub created: Option<usize>,
    pub updated: Option<usize>,
    pub skipped: Option<usize>,
    pub errors: Option<usize>,
    pub duration_ms: Option<u64>,
}

// ============================================================================
// Undo System
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UndoResponse {
    pub undone: UndoStats,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UndoStats {
    pub sondages: usize,
    pub essais: usize,
    pub grids_recalculated: usize,
}

// ============================================================================
// Database Models
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Import {
    pub id: Uuid,
    pub batch_id: String,
    pub filename: String,
    pub sha256: String,
    pub user_id: Option<String>,
    pub status: String,
    pub params: serde_json::Value,
    pub stats: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ImportError {
    pub id: Uuid,
    pub import_id: Uuid,
    pub row_no: i32,
    pub column_name: Option<String>,
    pub error_code: String,
    pub message: String,
    pub severity: String,
    pub value: Option<String>,
    pub hint: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Presets Atlas
// ============================================================================

pub fn get_preset_sondages_complets() -> MappingPreset {
    MappingPreset {
        name: "Sondages complets".to_string(),
        description: "Import de sondages avec essais géotechniques complets".to_string(),
        mappings: vec![
            FieldMapping {
                atlas_field: "code".to_string(),
                file_column: Some("code_site".to_string()),
                field_type: FieldType::Text,
                required: true,
            },
            FieldMapping {
                atlas_field: "localite".to_string(),
                file_column: Some("localite".to_string()),
                field_type: FieldType::Text,
                required: false,
            },
            FieldMapping {
                atlas_field: "date".to_string(),
                file_column: Some("date".to_string()),
                field_type: FieldType::Date,
                required: false,
            },
            FieldMapping {
                atlas_field: "lon".to_string(),
                file_column: Some("lon".to_string()),
                field_type: FieldType::Number,
                required: true,
            },
            FieldMapping {
                atlas_field: "lat".to_string(),
                file_column: Some("lat".to_string()),
                field_type: FieldType::Number,
                required: true,
            },
            FieldMapping {
                atlas_field: "depth_m".to_string(),
                file_column: Some("depth_m".to_string()),
                field_type: FieldType::Number,
                required: true,
            },
            FieldMapping {
                atlas_field: "wl".to_string(),
                file_column: Some("wl".to_string()),
                field_type: FieldType::Number,
                required: false,
            },
            FieldMapping {
                atlas_field: "wp".to_string(),
                file_column: Some("wp".to_string()),
                field_type: FieldType::Number,
                required: false,
            },
            FieldMapping {
                atlas_field: "vbs".to_string(),
                file_column: Some("vbs".to_string()),
                field_type: FieldType::Number,
                required: false,
            },
        ],
        conflict_policy: ConflictPolicy::Update,
    }
}

pub fn get_all_presets() -> Vec<MappingPreset> {
    vec![
        get_preset_sondages_complets(),
        // Autres presets à ajouter
    ]
}
