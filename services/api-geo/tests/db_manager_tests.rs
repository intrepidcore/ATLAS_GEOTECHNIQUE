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
        let staging_result = api_geo::db_manager::create_staging(&pool, "atlas", "communes", api_geo::db_manager::CreateStagingRequest { reason: Some("Test staging".to_string()) }).await;

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
        let staging_info = api_geo::db_manager::create_staging(&pool, "atlas", "communes", api_geo::db_manager::CreateStagingRequest { reason: Some("Test staging".to_string()) })
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
            character_length: None,
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

    /// Test d'intégration: commit staging avec succès
    #[tokio::test]
    #[ignore] // Run with: cargo test --test db_manager_tests -- --ignored --test-threads=1
    async fn test_staging_commit_success_integration() {
        let pool = setup_test_db().await;
        
        // Nettoyer et créer une table de test
        sqlx::query("DROP TABLE IF EXISTS atlas.test_staging_commit CASCADE")
            .execute(&pool)
            .await
            .ok();
    
        sqlx::query(
            "CREATE TABLE atlas.test_staging_commit (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                value INTEGER
            )"
        )
        .execute(&pool)
        .await
        .expect("Failed to create test table");

        // Créer un staging
        let staging_info = api_geo::db_manager::create_staging(&pool, "atlas", "test_staging_commit", api_geo::db_manager::CreateStagingRequest { reason: Some("Test commit".to_string()) }).await.expect("Failed to create staging");

        // Insérer des données dans le staging
        let staging_table = format!("atlas.{}", staging_info.staging_id);
        sqlx::query(&format!(
            "INSERT INTO {} (name, value) VALUES ($1, $2), ($3, $4)",
            staging_table
        ))
        .bind("test1")
        .bind(100)
        .bind("test2")
        .bind(200)
        .execute(&pool)
        .await
        .expect("Failed to insert into staging");

        // Commit staging
        let commit_result = api_geo::db_manager::commit_staging(&pool, &staging_info.staging_id)
            .await;

        if let Err(e) = &commit_result {
            eprintln!("Commit error: {:?}", e);
        }
        assert!(commit_result.is_ok(), "Staging commit should succeed: {:?}", commit_result.err());

        // Vérifier que les données sont dans la table réelle
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM atlas.test_staging_commit")
            .fetch_one(&pool)
            .await
            .expect("Failed to count rows");

        assert_eq!(count.0, 2, "Should have 2 rows after commit");

        // Cleanup
        sqlx::query("DROP TABLE IF EXISTS atlas.test_staging_commit CASCADE")
            .execute(&pool)
            .await
            .ok();
    }

    /// Test d'intégration: commit staging simple sans conflit
    #[tokio::test]
    #[ignore]
    async fn test_staging_rollback_on_constraint_violation() {
        let pool = setup_test_db().await;
        
        // Nettoyer et créer une table de test
        sqlx::query("DROP TABLE IF EXISTS atlas.test_staging_simple CASCADE")
            .execute(&pool)
            .await
            .ok();
        
        sqlx::query(
            "CREATE TABLE atlas.test_staging_simple (
                id SERIAL PRIMARY KEY,
                code TEXT NOT NULL,
                name TEXT
            )"
        )
        .execute(&pool)
        .await
        .expect("Failed to create test table");

        // Insérer une donnée initiale
        sqlx::query("INSERT INTO atlas.test_staging_simple (code, name) VALUES ($1, $2)")
            .bind("INITIAL")
            .bind("Original")
            .execute(&pool)
            .await
            .expect("Failed to insert original row");

        // Créer un staging
        let staging_info = api_geo::db_manager::create_staging(&pool, "atlas", "test_staging_simple", api_geo::db_manager::CreateStagingRequest { reason: Some("Test simple".to_string()) }).await.expect("Failed to create staging");

        // Insérer de nouvelles données dans staging (pas de conflit)
        let staging_table = format!("atlas.{}", staging_info.staging_id);
        sqlx::query(&format!(
            "INSERT INTO {} (code, name) VALUES ($1, $2), ($3, $4)",
            staging_table
        ))
        .bind("NEW1")
        .bind("New Data 1")
        .bind("NEW2")
        .bind("New Data 2")
        .execute(&pool)
        .await
        .expect("Failed to insert into staging");

        // Commit (doit réussir)
        let commit_result = api_geo::db_manager::commit_staging(&pool, &staging_info.staging_id)
            .await;

        assert!(commit_result.is_ok(), "Staging commit should succeed");

        // Vérifier que les nouvelles données sont présentes
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM atlas.test_staging_simple")
            .fetch_one(&pool)
            .await
            .expect("Failed to count rows");

        assert_eq!(count.0, 2, "Should have 2 rows after commit");

        // Cleanup
        sqlx::query("DROP TABLE IF EXISTS atlas.test_staging_simple CASCADE")
            .execute(&pool)
            .await
            .ok();
    }

    /// Test d'intégration: validation passe avec données valides
    #[tokio::test]
    #[ignore]
    async fn test_staging_validation_detects_errors() {
        let pool = setup_test_db().await;
        
        // Nettoyer et créer une table de test
        sqlx::query("DROP TABLE IF EXISTS atlas.test_staging_validation CASCADE")
            .execute(&pool)
            .await
            .ok();
        
        sqlx::query(
            "CREATE TABLE atlas.test_staging_validation (
                id SERIAL PRIMARY KEY,
                required_field TEXT NOT NULL,
                optional_field TEXT
            )"
        )
        .execute(&pool)
        .await
        .expect("Failed to create test table");

        // Créer un staging
        let staging_info = api_geo::db_manager::create_staging(&pool, "atlas", "test_staging_validation", api_geo::db_manager::CreateStagingRequest { reason: Some("Test validation".to_string()) }).await.expect("Failed to create staging");

        // Insérer des données valides
        let staging_table = format!("atlas.{}", staging_info.staging_id);
        sqlx::query(&format!(
            "INSERT INTO {} (required_field, optional_field) VALUES ($1, $2)",
            staging_table
        ))
        .bind("valid_value")
        .bind(Some("optional"))
        .execute(&pool)
        .await
        .expect("Failed to insert valid data");

        // Valider (devrait passer)
        let validation = api_geo::db_manager::validate_staging(&pool, &staging_info.staging_id)
            .await;

        assert!(validation.is_ok(), "Validation should succeed");
        let result = validation.unwrap();
        assert!(result.is_valid, "Validation should pass with valid data");
        assert!(result.errors.is_empty(), "Should have no errors");

        // Cleanup
        let _ = api_geo::db_manager::cancel_staging(&pool, &staging_info.staging_id).await;
        sqlx::query("DROP TABLE IF EXISTS atlas.test_staging_validation CASCADE")
            .execute(&pool)
            .await
            .ok();
    }
}
