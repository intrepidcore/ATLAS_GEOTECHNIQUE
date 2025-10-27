# 📊 Comparaison des Scripts de Démarrage - Atlas v1.3.0

## 🎯 Résumé Rapide

| Script | Recommandé Pour | Hot Reload | Facilité |
|--------|----------------|------------|----------|
| **quick-start.ps1** ⭐ | **Développement quotidien** | ✅ Oui | ⭐⭐⭐⭐⭐ |
| start-dev-improved.ps1 | Production/Déploiement | ⚠️ Partiel | ⭐⭐⭐ |
| start-dev.ps1 | Legacy | ❌ Non | ⭐⭐ |

---

## 🚀 quick-start.ps1 ⭐ **RECOMMANDÉ**

### ✨ Avantages

1. **Hot Reload Complet**
   - ✅ Backend: `cargo run` recompile automatiquement les fichiers `.rs` modifiés
   - ✅ Frontend: Vite HMR recharge instantanément les `.ts`, `.html`, `.css`
   - ✅ **Pas besoin de redémarrer manuellement !**

2. **Workflow Optimal**
   ```
   Modifier fichier .rs → Sauvegarder → Recompilation auto → Serveur redémarre
   Modifier fichier .ts → Sauvegarder → HMR instantané → Page se met à jour
   ```

3. **Fenêtres Séparées**
   - Chaque service dans sa propre fenêtre PowerShell
   - Logs visibles en temps réel
   - Facile à arrêter (fermer la fenêtre ou Ctrl+C)
   - Pas de jobs PowerShell compliqués

4. **Options Flexibles**
   ```powershell
   .\quick-start.ps1              # Démarrage normal
   .\quick-start.ps1 -CleanBuild  # Build propre
   .\quick-start.ps1 -Verbose     # Logs détaillés
   ```

5. **Simple et Efficace**
   - Pas de gestion complexe de processus
   - Pas de redirection de logs
   - Juste 2 fenêtres PowerShell indépendantes

### 📋 Usage Typique

```powershell
# Lancer le projet
.\quick-start.ps1

# Modifier un fichier backend
# → services/api-geo/src/exports.rs
# → Sauvegarder
# → cargo détecte le changement et recompile automatiquement
# → Le serveur redémarre avec les nouvelles modifications

# Modifier un fichier frontend
# → ui/src/main.ts
# → Sauvegarder
# → Vite HMR recharge instantanément la page
# → Pas de rechargement complet du navigateur

# Arrêter
# → Fermer les 2 fenêtres PowerShell
```

### ⚠️ Limitations

- Nécessite de fermer manuellement les fenêtres pour arrêter
- Pas de logs centralisés dans des fichiers

---

## 🔧 start-dev-improved.ps1

### ✨ Avantages

1. **Gestion Avancée**
   - Processus natifs (pas de jobs)
   - Logs redirigés vers `logs/`
   - Health checks intelligents
   - Arrêt propre avec Ctrl+C

2. **Logs Persistants**
   ```
   logs/backend.log
   logs/backend-error.log
   logs/frontend.log
   logs/frontend-error.log
   ```

3. **Monitoring**
   - Détection automatique des crashes
   - Vérification des ports
   - Messages d'erreur détaillés

### ⚠️ Limitations

- **Pas de Hot Reload** : Utilise `cargo build --release` puis lance l'exécutable
- Modifications backend nécessitent un redémarrage complet
- Plus complexe à utiliser

### 📋 Usage

```powershell
.\start-dev-improved.ps1 -NoBrowser
```

---

## 📜 start-dev.ps1 (Legacy)

### ⚠️ Limitations

- Utilise des jobs PowerShell (difficiles à gérer)
- Pas de hot reload
- Logs non persistants
- Arrêt manuel compliqué

### 📋 Quand l'utiliser

- Pour référence uniquement
- Préférez `quick-start.ps1` à la place

---

## 🎯 Recommandation Finale

### Pour le Développement Quotidien ⭐

```powershell
.\quick-start.ps1
```

**Pourquoi ?**
- ✅ Hot reload complet (backend + frontend)
- ✅ Workflow optimal pour le développement
- ✅ Simple et efficace
- ✅ Pas besoin de redémarrer manuellement
- ✅ Logs visibles en temps réel dans les fenêtres

### Pour le Débogage Avancé

```powershell
.\quick-start.ps1 -Verbose
```

### Pour un Build Propre

```powershell
.\quick-start.ps1 -CleanBuild
```

---

## 📊 Tableau Comparatif Détaillé

| Fonctionnalité | quick-start.ps1 | start-dev-improved.ps1 | start-dev.ps1 |
|----------------|-----------------|------------------------|---------------|
| **Hot Reload Backend** | ✅ Automatique | ❌ Manuel | ❌ Manuel |
| **Hot Reload Frontend** | ✅ HMR | ✅ HMR | ✅ HMR |
| **Fenêtres Séparées** | ✅ Oui | ❌ Non | ❌ Non |
| **Logs Temps Réel** | ✅ Visibles | ⚠️ Fichiers | ⚠️ Jobs |
| **Arrêt Simple** | ✅ Fermer fenêtre | ✅ Ctrl+C | ⚠️ Commandes |
| **Compilation Auto** | ✅ cargo run | ⚠️ cargo build | ⚠️ cargo build |
| **Health Checks** | ⚠️ Basique | ✅ Avancé | ✅ Avancé |
| **Clean Build** | ✅ -CleanBuild | ✅ -CleanBuild | ❌ Non |
| **Mode Verbose** | ✅ -Verbose | ✅ -Verbose | ✅ -Verbose |
| **Complexité** | ⭐ Simple | ⭐⭐⭐ Moyen | ⭐⭐⭐⭐ Complexe |

---

## 💡 Conseils

### Développement Actif
```powershell
# Lancer une fois
.\quick-start.ps1

# Modifier les fichiers
# → Backend (.rs) : Recompilation auto
# → Frontend (.ts) : HMR instantané

# Pas besoin de relancer !
```

### Après un Git Pull
```powershell
# Build propre recommandé
.\quick-start.ps1 -CleanBuild
```

### Débogage
```powershell
# Mode verbose
.\quick-start.ps1 -Verbose

# Voir les logs backend dans la fenêtre
# Voir les logs frontend dans l'autre fenêtre
```

---

## 🔄 Migration

Si vous utilisez actuellement `start-dev.ps1` :

1. **Arrêter l'ancien script**
   ```powershell
   # Arrêter les jobs
   Get-Job | Stop-Job
   Get-Job | Remove-Job
   ```

2. **Utiliser le nouveau**
   ```powershell
   .\quick-start.ps1
   ```

3. **Profiter du hot reload !**
   - Modifiez vos fichiers
   - Sauvegardez
   - Les changements sont appliqués automatiquement

---

**Atlas Géotechnique du Togo v1.3.0**  
*Workflow de développement optimisé avec Hot Reload*
