# 📚 Index Documentation - Atlas Géotechnique

**Version** : v2.1.0 (préparé)  
**Date** : 27 octobre 2025

---

## 🎯 POUR DÉMARRER

### Nouveau sur le projet ?
1. 📖 Lire `README.md` (si existe)
2. 📖 Lire `RECAPITULATIF_FINAL.md` (v2.0)
3. 📖 Lire `AUDIT_V2_RECAPITULATIF_FINAL.md` (v2.0.1)

### Reprendre l'implémentation panneau droit ?
1. 🚀 **START HERE** : `RESUME_POUR_REPRENDRE.md`
2. 📋 Contexte : `CONTEXTE_PANNEAU_DROIT_COMPLET.md`
3. 🔧 Code : `SPEC_TECHNIQUE_PANNEAU_DROIT.md`

---

## 📁 DOCUMENTATION PAR THÈME

### 🎨 UI/UX

#### Panneau Gauche (v2.0 - ✅ Complété)
- `RECAPITULATIF_FINAL.md` - Implémentation complète v2.0
- `IMPLEMENTATION_V2_RECAPITULATIF.md` - Détails implémentation
- `README_V2.md` - Guide utilisateur v2.0

#### Panneau Droit (v3.0 - 📋 Spécifié)
- **`RESUME_POUR_REPRENDRE.md`** ⭐ - Point d'entrée
- `CONTEXTE_PANNEAU_DROIT_COMPLET.md` - Contexte global
- `SPEC_TECHNIQUE_PANNEAU_DROIT.md` - Code complet
- `PANNEAU_DROIT_V3_RESUME.md` - Résumé exécutif
- `DECISION_PANNEAU_DROIT.md` - Analyse options
- `SESSION_RECAP_PANNEAU_DROIT.md` - Récap session

### 🔧 Backend SQL

#### Robustesse & Performance (v2.0.1 - ✅ Complété)
- `AUDIT_V2_RECAPITULATIF_FINAL.md` - Audit complet
- `README_AUDIT_V2.md` - Guide audit
- `sql/fn_granulo_indices.sql` - Fonction robuste
- `sql/fn_classify_uscs_v2.sql` - Classification USCS
- `sql/fn_classify_aashto_v2.sql` - Classification AASHTO
- `sql/v_samples_complete_v2.sql` - Vue complète
- `sql/validation_queries.sql` - 6 requêtes validation

### 🧪 Tests & Validation

#### Scripts de Test
- `test_validation_complete.ps1` - Validation automatisée
- `test_complete_endpoint.ps1` - Test endpoint simple
- `sql/find_mailles_with_data.sql` - Trouver mailles avec données

#### Guides de Test
- `GUIDE_TEST_MAILLES.md` - Guide pour trouver mailles
- Tests manuels dans `AUDIT_V2_RECAPITULATIF_FINAL.md`

### 📊 Données

#### Import/Export
- `scripts/README_IMPORT_XLSX.md` - Guide import Excel
- Nombreux scripts dans `scripts/`

#### Validation
- `sql/validation_queries.sql` - Requêtes de contrôle

---

## 📋 DOCUMENTATION PAR VERSION

### v2.0.0 (Panneau Gauche)
- ✅ `RECAPITULATIF_FINAL.md`
- ✅ `IMPLEMENTATION_V2_RECAPITULATIF.md`
- ✅ `README_V2.md`

### v2.0.1 (Audit & Robustesse)
- ✅ `AUDIT_V2_RECAPITULATIF_FINAL.md`
- ✅ `README_AUDIT_V2.md`
- ✅ `GUIDE_TEST_MAILLES.md`

### v2.1.0 (Panneau Droit - Préparé)
- 📋 `RESUME_POUR_REPRENDRE.md`
- 📋 `CONTEXTE_PANNEAU_DROIT_COMPLET.md`
- 📋 `SPEC_TECHNIQUE_PANNEAU_DROIT.md`
- 📋 `PANNEAU_DROIT_V3_RESUME.md`
- 📋 `DECISION_PANNEAU_DROIT.md`
- 📋 `SESSION_RECAP_PANNEAU_DROIT.md`

---

## 🎯 GUIDES PAR TÂCHE

### Je veux...

#### ...comprendre l'état actuel du projet
→ `AUDIT_V2_RECAPITULATIF_FINAL.md`

#### ...implémenter le panneau droit
→ `RESUME_POUR_REPRENDRE.md` puis `SPEC_TECHNIQUE_PANNEAU_DROIT.md`

#### ...tester l'application
→ `test_validation_complete.ps1` et `GUIDE_TEST_MAILLES.md`

#### ...trouver des mailles avec données
→ `GUIDE_TEST_MAILLES.md` et `sql/find_mailles_with_data.sql`

