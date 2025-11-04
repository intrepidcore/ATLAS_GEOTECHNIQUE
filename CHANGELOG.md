# Changelog - Atlas Géotechnique Togo

## v2.4.1 — Post-import grid codes (2025-11-04)

### 🔧 Corrections & Améliorations

**Script Post-Import**
- ✅ Script `sql/post_import/calculate_grid_codes.sql`
- ✅ Calcule `grid_code` pour `exact` (Point-in-Polygon)
- ✅ Calcule `grid_code` pour `adm_random_cell` (déterministe via ADM3)
- ✅ Migre automatiquement `spread` → `adm_random_cell`
- ✅ Crée index manquants (`idx_sondages_grid_code`, `idx_mailles_geom`)

**Vérifications**
- ✅ 0 sondages `exact` sans `grid_code`
- ✅ 0 sondages `adm_random_cell` sans `grid_code`
- ✅ 0 sondages en mode `spread`

**Documentation**
- ✅ Guide post-import dans `README_API_V2.4.md`
- ✅ Commandes de vérification SQL

---

## v2.4.0 — API & UI enrichies (2025-11-04)

### 🎯 Fonctionnalités

**API `/cells/{code}/complete`**
- ✅ Ajout champ `physiques` (densité absolue, teneur en eau, source)
- ✅ Ajout champ `classif` (AASHTO/USCS/GTR avec reason)
- ✅ Badge "ADM random cell" pour `location_mode=adm_random_cell`

**SQL**
- ✅ Nouvelle vue `v_samples_complete_v4` avec physiques + classif
- ✅ Migration `017_view_samples_v4.sql`

**UI**
- ✅ Nouveaux accordéons "Essais physiques" et "Classifications"
- ✅ Badge 🎲 affiché dans la liste des sondages
- ✅ Styles pour chips (AASHTO/USCS/GTR) et pills

**Tests**
- ✅ Script `scripts/test_complete_api.ps1`

**QA & Import**
- ✅ Import complet de `bleu.xlsx` (72 sondages, 213 essais VBS)
- ✅ Import complet de `Granulométrie.xlsx` (72 localités, 214 points granulo)
- ✅ Import complet de `limite.xlsx` (32 localités, 94 essais Atterberg)
- ✅ Système de validation QA avec 6 vérifications obligatoires
- ✅ Script `scripts/run_qa_validation.ps1` avec archivage des résultats

### 📊 Statistiques Import

**Total importé:**
- 176 sondages uniques
- 521 essais géotechniques
- 214 points granulométriques

**Validation QA:**
- ✅ Compteurs & Couverture: PASS
- ✅ Méthodes Granulo: 100% tamisage
- ✅ Doublons: PASS (0 doublon)
- ✅ Bornes % Passing: PASS (toutes valeurs dans [0,100])
- ✅ Monotonicité: PASS (0 inversion)
- ✅ Géolocalisation: PASS (0 spread, tous les adm_random_cell ont grid_code)

### ⚠️ Limitations Connues

- Les sondages importés via recap (bleu/granulo/limite) n'ont pas encore de `grid_code` calculé
- L'endpoint `/cells/{code}/complete` nécessite un `grid_code` pour fonctionner
- **Action requise:** Exécuter un script de post-processing pour calculer les `grid_code` manquants

### 🔧 Fichiers Modifiés

```
db/migrations/017_view_samples_v4.sql
services/api-geo/src/cells_labs.rs
ui/src/main.ts
ui/src/cell-complete-types.ts
ui/index.html
scripts/test_complete_api.ps1
scripts/run_qa_validation.ps1
sql/qa/recap_full_validation.sql
```

---

## v2.3.0 — Import Wizard V3 (2025-10-28)

### Fonctionnalités
- Import wizard V3 avec détection automatique des colonnes
- Support multi-feuilles Excel
- Validation en temps réel
- Gestion des conflits (skip/update/error)

---

## v2.2.0 — Cartes Thématiques (2025-10-20)

### Fonctionnalités
- Cartes thématiques choroplèthes
- Classification automatique (quantiles, Jenks, intervalles égaux)
- Export GeoJSON et PNG
- Filtres ADM1/ADM2/ADM3

---

## v2.1.0 — Panneau Droit Unifié (2025-10-15)

### Fonctionnalités
- Recherche unifiée mailles/sondages
- Accordéons filtres
- Actions directes
- Raccourcis clavier

---

## v2.0.0 — Refonte Complète (2025-10-01)

### Fonctionnalités
- Architecture Rust/Axum
- PostGIS pour géométries
- UI moderne avec Leaflet
- Formulaire géotechnique modal
