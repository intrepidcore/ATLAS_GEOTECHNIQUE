# Atlas - Guide Complet des Fonctionnalités

## 📋 Table des Matières

1. [Backup & Restore](#backup--restore)
2. [Tests d'Intégration](#tests-dintégration)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [EXPLAIN Preview](#explain-preview)
5. [Pagination & Streaming](#pagination--streaming)
6. [Field Calculator](#field-calculator)
7. [Import/Export](#importexport)
8. [Versioning & Undo/Redo](#versioning--undoredo)
9. [Observabilité](#observabilité)
10. [Commandes Makefile](#commandes-makefile)

---

## 🔄 Backup & Restore

### Scripts Disponibles

#### Windows PowerShell
```powershell
# Backup simple
.\scripts\backup_db.ps1

# Backup chiffré
.\scripts\backup_db.ps1 -Encrypt

# Backup avec upload S3
.\scripts\backup_db.ps1 -Encrypt -Upload

# Restore
.\scripts\restore_db.ps1 -BackupFile "backups\atlas_20251110_abc123.sql.gz"
```

#### Linux/Mac Bash
```bash
# Backup simple
./scripts/backup_db.sh

# Backup chiffré et upload
./scripts/backup_db.sh --encrypt --upload

# Restore
gunzip -c backups/atlas_20251110_abc123.sql.gz | psql -U atlas -d atlas_clean
```

### Configuration

Variables d'environnement :
```bash
export BACKUP_DIR="./backups"
export DB_USER="atlas"
export DB_NAME="atlas_clean"
export RETENTION_DAYS="14"
export S3_BUCKET="my-backups-bucket"
export GPG_PASSPHRASE="your-secure-passphrase"
```

### Automatisation

Cron job (Linux) :
```cron
# Backup quotidien à 2h du matin
0 2 * * * /path/to/atlas/scripts/backup_db.sh --encrypt --upload
```

Task Scheduler (Windows) :
```powershell
$action = New-ScheduledTaskAction -Execute 'PowerShell.exe' -Argument '-File C:\atlas\scripts\backup_db.ps1 -Encrypt'
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "Atlas DB Backup"
```

---

## 🧪 Tests d'Intégration

### Tests Staging

Tests complets pour le workflow staging :

```bash
# Tests unitaires
make test-staging

# Tests d'intégration (nécessite DB)
make test-integration

# Ou directement avec cargo
cd services/api-geo
cargo test --test db_manager_tests -- --ignored --test-threads=1
```

### Tests Disponibles

1. **test_staging_commit_success_integration** : Vérifie le commit réussi
2. **test_staging_rollback_on_constraint_violation** : Vérifie le rollback automatique
3. **test_staging_validation_detects_errors** : Vérifie la validation

### Écrire de Nouveaux Tests

```rust
#[tokio::test]
#[ignore]
async fn test_my_feature() {
    let pool = setup_test_db().await;
    
    // Votre test ici
    
    assert!(result.is_ok());
}
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions

Le pipeline CI exécute :

1. **Linting** : `cargo fmt --check` et `cargo clippy`
2. **Tests unitaires** : `cargo test`
3. **Tests d'intégration** : Tests avec PostgreSQL
4. **SQLx prepare check** : Vérification des queries
5. **Build UI** : `npm ci && npm run build`

### Configuration

`.github/workflows/ci.yml` :
- Service PostgreSQL avec PostGIS
- Migrations automatiques
- Tests parallèles
- Cache des dépendances

### Exécution Locale

```bash
# Simuler la CI localement
docker-compose up -d db
make check-migrations
cd services/api-geo && cargo fmt --check
cd services/api-geo && cargo clippy
cd services/api-geo && cargo test
cd services/api-geo && cargo test --test db_manager_tests -- --ignored
```

---

## 📊 EXPLAIN Preview

### Fonctionnalité

Les dry-runs DDL incluent maintenant :
- **EXPLAIN plan** : Plan d'exécution PostgreSQL
- **Échantillon de données** : 5 premières lignes
- **Estimations** : Durée, lignes affectées
- **Warnings** : Alertes sur les risques

### Utilisation

```typescript
// Frontend
const dryrun = await api.dryrunAddColumn(schema, table, {
  name: "new_column",
  data_type: "TEXT",
  is_nullable: true
});

console.log(dryrun.explain_plan);  // Plan EXPLAIN
console.log(dryrun.sample_rows);   // Échantillon
console.log(dryrun.warnings);      // Warnings
```

### Exemple de Réponse

```json
{
  "sql": "ALTER TABLE atlas.communes ADD COLUMN new_column TEXT",
  "explain_plan": "[{\"Plan\": {...}}]",
  "sample_rows": [
    {"id": "1", "name": "Paris", ...},
    {"id": "2", "name": "Lyon", ...}
  ],
  "warnings": ["Table volumineuse (1M lignes)"],
  "is_safe": true
}
```

---

## 📄 Pagination & Streaming

### Pagination Offset

```rust
use api_geo::db_manager::pagination::*;

let params = PaginationParams {
    limit: Some(50),
    offset: Some(0),
    order_by: Some("id".to_string()),
    order_dir: Some("ASC".to_string()),
    ..Default::default()
};

let result = paginate_table(&pool, "atlas", "communes", &params).await?;
```

### Pagination Curseur

Plus efficace pour grandes tables :

```rust
let result = paginate_table_cursor(
    &pool,
    "atlas",
    "communes",
    "id",           // Colonne curseur
    Some("12345"),  // Valeur curseur (ou None pour première page)
    50              // Limite
).await?;

// Prochaine page
let next = paginate_table_cursor(
    &pool,
    "atlas",
    "communes",
    "id",
    result.next_cursor.as_deref(),
    50
).await?;
```

### Streaming

Pour export massif :

```rust
let chunks = stream_table_chunks(&pool, "atlas", "communes", 1000).await?;
// Retourne Vec<Vec<Value>> - chunks de 1000 lignes
```

---

## 🧮 Field Calculator

### Preview

Tester une expression sur 50 lignes :

```rust
use api_geo::db_manager::field_calculator::*;

let request = FieldCalculatorRequest {
    target_column: "population".to_string(),
    expression: "population * 1.05".to_string(),  // +5%
    filter: Some("departement = '75'".to_string()),
};

let preview = preview_field_calculation(&pool, "atlas", "communes", &request).await?;

// Voir les résultats
for sample in preview.sample_results {
    println!("{:?} -> {:?}", sample.old_value, sample.new_value);
}
```

### Exécution

Appliquer dans un staging :

```rust
let rows_affected = execute_field_calculation(
    &pool,
    &staging_id,
    &request
).await?;
```

### Validation

Valider une expression avant exécution :

```rust
let is_valid = validate_expression(
    &pool,
    "atlas",
    "communes",
    "UPPER(nom)"
).await?;
```

---

## 📥📤 Import/Export

### Export CSV

```rust
use api_geo::db_manager::import_export::*;

let csv = export_to_csv(&pool, "atlas", "communes").await?;
// Sauvegarder dans un fichier
std::fs::write("export.csv", csv)?;
```

### Export GeoJSON

```rust
let geojson = export_to_geojson(
    &pool,
    "atlas",
    "communes",
    "geom",  // Colonne géométrie
    4326     // SRID
).await?;
```

### Import CSV

```rust
let csv_data = std::fs::read_to_string("import.csv")?;

let result = import_csv_to_staging(
    &pool,
    &staging_id,
    &csv_data,
    Some(&[
        ColumnMapping {
            source_column: "nom".to_string(),
            target_column: "name".to_string(),
            transform: Some("UPPER(nom)".to_string()),
        }
    ])
).await?;

println!("Imported {} rows", result.rows_imported);
```

### Import GeoJSON

```rust
let geojson_data = std::fs::read_to_string("import.geojson")?;

let result = import_geojson_to_staging(
    &pool,
    &staging_id,
    &geojson_data,
    "geom",  // Colonne géométrie
    4326     // SRID
).await?;
```

---

## ⏮️ Versioning & Undo/Redo

### Créer un Changeset

```rust
use api_geo::db_manager::versioning::*;

let changeset_id = create_changeset(
    &pool,
    "atlas.communes",
    ChangeOperation::Update,
    serde_json::json!({
        "updates": [
            {
                "id": "123",
                "old_values": {"name": "Paris"},
                "new_values": {"name": "PARIS"}
            }
        ]
    }),
    Some("admin@example.com")
).await?;
```

### Lister l'Historique

```rust
let changesets = get_changesets(
    &pool,
    Some("atlas.communes"),  // Table spécifique ou None pour toutes
    50                        // Limite
).await?;

for cs in changesets {
    println!("{}: {} on {}", cs.id, cs.operation, cs.table_name);
}
```

### Undo

```rust
undo_changeset(&pool, &changeset_id).await?;
```

### Versioning de Tables

```rust
// Créer une version
let version = create_table_version(
    &pool,
    "atlas",
    "communes",
    Some("Avant migration 2025-11-10")
).await?;

// Lister les versions
let versions = list_table_versions(&pool, "atlas.communes").await?;
```

---

## 📊 Observabilité

### Métriques Prometheus

Endpoint : `GET /metrics`

Métriques disponibles :
- `db_operations_total` : Total opérations DB
- `db_errors_total` : Total erreurs DB
- `staging_commits_total` : Total commits staging
- `staging_rollbacks_total` : Total rollbacks
- `staging_commits_failed_total` : Total commits échoués
- `ddl_dryrun_total` : Total dry-runs DDL
- `backups_created_total` : Total backups créés
- `rate_limit_hits_total` : Total rate limit hits
- `db_query_duration_seconds` : Durée des queries (histogram)

### Logs Structurés

```rust
use api_geo::observability::StructuredLog;

StructuredLog::new("staging_commit")
    .with_table("atlas.communes")
    .with_rows_affected(150)
    .with_details(serde_json::json!({
        "staging_id": staging_id,
        "user": "admin"
    }))
    .log();
```

### Vérification

```bash
# Métriques
make metrics

# Health
make health

# Ou directement
curl http://localhost:8000/metrics
curl http://localhost:8000/healthz
```

---

## 🛠️ Commandes Makefile

### Développement

```bash
make dev          # Démarrer en mode dev
make build        # Build tous les services
make clean        # Nettoyer les artefacts
```

### Base de Données

```bash
make up           # Démarrer PostgreSQL
make down         # Arrêter PostgreSQL
make wait-db      # Attendre que DB soit prête
make backup-db    # Backup de la DB
make restore-db   # Restore de la DB
```

### Tests

```bash
make test-staging      # Tests staging
make test-integration  # Tests d'intégration complets
make check-migrations  # Vérifier migrations
```

### Quality

```bash
make fmt          # Format le code
make lint         # Lint le code
make sqlx-prepare # Préparer queries SQLx
```

### Monitoring

```bash
make metrics      # Voir métriques Prometheus
make health       # Vérifier santé de l'API
```

---

## 🚀 Démarrage Rapide

```bash
# 1. Démarrer la DB
docker-compose up -d db
make wait-db

# 2. Appliquer les migrations
cd migrations && for f in *.sql; do psql -U atlas -d atlas_clean -f "$f"; done

# 3. Build et démarrer l'API
cd services/api-geo
cargo build --release
./target/release/api-geo

# 4. Vérifier
make health
make metrics

# 5. Lancer les tests
make test-integration
```

---

## 📚 Documentation Additionnelle

- [Runbook Admin](./DB_MANAGER_RUNBOOK.md)
- [API Contracts](../ui/src/db-manager/api-contracts.ts)
- [Architecture](./ARCHITECTURE.md)

---

## 🔒 Sécurité

### Backups

- Chiffrement AES-256 avec GPG
- Checksum SHA-256 pour intégrité
- Rotation automatique (14 jours par défaut)
- Upload S3 avec encryption at rest

### SQL Sanitization

- Validation des expressions Field Calculator
- Détection de mots-clés dangereux
- Paramètres bindés pour toutes les queries
- Rate limiting sur endpoints sensibles

### Audit

- Table `audit_log` immuable (trigger)
- Tracking de tous les changements
- Changesets pour undo/redo
- Logs structurés JSON

---

## 📞 Support

Pour toute question ou problème :
1. Consulter le [Runbook Admin](./DB_MANAGER_RUNBOOK.md)
2. Vérifier les logs : `docker-compose logs api-geo`
3. Vérifier les métriques : `make metrics`
4. Créer une issue GitHub

---

**Version** : 2.0.0  
**Dernière mise à jour** : 2025-11-10
