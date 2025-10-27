# 🚀 Démarrage Rapide Atlas

## 📋 Après un Redémarrage PC

Lancez simplement :
```powershell
cd C:\PROJET_ATLAS_MASTER\atlas
.\scripts\quick-start.ps1
```

Cela va :
1. ✅ Démarrer tous les conteneurs Docker (DB + API + UI)
2. ✅ Vérifier le statut des services
3. ✅ Ouvrir automatiquement http://localhost:8080

## 🔧 Commandes Disponibles

### Démarrage Standard
```powershell
.\scripts\quick-start.ps1
```

### Rebuild Backend (après modif .rs)
```powershell
.\scripts\quick-start.ps1 -RebuildAPI
```

### Rebuild Frontend (après modif .ts)
```powershell
.\scripts\quick-start.ps1 -RebuildUI
```

### Rebuild Complet
```powershell
.\scripts\quick-start.ps1 -RebuildAPI -RebuildUI
```

## 🎨 Mode Développement (HMR)

Pour développer avec rechargement instantané :
```powershell
.\scripts\quick-start-wizard-dev.ps1
```

Cela lance :
- Backend Docker sur port 8080
- Frontend Vite avec HMR sur port 5173
- Modifications .ts rechargées automatiquement

## 🛠️ Développement Frontend Rapide

Si vous modifiez uniquement le frontend :

1. **Modifier** les fichiers dans `ui/src/`
2. **Build** :
   ```powershell
   cd ui
   npm run build
   cd ..
   ```
3. **Déployer** :
   ```powershell
   .\deploy_dist.ps1
   ```
4. **Rafraîchir** le navigateur : `Ctrl + Shift + R`

## 📊 Architecture

```
┌─────────────────────────────────────┐
│  Navigateur                         │
│  http://localhost:8080              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Nginx (conteneur UI)               │
│  - Sert le frontend statique        │
│  - Proxy /api → api-geo:8000        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  API Rust (conteneur api-geo)       │
│  Port interne: 8000                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  PostgreSQL + PostGIS (conteneur db)│
│  Port: 5432                         │
└─────────────────────────────────────┘
```

## 🔍 Diagnostics

### Vérifier les Services
```powershell
docker compose ps
```

### Voir les Logs
```powershell
# Backend
docker compose logs -f api-geo

# Frontend
docker compose logs -f ui

# Base de données
docker compose logs -f db
```

### Arrêter Tout
```powershell
docker compose down
```

### Redémarrer un Service
```powershell
docker compose restart api-geo
docker compose restart ui
```

## ⚠️ Problèmes Courants

### "Failed to fetch"
**Cause** : Les conteneurs Docker ne sont pas démarrés
**Solution** : `.\scripts\quick-start.ps1`

### "Port 8080 already in use"
**Cause** : Un autre service utilise le port
**Solution** :
```powershell
# Trouver le processus
netstat -ano | findstr :8080

# Arrêter les conteneurs
docker compose down
```

### Modifications Frontend non visibles
**Cause** : Cache navigateur
**Solution** : `Ctrl + Shift + R` ou navigation privée

### Modifications Backend non visibles
**Cause** : L'image Docker n'a pas été rebuildée
**Solution** : `.\scripts\quick-start.ps1 -RebuildAPI`

## 📚 Documentation Complète

- **Wizard Import** : Voir `TEST_WIZARD_CHECKLIST.md`
- **Solution Robuste** : Voir `SOLUTION_ROBUSTE_FINALE.md`
- **Migration ExcelJS** : Voir `MIGRATION_EXCELJS.md`
- **Diagnostic 400** : Voir `DIAGNOSTIC_FINAL_400.md`

## 💡 Astuces

- **Logs en temps réel** : Ouvrez un terminal avec `docker compose logs -f`
- **Mode dev** : Utilisez `quick-start-wizard-dev.ps1` pour le HMR
- **Déploiement rapide** : `deploy_dist.ps1` copie directement dans le conteneur
- **Pas de rebuild** : Les modifications frontend ne nécessitent pas de rebuild Docker
