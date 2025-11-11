# 📊 Monitoring Atlas - Guide Complet

## 🎯 Vue d'ensemble

Le monitoring Atlas utilise **Prometheus** pour collecter les métriques et **Grafana** pour la visualisation.

## 📦 Composants

### 1. Prometheus
- **Port** : 9090
- **URL** : http://localhost:9090
- **Scrape interval** : 15s
- **Retention** : 15 jours

### 2. Grafana
- **Port** : 3000
- **URL** : http://localhost:3000
- **Dashboard** : http://localhost:3000/d/atlas
- **Credentials** : admin / admin (à changer en production)

### 3. Métriques API
- **Endpoint** : http://localhost:8000/metrics
- **Format** : Prometheus text format

---

## 🚀 Démarrage Rapide

### Option 1 : Docker Compose (Recommandé)

```bash
# Démarrer tous les services
docker-compose up -d

# Vérifier que Prometheus scrape l'API
curl http://localhost:9090/api/v1/targets

# Accéder à Grafana
open http://localhost:3000
```

### Option 2 : Installation manuelle

#### Prometheus

```bash
# Télécharger Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz
cd prometheus-*

# Copier la config
cp /path/to/atlas/monitoring/prometheus.yml ./

# Démarrer
./prometheus --config.file=prometheus.yml
```

#### Grafana

```bash
# Installation (Ubuntu/Debian)
sudo apt-get install -y adduser libfontconfig1
wget https://dl.grafana.com/oss/release/grafana_10.0.0_amd64.deb
sudo dpkg -i grafana_10.0.0_amd64.deb

# Démarrer
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

---

## 📊 Dashboard Grafana

### Import du dashboard

1. Ouvrir Grafana : http://localhost:3000
2. Login : admin / admin
3. Aller dans **Dashboards** → **Import**
4. Uploader `grafana-dashboard.json`
5. Sélectionner la datasource **Prometheus**
6. Cliquer **Import**

### Panels disponibles

| Panel | Description | Métrique |
|-------|-------------|----------|
| **Staging Operations** | Taux d'opérations staging | `rate(staging_operations_total[5m])` |
| **Active Locks** | Nombre de locks actifs | `staging_locks_active` |
| **API Requests** | Requêtes HTTP par endpoint | `rate(http_requests_total[5m])` |
| **Response Time** | Temps de réponse P50/P95/P99 | `http_request_duration_seconds` |
| **Database Connections** | Connexions DB actives | `db_connections_active` |
| **Error Rate** | Taux d'erreurs 5xx | `rate(http_requests_total{status=~"5.."}[5m])` |
| **Backup Status** | Statut des backups | `backup_last_success_timestamp` |
| **Audit Log Size** | Taille du log d'audit | `audit_log_entries_total` |

---

## 🔔 Alertes Prometheus

### Configuration des alertes

Le fichier `prometheus-alerts.yml` contient les règles d'alerte.

#### Alertes configurées

1. **HighErrorRate**
   - Condition : Taux d'erreur > 5% pendant 5 minutes
   - Sévérité : warning

2. **StagingLockStuck**
   - Condition : Lock actif > 30 minutes
   - Sévérité : warning

3. **DatabaseDown**
   - Condition : DB inaccessible
   - Sévérité: critical

4. **HighResponseTime**
   - Condition : P95 > 2s pendant 5 minutes
   - Sévérité : warning

5. **BackupFailed**
   - Condition : Pas de backup réussi depuis 25h
   - Sévérité : critical

### Test des alertes

```bash
# Vérifier les règles d'alerte
curl http://localhost:9090/api/v1/rules

# Voir les alertes actives
curl http://localhost:9090/api/v1/alerts
```

### Notification (Alertmanager)

Pour recevoir des notifications, configurer Alertmanager :

```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alertmanager@example.com'

route:
  receiver: 'team-email'

receivers:
  - name: 'team-email'
    email_configs:
      - to: 'team@example.com'
```

---

## 📈 Métriques Personnalisées

### Métriques disponibles

#### Staging

```promql
# Opérations staging par type
staging_operations_total{operation="create|commit|cancel"}

