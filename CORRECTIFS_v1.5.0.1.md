# 🔧 Correctifs v1.5.0.1 - Atlas Géotechnique

**Date** : 2025-10-20  
**Type** : Patch critique

---

## 🐛 Bugs Corrigés

### 1. ❌ Erreur "Failed to fetch" - CRITIQUE

**Problème** : L'UI ne peut pas contacter l'API  
**Cause** : `.env` utilise `http://127.0.0.1:8001` au lieu de `http://localhost:8001`  
**Solution** : Modifié `.env` ligne 6

```bash
# Avant
VITE_API_GEO=http://127.0.0.1:8001

# Après
VITE_API_GEO=http://localhost:8001
```

**Action** : Rebuild UI
```powershell
docker compose build ui
docker compose up -d ui
```

### 2. ⚠️ Grilles non visibles

**Problème** : Aucune maille affichée sur la carte  
**Cause** : Endpoint `/thematic/data` non appelé correctement  
**Solution** : Après correction du bug #1, les grilles apparaîtront

---

## 🔒 Améliorations Sécurité

### 1. CORS Restreint

**Fichier** : `docker-compose.yml`

```yaml
environment:
  CORS_ORIGIN: http://localhost:8080  # Au lieu de *
```

### 2. Protection des Endpoints Admin

**À implémenter v1.5.1** :
- `/thematic/configs` (POST/DELETE) → Admin seulement
- `/import/bulk` → Editor/Admin
- `/users` → Admin seulement

---

## ⚡ Optimisations Performance

### 1. min_sondages par défaut

**Fichier** : `services/api-geo/src/thematic/routes.rs`

```rust
// Ligne 58 - Ajouter valeur par défaut
let min_sondages = req.min_sondages.unwrap_or(3);
query.push_str(&format!(" AND n_sondages >= {}", min_sondages));
```

### 2. Refresh MV Automatique

**Fichier** : `refresh_mv_cron.sh` (nouveau)

```bash
#!/bin/bash
# Cron: 0 2 * * * /app/refresh_mv_cron.sh

docker compose exec -T db psql -U atlas -d atlas -c \
  "REFRESH MATERIALIZED VIEW CONCURRENTLY mailles_geotechnique_stats;"

echo "$(date): MV refreshed" >> /var/log/atlas/refresh.log
```

---

## 👥 User Manager (v1.5.1)

### Structure SQL

```sql
-- Table users (déjà existe, à enrichir)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Table sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table audit_users
CREATE TABLE IF NOT EXISTS audit_users (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'logout'
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

### Endpoints API

```
POST   /users              - Créer utilisateur (Admin)
GET    /users              - Liste utilisateurs (Admin)
GET    /users/:id          - Détails utilisateur
PUT    /users/:id          - Modifier utilisateur (Admin/Self)
DELETE /users/:id          - Désactiver utilisateur (Admin)
POST   /users/:id/reset    - Réinitialiser mot de passe (Admin)
GET    /users/:id/audit    - Historique utilisateur (Admin)
POST   /auth/login         - Connexion
POST   /auth/logout        - Déconnexion
GET    /auth/sessions      - Sessions actives
DELETE /auth/sessions      - Déconnecter tous appareils
```

### UI Components

```typescript
// UserManagerPanel.ts
interface User {
  id: string;
  username: string;
  email: string;
  role: 'viewer' | 'editor' | 'admin';
  is_active: boolean;
  last_login: string;
  created_at: string;
}

// Tableau avec actions :
// - Créer
// - Modifier rôle
// - Désactiver/Activer
// - Réinitialiser mot de passe
// - Voir audit
```

---

## 🗺️ UI - Raffinements

### 1. Valeurs par défaut

**Fichier** : `ui/src/main.ts`

```typescript
// Panneau thématique - valeurs par défaut
const defaultConfig = {
  parameter: null,
  min_sondages: 3,  // ← Nouveau
  method: 'quantiles',
  classes: 5,
  palette: 'greens'
};
```

### 2. Désactiver bouton "Appliquer"

```typescript
const applyButton = document.querySelector('#apply-thematic');
const parameterSelect = document.querySelector('#parameter-select');

