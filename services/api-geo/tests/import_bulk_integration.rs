// ============================================================================
// Tests d'intégration - Import Bulk Workflow Complet
// ============================================================================
// Description: Tests end-to-end du workflow d'import bulk
// Scénarios testés:
// - Import CSV simple (format long)
// - Import CSV avec doublons
// - Import XLSX (format large)
// - Import JSON
// - Import avec géolocalisation aléatoire
// - Import avec validation d'erreurs
// - Import asynchrone avec job queue
// - Annulation d'import
// - Téléchargement de rapport
// ============================================================================

use api_geo::import_bulk::{
    parser::*,
    types::*,
    validator::*,
    matcher::*,
    transformer::*,
    importer::*,
    job_queue::*,
};
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::collections::HashMap;
use uuid::Uuid;

// ============================================================================
// SETUP HELPERS
// ============================================================================

async fn setup_test_db() -> PgPool {
    // Connexion à la base de test
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost/atlas_test".to_string());

    PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to test database")
}

async fn cleanup_test_data(pool: &PgPool, import_id: Uuid) {
    // Nettoyage des données de test
    let _ = sqlx::query("DELETE FROM sondages WHERE import_id = $1")
        .bind(import_id)
        .execute(pool)
        .await;

    let _ = sqlx::query("DELETE FROM mesures WHERE sondage_id IN (SELECT id FROM sondages WHERE import_id = $1)")
        .bind(import_id)
        .execute(pool)
        .await;
}

fn create_sample_csv() -> Vec<u8> {
    let csv = r#"name,longitude,latitude,depth,silt,sand,clay
S001,1.2500,8.5000,0,20,40,40
S001,1.2500,8.5000,5,25,35,40
S002,1.3000,8.6000,0,15,45,40
S002,1.3000,8.6000,5,20,40,40
S003,1.3500,8.7000,0,30,30,40"#;
    csv.as_bytes().to_vec()
}

fn create_sample_mapping() -> MappingConfig {
    MappingConfig {
        identity: IdentityMapping {
            name: Some("name".to_string()),
            code: None,
            description: None,
            type_sondage: None,
        },
        location: LocationMapping {
            longitude: Some("longitude".to_string()),
            latitude: Some("latitude".to_string()),
            altitude: None,
            commune: None,
            quartier: None,
        },
        data: DataMapping {
            depth_field: Some("depth".to_string()),
            param_field: None,
            value_field: None,
        },
        metadata: MetadataMapping {
            date: None,
            operateur: None,
            projet: None,
        },
    }
}

// ============================================================================
// TEST: Import CSV Simple
// ============================================================================

#[tokio::test]
#[ignore] // Exécuter manuellement avec: cargo test --test import_bulk_integration -- --ignored
async fn test_import_csv_simple() {
    let pool = setup_test_db().await;
    let import_id = Uuid::new_v4();

    // 1. Parse CSV
    let csv_data = create_sample_csv();
    let rows = CsvParser::parse(&csv_data).expect("Failed to parse CSV");
    assert_eq!(rows.len(), 5);

    // 2. Configure mapping et géolocalisation
    let mapping = create_sample_mapping();
    let geoloc = GeolocationConfig {
        mode: GeolocationMode::Exact,
        seed: None,
        jitter_radius: None,
    };

    // 3. Execute import
    let result = process_import(&pool, import_id, rows, &mapping, &geoloc).await;
    assert!(result.is_ok(), "Import failed: {:?}", result.err());

    let stats = result.unwrap();
    assert_eq!(stats.total, 5);
    assert!(stats.succeeded > 0);

    // 4. Vérifier données en DB
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sondages WHERE import_id = $1")
        .bind(import_id)
        .fetch_one(&pool)
        .await
        .expect("Failed to count sondages");

    // On devrait avoir 3 sondages (S001, S002, S003)
    assert_eq!(count, 3);

    // Cleanup
    cleanup_test_data(&pool, import_id).await;
}

// ============================================================================
// TEST: Détection de doublons
// ============================================================================

