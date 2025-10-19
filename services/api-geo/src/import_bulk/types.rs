// ============================================================================
// Types et structures de données pour l'import bulk
// ============================================================================

#![allow(dead_code)]

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::types::BigDecimal;
use uuid::Uuid;

// ============================================================================
// ENUMS
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ImportStatus {
    Pending,
    Running,
    Succeeded,
    Failed,
    Partial,
    Cancelled,
}

impl ToString for ImportStatus {
    fn to_string(&self) -> String {
        match self {
            ImportStatus::Pending => "pending".to_string(),
            ImportStatus::Running => "running".to_string(),
            ImportStatus::Succeeded => "succeeded".to_string(),
            ImportStatus::Failed => "failed".to_string(),
            ImportStatus::Partial => "partial".to_string(),
            ImportStatus::Cancelled => "cancelled".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GeolocationMode {
    Exact,
    Centroid,
    Random,
    Unknown,
    Maille,
}

impl ToString for GeolocationMode {
    fn to_string(&self) -> String {
        match self {
            GeolocationMode::Exact => "exact".to_string(),
            GeolocationMode::Centroid => "centroid".to_string(),
            GeolocationMode::Random => "random".to_string(),
            GeolocationMode::Unknown => "unknown".to_string(),
            GeolocationMode::Maille => "maille".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ItemStatus {
    Ok,
    Warning,
    Error,
    Skipped,
}

impl ToString for ItemStatus {
    fn to_string(&self) -> String {
        match self {
            ItemStatus::Ok => "ok".to_string(),
            ItemStatus::Warning => "warning".to_string(),
            ItemStatus::Error => "error".to_string(),
            ItemStatus::Skipped => "skipped".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FileFormat {
    Csv,
    Xlsx,
    Json,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DataStructure {
    Long,  // Une ligne par mesure
    Large, // Profondeurs en colonnes
}

// ============================================================================
// STRUCTURES PRINCIPALES
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportJob {
    pub id: Uuid,
    pub filename: String,
    pub size_bytes: i32,
    pub content_hash: String,
    pub status: ImportStatus,
    pub progress: f32,
    pub stats: ImportStats,
    pub geoloc_mode: GeolocationMode,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ImportStats {
    pub total_rows: i32,
    pub valid_rows: i32,
    pub sondages: i32,
    pub essais: i32,
    pub warnings: i32,
    pub errors: i32,
    pub duplicates: i32,
}

#[derive(Debug)]
pub struct ImportRecord {
    pub id: Uuid,
    pub filename: String,
    pub size_bytes: i32,
    pub content_hash: String,
    pub status: String,
    pub progress: Option<BigDecimal>,
    pub stats_json: Option<serde_json::Value>,
    pub geoloc_mode: String,
    pub created_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
}

// ============================================================================
// REQUÊTES
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ImportRequest {
    pub format: FileFormat,
    pub encoding: Option<String>,
    pub mapping: MappingConfig,
    pub geolocation: GeolocationConfig,
    pub dry_run: Option<bool>,
    pub save_file: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MappingConfig {
    // Colonnes identité
    pub localite_col: Option<String>,
    pub code_col: Option<String>,
    
    // Type d'essai
    pub type_essai: Option<String>, // Si fixe pour tout le fichier
    pub type_essai_col: Option<String>, // Si colonne variable
    
    // Structure données
    pub structure: DataStructure,
    
    // Format Long
    pub profondeur_col: Option<String>,
    pub valeur_col: Option<String>,
    
    // Format Large
    pub profondeur_cols: Option<Vec<String>>, // Ex: ["1", "1.5", "2"]
    
    // Analyses
    pub analyse_col: Option<String>,
    pub unite_col: Option<String>,
    
    // Métadonnées
    pub date_col: Option<String>,
    pub source_col: Option<String>,
    pub operator_col: Option<String>,
    pub type_sol_col: Option<String>,
    
    // Géolocalisation
    pub lon_col: Option<String>,
    pub lat_col: Option<String>,
    pub adm1_col: Option<String>,
    pub adm2_col: Option<String>,
    pub adm3_col: Option<String>,
    pub maille_col: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeolocationConfig {
    pub mode: GeolocationMode,
    pub seed: Option<i32>,
    pub jitter_radius: Option<i32>, // En mètres (150, 400, 1000)
    
    // Valeurs fixes (si pas de colonnes)
    pub adm1_fixed: Option<String>,
    pub adm2_fixed: Option<String>,
    pub adm3_fixed: Option<String>,
    pub maille_code_fixed: Option<String>,
}

// ============================================================================
// RÉPONSES
// ============================================================================

#[derive(Debug, Serialize)]
pub struct ImportResponse {
    pub job_id: Uuid,
    pub status: ImportStatus,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct DryRunResult {
    pub valid: bool,
    pub stats: ImportStats,
    pub preview: Vec<PreviewRow>,
    pub warnings: Vec<ValidationMessage>,
    pub errors: Vec<ValidationMessage>,
    pub ambiguous_matches: Vec<AmbiguousMatch>,
}

#[derive(Debug, Serialize)]
pub struct PreviewRow {
    pub row: i32,
    pub localite: Option<String>,
    pub code: Option<String>,
    pub adm3_matched: Option<String>,
    pub match_score: Option<f32>,
    pub match_confidence: Option<String>,
    pub tests_count: i32,
    pub status: ItemStatus,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ValidationMessage {
    pub row: i32,
    pub field: Option<String>,
    pub message: String,
    pub severity: String, // error/warning/info
}

#[derive(Debug, Serialize)]
pub struct AmbiguousMatch {
    pub row: i32,
    pub localite: String,
    pub candidates: Vec<AdmCandidate>,
    pub requires_confirmation: bool,
}

#[derive(Debug, Serialize)]
pub struct AdmCandidate {
    pub id: Uuid,
    pub name: String,
    pub adm2_name: Option<String>,
    pub adm1_name: Option<String>,
    pub score: f32,
}

// ============================================================================
// DONNÉES PARSÉES
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct ParsedRow {
    pub row_idx: i32,
    pub localite: Option<String>,
    pub code: Option<String>,
    pub type_essai: String,
    pub profondeur_m: f64,
    pub valeur: Option<f64>,
    pub analyse_qualitative: Option<String>,
    pub unite: Option<String>,
    pub date: Option<NaiveDate>,
    pub source: Option<String>,
    pub operator: Option<String>,
    pub type_sol: Option<String>,
    pub lon: Option<f64>,
    pub lat: Option<f64>,
    pub adm1: Option<String>,
    pub adm2: Option<String>,
    pub adm3: Option<String>,
    pub maille_code: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ValidatedRow {
    pub parsed: ParsedRow,
    pub adm3_id: Option<Uuid>,
    pub adm3_match_score: Option<f32>,
    pub validation_errors: Vec<String>,
    pub validation_warnings: Vec<String>,
    pub fingerprint: String,
}

#[derive(Debug, Clone)]
pub struct GroupedSurvey {
    pub code: String,
    pub localite: Option<String>,
    pub date: Option<NaiveDate>,
    pub source: Option<String>,
    pub operator: Option<String>,
    pub type_sol: Option<String>,
    pub lon: Option<f64>,
    pub lat: Option<f64>,
    pub adm1_id: Option<Uuid>,
    pub adm2_id: Option<Uuid>,
    pub adm3_id: Option<Uuid>,
    pub maille_code: Option<String>,
    pub tests: Vec<ValidatedRow>,
}

// ============================================================================
// RÉFÉRENTIELS
// ============================================================================

#[derive(Debug, Clone)]
pub struct TestTypeDefault {
    pub type_essai: String,
    pub default_unit: String,
    pub min_value: Option<BigDecimal>,
    pub max_value: Option<BigDecimal>,
    pub accepted_units: Option<Vec<String>>,
    pub converter_fn: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AdmMatch {
    pub id: Uuid,
    pub name: String,
    pub adm2_name: Option<String>,
    pub adm1_name: Option<String>,
    pub score: f32,
    pub confidence: MatchConfidence,
}

#[derive(Debug, Clone, PartialEq)]
pub enum MatchConfidence {
    High,   // Score >= 0.95 (exact match)
    Medium, // Score >= 0.85
    Low,    // Score >= 0.75
}

// ============================================================================
// PROFILS DE MAPPING
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MappingProfile {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub mapping: MappingConfig,
    pub geolocation: GeolocationConfig,
    pub created_by: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub is_public: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateMappingProfileRequest {
    pub name: String,
    pub description: Option<String>,
    pub mapping: MappingConfig,
    pub geolocation: GeolocationConfig,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMappingProfileRequest {
    pub name: String,
    pub description: Option<String>,
    pub mapping: MappingConfig,
    pub geolocation: GeolocationConfig,
}

#[derive(Debug, Serialize)]
pub struct ImportJobResponse {
    pub job_id: Uuid,
    pub status: ImportStatus,
    pub progress: f32,
    pub stats: Option<ImportStats>,
    pub error_message: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

// ============================================================================
// RAPPORT D'IMPORT
// ============================================================================

#[derive(Debug, Serialize)]
pub struct ImportReport {
    pub import_id: Uuid,
    pub filename: String,
    pub status: ImportStatus,
    pub stats: ImportStats,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i64>,
    pub items: Vec<ImportItemReport>,
}

#[derive(Debug, Serialize)]
pub struct ImportItemReport {
    pub row_idx: i32,
    pub status: String,
    pub error_msg: Option<String>,
    pub warning_msg: Option<String>,
    pub created_tests_count: Option<i32>,
    pub raw_json: Option<serde_json::Value>,
}

// ============================================================================
// TEMPLATES
// ============================================================================

#[derive(Debug, Serialize)]
pub struct TemplateInfo {
    pub name: String,
    pub description: String,
    pub type_essai: String,
    pub structure: DataStructure,
    pub example_rows: i32,
}

pub const AVAILABLE_TEMPLATES: &[(&str, &str, &str)] = &[
    ("granulometrie", "Granulométrie", "Granulometrie"),
    ("vbs", "Bleu de Méthylène (VBS)", "BleuMethylene_VBS"),
    ("atterberg", "Limites d'Atterberg", "Atterberg_WL"),
    ("proctor", "Proctor", "Proctor_gdmax"),
    ("multi", "Multi-essais", "mixed"),
];