parameterSelect.addEventListener('change', () => {
  applyButton.disabled = !parameterSelect.value;
});
```

### 3. Message "Pas de données"

```typescript
if (response.features.length === 0) {
  showNotification(
    'Aucune donnée disponible pour ce paramètre dans la zone actuelle. ' +
    'Essayez de réduire min_sondages ou de changer de paramètre.',
    'warning'
  );
}
```

### 4. Masquer Import Bulk (temporaire)

```typescript
// Jusqu'à v1.5.1
const importBulkButton = document.querySelector('#import-bulk-btn');
if (importBulkButton) {
  importBulkButton.innerHTML = '📦 Import CSV/Bulk <span class="badge">v1.5.1</span>';
  importBulkButton.disabled = true;
  importBulkButton.title = 'Disponible dans la version 1.5.1';
}
```

---

## 🔄 Refresh MV - Stratégies

### Option 1 : Manuel (actuel)

```sql
REFRESH MATERIALIZED VIEW mailles_geotechnique_stats;
```

### Option 2 : Trigger (après chaque import)

```sql
CREATE OR REPLACE FUNCTION refresh_mv_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO refresh_queue (reason) VALUES ('insert_' || TG_TABLE_NAME);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_mv_sondages
AFTER INSERT ON sondages
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_mv_on_insert();

CREATE TRIGGER trg_refresh_mv_essais
AFTER INSERT ON essais_geotechniques
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_mv_on_insert();
```

### Option 3 : Cron (quotidien)

```bash
# Crontab
0 2 * * * docker compose exec -T db psql -U atlas -d atlas -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mailles_geotechnique_stats;"
```

### Option 4 : Bouton Admin UI

```typescript
async function refreshMV() {
  const response = await fetch('/admin/refresh-mv', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.ok) {
    showNotification('Vue matérialisée rafraîchie avec succès', 'success');
  }
}
```

---

## 🌐 Réseau LAN - Améliorations

### 1. IP Fixe (DHCP Reservation)

**Sur le routeur** :
- MAC Address du PC labo → IP fixe (ex: 192.168.1.100)

### 2. Configuration .env pour LAN

```bash
# Pour déploiement LAN
VITE_API_GEO=http://192.168.1.100:8001
CORS_ORIGIN=http://192.168.1.100:8080
```

### 3. Script de détection IP

**Fichier** : `detect_ip.ps1`

```powershell
$ip = (Get-NetIPAddress -AddressFamily IPv4 | 
       Where-Object {$_.InterfaceAlias -notlike "*Loopback*"} | 
       Select-Object -First 1).IPAddress

Write-Host "IP détectée : $ip"
Write-Host "URL UI : http://${ip}:8080"
Write-Host "URL API : http://${ip}:8001"
```

---

## 📊 Sauvegarde & Monitoring

### Sauvegarde Automatique

```bash
#!/bin/bash
# backup.sh - Cron: 0 3 * * 0 (dimanche 3h)

BACKUP_DIR="/backups/atlas"
DATE=$(date +%Y%m%d)

# Dump DB
docker compose exec -T db pg_dump -U atlas -d atlas | \
  gzip > "${BACKUP_DIR}/atlas_${DATE}.sql.gz"

# Nettoyer anciens backups (>30 jours)
find "${BACKUP_DIR}" -name "atlas_*.sql.gz" -mtime +30 -delete

echo "$(date): Backup créé - atlas_${DATE}.sql.gz"
```

### Monitoring Simple

```bash
#!/bin/bash
# health_check.sh - Cron: */5 * * * * (toutes les 5 min)

# Check API
if ! curl -sf http://localhost:8001/healthz > /dev/null; then
  echo "$(date): API DOWN" >> /var/log/atlas/health.log
  # Redémarrer
  docker compose restart api-geo
fi

# Check UI
if ! curl -sf http://localhost:8080 > /dev/null; then
  echo "$(date): UI DOWN" >> /var/log/atlas/health.log
  docker compose restart ui
fi
```

---

## ✅ Checklist v1.5.0.1

### Correctifs Immédiats

- [x] Corriger `.env` (localhost au lieu de 127.0.0.1)
- [ ] Rebuild UI
- [ ] Redémarrer services
- [ ] Tester carte thématique
- [ ] Vérifier grilles visibles

### Améliorations Court Terme

- [ ] Ajouter `min_sondages=3` par défaut
- [ ] Masquer bouton Import Bulk
- [ ] Ajouter message "Pas de données"
- [ ] Désactiver bouton si pas de paramètre

### Sécurité

- [ ] Restreindre CORS à l'IP UI
- [ ] Protéger endpoints admin (v1.5.1)
- [ ] Implémenter sessions (v1.5.1)

### User Manager (v1.5.1)

- [ ] Créer tables SQL
- [ ] Implémenter endpoints API
- [ ] Créer UI de gestion
- [ ] Ajouter audit trail

### Performance

- [ ] Refresh MV automatique (cron ou trigger)
- [ ] Monitoring simple
- [ ] Sauvegarde automatique

---

**Version** : 1.5.0.1  
**Statut** : Patch en cours  
**Date** : 2025-10-20
