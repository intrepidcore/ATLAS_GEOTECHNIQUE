use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Csv,
    Json,
    Xlsx,
    Pdf,
    GeoJson,
}

impl std::fmt::Display for ExportFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExportFormat::Csv => write!(f, "csv"),
            ExportFormat::Json => write!(f, "json"),
            ExportFormat::Xlsx => write!(f, "xlsx"),
            ExportFormat::Pdf => write!(f, "pdf"),
            ExportFormat::GeoJson => write!(f, "geojson"),
        }
    }
}

impl ExportFormat {
    pub fn from_db_str(s: &str) -> Option<Self> {
        match s {
            "csv" => Some(Self::Csv),
            "json" => Some(Self::Json),
            "xlsx" => Some(Self::Xlsx),
            "pdf" => Some(Self::Pdf),
            "geojson" => Some(Self::GeoJson),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportDataSource {
    Missions,
    Students,
    Supervisors,
    Documents,
    Logs,
    // Exports croisés
    MissionsStudentsSupervisors,
    MissionsDocuments,
    StudentsMissions,
    LogsMissions,
}

impl std::fmt::Display for ExportDataSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExportDataSource::Missions => write!(f, "missions"),
            ExportDataSource::Students => write!(f, "students"),
            ExportDataSource::Supervisors => write!(f, "supervisors"),
            ExportDataSource::Documents => write!(f, "documents"),
            ExportDataSource::Logs => write!(f, "logs"),
            ExportDataSource::MissionsStudentsSupervisors => write!(f, "missions_students_supervisors"),
            ExportDataSource::MissionsDocuments => write!(f, "missions_documents"),
            ExportDataSource::StudentsMissions => write!(f, "students_missions"),
            ExportDataSource::LogsMissions => write!(f, "logs_missions"),
        }
    }
}

impl ExportDataSource {
    pub fn from_db_str(s: &str) -> Option<Self> {
        match s {
            "missions" => Some(Self::Missions),
            "students" => Some(Self::Students),
            "supervisors" => Some(Self::Supervisors),
            "documents" => Some(Self::Documents),
            "logs" => Some(Self::Logs),
            "missions_students_supervisors" => Some(Self::MissionsStudentsSupervisors),
            "missions_documents" => Some(Self::MissionsDocuments),
            "students_missions" => Some(Self::StudentsMissions),
            "logs_missions" => Some(Self::LogsMissions),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportRequest {
    pub source: ExportDataSource,
    pub filters: ExportFilters,
    pub format: ExportFormat,
    pub template_id: Option<Uuid>, // Pour Phase 2
    pub columns: Option<Vec<String>>,
    pub pdf_options: Option<PdfOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfOptions {
    pub title: Option<String>,
    pub orientation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportFilters {
    pub date_range: Option<DateRange>,
    pub status: Option<Vec<String>>,
    pub theme: Option<Vec<String>>,
    pub region_id: Option<i32>,
    pub commune_id: Option<i32>,
    pub maille_id: Option<Uuid>,
    pub student_id: Option<Uuid>,
    pub supervisor_id: Option<Uuid>,
    // Pour Phase 2 : agrégations
    pub group_by: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub start: chrono::NaiveDate,
    pub end: chrono::NaiveDate,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportJobResponse {
    pub job_id: Uuid,
    pub status: ExportJobStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub finished_at: Option<chrono::DateTime<chrono::Utc>>,
    pub file_path: Option<String>,
    pub file_size: Option<i64>,
    pub format: ExportFormat,
    pub source: ExportDataSource,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportJobStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportHistoryItem {
    pub id: Uuid,
    pub source: ExportDataSource,
    pub format: ExportFormat,
    pub filters: ExportFilters,
    pub status: ExportJobStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub created_by: String, // user_id ou username
    pub file_path: Option<String>,
    pub file_size: Option<i64>, // bytes
}
