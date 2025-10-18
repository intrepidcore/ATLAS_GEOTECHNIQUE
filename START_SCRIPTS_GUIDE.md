# 🚀 Guide des Scripts de Démarrage - Atlas v1.3.0

## 📋 Scripts Disponibles

### 1. `start-dev-improved.ps1` ⭐ **RECOMMANDÉ**

Script amélioré avec gestion avancée des processus et logs.

**Fonctionnalités:**
- ✅ Compilation automatique du backend
- ✅ Gestion propre des processus (pas de jobs PowerShell)
- ✅ Logs redirigés vers des fichiers
- ✅ Détection automatique des crashes
- ✅ Arrêt propre avec Ctrl+C
- ✅ Health checks intelligents
- ✅ Ports alternatifs automatiques

**Usage:**
```powershell
# Démarrage normal
.\start-dev-improved.ps1

# Mode verbose
.\start-dev-improved.ps1 -Verbose

# Sans navigateur
.\start-dev-improved.ps1 -NoBrowser

# Compilation complète
.\start-dev-improved.ps1 -CleanBuild

# Ignorer la vérification DB
.\start-dev-improved.ps1 -SkipDbCheck
```

**Avantages:**
- 🎯 Processus indépendants (pas de jobs)
- 📝 Logs persistants dans `logs/`
- 🔄 Redémarrage facile
- 🛑 Arrêt propre garanti
- 📊 Monitoring en temps réel

---

### 2. `start-dev.ps1`

Script original avec jobs PowerShell.

**Usage:**
```powershell
.\start-dev.ps1 -NoBrowser
```

**Limitations:**
- Jobs PowerShell peuvent être difficiles à arrêter
- Logs non persistants
- Nécessite commandes manuelles pour arrêter

---

## 📂 Structure des Logs

```
atlas/
├── logs/
│   ├── backend.log          # Logs backend (stdout)
│   ├── backend-error.log    # Erreurs backend (stderr)
│   ├── frontend.log         # Logs frontend (stdout)
│   └── frontend-error.log   # Erreurs frontend (stderr)
```

## 🔧 Commandes Utiles

### Voir les logs en temps réel

```powershell
# Backend
Get-Content logs/backend.log -Wait

# Frontend
Get-Content logs/frontend.log -Wait

# Erreurs backend
Get-Content logs/backend-error.log -Wait
```

### Arrêter manuellement

```powershell
# Trouver les processus
Get-Process | Where-Object {$_.ProcessName -like "*api-geo*" -or $_.ProcessName -like "*node*"}

# Arrêter par port
Get-NetTCPConnection -LocalPort 8000 | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force
Get-NetTCPConnection -LocalPort 5173 | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force
```

### Nettoyer les logs

```powershell
Remove-Item logs/*.log
```

## 🐛 Dépannage

### Backend ne démarre pas

1. Vérifier la compilation:
```powershell
cd services/api-geo
cargo check
```

2. Vérifier les logs:
```powershell
Get-Content logs/backend-error.log
```

3. Vérifier la base de données:
```powershell
docker ps | findstr atlas-db
```

### Frontend ne démarre pas

1. Vérifier node_modules:
```powershell
cd ui
npm install
```

2. Vérifier les logs:
```powershell
Get-Content logs/frontend-error.log
```

3. Tester manuellement:
```powershell
cd ui
npm run dev
```

### Port déjà utilisé

```powershell
# Libérer le port 8000
Get-NetTCPConnection -LocalPort 8000 | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force

# Libérer le port 5173
Get-NetTCPConnection -LocalPort 5173 | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force
```

## ⚡ Comparaison des Scripts

| Fonctionnalité | start-dev.ps1 | start-dev-improved.ps1 |
|----------------|---------------|------------------------|
| Compilation auto | ❌ | ✅ |
| Logs fichiers | ❌ | ✅ |
| Arrêt propre | ⚠️ | ✅ |
| Détection crash | ❌ | ✅ |
| Health checks | ✅ | ✅ |
| Monitoring | ✅ | ✅ |
| Jobs PowerShell | ✅ | ❌ |
| Processus natifs | ❌ | ✅ |

## 🎯 Recommandations

### Pour le développement quotidien
```powershell
.\start-dev-improved.ps1
```

### Pour déboguer
```powershell
.\start-dev-improved.ps1 -Verbose
```

### Pour tester sans navigateur
```powershell
.\start-dev-improved.ps1 -NoBrowser
```

### Pour une compilation propre
```powershell
.\start-dev-improved.ps1 -CleanBuild
```

## 📝 Notes

- Les logs sont automatiquement créés dans `logs/`
- Le script détecte automatiquement les ports alternatifs (5174 si 5173 occupé)
- Ctrl+C arrête proprement tous les services
- Les processus sont tués même en cas d'erreur
- Compatible avec Windows PowerShell 5.1+

## 🆕 Nouveautés v1.3.0

Le script `start-dev-improved.ps1` inclut toutes les fonctionnalités v1.3.0:
- ✨ Historique d'édition
- ✨ Chargement paresseux
- ✨ Vues thématiques
- ✨ Comparaison mailles voisines
- ✨ Exports professionnels

---

**Atlas Géotechnique du Togo v1.3.0**  
*Script de démarrage professionnel pour développeurs*
