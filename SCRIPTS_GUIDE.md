# 📜 Guide des Scripts Atlas v1.4.0

Ce guide explique les différents scripts PowerShell disponibles pour gérer l'environnement de développement Atlas.

---

## 🚀 Scripts de Démarrage

### `quick-start.ps1` - Démarrage Rapide (Docker)

**Utilisation recommandée pour le développement**

Lance le backend dans Docker et le frontend avec Vite.

```powershell
# Démarrage normal
.\quick-start.ps1

# Rebuild de l'image Docker avant démarrage
.\quick-start.ps1 -RebuildDocker

# Équivalent à -RebuildDocker (pour compatibilité)
.\quick-start.ps1 -CleanBuild
```

**Ce que fait le script :**
1. ✅ Détecte et arrête les conflits (processus Cargo local, conteneurs existants)
2. ✅ Lance Docker Compose (DB + API)
3. ✅ Lance le frontend Vite dans une fenêtre séparée
4. ✅ Ouvre automatiquement le navigateur

**Architecture :**
- Backend : `http://localhost:8001` (Docker)
- Frontend : `http://localhost:5173` (Vite local)
- Database : `localhost:5432` (Docker)

**Workflow de développement :**
- **Frontend (.ts/.html/.css)** → Hot reload automatique ⚡
- **Backend (.rs)** → Rebuild manuel nécessaire :
  ```powershell
  docker compose build api-geo
  docker compose up -d api-geo
  ```

---

### `start-dev.ps1` - Démarrage Développement (Legacy)

**⚠️ Ancien script - Utilise Cargo local au lieu de Docker**

Lance le backend avec `cargo run` directement sur Windows.

```powershell
.\start-dev.ps1
```

**Différences avec `quick-start.ps1` :**
- ❌ Pas d'isolation Docker
- ✅ Hot reload automatique pour le backend
- ❌ Nécessite Rust installé localement
- ❌ Peut avoir des conflits de dépendances système

**Recommandation :** Utilisez `quick-start.ps1` à la place.

---

## 🛑 Scripts d'Arrêt

### `stop-all.ps1` - Arrêt Complet

Arrête **tous** les services (Docker + processus locaux).

```powershell
.\stop-all.ps1
```

**Ce que fait le script :**
1. ✅ Arrête tous les conteneurs Docker (`docker compose down`)
2. ✅ Tue les processus `api-geo.exe` (Cargo local)
3. ✅ Tue les processus Node/Vite
4. ✅ Vérifie que les ports sont libérés

**Utilisation :**
- Avant de changer d'approche (Docker ↔ Cargo local)
- Pour nettoyer complètement l'environnement
- En cas de conflit de ports

---

## 🧪 Scripts de Test

### `test_geotech_api.ps1` - Tests API Géotechnique

Teste les nouveaux endpoints géotechniques (v1.4.0).

```powershell
.\test_geotech_api.ps1
```

**Tests effectués :**
1. ✅ Healthcheck API
2. ✅ Création sondage géotechnique complet
3. ✅ Récupération avec essais et classifications
4. ✅ Calcul automatique IP (WL - WP)
5. ✅ Validation des ENUMs

**Prérequis :** Backend Docker doit être démarré (`.\quick-start.ps1`)

---

## 🐳 Commandes Docker Utiles

### Gestion des conteneurs

```powershell
# Voir l'état des conteneurs
docker compose ps

# Voir les logs en temps réel
docker compose logs -f api-geo

# Redémarrer un service
docker compose restart api-geo

# Arrêter tous les services
docker compose down

# Arrêter et supprimer les volumes (⚠️ perte de données DB)
docker compose down -v
```

### Rebuild après modification du code Rust

```powershell
# Rebuild de l'image
docker compose build api-geo

# Redémarrer avec la nouvelle image
docker compose up -d api-geo

# Ou en une seule commande
docker compose build api-geo && docker compose up -d api-geo
```