# Locks actifs
staging_locks_active

# Durée des commits
staging_commit_duration_seconds
```

#### API HTTP

```promql
# Requêtes totales
http_requests_total{method, endpoint, status}

# Durée des requêtes
http_request_duration_seconds{method, endpoint}

# Taille des réponses
http_response_size_bytes{method, endpoint}
```

#### Base de données

```promql
# Connexions actives
db_connections_active

# Requêtes SQL
db_queries_total{query_type}

# Durée des requêtes
db_query_duration_seconds
```

#### Backups

```promql
# Dernier backup réussi (timestamp)
backup_last_success_timestamp

# Taille du backup
backup_size_bytes

# Durée du backup
backup_duration_seconds
```

### Ajouter une métrique personnalisée

Dans le code Rust :

```rust
use prometheus::{Counter, register_counter};

lazy_static! {
    static ref MY_COUNTER: Counter = register_counter!(
        "my_custom_metric_total",
        "Description de ma métrique"
    ).unwrap();
}

// Incrémenter
MY_COUNTER.inc();
```

---

## 🔍 Requêtes PromQL Utiles

### Performance

```promql
# Top 10 endpoints les plus lents
topk(10, 
  histogram_quantile(0.95, 
    rate(http_request_duration_seconds_bucket[5m])
  )
) by (endpoint)

# Taux d'erreur par endpoint
rate(http_requests_total{status=~"5.."}[5m]) 
/ 
rate(http_requests_total[5m])
```

### Staging

```promql
# Nombre de staging créés aujourd'hui
increase(staging_operations_total{operation="create"}[24h])

# Durée moyenne des commits
rate(staging_commit_duration_seconds_sum[5m]) 
/ 
rate(staging_commit_duration_seconds_count[5m])
```

### Base de données

```promql
# Connexions DB utilisées (%)
db_connections_active / db_connections_max * 100

# Requêtes SQL les plus lentes
topk(10, db_query_duration_seconds) by (query_type)
```

---

## 🛠️ Troubleshooting

### Prometheus ne scrape pas l'API

```bash
# Vérifier que l'API expose /metrics
curl http://localhost:8000/metrics

# Vérifier la config Prometheus
curl http://localhost:9090/api/v1/targets

# Logs Prometheus
docker logs prometheus
```

### Grafana ne se connecte pas à Prometheus

1. Vérifier la datasource : **Configuration** → **Data Sources**
2. URL doit être : `http://prometheus:9090` (Docker) ou `http://localhost:9090` (local)
3. Tester avec **Save & Test**

### Métriques manquantes

```bash
# Lister toutes les métriques disponibles
curl http://localhost:8000/metrics | grep "^[a-z]"

# Vérifier dans Prometheus
curl http://localhost:9090/api/v1/label/__name__/values
```

---

## 📚 Ressources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/best-practices-for-creating-dashboards/)

---

## 🔐 Sécurité Production

### Prometheus

```yaml
# prometheus.yml
global:
  external_labels:
    environment: 'production'

# Activer l'authentification
basic_auth:
  username: 'prometheus'
  password_file: '/etc/prometheus/password'
```

### Grafana

```ini
# grafana.ini
[security]
admin_user = admin
admin_password = <strong_password>

[auth]
disable_login_form = false
oauth_auto_login = true

[auth.anonymous]
enabled = false
```

---

## 📊 Exemples de Dashboards

### Dashboard Opérationnel

- Santé globale du système
- Taux d'erreur
- Latence
- Throughput

### Dashboard Staging

- Opérations staging actives
- Locks en cours
- Historique des commits
- Taux de succès/échec

### Dashboard Base de Données

- Connexions actives
- Requêtes lentes
- Taille des tables
- Vacuum/Analyze status

---

## 🎯 Objectifs SLO/SLA

| Métrique | Objectif | Alerte si |
|----------|----------|-----------|
| Disponibilité API | 99.9% | < 99.5% |
| Latence P95 | < 500ms | > 2s |
| Taux d'erreur | < 1% | > 5% |
| Backup réussi | Quotidien | > 25h |
| Staging commit | < 30s | > 60s |
