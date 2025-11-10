# DB Manager - Runbook Admin

Guide opérationnel pour les administrateurs du gestionnaire de base de données Atlas.

## 🚀 Démarrage rapide

### Prérequis
- PostgreSQL 14+ avec PostGIS 3.3+
- Rust 1.79+
- Node.js 20+
- Docker (optionnel)

### Démarrage local
```bash
# 1. Démarrer la base de données
docker-compose up -d db

# 2. Appliquer les migrations
psql -U atlas -d atlas_clean -f migrations/*.sql

# 3. Démarrer l'API
cd services/api-geo
cargo run --release

# 4. Démarrer l'UI
cd ui
npm install
npm run dev
```

## 📊 Monitoring

### Métriques Prometheus
Endpoint: `http://localhost:8000/metrics`

**Métriques clés:**
- `staging_commits_total` - Nombre total de commits staging
- `staging_commits_failed_total` - Commits échoués (⚠️ alerter si > 0)
- `staging_rollbacks_total` - Rollbacks effectués
- `db_operations_total` - Opérations DB totales
- `db_errors_total` - Erreurs DB
- `ddl_dryrun_total` - Dry-runs DDL
- `backups_created_total` - Backups créés
- `rate_limit_hits_total` - Rate limits atteints

### Logs structurés
Les logs sont au format JSON avec:
- `timestamp` - ISO 8601
- `level` - INFO, WARN, ERROR
- `action` - Type d'opération
- `user` - Utilisateur (si disponible)
- `table` - Table concernée
- `rows_affected` - Nombre de lignes
- `duration_ms` - Durée en ms
- `error` - Message d'erreur (si échec)

```bash
# Filtrer les erreurs
docker logs api-geo | jq 'select(.level == "ERROR")'

# Opérations staging
docker logs api-geo | jq 'select(.action | startswith("staging_"))'
```

## 🔧 Opérations courantes

### Créer un backup avant modification
```bash
curl -X POST http://localhost:8000/db/backup \
  -H "Content-Type: application/json" \
  -d '{
    "tables": ["atlas.communes", "atlas.sondages"],
    "description": "Backup avant modification masse"
  }'
```

### Lister les backups
```bash
curl http://localhost:8000/db/backup | jq
```

### Restaurer un backup
```bash
curl -X POST http://localhost:8000/db/backup/{backup_id}/restore
```

### Vérifier l'état d'un staging
```bash
# Preview des changements
curl http://localhost:8000/db/staging/{staging_id}/preview | jq

# Validation
curl http://localhost:8000/db/staging/{staging_id}/validate | jq
```

### Dry-run avant DDL
```bash
# Tester ajout de colonne
curl -X POST http://localhost:8000/db/table/atlas/communes/column/dryrun \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_col",
    "data_type": "TEXT",
    "is_nullable": true
  }' | jq
```

## 🚨 Procédures d'urgence

### Annuler un commit staging en cours
```bash
# 1. Identifier le staging_id
curl http://localhost:8000/db/staging | jq

# 2. Annuler
curl -X DELETE http://localhost:8000/db/staging/{staging_id}
```

### Rollback après commit problématique
```bash
# 1. Trouver le backup le plus récent
curl http://localhost:8000/db/backup | jq '[.[] | select(.tables[] | contains("ma_table"))] | sort_by(.created_at) | reverse | .[0]'

# 2. Restaurer
curl -X POST http://localhost:8000/db/backup/{backup_id}/restore

# 3. Vérifier l'audit log
curl http://localhost:8000/db/table/atlas/ma_table/audit | jq
```

### Débloquer une table verrouillée
```sql
-- Identifier les locks
SELECT 
    pid,
    usename,
    pg_blocking_pids(pid) as blocked_by,
    query as current_query
FROM pg_stat_activity
WHERE datname = 'atlas_clean';

-- Terminer une session bloquante (avec précaution!)
SELECT pg_terminate_backend(pid);
```