### Accès à la base de données

```powershell
# Se connecter à PostgreSQL
docker compose exec db psql -U atlas -d atlas

# Exécuter un fichier SQL
type migration.sql | docker compose exec -T db psql -U atlas -d atlas

# Voir les tables
docker compose exec db psql -U atlas -d atlas -c "\dt"
```

---

## 📊 Comparaison des Approches

| Critère | `quick-start.ps1` (Docker) | `start-dev.ps1` (Cargo) |
|---------|---------------------------|------------------------|
| **Backend** | Docker (Port 8001) | Cargo local (Port 8000) |
| **Hot reload backend** | ❌ Rebuild manuel | ✅ Automatique |
| **Hot reload frontend** | ✅ Automatique | ✅ Automatique |
| **Isolation** | ✅ Complète | ❌ Non |
| **Vitesse rebuild** | 🐌 Lent (30-60s) | ⚡ Rapide (5-10s) |
| **Déploiement** | ✅ Facile | ❌ Complexe |
| **Recommandation** | 🚀 Production | 🛠️ Dev rapide |

---

## 🎯 Workflows Recommandés

### Développement Frontend Intensif

Si vous modifiez principalement le frontend :

```powershell
# Démarrage
.\quick-start.ps1

# Développement
# → Modifiez les fichiers .ts/.html/.css
# → Le navigateur se recharge automatiquement

# Arrêt
.\stop-all.ps1
```

### Développement Backend Intensif

Si vous modifiez souvent le backend Rust :

**Option 1 : Docker (recommandé pour la cohérence)**
```powershell
# Démarrage
.\quick-start.ps1

# Après chaque modification .rs
docker compose build api-geo && docker compose up -d api-geo

# Voir les logs
docker compose logs -f api-geo
```

**Option 2 : Cargo local (plus rapide)**
```powershell
# Arrêter Docker
docker compose down

# Lancer uniquement la DB en Docker
docker compose up -d db

# Lancer le backend en local (fenêtre séparée)
cd services/api-geo
cargo run

# Lancer le frontend (autre fenêtre)
cd ui
npm run dev
```

### Développement Full-Stack

```powershell
# Démarrage
.\quick-start.ps1

# Frontend : modifications automatiques
# Backend : rebuild quand nécessaire
docker compose build api-geo && docker compose up -d api-geo

# Tests
.\test_geotech_api.ps1

# Arrêt
.\stop-all.ps1
```

---

## 🔧 Dépannage

### Port déjà utilisé

```powershell
# Identifier le processus
Get-NetTCPConnection -LocalPort 8001

# Arrêter tout
.\stop-all.ps1
```

### Backend ne démarre pas

```powershell
# Voir les logs
docker compose logs api-geo

# Rebuild complet
docker compose down
docker compose build api-geo
docker compose up -d
```

### Frontend ne se connecte pas au backend

Vérifiez que l'URL de l'API dans le frontend pointe vers le bon port :
- Docker : `http://localhost:8001`
- Cargo local : `http://localhost:8000`

### Migration SQL non appliquée

```powershell
# Appliquer une migration
type db\migrations\007_geotechnical_enrichment.sql | docker compose exec -T db psql -U atlas -d atlas

# Vérifier les tables
docker compose exec db psql -U atlas -d atlas -c "\dt"
```

---

## 📝 Résumé des Commandes

```powershell
# Démarrage rapide (recommandé)
.\quick-start.ps1

# Démarrage avec rebuild Docker
.\quick-start.ps1 -RebuildDocker

# Arrêt complet
.\stop-all.ps1

# Tests API
.\test_geotech_api.ps1

# Rebuild backend après modif .rs
docker compose build api-geo && docker compose up -d api-geo

# Logs backend
docker compose logs -f api-geo

# État des services
docker compose ps
```

---

**Version :** 1.4.0  
**Dernière mise à jour :** 2025-10-18
