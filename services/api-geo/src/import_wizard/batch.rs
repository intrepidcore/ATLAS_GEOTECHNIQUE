// Import Wizard v2.3.0 - Batch tracking

use chrono::Utc;

/// Génère un batch_id unique au format IMP-YYYYMMDD-HHMMSS
pub fn generate_batch_id() -> String {
    let now = Utc::now();
    format!("IMP-{}", now.format("%Y%m%d-%H%M%S"))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_generate_batch_id() {
        let batch_id = generate_batch_id();
        assert!(batch_id.starts_with("IMP-"));
        assert_eq!(batch_id.len(), 20); // IMP-YYYYMMDD-HHMMSS
    }
}
