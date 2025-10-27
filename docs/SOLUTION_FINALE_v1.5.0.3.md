# ✅ Solution Finale - Atlas v1.5.0.3

**Date** : 2025-10-21  
**Statut** : ✅ **RÉSOLU ET TESTÉ**

---

## 🎯 Problème Initial

**"Failed to fetch"** dans l'UI lors de l'appel à l'API.

### Cause Racine

L'UI était compilée avec `http://127.0.0.1:8001` au lieu de `/api` (proxy Nginx).

**Pourquoi ?** Vite ne voyait pas les variables `VITE_API_GEO` pendant le build Docker.

---

## ✅ Solution Appliquée

### Option A : Build Args Docker (RETENUE)

**Fichiers modifiés** :

#### 1. `ui/Dockerfile`

```dockerfile
# Build args pour Vite
ARG VITE_API_GEO=/api
ARG VITE_API_INFER=/api-infer
ARG VITE_API_OPTI=/api-opti

# Convertir ARG en ENV pour que Vite les voie
ENV VITE_API_GEO=${VITE_API_GEO}
ENV VITE_API_INFER=${VITE_API_INFER}
ENV VITE_API_OPTI=${VITE_API_OPTI}

RUN npm run build
```

#### 2. `docker-compose.yml`

```yaml
ui:
  build:
    context: ./ui
    args:
      - VITE_API_GEO=${VITE_API_GEO:-/api}
      - VITE_API_INFER=${VITE_API_INFER:-/api-infer}
      - VITE_API_OPTI=${VITE_API_OPTI:-/api-opti}
```

#### 3. `.env` (racine)

```env
VITE_API_GEO=/api
VITE_API_INFER=/api-infer
VITE_API_OPTI=/api-opti
```

#### 4. Suppression fichier parasite

```powershell
Remove-Item ui\.env -Force
```

**Ce fichier écrasait les variables !**

---

## 🔧 Autres Correctifs

### Backend API

1. **Alias Serde** (`services/api-geo/src/thematic/types.rs`)
   ```rust
   #[serde(alias = "passant80um_avg", alias = "passant_80um_avg")]
   Passant80umAvg,
   ```

2. **Route import/bulk** (`services/api-geo/src/import_bulk/routes.rs`)
   ```rust
   .route("/import/bulk", post(import_async))
   ```

---

## 🧪 Tests de Validation

### Test Automatique

```powershell
.\test_rebuild.ps1
```

**Résultats** :
- ✅ Proxy healthz : OK
- ✅ Paramètre avec underscore : OK
- ✅ Endpoint import/bulk : OK

### Vérification Build UI

```powershell
.\check_ui_build.ps1
```

**Résultat** : ✅ Pas de référence à `8001`

---

## 📊 Architecture Finale

```
Navigateur
    ↓
http://127.0.0.1:8080
    ↓
Nginx (UI Container)
    ├─ / → UI statique (dist/)
    └─ /api/ → api-geo:8000 (proxy interne)
        ├─ /api/healthz
        ├─ /api/thematic/data
        └─ /api/import/bulk
```

---

## 🚀 Démarrage

### Production

```powershell
cd atlas
.\scripts\start-production.ps1
```

### Avec Rebuild

```powershell
.\scripts\start-production.ps1 -Rebuild
```

### Clean Start

```powershell
.\scripts\start-production.ps1 -CleanStart -Rebuild
```

---

## ✅ Avantages v1.5.0.3

1. **Plus de problème localhost** : Proxy Nginx gère tout
2. **Pas de CORS** : Même origine (port 8080)
3. **Pas de rebuild si IP change** : Chemins relatifs `/api`
4. **API non exposée** : Sécurité renforcée
5. **Vérification automatique** : Script détecte les mauvais builds

---

## 🔍 Diagnostic Rapide

### Si "Failed to fetch"

```powershell
# 1. Vérifier proxy
Invoke-RestMethod http://127.0.0.1:8080/api/healthz

# 2. Vérifier build UI
.\check_ui_build.ps1

# 3. Si erreur, rebuild
docker compose build --no-cache ui
docker compose up -d ui
```

### Logs

```powershell
# API
docker compose logs -f api-geo

# UI (Nginx)
docker compose logs -f ui

# Tous
docker compose logs -f
```

---

## 📝 Leçons Apprises

### Priorité des fichiers .env dans Vite

1. `.env.local` (le plus prioritaire)
2. `.env.[mode]` (ex: `.env.production`)
3. `.env` ← **ATTENTION : Peut écraser !**

**Solution** : Supprimer `ui/.env` ou utiliser build args Docker.

### Build Args vs ENV

- **ARG** : Disponible uniquement pendant le build
- **ENV** : Disponible au runtime ET au build

**Pour Vite** : Convertir ARG → ENV avant `npm run build`

### Cache Docker

Toujours utiliser `--no-cache` pour les builds critiques :
```powershell
docker compose build --no-cache ui
```

---

## 🎯 Checklist Déploiement

- [x] `.env` contient `VITE_API_GEO=/api`
- [x] Pas de `ui/.env` parasite
- [x] `docker-compose.yml` passe les build args
- [x] `ui/Dockerfile` convertit ARG → ENV
- [x] Build avec `--no-cache`
- [x] Vérification avec `check_ui_build.ps1`
- [x] Tests automatiques passent
- [x] Test navigateur (mode privé)

---

## 🌐 Pour LAN

1. Obtenir IP serveur :
   ```powershell
   ipconfig
   ```

2. Ouvrir firewall :
   ```powershell
   New-NetFirewallRule -DisplayName "Atlas" -LocalPort 8080 -Protocol TCP -Action Allow
   ```

3. URL testeurs :
   ```
   http://[IP_SERVEUR]:8080
   ```

4. **AUCUN rebuild nécessaire !** ✅

---

**Version** : 1.5.0.3  
**Statut** : ✅ Production-Ready  
**Date** : 2025-10-21

🎉 **Atlas est maintenant pleinement opérationnel !**
