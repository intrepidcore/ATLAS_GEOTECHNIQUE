use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;
use std::sync::Arc;
use moka::sync::Cache;
use std::time::Duration;

/// Clé de cache pour les données thématiques
#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CacheKey {
    pub parameter: String,
    pub bbox_hash: u64,
    pub adm1: Option<String>,
    pub zoom: Option<u8>,
    pub breaks_hash: u64,
}

impl CacheKey {
    #[allow(dead_code)]
    pub fn new(
        parameter: &str,
        bbox: Option<[f64; 4]>,
        adm1: Option<String>,
        zoom: Option<u8>,
        breaks: &[f64],
    ) -> Self {
        Self {
            parameter: parameter.to_string(),
            bbox_hash: Self::hash_bbox(bbox),
            adm1,
            zoom,
            breaks_hash: Self::hash_breaks(breaks),
        }
    }
    
    #[allow(dead_code)]
    fn hash_bbox(bbox: Option<[f64; 4]>) -> u64 {
        let mut hasher = DefaultHasher::new();
        if let Some(b) = bbox {
            for val in b.iter() {
                val.to_bits().hash(&mut hasher);
            }
        }
        hasher.finish()
    }
    
    #[allow(dead_code)]
    fn hash_breaks(breaks: &[f64]) -> u64 {
        let mut hasher = DefaultHasher::new();
        for val in breaks.iter() {
            val.to_bits().hash(&mut hasher);
        }
        hasher.finish()
    }
}

/// Cache pour les données thématiques
#[allow(dead_code)]
pub struct ThematicCache {
    cache: Cache<CacheKey, Arc<String>>,
}

impl ThematicCache {
    /// Créer un nouveau cache avec TTL de 60 secondes
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            cache: Cache::builder()
                .max_capacity(1000)
                .time_to_live(Duration::from_secs(60))
                .build(),
        }
    }
    
    /// Récupérer une valeur du cache
    #[allow(dead_code)]
    pub fn get(&self, key: &CacheKey) -> Option<Arc<String>> {
        self.cache.get(key)
    }
    
    /// Insérer une valeur dans le cache
    #[allow(dead_code)]
    pub fn insert(&self, key: CacheKey, value: String) {
        self.cache.insert(key, Arc::new(value));
    }
    
    /// Invalider tout le cache
    #[allow(dead_code)]
    pub fn invalidate_all(&self) {
        self.cache.invalidate_all();
    }
    
    /// Obtenir les statistiques du cache
    #[allow(dead_code)]
    pub fn stats(&self) -> (u64, u64) {
        (self.cache.entry_count(), self.cache.weighted_size())
    }
}

impl Default for ThematicCache {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_cache_key_creation() {
        let key1 = CacheKey::new(
            "ip_avg",
            Some([0.0, 0.0, 1.0, 1.0]),
            Some("Maritime".to_string()),
            Some(10),
            &[12.0, 25.0, 40.0],
        );
        
        let key2 = CacheKey::new(
            "ip_avg",
            Some([0.0, 0.0, 1.0, 1.0]),
            Some("Maritime".to_string()),
            Some(10),
            &[12.0, 25.0, 40.0],
        );
        
        assert_eq!(key1, key2);
    }
    
    #[test]
    fn test_cache_key_different_parameter() {
        let key1 = CacheKey::new("ip_avg", None, None, None, &[]);
        let key2 = CacheKey::new("vbs_avg", None, None, None, &[]);
        
        assert_ne!(key1, key2);
    }
    
    #[test]
    fn test_cache_insert_get() {
        let cache = ThematicCache::new();
        let key = CacheKey::new("ip_avg", None, None, None, &[]);
        
        cache.insert(key.clone(), "test_data".to_string());
        
        let result = cache.get(&key);
        assert!(result.is_some());
        assert_eq!(*result.unwrap(), "test_data");
    }
    
    #[test]
    fn test_cache_invalidate() {
        let cache = ThematicCache::new();
        let key = CacheKey::new("ip_avg", None, None, None, &[]);
        
        cache.insert(key.clone(), "test_data".to_string());
        assert!(cache.get(&key).is_some());
        
        cache.invalidate_all();
        assert!(cache.get(&key).is_none());
    }
}