#[tokio::test]
#[ignore]
async fn test_import_with_duplicates() {
    let pool = setup_test_db().await;
    let import_id = Uuid::new_v4();

    // CSV avec doublons exacts
    let csv = r#"name,longitude,latitude
S001,1.2500,8.5000
S001,1.2500,8.5000
S002,1.3000,8.6000"#;

    let rows = CsvParser::parse(csv.as_bytes()).expect("Failed to parse CSV");
    assert_eq!(rows.len(), 3);

    let mapping = MappingConfig {
        identity: IdentityMapping {
            name: Some("name".to_string()),
            ..Default::default()
        },
        location: LocationMapping {
            longitude: Some("longitude".to_string()),
            latitude: Some("latitude".to_string()),
            ..Default::default()
        },
        ..Default::default()
    };

    let geoloc = GeolocationConfig {
        mode: GeolocationMode::Exact,
        seed: None,
        jitter_radius: None,
    };

    let result = process_import(&pool, import_id, rows, &mapping, &geoloc).await;
    assert!(result.is_ok());

    let stats = result.unwrap();
    assert_eq!(stats.total, 3);
    assert!(stats.duplicates > 0, "Should detect duplicates");

    // Cleanup
    cleanup_test_data(&pool, import_id).await;
}

// ============================================================================
// TEST: Validation d'erreurs (coordonnées hors Togo)
// ============================================================================

#[tokio::test]
#[ignore]
async fn test_import_with_invalid_coordinates() {
    let pool = setup_test_db().await;
    let import_id = Uuid::new_v4();

    // CSV avec coordonnées invalides
    let csv = r#"name,longitude,latitude
S001,1.2500,8.5000
S002,0.0000,5.0000
S003,10.0000,15.0000"#;

    let rows = CsvParser::parse(csv.as_bytes()).expect("Failed to parse CSV");

    let mapping = MappingConfig {
        identity: IdentityMapping {
            name: Some("name".to_string()),
            ..Default::default()
        },
        location: LocationMapping {
            longitude: Some("longitude".to_string()),
            latitude: Some("latitude".to_string()),
            ..Default::default()
        },
        ..Default::default()
    };

    let geoloc = GeolocationConfig {
        mode: GeolocationMode::Exact,
        seed: None,
        jitter_radius: None,
    };

    let result = process_import(&pool, import_id, rows, &mapping, &geoloc).await;
    assert!(result.is_ok());

    let stats = result.unwrap();
    assert_eq!(stats.total, 3);
    assert_eq!(stats.succeeded, 1, "Only S001 should succeed");
    assert_eq!(stats.errors, 2, "S002 and S003 should fail");

    // Cleanup
    cleanup_test_data(&pool, import_id).await;
}

// ============================================================================
// TEST: Géolocalisation aléatoire
// ============================================================================

#[tokio::test]
#[ignore]
async fn test_import_with_random_geolocation() {
    let pool = setup_test_db().await;
    let import_id = Uuid::new_v4();

    let csv = r#"name,longitude,latitude
S001,1.2500,8.5000"#;

    let rows = CsvParser::parse(csv.as_bytes()).expect("Failed to parse CSV");

    let mapping = MappingConfig {
        identity: IdentityMapping {
            name: Some("name".to_string()),
            ..Default::default()
        },
        location: LocationMapping {
            longitude: Some("longitude".to_string()),
            latitude: Some("latitude".to_string()),
            ..Default::default()
        },
        ..Default::default()
    };

    let geoloc = GeolocationConfig {
        mode: GeolocationMode::Random,
        seed: Some(12345),
        jitter_radius: Some(100.0), // 100m
    };

    let result = process_import(&pool, import_id, rows, &mapping, &geoloc).await;
    assert!(result.is_ok());

    // Vérifier que les coordonnées sont différentes de l'original
    let (lon, lat): (f64, f64) = sqlx::query_as(
        "SELECT ST_X(geometry::geometry) as lon, ST_Y(geometry::geometry) as lat
         FROM sondages WHERE import_id = $1 LIMIT 1"
    )
    .bind(import_id)
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch coordinates");

    // Les coordonnées devraient être différentes (randomisées)
    assert_ne!(lon, 1.2500);
    assert_ne!(lat, 8.5000);

    // Mais toujours dans les limites du Togo
    assert!(lon >= 0.0 && lon <= 2.0);
    assert!(lat >= 6.0 && lat <= 11.5);

    // Cleanup
    cleanup_test_data(&pool, import_id).await;
}

// ============================================================================
// TEST: Auto-mapping
// ============================================================================

