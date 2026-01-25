use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

use crate::export::formats::{ExportDataSource, ExportFormat, ExportFilters, ExportJobStatus};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ExportJob {
    pub id: Uuid,
    pub source: ExportDataSource,
    pub format: ExportFormat,
    pub filters: ExportFilters, // Stocké en JSON
    pub status: ExportJobStatus,
    pub created_by: String, // user_id ou username
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub file_path: Option<String>,
    pub file_size: Option<i64>,
    pub error: Option<String>,
}

impl ExportJob {
    pub fn new(source: ExportDataSource, format: ExportFormat, filters: ExportFilters, created_by: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            source,
            format,
            filters,
            status: ExportJobStatus::Pending,
            created_by,
            created_at: Utc::now(),
            started_at: None,
            finished_at: None,
            file_path: None,
            file_size: None,
            error: None,
        }
    }

    pub fn start(&mut self) {
        self.status = ExportJobStatus::Running;
        self.started_at = Some(Utc::now());
    }

    pub fn complete(&mut self, file_path: String, file_size: i64) {
        self.status = ExportJobStatus::Completed;
        self.finished_at = Some(Utc::now());
        self.file_path = Some(file_path);
        self.file_size = Some(file_size);
    }

    pub fn fail(&mut self, error: String) {
        self.status = ExportJobStatus::Failed;
        self.finished_at = Some(Utc::now());
        self.error = Some(error);
    }
}

impl ExportJobStatus {
    pub fn to_string(&self) -> String {
        match self {
            ExportJobStatus::Pending => "pending".to_string(),
            ExportJobStatus::Running => "running".to_string(),
            ExportJobStatus::Completed => "completed".to_string(),
            ExportJobStatus::Failed => "failed".to_string(),
        }
    }
}

// Table : colab_export_jobs
// CREATE TABLE atlas.colab_export_jobs (
//     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     source TEXT NOT NULL, -- ExportDataSource (enum)
//     format TEXT NOT NULL, -- ExportFormat (enum)
//     filters JSONB NOT NULL, -- ExportFilters
//     status TEXT NOT NULL DEFAULT 'pending', -- ExportJobStatus (enum)
//     created_by TEXT NOT NULL, -- user_id ou username
//     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//     started_at TIMESTAMP WITH TIME ZONE,
//     finished_at TIMESTAMP WITH TIME ZONE,
//     file_path TEXT,
//     file_size BIGINT,
//     error TEXT
// );

// Table : colab_export_logs (audit)
// CREATE TABLE atlas.colab_export_logs (
//     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     job_id UUID NOT NULL REFERENCES atlas.colab_export_jobs(id),
//     action TEXT NOT NULL, -- 'created', 'started', 'completed', 'failed', 'downloaded'
//     actor TEXT NOT NULL, -- user_id ou username
//     timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//     details JSONB -- optionnel : filtres utilisés, format, etc.
// );
