// Rate limiting pour les opérations DB Manager
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct RateLimiter {
    requests: Arc<RwLock<HashMap<String, Vec<Instant>>>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window_secs: u64) -> Self {
        Self {
            requests: Arc::new(RwLock::new(HashMap::new())),
            max_requests,
            window: Duration::from_secs(window_secs),
        }
    }

    /// Vérifie si la requête est autorisée
    pub async fn check_rate_limit(&self, key: &str) -> bool {
        let mut requests = self.requests.write().await;
        let now = Instant::now();

        // Nettoyer les anciennes requêtes
        let entry = requests.entry(key.to_string()).or_insert_with(Vec::new);
        entry.retain(|&instant| now.duration_since(instant) < self.window);

        // Vérifier la limite
        if entry.len() >= self.max_requests {
            return false;
        }

        // Ajouter la nouvelle requête
        entry.push(now);
        true
    }

    /// Nettoie périodiquement les entrées expirées
    pub async fn cleanup(&self) {
        let mut requests = self.requests.write().await;
        let now = Instant::now();

        requests.retain(|_, instants| {
            instants.retain(|&instant| now.duration_since(instant) < self.window);
            !instants.is_empty()
        });
    }
}

/// Configuration par défaut : 100 requêtes par minute
pub fn default_rate_limiter() -> RateLimiter {
    RateLimiter::new(100, 60)
}

/// Configuration stricte pour opérations dangereuses : 10 requêtes par minute
pub fn strict_rate_limiter() -> RateLimiter {
    RateLimiter::new(10, 60)
}
