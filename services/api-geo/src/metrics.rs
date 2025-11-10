// Metrics Prometheus pour monitoring
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct Metrics {
    // Compteurs
    pub db_operations_total: Arc<AtomicU64>,
    pub db_errors_total: Arc<AtomicU64>,
    pub staging_commits_total: Arc<AtomicU64>,
    pub staging_rollbacks_total: Arc<AtomicU64>,
    pub staging_commits_failed_total: Arc<AtomicU64>,
    pub ddl_dryrun_total: Arc<AtomicU64>,
    pub backups_created_total: Arc<AtomicU64>,
    pub rate_limit_hits_total: Arc<AtomicU64>,

    // Histogrammes (durées en ms)
    pub operation_durations: Arc<RwLock<HashMap<String, Vec<u64>>>>,
}

impl Metrics {
    pub fn new() -> Self {
        Self {
            db_operations_total: Arc::new(AtomicU64::new(0)),
            db_errors_total: Arc::new(AtomicU64::new(0)),
            staging_commits_total: Arc::new(AtomicU64::new(0)),
            staging_rollbacks_total: Arc::new(AtomicU64::new(0)),
            staging_commits_failed_total: Arc::new(AtomicU64::new(0)),
            ddl_dryrun_total: Arc::new(AtomicU64::new(0)),
            backups_created_total: Arc::new(AtomicU64::new(0)),
            rate_limit_hits_total: Arc::new(AtomicU64::new(0)),
            operation_durations: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn inc_db_operations(&self) {
        self.db_operations_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_db_errors(&self) {
        self.db_errors_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_staging_commits(&self) {
        self.staging_commits_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_backups_created(&self) {
        self.backups_created_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_rate_limit_hits(&self) {
        self.rate_limit_hits_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_staging_rollbacks(&self) {
        self.staging_rollbacks_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_staging_commits_failed(&self) {
        self.staging_commits_failed_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_ddl_dryrun(&self) {
        self.ddl_dryrun_total.fetch_add(1, Ordering::Relaxed);
    }

    pub async fn record_duration(&self, operation: &str, duration_ms: u64) {
        let mut durations = self.operation_durations.write().await;
        durations
            .entry(operation.to_string())
            .or_insert_with(Vec::new)
            .push(duration_ms);

        // Garder seulement les 1000 dernières mesures
        if let Some(vec) = durations.get_mut(operation) {
            if vec.len() > 1000 {
                vec.drain(0..vec.len() - 1000);
            }
        }
    }

    /// Génère le format Prometheus
    pub async fn to_prometheus(&self) -> String {
        let mut output = String::new();

        // Compteurs
        output.push_str("# HELP db_operations_total Total database operations\n");
        output.push_str("# TYPE db_operations_total counter\n");
        output.push_str(&format!(
            "db_operations_total {}\n",
            self.db_operations_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP db_errors_total Total database errors\n");
        output.push_str("# TYPE db_errors_total counter\n");
        output.push_str(&format!(
            "db_errors_total {}\n",
            self.db_errors_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP staging_commits_total Total staging commits\n");
        output.push_str("# TYPE staging_commits_total counter\n");
        output.push_str(&format!(
            "staging_commits_total {}\n",
            self.staging_commits_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP backups_created_total Total backups created\n");
        output.push_str("# TYPE backups_created_total counter\n");
        output.push_str(&format!(
            "backups_created_total {}\n",
            self.backups_created_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP rate_limit_hits_total Total rate limit hits\n");
        output.push_str("# TYPE rate_limit_hits_total counter\n");
        output.push_str(&format!(
            "rate_limit_hits_total {}\n",
            self.rate_limit_hits_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP staging_rollbacks_total Total staging rollbacks\n");
        output.push_str("# TYPE staging_rollbacks_total counter\n");
        output.push_str(&format!(
            "staging_rollbacks_total {}\n",
            self.staging_rollbacks_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP staging_commits_failed_total Total failed staging commits\n");
        output.push_str("# TYPE staging_commits_failed_total counter\n");
        output.push_str(&format!(
            "staging_commits_failed_total {}\n",
            self.staging_commits_failed_total.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP ddl_dryrun_total Total DDL dry-run operations\n");
        output.push_str("# TYPE ddl_dryrun_total counter\n");
        output.push_str(&format!(
            "ddl_dryrun_total {}\n",
            self.ddl_dryrun_total.load(Ordering::Relaxed)
        ));

        // Histogrammes
        let durations = self.operation_durations.read().await;
        for (operation, values) in durations.iter() {
            if values.is_empty() {
                continue;
            }

            let mut sorted = values.clone();
            sorted.sort_unstable();

            let count = sorted.len();
            let sum: u64 = sorted.iter().sum();
            let p50 = sorted[count / 2];
            let p95 = sorted[(count * 95) / 100];
            let p99 = sorted[(count * 99) / 100];

            output.push_str(&format!(
                "# HELP operation_duration_ms_{} Operation duration in milliseconds\n",
                operation
            ));
            output.push_str(&format!(
                "# TYPE operation_duration_ms_{} summary\n",
                operation
            ));
            output.push_str(&format!(
                "operation_duration_ms_{}_sum {}\n",
                operation, sum
            ));
            output.push_str(&format!(
                "operation_duration_ms_{}_count {}\n",
                operation, count
            ));
            output.push_str(&format!(
                "operation_duration_ms_{}{{quantile=\"0.5\"}} {}\n",
                operation, p50
            ));
            output.push_str(&format!(
                "operation_duration_ms_{}{{quantile=\"0.95\"}} {}\n",
                operation, p95
            ));
            output.push_str(&format!(
                "operation_duration_ms_{}{{quantile=\"0.99\"}} {}\n",
                operation, p99
            ));
        }

        output
    }
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}
