# Guide Opérationnel Atlas

## Déploiement Production

### Prérequis
- PostgreSQL 16+ avec PostGIS 3.4+
- Rust 1.70+ (pour compilation)
- Node.js 20+ (pour UI)
- systemd (Linux) ou équivalent

### Installation

#### 1. Préparation système

```bash
# Créer utilisateur système
sudo useradd -r -s /bin/false atlas

# Créer répertoires
sudo mkdir -p /opt/atlas/{backups,logs}
sudo chown -R atlas:atlas /opt/atlas

# Cloner le projet
cd /opt/atlas
git clone https://github.com/your-org/atlas.git
cd atlas
```

#### 2. Build backend

```bash
cd services/api-geo
cargo build --release
```

#### 3. Build UI

```bash
cd ui
npm ci
npm run build
```

#### 4. Configuration

```bash
# Copier et éditer .env
cp .env.example .env
nano .env

# Variables critiques:
# - DATABASE_URL
# - PGPASSWORD
# - RUST_LOG
# - CORS_ORIGIN
```

#### 5. Migrations DB

```bash
psql -U atlas -d atlas_clean -f migrations/init.sql
```

#### 6. Service systemd

```bash
# Copier le service
sudo cp deployment/systemd/atlas-api-geo.service /etc/systemd/system/

# Éditer les variables d'environnement
sudo nano /etc/systemd/system/atlas-api-geo.service

# Activer et démarrer
sudo systemctl daemon-reload
sudo systemctl enable atlas-api-geo
sudo systemctl start atlas-api-geo

# Vérifier
sudo systemctl status atlas-api-geo
sudo journalctl -u atlas-api-geo -f
```

---

## Backups

### Backup complet automatique

```bash
# Cron quotidien (2h du matin)
0 2 * * * /opt/atlas/scripts/backup-full-db.sh /opt/atlas/backups >> /opt/atlas/logs/backup.log 2>&1
```

### Backup manuel

```bash
./scripts/backup-full-db.sh /path/to/backups
```

### Restauration

```bash
# Sur environnement de test
./scripts/restore-db.sh /opt/atlas/backups/atlas_full_20251110T174430Z.dump atlas_restore

# Vérifier
psql -U atlas -d atlas_restore -c '\dt'
```

### Retention policy

- **Daily**: 7 jours
- **Weekly**: 4 semaines
- **Monthly**: 12 mois

Configuré dans `scripts/backup-full-db.sh` (variable `CLEANUP_OLD_BACKUPS`).

---

## Monitoring

### Healthchecks

```bash
# API
curl -f http://localhost:8000/healthz

# Métriques Prometheus
curl http://localhost:8000/metrics

# Version
curl http://localhost:8000/version
```

### Logs

```bash
# Logs systemd
sudo journalctl -u atlas-api-geo -f

# Logs applicatifs (si configuré)
tail -f /opt/atlas/logs/api-geo.log
```

### Grafana

- URL: http://localhost:3000/d/atlas
- Dashboard: `monitoring/grafana-dashboard.json`
- Alertes: `monitoring/prometheus-alerts.yml`

---

## Troubleshooting

### API ne démarre pas

```bash
# Vérifier logs
sudo journalctl -u atlas-api-geo -n 100

# Vérifier DB
psql -U atlas -d atlas_clean -c 'SELECT version();'

# Vérifier port
netstat -tulpn | grep 8000
```

### Locks bloqués

```bash
# Lister locks actifs
psql -U atlas -d atlas_clean -c 'SELECT * FROM atlas.staging_locks;'

# Forcer libération (ATTENTION)
psql -U atlas -d atlas_clean -c "DELETE FROM atlas.staging_locks WHERE staging_id = 'xxx';"
```

### Performance dégradée

```bash
# Vérifier connexions DB
psql -U atlas -d atlas_clean -c 'SELECT count(*) FROM pg_stat_activity;'

# Vacuum analyze
psql -U atlas -d atlas_clean -c 'VACUUM ANALYZE;'

# Reindex
psql -U atlas -d atlas_clean -c 'REINDEX DATABASE atlas_clean;'
```

---

## Mise à jour

### Rolling update (zero downtime)

```bash
# 1. Build nouvelle version
cd /opt/atlas/atlas
git pull
cd services/api-geo
cargo build --release

# 2. Tester sur port alternatif
API_BIND=0.0.0.0:8001 ./target/release/api-geo &
curl -f http://localhost:8001/healthz

# 3. Basculer
sudo systemctl restart atlas-api-geo

# 4. Vérifier
curl -f http://localhost:8000/healthz
```

### Blue/Green deployment

```bash
# 1. Déployer version "green"
docker-compose -f docker-compose.green.yml up -d

# 2. Tester
curl -f http://localhost:8001/healthz

# 3. Basculer reverse proxy (nginx/traefik)
# 4. Arrêter version "blue"
docker-compose -f docker-compose.blue.yml down
```

---

## Sécurité

### Secrets management

- **NE JAMAIS** commiter `.env` avec secrets
- Utiliser Vault, AWS Secrets Manager, ou Azure Key Vault
- Rotation des mots de passe tous les 90 jours

### Audit

```bash
# Logs d'audit
psql -U atlas -d atlas_clean -c 'SELECT * FROM atlas.audit_log ORDER BY created_at DESC LIMIT 100;'

# Exporter pour analyse
psql -U atlas -d atlas_clean -c "COPY (SELECT * FROM atlas.audit_log WHERE created_at > NOW() - INTERVAL '7 days') TO '/tmp/audit_export.csv' CSV HEADER;"
```

### Firewall

```bash
# Autoriser seulement ports nécessaires
sudo ufw allow 8000/tcp  # API
sudo ufw allow 5432/tcp  # PostgreSQL (seulement depuis réseau interne)
sudo ufw enable
```

---

## Performance tuning

### PostgreSQL

```sql
-- postgresql.conf
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 64MB
min_wal_size = 2GB
max_wal_size = 8GB
max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
```

### API

```bash
# Variables d'environnement
RUST_LOG=info  # Pas debug en prod
DATABASE_POOL_SIZE=20
DATABASE_MAX_CONNECTIONS=100
```

---

## Disaster Recovery

### Plan de reprise

1. **Restaurer DB** depuis backup le plus récent
2. **Redémarrer API** avec nouvelle DB
3. **Vérifier intégrité** des données
4. **Notifier utilisateurs** du downtime

### RTO/RPO

- **RTO** (Recovery Time Objective): 1 heure
- **RPO** (Recovery Point Objective): 24 heures (backups quotidiens)

### Drill de reprise

Tester la procédure de DR tous les 3 mois :

```bash
# 1. Simuler perte de DB
# 2. Restaurer depuis backup
./scripts/restore-db.sh /opt/atlas/backups/latest.dump atlas_dr_test
# 3. Chronométrer
# 4. Documenter problèmes rencontrés
```