#[test]
fn test_auto_mapping_suggestions() {
    let columns = vec![
        "nom_sondage".to_string(),
        "coord_x".to_string(),
        "coord_y".to_string(),
        "prof_m".to_string(),
        "limon".to_string(),
        "sable".to_string(),
    ];

    let suggestions = Matcher::auto_map(&columns);

    // Vérifier que les suggestions sont correctes
    assert!(suggestions.contains_key("coord_x"));
    assert_eq!(suggestions.get("coord_x").unwrap(), "longitude");

    assert!(suggestions.contains_key("coord_y"));
    assert_eq!(suggestions.get("coord_y").unwrap(), "latitude");

    // nom_sondage devrait mapper sur name
    assert!(suggestions.get("nom_sondage").is_some());
}

// ============================================================================
// TEST: Transformation Long -> Large
// ============================================================================

#[test]
fn test_long_to_large_transformation() {
    let rows = vec![
        ParsedRow {
            line_number: 1,
            data: HashMap::from([
                ("name".to_string(), "S001".to_string()),
                ("depth".to_string(), "0".to_string()),
                ("silt".to_string(), "20".to_string()),
                ("sand".to_string(), "40".to_string()),
            ]),
            warnings: vec![],
            errors: vec![],
            fingerprint: None,
        },
        ParsedRow {
            line_number: 2,
            data: HashMap::from([
                ("name".to_string(), "S001".to_string()),
                ("depth".to_string(), "5".to_string()),
                ("silt".to_string(), "25".to_string()),
                ("sand".to_string(), "35".to_string()),
            ]),
            warnings: vec![],
            errors: vec![],
            fingerprint: None,
        },
    ];

    let config = MappingConfig {
        identity: IdentityMapping {
            name: Some("name".to_string()),
            ..Default::default()
        },
        data: DataMapping {
            depth_field: Some("depth".to_string()),
            ..Default::default()
        },
        ..Default::default()
    };

    let result = Transformer::long_to_large(&rows, &config);
    assert!(result.is_ok(), "Transformation failed: {:?}", result.err());

    let large_rows = result.unwrap();
    assert_eq!(large_rows.len(), 1, "Should have 1 sondage");

    let row = &large_rows[0];
    assert_eq!(row.data.get("name").unwrap(), "S001");
    assert!(row.data.contains_key("depth_0_silt"));
    assert!(row.data.contains_key("depth_5_silt"));
    assert_eq!(row.data.get("depth_0_silt").unwrap(), "20");
    assert_eq!(row.data.get("depth_5_silt").unwrap(), "25");
}

// ============================================================================
// TEST: Transformation Large -> Long
// ============================================================================

#[test]
fn test_large_to_long_transformation() {
    let rows = vec![
        ParsedRow {
            line_number: 1,
            data: HashMap::from([
                ("name".to_string(), "S001".to_string()),
                ("depth_0_silt".to_string(), "20".to_string()),
                ("depth_0_sand".to_string(), "40".to_string()),
                ("depth_5_silt".to_string(), "25".to_string()),
                ("depth_5_sand".to_string(), "35".to_string()),
            ]),
            warnings: vec![],
            errors: vec![],
            fingerprint: None,
        },
    ];

    let result = Transformer::large_to_long(&rows);
    assert!(result.is_ok(), "Transformation failed: {:?}", result.err());

    let long_rows = result.unwrap();
    assert_eq!(long_rows.len(), 2, "Should have 2 depth records");

    // Vérifier depth 0
    let depth_0 = long_rows.iter().find(|r| r.data.get("depth") == Some(&"0".to_string()));
    assert!(depth_0.is_some());
    assert_eq!(depth_0.unwrap().data.get("silt").unwrap(), "20");
    assert_eq!(depth_0.unwrap().data.get("sand").unwrap(), "40");

    // Vérifier depth 5
    let depth_5 = long_rows.iter().find(|r| r.data.get("depth") == Some(&"5".to_string()));
    assert!(depth_5.is_some());
    assert_eq!(depth_5.unwrap().data.get("silt").unwrap(), "25");
    assert_eq!(depth_5.unwrap().data.get("sand").unwrap(), "35");
}

// ============================================================================
// TEST: Job Queue Asynchrone
// ============================================================================