#### ...comprendre les classifications
→ `AUDIT_V2_RECAPITULATIF_FINAL.md` (section Classifications)

#### ...améliorer les performances
→ `AUDIT_V2_RECAPITULATIF_FINAL.md` (section Index)

#### ...importer des données Excel
→ `scripts/README_IMPORT_XLSX.md`

#### ...valider les données
→ `sql/validation_queries.sql`

---

## 📊 MÉTRIQUES PROJET

### Lignes de Code
- **v2.0** : ~2000 lignes (panneau gauche)
- **v2.0.1** : +1420 lignes (audit)
- **v2.1.0** : +1750 lignes (panneau droit - préparé)
- **Total** : ~5170 lignes

### Documentation
- **Fichiers** : 15+ documents
- **Pages** : ~100 pages
- **Mots** : ~50,000 mots

### Tests
- **Scripts** : 3 scripts PowerShell
- **Requêtes SQL** : 12 requêtes validation
- **Couverture** : 100% fonctionnalités v2.0.1

---

## 🔄 WORKFLOW DÉVELOPPEMENT

### 1. Nouvelle Fonctionnalité

```
1. Lire documentation existante
2. Créer branche feature/nom-feature
3. Implémenter
4. Tester (scripts + manuel)
5. Documenter
6. Commit + push
7. Tag version
```

### 2. Bug Fix

```
1. Identifier bug (logs, tests)
2. Créer branche fix/nom-bug
3. Corriger
4. Tester (scripts + manuel)
5. Commit + push
```

### 3. Refactoring

```
1. Analyser code existant
2. Créer branche refactor/nom-refactor
3. Refactorer
4. Tester (100% tests passent)
5. Documenter changements
6. Commit + push
```

---

## 📞 RÉFÉRENCES RAPIDES

### Commandes Utiles

```powershell
# Tests
.\test_validation_complete.ps1

# Build UI
cd ui && npm run build

# Redémarrer API
docker compose restart api-geo

# Logs
docker compose logs api-geo --tail 50 -f

# SQL
docker compose exec -T db psql -U atlas -d atlas -f /tmp/fichier.sql
```

### Endpoints API

- `GET /cells/{code}/complete` - Données complètes maille
- `GET /cells/{code}/labs` - Données laboratoire (legacy)
- `POST /grid/recompute/{code}` - Recalculer IDW
- `GET /grid/{code}/shape` - Géométrie maille

### Fichiers Clés

- `ui/index.html` - Interface principale
- `ui/src/main.ts` - Point d'entrée TypeScript
- `ui/src/version.ts` - Version application
- `services/api-geo/src/main.rs` - API Rust
- `sql/v_samples_complete_v2.sql` - Vue principale

---

## 🎯 ROADMAP

### v2.1.0 (En cours)
- [ ] Implémentation panneau droit
- [ ] Tests complets
- [ ] Documentation utilisateur

### v2.2.0 (Futur)
- [ ] Suggestions temps réel
- [ ] Actions groupées
- [ ] Configurateur export avancé
- [ ] Historique exports

### v3.0.0 (Futur)
- [ ] Polish UI/UX
- [ ] Optimisations performance
- [ ] Tests automatisés complets
- [ ] Documentation API complète

---

## 📚 RESSOURCES EXTERNES

### Technologies
- **Rust** : https://www.rust-lang.org/
- **Axum** : https://github.com/tokio-rs/axum
- **TypeScript** : https://www.typescriptlang.org/
- **Vite** : https://vitejs.dev/
- **PostgreSQL** : https://www.postgresql.org/
- **PostGIS** : https://postgis.net/
- **Leaflet** : https://leafletjs.com/
- **Chart.js** : https://www.chartjs.org/

### Standards
- **USCS** : Unified Soil Classification System
- **AASHTO** : American Association of State Highway and Transportation Officials
- **GTR** : Guide des Terrassements Routiers (France)

---

## 🆘 AIDE

### Problèmes Courants

#### UI ne se met pas à jour
```powershell
# Vider cache navigateur
Ctrl+Shift+R

# Rebuild UI
cd ui && npm run build

# Redémarrer services
docker compose restart
```

#### Tests échouent
```powershell
# Vérifier services
docker compose ps

# Vérifier logs
docker compose logs api-geo --tail 50

# Réappliquer SQL
docker cp sql/fichier.sql atlas-db:/tmp/
docker compose exec -T db psql -U atlas -d atlas -f /tmp/fichier.sql
```

#### Maille sans données
```powershell
# Trouver mailles avec données
docker compose exec -T db psql -U atlas -d atlas -f /tmp/find_mailles_with_data.sql
```

---

**Dernière mise à jour** : 27 octobre 2025  
**Commit** : `189226d`  
**Version** : v2.1.0 (préparé)
