// ============================================================================
// Streaming: Traitement par chunks pour gros fichiers
// ============================================================================

#![allow(dead_code)]

use super::types::*;
use super::parser::*;
use super::transformer::{map_long_row, group_by_survey};
use super::importer::*;
use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CHUNK_SIZE: usize = 1000; // Lignes par chunk
const BATCH_SIZE: usize = 100;  // Inserts par batch

// ============================================================================
// STREAMING PROCESSOR
// ============================================================================

pub struct StreamingProcessor {
    pool: PgPool,
    import_id: Uuid,
    chunk_size: usize,
    batch_size: usize,
}

impl StreamingProcessor {
    pub fn new(pool: PgPool, import_id: Uuid) -> Self {
        Self {
            pool,
            import_id,
            chunk_size: CHUNK_SIZE,
            batch_size: BATCH_SIZE,
        }
    }

    pub fn with_chunk_size(mut self, size: usize) -> Self {
        self.chunk_size = size;
        self
    }

    pub fn with_batch_size(mut self, size: usize) -> Self {
        self.batch_size = size;
        self
    }

    /// Traiter fichier CSV en streaming
    pub async fn process_csv_stream(
        &self,
        bytes: &[u8],
        mapping: &MappingConfig,
        geoloc: &GeolocationConfig,
    ) -> Result<ImportStats> {
        let mut stats = ImportStats::default();
        
        // Parser CSV
        let parser = CsvParser::new(bytes)?;
        let rows = parser.parse(bytes)?;
        
        // Traiter par chunks
        for (chunk_idx, chunk) in rows.chunks(self.chunk_size).enumerate() {
            tracing::info!(
                "Traitement chunk {}/{} ({} lignes)",
                chunk_idx + 1,
                (rows.len() + self.chunk_size - 1) / self.chunk_size,
                chunk.len()
            );
            
            // Transformer chunk
            let mut parsed_rows = Vec::new();
            for (idx, row) in chunk.iter().enumerate() {
                let global_idx = (chunk_idx * self.chunk_size + idx) as i32;
                if let Ok(parsed) = map_long_row(row, global_idx, mapping) {
                    parsed_rows.push(parsed);
                }
            }
            
            // Grouper par sondage
            let surveys = group_by_survey(parsed_rows);
            
            // Import par batch
            let mut tx = self.pool.begin().await?;
            let chunk_stats = import_surveys(&mut tx, self.import_id, surveys, geoloc).await?;
            tx.commit().await?;
            
            // Agréger stats
            stats.total_rows += chunk_stats.total_rows;
            stats.valid_rows += chunk_stats.valid_rows;
            stats.sondages += chunk_stats.sondages;
            stats.essais += chunk_stats.essais;
            stats.warnings += chunk_stats.warnings;
            stats.errors += chunk_stats.errors;
            
            // Mise à jour progression
            let progress = ((chunk_idx + 1) as f32 / ((rows.len() + self.chunk_size - 1) / self.chunk_size) as f32) * 100.0;
            update_import_status(
                &self.pool,
                self.import_id,
                ImportStatus::Running,
                progress,
                Some(&stats),
                None,
            ).await?;
        }
        
        Ok(stats)
    }

    /// Traiter fichier XLSX en streaming (par feuille)
    pub async fn process_xlsx_stream(
        &self,
        bytes: &[u8],
        mapping: &MappingConfig,
        geoloc: &GeolocationConfig,
    ) -> Result<ImportStats> {
        // XLSX est chargé en mémoire par calamine
        // Pour très gros fichiers, utiliser CSV export
        let rows = XlsxParser::parse(bytes)?;
        
        // Traiter comme CSV
        self.process_rows_stream(&rows, mapping, geoloc).await
    }

