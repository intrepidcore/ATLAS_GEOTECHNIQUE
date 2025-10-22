// ============================================================================
// Module: Import Bulk - Complet selon cahier des charges
// ============================================================================
// Description: Gestion complète de l'import bulk de sondages géotechniques
// Version: 1.0
// Date: 2025-10-19
// Référence: docs/CAHIER_CHARGES_IMPORT_BULK.md
// ============================================================================

pub mod types;
pub mod parser;
pub mod validator;
pub mod matcher;
pub mod transformer;
pub mod importer;
pub mod job_queue;
pub mod routes;
pub mod xlsx_parser;
pub mod geotechnical_importer;

#[cfg(test)]
mod tests;

pub use routes::configure;
