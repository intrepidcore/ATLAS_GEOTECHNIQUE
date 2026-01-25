//! Types et DTOs pour Atlas Colab

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ============================================================================
// Enums
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MissionTheme {
    Stabilisation,
    Synthese,
    Reconnaissance,
    EtudeDetaillee,
    Controle,
}

impl MissionTheme {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Stabilisation => "stabilisation",
            Self::Synthese => "synthese",
            Self::Reconnaissance => "reconnaissance",
            Self::EtudeDetaillee => "etude_detaillee",
            Self::Controle => "controle",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "stabilisation" => Some(Self::Stabilisation),
            "synthese" => Some(Self::Synthese),
            "reconnaissance" => Some(Self::Reconnaissance),
            "etude_detaillee" => Some(Self::EtudeDetaillee),
            "controle" => Some(Self::Controle),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MissionStatus {
    Draft,
    Planned,
    InProgress,
    Completed,
    Cancelled,
    Suspended,
}

impl MissionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Planned => "planned",
            Self::InProgress => "in_progress",
            Self::Completed => "completed",
            Self::Cancelled => "cancelled",
            Self::Suspended => "suspended",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "draft" => Some(Self::Draft),
            "planned" => Some(Self::Planned),
            "in_progress" => Some(Self::InProgress),
            "completed" => Some(Self::Completed),
            "cancelled" => Some(Self::Cancelled),
            "suspended" => Some(Self::Suspended),
            _ => None,
        }
    }
}

// ============================================================================
// Mission DTOs
// ============================================================================