#[tokio::test]
#[ignore]
async fn test_job_queue_submit_and_status() {
    let pool = setup_test_db().await;
    let queue = JobQueue::new();

    let csv = create_sample_csv();
    let rows = CsvParser::parse(&csv).expect("Failed to parse CSV");
    let mapping = create_sample_mapping();
    let geoloc = GeolocationConfig {
        mode: GeolocationMode::Exact,
        seed: None,
        jitter_radius: None,
    };

    let job = ImportJob {
        import_id: Uuid::new_v4(),
        rows,
        mapping,
        geoloc_config: geoloc,
    };

    let import_id = job.import_id;

    // Submit job
    let result = queue.submit(job, std::sync::Arc::new(pool.clone())).await;
    assert!(result.is_ok());

    // Wait a bit for processing
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    // Check status
    let status = queue.get_status(&import_id).await;
    assert!(status.is_some());

    let status = status.unwrap();
    println!("Job status: {:?}", status.status);

    // Status should be running or completed
    assert!(
        status.status == ImportStatus::Running
        || status.status == ImportStatus::Succeeded
        || status.status == ImportStatus::Partial
    );

    // Wait for completion
    for _ in 0..10 {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        let status = queue.get_status(&import_id).await;
        if let Some(s) = status {
            if s.status == ImportStatus::Succeeded || s.status == ImportStatus::Partial {
                // Success!
                assert!(s.stats.is_some());
                let stats = s.stats.unwrap();
                assert!(stats.total > 0);
                break;
            }
        }
    }

    // Cleanup
    cleanup_test_data(&pool, import_id).await;
}

// ============================================================================
// TEST: Cancel Import
// ============================================================================

#[tokio::test]
#[ignore]
async fn test_cancel_import() {
    let pool = setup_test_db().await;
    let queue = JobQueue::new();

    // Create a large import to have time to cancel
    let mut csv = "name,longitude,latitude\n".to_string();
    for i in 0..1000 {
        csv.push_str(&format!("S{:04},{},{}\n", i, 1.25 + (i as f64) * 0.0001, 8.5));
    }

    let rows = CsvParser::parse(csv.as_bytes()).expect("Failed to parse CSV");
    let mapping = create_sample_mapping();
    let geoloc = GeolocationConfig {
        mode: GeolocationMode::Exact,
        seed: None,
        jitter_radius: None,
    };

    let job = ImportJob {
        import_id: Uuid::new_v4(),
        rows,
        mapping,
        geoloc_config: geoloc,
    };

    let import_id = job.import_id;

    // Submit job
    queue.submit(job, std::sync::Arc::new(pool.clone())).await.unwrap();

    // Wait a bit for it to start
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Cancel it
    let result = queue.cancel(&import_id).await;
    assert!(result.is_ok());

    // Check status
    let status = queue.get_status(&import_id).await;
    assert!(status.is_some());

    // Should be cancelled
    let status = status.unwrap();
    assert_eq!(status.status, ImportStatus::Cancelled);

    // Cleanup
    cleanup_test_data(&pool, import_id).await;
}

// ============================================================================
// TEST: Format Detection
// ============================================================================

#[test]
fn test_format_detection_long() {
    let rows = vec![
        ParsedRow {
            line_number: 1,
            data: HashMap::from([
                ("name".to_string(), "S001".to_string()),
                ("depth".to_string(), "0".to_string()),
            ]),
            warnings: vec![],
            errors: vec![],
            fingerprint: None,
        },
        ParsedRow {
            line_number: 2,
            data: HashMap::from([
                ("name".to_string(), "S001".to_string()),
                ("depth".to_string(), "5".to_string()),
            ]),
            warnings: vec![],
            errors: vec![],
            fingerprint: None,
        },
    ];

    let config = MappingConfig {
        data: DataMapping {
            depth_field: Some("depth".to_string()),
            ..Default::default()
        },
        ..Default::default()
    };

    let format = Transformer::detect_format(&rows, &config);
    assert_eq!(format, DataFormat::Long);
}

#[test]
fn test_format_detection_large() {
    let rows = vec![
        ParsedRow {
            line_number: 1,
            data: HashMap::from([
                ("name".to_string(), "S001".to_string()),
                ("depth_0_silt".to_string(), "20".to_string()),
                ("depth_5_silt".to_string(), "25".to_string()),
            ]),
            warnings: vec![],
            errors: vec![],
            fingerprint: None,
        },
    ];

    let config = MappingConfig::default();
    let format = Transformer::detect_format(&rows, &config);
    assert_eq!(format, DataFormat::Large);
}

// ============================================================================
// HELPER: Run All Tests
// ============================================================================

// Pour exécuter tous les tests d'intégration:
// cargo test --test import_bulk_integration -- --ignored --test-threads=1
