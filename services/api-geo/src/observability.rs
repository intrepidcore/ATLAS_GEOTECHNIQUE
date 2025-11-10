// Observabilité : logs structurés et metrics
use serde::Serialize;
use std::time::Instant;

#[derive(Debug, Serialize)]
pub struct StructuredLog {
    pub timestamp: String,
    pub level: String,
    pub user: Option<String>,
    pub action: String,
    pub table: Option<String>,
    pub rows_affected: Option<i64>,
    pub duration_ms: Option<u128>,
    pub request_id: Option<String>,
    pub error: Option<String>,
    pub details: Option<serde_json::Value>,
}

impl StructuredLog {
    pub fn new(action: &str) -> Self {
        Self {
            timestamp: chrono::Utc::now().to_rfc3339(),
            level: "INFO".to_string(),
            user: None,
            action: action.to_string(),
            table: None,
            rows_affected: None,
            duration_ms: None,
            request_id: None,
            error: None,
            details: None,
        }
    }

    pub fn with_user(mut self, user: &str) -> Self {
        self.user = Some(user.to_string());
        self
    }

    pub fn with_table(mut self, table: &str) -> Self {
        self.table = Some(table.to_string());
        self
    }

    pub fn with_rows_affected(mut self, rows: i64) -> Self {
        self.rows_affected = Some(rows);
        self
    }

    pub fn with_duration(mut self, duration: u128) -> Self {
        self.duration_ms = Some(duration);
        self
    }

    pub fn with_request_id(mut self, id: &str) -> Self {
        self.request_id = Some(id.to_string());
        self
    }

    pub fn with_error(mut self, error: &str) -> Self {
        self.level = "ERROR".to_string();
        self.error = Some(error.to_string());
        self
    }

    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }

    pub fn log(&self) {
        let json = serde_json::to_string(self).unwrap_or_else(|_| "{}".to_string());
        println!("{}", json);
    }
}

/// Timer pour mesurer la durée d'une opération
pub struct OperationTimer {
    start: Instant,
    action: String,
}

impl OperationTimer {
    pub fn new(action: &str) -> Self {
        Self {
            start: Instant::now(),
            action: action.to_string(),
        }
    }

    pub fn finish(self) -> u128 {
        let duration = self.start.elapsed().as_millis();
        StructuredLog::new(&self.action)
            .with_duration(duration)
            .log();
        duration
    }

    pub fn finish_with_rows(self, rows: i64) -> u128 {
        let duration = self.start.elapsed().as_millis();
        StructuredLog::new(&self.action)
            .with_duration(duration)
            .with_rows_affected(rows)
            .log();
        duration
    }

    pub fn finish_with_error(self, error: &str) -> u128 {
        let duration = self.start.elapsed().as_millis();
        StructuredLog::new(&self.action)
            .with_duration(duration)
            .with_error(error)
            .log();
        duration
    }
}

/// Macro pour logger facilement
#[macro_export]
macro_rules! log_operation {
    ($action:expr) => {
        $crate::observability::OperationTimer::new($action)
    };
}

#[macro_export]
macro_rules! log_info {
    ($action:expr, $($key:ident = $value:expr),*) => {{
        let mut log = $crate::observability::StructuredLog::new($action);
        $(
            log = log.$key($value);
        )*
        log.log();
    }};
}
