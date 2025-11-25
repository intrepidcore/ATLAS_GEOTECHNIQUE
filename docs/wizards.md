# 📥 Documentation des Wizards d'Import

## Vue d'ensemble

Le projet Atlas dispose de plusieurs wizards d'import pour les données géotechniques.
Ce document décrit le rôle de chaque wizard et son statut.

## Wizards disponibles

### ✅ `import-wizard-v2.ts` - CANONIQUE
- **Rôle** : Wizard principal 5 étapes pour import CSV/XLSX
- **Statut** : Production - À utiliser par défaut
- **Utilisé dans** : `sondages-manager-page.ts` (onglet Import)
- **Fonctionnalités** :
  - Upload fichier (CSV, XLSX)
  - Mapping colonnes automatique + manuel
  - Configuration géométrie (coords décimales, DMS)
  - Prévisualisation avec validation
  - Import avec auto-géocodage

### 📦 `import-bulk-wizard.ts` - BULK LEGACY
- **Rôle** : Import bulk multi-feuilles XLSX
- **Statut** : Legacy - Conservé pour compatibilité
- **Utilisé dans** : Non utilisé actuellement
- **Fonctionnalités** :
  - Support multi-feuilles Excel
  - Mapping par rôle (sondages, atterberg, granulo, etc.)

### 📦 `import-bulk-wizard_v3.ts` - BULK V3
- **Rôle** : Version améliorée du bulk wizard avec ExcelJS
- **Statut** : Disponible - Alternative pour imports complexes
- **Utilisé dans** : Panneau dev test (si activé)
- **Fonctionnalités** :
  - Parsing ExcelJS robuste
  - Mapping fiable avec auto-guess
  - Aperçu multi-feuilles
  - Badge "V3" dans l'en-tête

### 🔬 `geotechnical-import-wizard.ts` - GÉOTECHNIQUE
- **Rôle** : Import spécialisé XLSX géotechnique simplifié
- **Statut** : Spécialisé - Pour formats spécifiques
- **Utilisé dans** : Panneau dev test (si activé)
- **Fonctionnalités** :
  - Format XLSX multi-feuilles géotechnique
  - Structure simplifiée

### ⚠️ `import-wizard-core.ts` - DEPRECATED
- **Rôle** : Version expérimentale avec modes modal/embedded
- **Statut** : DEPRECATED - Ne pas utiliser
- **Problèmes** : Code corrompu, fonctions dupliquées
- **Action** : Utiliser `import-wizard-v2.ts` à la place

## Recommandations

1. **Pour l'import standard** : Utiliser `import-wizard-v2.ts`
2. **Pour les imports bulk complexes** : Tester `import-bulk-wizard_v3.ts`
3. **Ne jamais utiliser** : `import-wizard-core.ts` (deprecated)

## Panneau de test (dev only)

Un panneau de test est disponible en mode développement pour comparer les wizards.
Activer avec `window.ATLAS_DEBUG_WIZARDS = true` dans la console.
