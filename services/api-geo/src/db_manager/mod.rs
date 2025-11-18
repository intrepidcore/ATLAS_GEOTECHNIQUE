// Module de gestion de base de données pour l'UI admin
pub mod audit;
pub mod backup;
pub mod backup_retention;
pub mod dryrun;
pub mod field_calculator;
pub mod import_export;
pub mod locks;
pub mod pagination;
pub mod pg_types;
pub mod rate_limit;
pub mod routes;
pub mod schema;
pub mod staging;
pub mod staging_dryrun;
pub mod staging_routes;
pub mod table;
pub mod types;
pub mod versioning;

// Re-export tous les types publics (nécessaire pour routes)
pub use audit::create_audit_entry;
pub use backup::{create_backup, restore_backup};
pub use dryrun::DryRunResult;
pub use locks::{acquire_lock, release_lock, StagingLock};
pub use pg_types::{get_postgres_types, PostgresType};
pub use schema::get_database_schema;
pub use staging::{cancel_staging, commit_staging, create_staging};
pub use table::get_table_data;
#[allow(ambiguous_glob_reexports)]
pub use types::*;
