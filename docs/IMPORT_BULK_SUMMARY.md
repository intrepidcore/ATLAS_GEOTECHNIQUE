# 📊 Résumé - Cahier des Charges Import Bulk

**Date:** 19 octobre 2025  
**Version:** 1.0  
**Statut:** ✅ Validé pour implémentation

---

## 🎯 Objectif Principal

Permettre l'import de sondages géotechniques **SANS coordonnées GPS** à partir de fichiers CSV/Excel, avec géolocalisation alternative via zones administratives (ADM).

---

## 📋 Fonctionnalités Clés

### ✅ Import Multi-Format
- **CSV** (virgule, point-virgule, tabulation)
- **Excel** (.xlsx)
- **JSON** (array d'objets)

### ✅ Détection Automatique
- Format de fichier
- Séparateur CSV
- Structure des données (Large/Long)
- Type d'essai
- Colonnes ADM

### ✅ 4 Modes de Géolocalisation

1. **Centroïde ADM** (Recommandé)
   - Point au centre de la zone administrative
   - Géocodage ultérieur possible

2. **Position Inconnue (Unknown)**
   - Aucune coordonnée
   - Géocodage ultérieur obligatoire

3. **Point Aléatoire**
   - Position aléatoire déterministe dans la zone
   - Rayon: ±150m, ±400m, ±1000m

4. **Rattachement Maille**
   - Point au centroïde d'une maille
   - Sélection sur carte

### ✅ Matching Intelligent ADM3
- Recherche exacte (case-insensitive)
- Normalisation (accents, espaces)
- Fuzzy matching (Levenshtein)
- Fallback vers mode `unknown`

### ✅ Support Analyses Qualitatives
- Valeurs numériques ET qualitatives
- Exemple: VBS = 1.75 g/100g + "Faible"

---

## 📊 Format Standard

### Format "Long" (Recommandé)

```csv
localite,type_essai,profondeur_m,valeur,unite,analyse_qualitative,date,adm3
Adjengré,Granulometrie,1.0,77.73,%,,2024-01-15,Sotouboua
Akéi,BleuMethylene_VBS,1.0,1.75,g/100g,Faible,2024-02-10,Bassar
Adjengré,Atterberg_WL,1.0,50.34,%,Elevé,2024-03-01,Sotouboua
```

### Champs

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `localite` | ✅ | Nom de la localité |
| `type_essai` | ✅ | Type d'essai |
| `profondeur_m` | ✅ | Profondeur (m) |
| `valeur` | ⚠️ | Valeur numérique |
| `analyse_qualitative` | ⚠️ | Analyse qualitative |
| `adm3` | ❌ | Zone ADM3 |
| `date` | ❌ | Date du sondage |
| `source` | ❌ | Source des données |
| `operator` | ❌ | Opérateur |

⚠️ Au moins `valeur` OU `analyse_qualitative` requis

---

## 🗺️ Workflow Utilisateur

### Étape 1: Upload
```
┌─────────────────────────────────┐
│  📁 Import Bulk                 │
│  Glissez-déposez votre fichier  │
│  Formats: CSV, XLSX, JSON       │
└─────────────────────────────────┘
```

### Étape 2: Mapping
```
┌─────────────────────────────────┐
│  📊 Configuration Import        │
│  Localités → [localite ▼]      │
│  1, 1.5, 2 → [Profondeurs ▼]   │
│  Type essai: [Granulometrie ▼] │
└─────────────────────────────────┘
```

### Étape 3: Géolocalisation
```
┌─────────────────────────────────┐
│  🗺️ Mode de Géolocalisation     │
│  ○ Centroïde ADM (recommandé)   │
│  ○ Position inconnue            │
│  ○ Point aléatoire              │
│  ○ Rattachement maille          │
└─────────────────────────────────┘
```

### Étape 4: Validation
```
┌─────────────────────────────────┐
│  ✅ Import Terminé              │
│  • 12 sondages importés         │
│  • 36 essais créés              │
│  • Mode: Centroïde ADM          │
└─────────────────────────────────┘
```

### Étape 5: Géocodage Ultérieur (Optionnel)
```
┌─────────────────────────────────┐
│  🗺️ Sondages à Géocoder (12)    │
│  AUTO-001  Adjengré  centroid   │
│  [🗺️ Géocoder sélection]        │
└─────────────────────────────────┘
```

---

## 🔧 Architecture Technique

### Backend

**Endpoint:**
```
POST /api/v1/surveys/bulk-import
Content-Type: multipart/form-data
```

**Composants:**
- Parser CSV (détection auto séparateur)
- Parser Excel (.xlsx)
- Parser JSON
- Transformer Large → Long
- Matcher ADM3 (fuzzy)
- Validator
- Importer

### Frontend

**Composants:**
- Upload Manager (drag & drop)
- Column Mapper (interactif)
- Preview Table
- Geolocation Selector
- Progress Tracker
- Result Summary

### Base de Données

**Tables impactées:**
- `sondages` (INSERT)
- `essais` (INSERT)
- `sondages_non_geocodes` (VIEW - auto update)

---

## 📅 Roadmap

### Phase 1: MVP (2 semaines) - Priorité HAUTE
- ✅ Parser CSV format "Long"
- ✅ Mapping manuel colonnes
- ✅ Mode Centroïde ADM
- ✅ Import Granulométrie
- ✅ Validation basique

**Livrable:** Import fonctionnel pour Granulométrie

### Phase 2: Enrichissement (2 semaines) - Priorité MOYENNE
- ✅ Support format "Large" → "Long"
- ✅ Analyses qualitatives
- ✅ Modes `unknown` et `random`
- ✅ Matching ADM3 fuzzy
- ✅ Prévisualisation avancée

**Livrable:** Import VBS et Atterberg

### Phase 3: Optimisation (1 semaine) - Priorité BASSE
- ✅ Support Excel (.xlsx)
- ✅ Support JSON
- ✅ Import incrémental
- ✅ Détection auto type d'essai
- ✅ Export templates

**Livrable:** Multi-formats + Templates

### Phase 4: Avancé (Futur)
- Import batch (plusieurs fichiers)
- Validation avancée (règles métier)
- Import asynchrone (gros fichiers)
- Historique des imports
- Rollback d'import

---

## ✅ Avantages

### Pour les Utilisateurs
- ✅ Import de données historiques sans GPS
- ✅ Workflow simple et guidé
- ✅ Géocodage différé possible
- ✅ Validation en temps réel
- ✅ Support analyses qualitatives

### Pour le Projet
- ✅ Intégration données existantes
- ✅ Enrichissement base de données
- ✅ Compatibilité formats variés
- ✅ Extensible (nouveaux types d'essais)
- ✅ Traçabilité (source, opérateur)

---

## 📊 Cas d'Usage Réels

### Cas 1: Granulométrie (12 localités)
- **Fichier:** CSV format "Large"
- **Colonnes:** Localités, 1, 1.5, 2
- **Mode:** Centroïde ADM
- **Résultat:** 12 sondages, 36 essais

### Cas 2: VBS avec Analyses (17 localités)
- **Fichier:** CSV format "Large" (valeurs + analyses)
- **Colonnes:** Localités, 1, 1.5, 2 (×2)
- **Mode:** Centroïde ADM
- **Résultat:** 17 sondages, 51 essais (valeurs + qualitatives)

### Cas 3: Atterberg Multi-Essais (12 localités)
- **Fichier:** CSV format "Long"
- **Colonnes:** Localité, Profondeur, WL, WP, IP, Analyse
- **Mode:** Centroïde ADM
- **Résultat:** 12 sondages, 108 essais (3 types × 3 profondeurs × 12)

---

## 🎯 Critères de Succès

### Fonctionnels
- ✅ Import sans GPS fonctionnel
- ✅ 4 modes de géolocalisation opérationnels
- ✅ Matching ADM3 > 90% de réussite
- ✅ Support 3 formats (CSV, XLSX, JSON)
- ✅ Validation complète des données

### Techniques
- ✅ Import < 5 secondes pour 1000 lignes
- ✅ Taux d'erreur < 1%
- ✅ Détection automatique > 95%
- ✅ API RESTful documentée
- ✅ Tests unitaires > 80% coverage

### UX
- ✅ Workflow < 5 clics
- ✅ Prévisualisation en temps réel
- ✅ Messages d'erreur clairs
- ✅ Templates téléchargeables
- ✅ Documentation utilisateur

---

## 📚 Documentation

### Documents Créés
1. **CAHIER_CHARGES_IMPORT_BULK.md** (920 lignes)
   - Spécifications complètes
   - Workflows détaillés
   - Architecture technique
   - Tests et validation
   - Roadmap

2. **IMPORT_BULK_README.md**
   - Guide rapide
   - Format standard
   - Modes de géolocalisation
   - Types d'essais

3. **IMPORT_BULK_SUMMARY.md** (ce document)
   - Résumé exécutif
   - Points clés
   - Roadmap
   - Critères de succès

---

## 🚀 Prochaines Étapes

### Immédiat
1. ✅ Validation du cahier des charges
2. ⏳ Estimation détaillée (dev)
3. ⏳ Priorisation des features
4. ⏳ Planification Sprint 1

### Court Terme (Sprint 1)
1. ⏳ Développement Parser CSV
2. ⏳ Développement Mapper colonnes
3. ⏳ Développement Mode Centroïde ADM
4. ⏳ Tests unitaires
5. ⏳ Tests d'intégration

### Moyen Terme (Sprint 2-3)
1. ⏳ Enrichissement fonctionnalités
2. ⏳ Support multi-formats
3. ⏳ Optimisations
4. ⏳ Documentation utilisateur
5. ⏳ Formation utilisateurs

---

**✅ Cahier des charges validé et prêt pour implémentation !**
