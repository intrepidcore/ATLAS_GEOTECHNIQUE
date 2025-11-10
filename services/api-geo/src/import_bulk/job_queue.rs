// ============================================================================
// Job Queue: Gestion asynchrone des imports
// ============================================================================

use super::importer::process_import;
use super::types::*;
use anyhow::Result;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

// ============================================================================
// TYPES
// ============================================================================

#[derive(Clone)]
pub struct ImportJob {
    #[allow(dead_code)]
    pub import_id: Uuid,
    pub rows: Vec<ParsedRow>,
    pub mapping: MappingConfig,
    pub geoloc_config: GeolocationConfig,
}

#[derive(Debug, Clone)]
pub struct JobStatus {
    #[allow(dead_code)]
    pub import_id: Uuid,
    pub status: ImportStatus,
    pub progress: f32,
    pub stats: Option<ImportStats>,
    pub error_message: Option<String>,
    pub started_at: Option<chrono::NaiveDateTime>,
    pub completed_at: Option<chrono::NaiveDateTime>,
}

impl Default for JobStatus {
    fn default() -> Self {
        Self {
            import_id: Uuid::new_v4(),
            status: ImportStatus::Pending,
            progress: 0.0,
            stats: None,
            error_message: None,
            started_at: None,
            completed_at: None,
        }
    }
}

// ============================================================================
// JOB QUEUE
// ============================================================================

pub struct JobQueue {
    jobs: Arc<RwLock<HashMap<Uuid, JobStatus>>>,
    tx: mpsc::Sender<(ImportJob, Arc<PgPool>)>,
}

impl JobQueue {
    pub fn new() -> Self {
        let (tx, mut rx) = mpsc::channel::<(ImportJob, Arc<PgPool>)>(100);
        let jobs = Arc::new(RwLock::new(HashMap::new()));

        // Worker thread principal
        let jobs_clone = jobs.clone();
        tokio::spawn(async move {
            while let Some((job, pool)) = rx.recv().await {
                let jobs = jobs_clone.clone();
                let pool_clone = pool.clone();

                // Spawner un task par job pour parallélisation
                tokio::spawn(async move {
                    if let Err(e) = process_import_job(job, pool_clone, jobs).await {
                        tracing::error!("Erreur traitement job: {}", e);
                    }
                });
            }
        });

        Self { jobs, tx }
    }

    /// Soumettre un nouveau job
    pub async fn submit(&self, job: ImportJob, pool: Arc<PgPool>) -> Result<Uuid> {
        let import_id = job.import_id;

        // Créer statut initial
        let status = JobStatus {
            import_id,
            status: ImportStatus::Pending,
            progress: 0.0,
            stats: None,
            error_message: None,
            started_at: None,
            completed_at: None,
        };

        self.jobs.write().await.insert(import_id, status);

        // Envoyer job au worker
        self.tx
            .send((job, pool))
            .await
            .map_err(|e| anyhow::anyhow!("Erreur soumission job: {}", e))?;

        Ok(import_id)
    }

    /// Récupérer statut d'un job
    #[allow(dead_code)]
    pub async fn get_status(&self, import_id: &Uuid) -> Option<JobStatus> {
        self.jobs.read().await.get(import_id).cloned()
    }

    /// Annuler un job (marque comme cancelled, mais ne stoppe pas vraiment)
    #[allow(dead_code)]
    pub async fn cancel(&self, import_id: &Uuid) -> Result<()> {
        if let Some(status) = self.jobs.write().await.get_mut(import_id) {
            if status.status == ImportStatus::Running {
                status.status = ImportStatus::Cancelled;
                status.completed_at = Some(chrono::Utc::now().naive_utc());
            }
        }
        Ok(())
    }

    /// Nettoyer jobs terminés (garder seulement 1000 derniers)
    #[allow(dead_code)]
    pub async fn cleanup_old_jobs(&self) {
        let mut jobs = self.jobs.write().await;

        if jobs.len() > 1000 {
            let mut completed: Vec<_> = jobs
                .iter()
                .filter(|(_, s)| {
                    matches!(
                        s.status,
                        ImportStatus::Succeeded
                            | ImportStatus::Failed
                            | ImportStatus::Partial
                            | ImportStatus::Cancelled
                    )
                })
                .map(|(id, _)| *id)
                .collect();

            // Garder les 1000 plus récents
            if completed.len() > 1000 {
                completed.sort_by_key(|id| {
                    jobs.get(id)
                        .and_then(|s| s.completed_at)
                        .unwrap_or_default()
                });

                for id in completed.iter().take(completed.len() - 1000) {
                    jobs.remove(id);
                }
            }
        }
    }

    /// Lister tous les jobs actifs
    #[allow(dead_code)]
    pub async fn list_active_jobs(&self) -> Vec<JobStatus> {
        self.jobs
            .read()
            .await
            .values()
            .filter(|s| matches!(s.status, ImportStatus::Pending | ImportStatus::Running))
            .cloned()
            .collect()
    }
}

// ============================================================================
// TRAITEMENT JOB
// ============================================================================

async fn process_import_job(
    job: ImportJob,
    pool: Arc<PgPool>,
    jobs: Arc<RwLock<HashMap<Uuid, JobStatus>>>,
) -> Result<()> {
    let import_id = job.import_id;

    // Mettre statut Running
    {
        let mut jobs_guard = jobs.write().await;
        if let Some(status) = jobs_guard.get_mut(&import_id) {
            status.status = ImportStatus::Running;
            status.started_at = Some(chrono::Utc::now().naive_utc());
            status.progress = 0.0;
        }
    }

    // Exécuter import
    let result = process_import(&pool, import_id, job.rows, &job.mapping, &job.geoloc_config).await;

    // Mettre à jour statut final
    {
        let mut jobs_guard = jobs.write().await;
        if let Some(status) = jobs_guard.get_mut(&import_id) {
            match result {
                Ok(stats) => {
                    status.status = if stats.errors == 0 {
                        ImportStatus::Succeeded
                    } else if stats.valid_rows > 0 {
                        ImportStatus::Partial
                    } else {
                        ImportStatus::Failed
                    };
                    status.progress = 100.0;
                    status.stats = Some(stats);
                    status.completed_at = Some(chrono::Utc::now().naive_utc());
                }
                Err(e) => {
                    status.status = ImportStatus::Failed;
                    status.error_message = Some(e.to_string());
                    status.completed_at = Some(chrono::Utc::now().naive_utc());
                }
            }
        }
    }

    Ok(())
}

// ============================================================================
// SINGLETON GLOBAL
// ============================================================================

use once_cell::sync::Lazy;

pub static JOB_QUEUE: Lazy<JobQueue> = Lazy::new(JobQueue::new);

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_job_queue_submit_and_status() {
        let queue = JobQueue::new();
        let pool = Arc::new(PgPool::connect("postgres://test").await.unwrap());

        let job = ImportJob {
            import_id: Uuid::new_v4(),
            rows: vec![],
            mapping: MappingConfig::default(),
            geoloc_config: GeolocationConfig {
                mode: GeolocationMode::Unknown,
                seed: None,
                jitter_radius: None,
            },
        };

        let import_id = queue.submit(job, pool).await.unwrap();

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let status = queue.get_status(&import_id).await;
        assert!(status.is_some());
    }
}
