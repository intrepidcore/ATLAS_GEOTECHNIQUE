# Déploiement Atlas - Guide Rapide

## 🚀 Démarrage rapide (Docker)

```bash
# 1. Cloner le projet
git clone https://github.com/your-org/atlas.git
cd atlas

# 2. Configurer environnement
cp .env.example .env
nano .env  # Éditer DATABASE_URL, PGPASSWORD, etc.

# 3. Démarrer tous les services
docker-compose up -d

# 4. Vérifier
curl http://localhost:8000/healthz
curl http://localhost:5173/
```

## 📦 Déploiement Production

### Option 1: Systemd (Linux natif)

Voir `systemd/atlas-api-geo.service`

```bash
sudo cp systemd/atlas-api-geo.service /etc/systemd/system/
sudo systemctl enable --now atlas-api-geo
```

### Option 2: Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Option 3: Kubernetes

```bash
kubectl apply -f k8s/
```

## 🔧 Configuration

### Variables d'environnement critiques

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL | `postgres://user:pass@host:5432/db` |
| `RUST_LOG` | Niveau de log | `info` |
| `API_BIND` | Adresse d'écoute | `0.0.0.0:8000` |
| `CORS_ORIGIN` | Origines autorisées | `https://app.example.com` |

### Fichiers de configuration

- `.env` - Variables d'environnement
- `docker-compose.yml` - Services Docker
- `systemd/atlas-api-geo.service` - Service systemd

## 📊 Monitoring

### Healthchecks

```bash
# API
curl http://localhost:8000/healthz

# Métriques
curl http://localhost:8000/metrics

# Version
curl http://localhost:8000/version
```

### Grafana

Import dashboard: `../monitoring/grafana-dashboard.json`

URL: http://localhost:3000/d/atlas

### Alertes Prometheus

Config: `../monitoring/prometheus-alerts.yml`

## 💾 Backups

### Automatique (cron)

```bash
# Ajouter à crontab
0 2 * * * /opt/atlas/scripts/backup-full-db.sh /opt/atlas/backups
```

### Manuel

```bash
./scripts/backup-full-db.sh /path/to/backups
```

### Restauration

```bash
./scripts/restore-db.sh /path/to/backup.dump target_db_name
```

## 🔒 Sécurité

### Checklist pré-production

- [ ] Changer tous les mots de passe par défaut
- [ ] Configurer HTTPS/TLS
- [ ] Activer firewall (ports 8000, 5432)
- [ ] Configurer CORS correctement
- [ ] Activer audit logging
- [ ] Configurer backups automatiques
- [ ] Tester procédure de restauration
- [ ] Configurer monitoring et alertes
- [ ] Documenter procédures d'urgence

### Secrets

**NE JAMAIS** commiter:
- `.env`
- Mots de passe
- Clés API
- Certificats privés

Utiliser:
- Vault
- AWS Secrets Manager
- Azure Key Vault
- Kubernetes Secrets

## 🧪 Tests

### Tests unitaires

```bash
cd services/api-geo
cargo test
```

### Tests d'intégration

```bash
cd services/api-geo
cargo test --test integration_tests -- --ignored
```

### Tests E2E

```bash
cd ui
npm run test:e2e
```

## 📝 Logs

### Systemd

```bash
sudo journalctl -u atlas-api-geo -f
```

### Docker

```bash
docker-compose logs -f api-geo
```

### Fichiers

```bash
tail -f /opt/atlas/logs/api-geo.log
```

## 🆘 Troubleshooting

### API ne démarre pas

1. Vérifier logs: `journalctl -u atlas-api-geo -n 100`
2. Vérifier DB: `psql -U atlas -d atlas_clean -c 'SELECT 1;'`
3. Vérifier port: `netstat -tulpn | grep 8000`

### Erreurs 404 sur routes

1. Vérifier routes montées dans logs
2. Rebuild Docker image: `docker-compose build --no-cache api-geo`
3. Redémarrer: `docker-compose restart api-geo`

### Performance dégradée

1. Vérifier métriques: `curl http://localhost:8000/metrics`
2. Vacuum DB: `psql -c 'VACUUM ANALYZE;'`
3. Vérifier connexions: `psql -c 'SELECT count(*) FROM pg_stat_activity;'`

## 📚 Documentation

- [Guide opérationnel](../docs/OPERATIONS.md)
- [Architecture](../docs/ARCHITECTURE.md)
- [API Reference](../docs/API.md)
- [UI Integration](../UI_INTEGRATION_COMPLETE.md)

## 🔄 Mise à jour

### Rolling update

```bash
git pull
cd services/api-geo
cargo build --release
sudo systemctl restart atlas-api-geo
```

### Docker

```bash
git pull
docker-compose build
docker-compose up -d
```

## 📞 Support

- Issues: https://github.com/your-org/atlas/issues
- Docs: https://docs.atlas.example.com
- Email: support@example.com