/// Mission résumée pour liste
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissionListItem {
    pub id: Uuid,
    pub code: String,
    pub title: String,
    pub theme: String,
    pub status: String,
    pub maille_id: Option<Uuid>,
    pub zone_label: Option<String>,
    pub commune: Option<String>,
    pub region: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub expected_sondages: i32,
    pub supervisor_name: Option<String>,
    pub supervisor_id: Option<Uuid>,
    pub assigned_students_count: i64,
    pub linked_sondages_count: i64,
    pub field_logs_count: i64,
    pub documents_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Mission détaillée
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissionDetail {
    pub id: Uuid,
    pub code: String,
    pub title: String,
    pub theme: String,
    pub status: String,
    pub maille_id: Option<Uuid>,
    pub zone_label: Option<String>,
    pub commune: Option<String>,
    pub region: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub expected_sondages: i32,
    pub description: Option<String>,
    pub objectifs: Option<String>,
    pub notes_internal: Option<String>,
    // Superviseur
    pub supervisor: Option<SupervisorSummary>,
    // Créateur
    pub created_by: Option<UserSummary>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Relations
    pub assigned_students: Vec<AssignedStudent>,
    pub linked_sondages: Vec<LinkedSondage>,
}

/// Résumé superviseur
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupervisorSummary {
    pub id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub full_name: String,
    pub specialite: Option<String>,
    pub institution: Option<String>,
    pub is_active: bool,
}

/// Résumé utilisateur
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSummary {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub full_name: Option<String>,
}

/// Étudiant assigné à une mission
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignedStudent {
    pub assignment_id: Uuid,
    pub student_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub full_name: String,
    pub matricule: Option<String>,
    pub promotion: String,
    pub role: String,
    pub assigned_at: DateTime<Utc>,
}

/// Sondage lié à une mission
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkedSondage {
    pub link_id: Uuid,
    pub sondage_id: Uuid,
    pub sondage_code: Option<String>,
    pub role: String,
    pub linked_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColabDocument {
    pub id: Uuid,
    pub mission_id: Uuid,
    pub uploaded_by: Uuid,
    pub title: String,
    pub document_type: String,
    pub description: Option<String>,
    pub file_path: String,
    pub file_name: String,
    pub file_size_bytes: Option<i64>,
    pub mime_type: Option<String>,
    pub sondage_id: Option<Uuid>,
    pub version: i32,
    pub is_current: bool,
    pub uploaded_at: DateTime<Utc>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColabDocumentsListResponse {
    pub documents: Vec<ColabDocument>,
    pub total: usize,
}

// ============================================================================
// Requêtes de création/modification
// ============================================================================

/// Création d'une mission
#[derive(Debug, Clone, Deserialize, Validate)]
pub struct CreateMissionRequest {
    #[validate(length(min = 1, max = 50))]
    pub code: String,
    
    #[validate(length(min = 1, max = 200))]
    pub title: String,
    
    pub theme: String, // sera validé manuellement
    
    pub maille_id: Option<Uuid>,
    pub zone_label: Option<String>,
    pub commune: Option<String>,
    pub region: Option<String>,
    
    pub supervisor_id: Option<Uuid>,
    
    pub expected_sondages: Option<i32>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    
    pub description: Option<String>,
    pub objectifs: Option<String>,
    pub notes_internal: Option<String>,

    /// Liste d'étudiants à assigner à la mission (création transactionnelle)
    #[serde(default)]
    pub assigned_student_ids: Vec<Uuid>,
}

// ============================================================================
// Suggest DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailleSuggestItem {
    pub id: Uuid,
    pub code: String,
    pub adm1_name: Option<String>,
    pub adm2_name: Option<String>,
    pub adm3_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSuggestItem {
    pub id: Uuid,
    pub label: String,
}

// ============================================================================
// CRUD Étudiants / Superviseurs
// ============================================================================

#[derive(Debug, Clone, Deserialize, Validate)]
pub struct CreateStudentRequest {
    #[validate(email(message = "Email invalide"))]
    pub email: String,
    #[validate(length(min = 1, max = 100))]
    pub first_name: String,
    #[validate(length(min = 1, max = 100))]
    pub last_name: String,

    pub telephone: Option<String>,

    pub matricule: Option<String>,
    #[validate(length(min = 4, max = 20))]
    pub promotion: String,
    pub filiere: Option<String>,
    pub etablissement: Option<String>,
    pub niveau: Option<String>,
    pub age: Option<i32>,
}

#[derive(Debug, Clone, Deserialize, Validate)]
pub struct CreateSupervisorRequest {
    #[validate(email(message = "Email invalide"))]
    pub email: String,
    #[validate(length(min = 1, max = 100))]
    pub first_name: String,
    #[validate(length(min = 1, max = 100))]
    pub last_name: String,

    pub titre: Option<String>,
    pub institution: Option<String>,
    pub departement: Option<String>,
    pub specialite: Option<String>,
    pub telephone: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Validate)]
pub struct UpdateStudentRequest {
    #[validate(email(message = "Email invalide"))]
    pub email: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub first_name: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub last_name: Option<String>,

    pub telephone: Option<String>,

    pub matricule: Option<String>,
    #[validate(length(min = 4, max = 20))]
    pub promotion: Option<String>,
    pub filiere: Option<String>,
    pub etablissement: Option<String>,
    pub niveau: Option<String>,
    pub age: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Validate)]
pub struct UpdateSupervisorRequest {
    #[validate(email(message = "Email invalide"))]
    pub email: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub first_name: Option<String>,
    #[validate(length(min = 1, max = 100))]
    pub last_name: Option<String>,

    pub titre: Option<String>,
    pub institution: Option<String>,
    pub departement: Option<String>,
    pub specialite: Option<String>,
    pub telephone: Option<String>,
    pub notes: Option<String>,
    pub is_active: Option<bool>,
}

/// Mise à jour d'une mission
#[derive(Debug, Clone, Deserialize, Validate)]
pub struct UpdateMissionRequest {
    #[validate(length(min = 1, max = 200))]
    pub title: Option<String>,
    
    pub theme: Option<String>,
    pub status: Option<String>,
    
    pub maille_id: Option<Uuid>,
    pub zone_label: Option<String>,
    pub commune: Option<String>,
    pub region: Option<String>,
    
    pub supervisor_id: Option<Uuid>,
    
    pub expected_sondages: Option<i32>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    
    pub description: Option<String>,
    pub objectifs: Option<String>,
    pub notes_internal: Option<String>,
}

// ============================================================================
// Filtres de recherche
// ============================================================================

/// Filtres pour la liste des missions
#[derive(Debug, Clone, Deserialize, Default)]
pub struct MissionFilters {
    pub theme: Option<String>,
    pub status: Option<String>,
    pub commune: Option<String>,
    pub region: Option<String>,
    pub promotion: Option<String>,
    pub supervisor_id: Option<Uuid>,
    pub search: Option<String>, // recherche texte libre (code, titre)
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

// ============================================================================
// Réponses paginées
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct MissionListResponse {
    pub missions: Vec<MissionListItem>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

// ============================================================================
// Statistiques
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct ColabStats {
    pub total_missions: i64,
    pub missions_by_status: Vec<StatusCount>,
    pub missions_by_theme: Vec<ThemeCount>,
    pub total_students: i64,
    pub total_supervisors: i64,
    pub total_field_logs: i64,
    pub total_documents: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatusCount {
    pub status: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ThemeCount {
    pub theme: String,
    pub count: i64,
}