    /// Traiter lignes génériques en streaming
    async fn process_rows_stream(
        &self,
        rows: &[std::collections::HashMap<String, String>],
        mapping: &MappingConfig,
        geoloc: &GeolocationConfig,
    ) -> Result<ImportStats> {
        let mut stats = ImportStats::default();
        
        for (chunk_idx, chunk) in rows.chunks(self.chunk_size).enumerate() {
            let mut parsed_rows = Vec::new();
            for (idx, row) in chunk.iter().enumerate() {
                let global_idx = (chunk_idx * self.chunk_size + idx) as i32;
                if let Ok(parsed) = map_long_row(row, global_idx, mapping) {
                    parsed_rows.push(parsed);
                }
            }
            
            let surveys = group_by_survey(parsed_rows);
            
            let mut tx = self.pool.begin().await?;
            let chunk_stats = import_surveys(&mut tx, self.import_id, surveys, geoloc).await?;
            tx.commit().await?;
            
            stats.total_rows += chunk_stats.total_rows;
            stats.valid_rows += chunk_stats.valid_rows;
            stats.sondages += chunk_stats.sondages;
            stats.essais += chunk_stats.essais;
            stats.warnings += chunk_stats.warnings;
            stats.errors += chunk_stats.errors;
            
            let progress = ((chunk_idx + 1) as f32 / ((rows.len() + self.chunk_size - 1) / self.chunk_size) as f32) * 100.0;
            update_import_status(
                &self.pool,
                self.import_id,
                ImportStatus::Running,
                progress,
                Some(&stats),
                None,
            ).await?;
        }
        
        Ok(stats)
    }
}

// ============================================================================
// BATCH INSERTER
// ============================================================================

pub struct BatchInserter {
    pool: PgPool,
    batch_size: usize,
}

impl BatchInserter {
    pub fn new(pool: PgPool, batch_size: usize) -> Self {
        Self { pool, batch_size }
    }

    /// Insérer sondages par batch
    pub async fn insert_surveys_batch(
        &self,
        surveys: Vec<GroupedSurvey>,
        import_id: Uuid,
        geoloc: &GeolocationConfig,
    ) -> Result<usize> {
        let mut total_inserted = 0;
        
        for batch in surveys.chunks(self.batch_size) {
            let mut tx = self.pool.begin().await?;
            let stats = import_surveys(&mut tx, import_id, batch.to_vec(), geoloc).await?;
            tx.commit().await?;
            
            total_inserted += stats.sondages as usize;
        }
        
        Ok(total_inserted)
    }
}

// ============================================================================
// HELPERS
// ============================================================================

/// Estimer taille mémoire d'un fichier
pub fn estimate_memory_usage(file_size: usize) -> usize {
    // Approximation: 3x la taille du fichier
    // (fichier brut + parsing + structures Rust)
    file_size * 3
}

/// Déterminer si streaming est nécessaire
pub fn should_use_streaming(file_size: usize) -> bool {
    const MAX_MEMORY_MB: usize = 100; // 100 MB
    estimate_memory_usage(file_size) > MAX_MEMORY_MB * 1024 * 1024
}

/// Calculer nombre optimal de chunks
pub fn calculate_optimal_chunks(total_rows: usize) -> usize {
    if total_rows <= CHUNK_SIZE {
        1
    } else {
        (total_rows + CHUNK_SIZE - 1) / CHUNK_SIZE
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_estimate_memory_usage() {
        assert_eq!(estimate_memory_usage(1024), 3072);
        assert_eq!(estimate_memory_usage(1024 * 1024), 3 * 1024 * 1024);
    }

    #[test]
    fn test_should_use_streaming() {
        // Petit fichier: pas de streaming
        assert!(!should_use_streaming(1024 * 1024)); // 1 MB
        
        // Gros fichier: streaming
        assert!(should_use_streaming(50 * 1024 * 1024)); // 50 MB
    }

    #[test]
    fn test_calculate_optimal_chunks() {
        assert_eq!(calculate_optimal_chunks(500), 1);
        assert_eq!(calculate_optimal_chunks(1000), 1);
        assert_eq!(calculate_optimal_chunks(1500), 2);
        assert_eq!(calculate_optimal_chunks(5000), 5);
    }
}
