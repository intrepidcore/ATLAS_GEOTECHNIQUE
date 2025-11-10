// Tests d'intégration pour le DB Manager
#[cfg(test)]
mod db_manager_tests {
    use sqlx::PgPool;

    async fn setup_test_db() -> PgPool {
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://atlas:atlas@localhost:5432/atlas_clean".to_string());

        PgPool::connect(&database_url)
            .await
            .expect("Failed to connect to test database")
    }

    #[tokio::test]
    async fn test_get_database_schema() {
        let pool = setup_test_db().await;

        let result = api_geo::db_manager::get_database_schema(&pool).await;

        assert!(result.is_ok(), "Should retrieve database schema");
        let schema = result.unwrap();
        assert!(
            !schema.schemas.is_empty(),
            "Should have at least one schema"
        );
    }

    #[tokio::test]
    async fn test_create_and_cancel_staging() {
        let pool = setup_test_db().await;

        // Créer un staging
        let staging_result = api_geo::db_manager::create_staging(&pool, "atlas", "communes").await;

        assert!(staging_result.is_ok(), "Should create staging");
        let staging_info = staging_result.unwrap();

        // Annuler le staging
        let cancel_result =
            api_geo::db_manager::cancel_staging(&pool, &staging_info.staging_id).await;

        assert!(cancel_result.is_ok(), "Should cancel staging");
    }

    #[tokio::test]
    async fn test_validate_staging() {
        let pool = setup_test_db().await;

        // Créer un staging
        let staging_info = api_geo::db_manager::create_staging(&pool, "atlas", "communes")
            .await
            .unwrap();

        // Valider
        let validation =
            api_geo::db_manager::validate_staging(&pool, &staging_info.staging_id).await;

        assert!(validation.is_ok(), "Should validate staging");
        let result = validation.unwrap();
        assert!(result.is_valid, "Empty staging should be valid");

        // Cleanup
        let _ = api_geo::db_manager::cancel_staging(&pool, &staging_info.staging_id).await;
    }

    #[tokio::test]
    async fn test_backup_create_and_list() {
        let pool = setup_test_db().await;

        let backup_req = api_geo::db_manager::CreateBackupRequest {
            tables: vec!["atlas.communes".to_string()],
            description: Some("Test backup".to_string()),
        };

        let backup_result = api_geo::db_manager::create_backup(&pool, backup_req).await;
        assert!(backup_result.is_ok(), "Should create backup");

        let list_result = api_geo::db_manager::list_backups(&pool).await;
        assert!(list_result.is_ok(), "Should list backups");
        assert!(
            !list_result.unwrap().is_empty(),
            "Should have at least one backup"
        );
    }

    #[tokio::test]
    async fn test_postgres_types() {
        let types = api_geo::db_manager::get_postgres_types();

        assert!(!types.is_empty(), "Should have PostgreSQL types");
        assert!(
            types.iter().any(|t| t.name == "text"),
            "Should have text type"
        );
        assert!(
            types.iter().any(|t| t.name == "integer"),
            "Should have integer type"
        );
        assert!(
            types.iter().any(|t| t.category == "geometry"),
            "Should have geometry types"
        );
    }

    #[tokio::test]
    async fn test_dryrun_add_column() {
        let pool = setup_test_db().await;

        let request = api_geo::db_manager::AddColumnRequest {
            name: "test_column".to_string(),
            data_type: "TEXT".to_string(),
            is_nullable: true,
            default_value: None,
            ui_label: None,
            ui_unit: None,
        };

        let result =
            api_geo::db_manager::dryrun_add_column(&pool, "atlas", "communes", &request).await;

        assert!(result.is_ok(), "Dry-run should succeed");
        let dryrun = result.unwrap();
        assert!(
            dryrun.sql.contains("ALTER TABLE"),
            "Should generate ALTER TABLE SQL"
        );
        assert!(
            dryrun.sql.contains("test_column"),
            "Should include column name"
        );
    }
}