### Récupération après erreur de migration
```bash
# 1. Vérifier l'état des migrations
psql -U atlas -d atlas_clean -c "SELECT * FROM atlas.schema_migrations ORDER BY applied_at DESC LIMIT 5;"

# 2. Rollback manuel si nécessaire
psql -U atlas -d atlas_clean -f migrations/rollback_xxx.sql

# 3. Réappliquer
psql -U atlas -d atlas_clean -f migrations/xxx.sql
```

## 🔒 Sécurité

### Permissions RBAC
- **Admin**: Tous les droits (DDL, DML, backup, restore)
- **Editor**: Lecture + Écriture (pas de DDL)
- **Viewer**: Lecture seule

### Audit immuable
La table `atlas.audit_log` est **immuable**. Toute tentative de modification ou suppression sera rejetée par des triggers.

```sql
-- Vérifier l'intégrité de l'audit
SELECT COUNT(*) FROM atlas.audit_log;

-- Dernières opérations
SELECT * FROM atlas.audit_log ORDER BY created_at DESC LIMIT 10;
```

### Rate limiting
- **Default**: 100 requêtes/minute
- **Strict** (DDL/backup): 10 requêtes/minute

Si rate limit atteint:
```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests"
}
```

## 📈 Performance

### Optimiser les requêtes lentes
```sql
-- Identifier les requêtes lentes
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Analyser une requête
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM atlas.communes WHERE code LIKE 'FR%';
```

### Index recommandés
```sql
-- Colonnes fréquemment filtrées
CREATE INDEX IF NOT EXISTS idx_communes_code ON atlas.communes(code);
CREATE INDEX IF NOT EXISTS idx_sondages_date ON atlas.sondages(date_sondage);

-- Géométries (GIST)
CREATE INDEX IF NOT EXISTS idx_communes_geom ON atlas.communes USING GIST(geom);
```

## 🧪 Tests

### Tests d'intégration
```bash
# Tous les tests
make test-staging

# Tests spécifiques
cd services/api-geo
cargo test test_staging_commit_success -- --nocapture
cargo test test_staging_rollback_on_error -- --nocapture
```

### Vérifier les migrations
```bash
make check-migrations
```

## 📞 Support

### Logs utiles
```bash
# Erreurs récentes
docker logs api-geo --since 1h | grep ERROR

# Opérations staging
docker logs api-geo | jq 'select(.action | contains("staging"))'

# Slow queries
docker logs api-geo | jq 'select(.duration_ms > 1000)'
```

### Checklist de diagnostic
- [ ] Vérifier `/healthz` → 200 OK
- [ ] Vérifier `/metrics` → compteurs cohérents
- [ ] Vérifier logs → pas d'erreurs récentes
- [ ] Vérifier DB → connexions actives < max
- [ ] Vérifier disk → espace disponible > 20%
- [ ] Vérifier backups → au moins 1 par jour

## 🔄 Maintenance régulière

### Quotidien
- Vérifier métriques Prometheus
- Vérifier logs d'erreur
- Vérifier espace disque

### Hebdomadaire
- Nettoyer vieux backups (> 30 jours)
- Analyser slow queries
- Vérifier intégrité audit log

### Mensuel
- VACUUM ANALYZE sur tables volumineuses
- Revoir index inutilisés
- Audit des permissions utilisateurs

```sql
-- Nettoyer backups anciens
DELETE FROM atlas.backup_metadata 
WHERE created_at < NOW() - INTERVAL '30 days';

-- VACUUM
VACUUM ANALYZE atlas.communes;
VACUUM ANALYZE atlas.sondages;

-- Index inutilisés
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

## 📚 Ressources

- [Documentation technique](./DB_MANAGER_IMPLEMENTATION.md)
- [Problèmes et solutions](./DB_MANAGER_PROBLEMS_AND_SOLUTIONS.md)
- [API Contracts](../ui/src/db-manager/api-contracts.ts)
- [Migrations](../migrations/)
