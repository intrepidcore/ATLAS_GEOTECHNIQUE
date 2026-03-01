# Atlas UI - Interface React/TypeScript

Interface utilisateur moderne pour Atlas avec React, TypeScript, Tailwind CSS et shadcn/ui.

## Installation

```bash
cd ui
npm install
```

## Développement

```bash
npm run dev
```

L'application sera disponible sur `http://localhost:5173`

## Build Production

```bash
npm run build
```

## Structure

```
ui/
├── src/
│   ├── components/
│   │   ├── ui/           # Composants shadcn/ui
│   │   └── StagingModal.tsx  # Modal staging principal
│   ├── lib/
│   │   └── utils.ts      # Utilitaires (cn, etc.)
│   └── main.tsx          # Point d'entrée
├── package.json
├── tsconfig.json         # Configuration TypeScript
└── vite.config.ts        # Configuration Vite
```

## Technologies

- **React 18** - Framework UI
- **TypeScript** - Typage statique
- **Tailwind CSS** - Styling utilitaire
- **shadcn/ui** - Composants UI (Radix UI + Tailwind)
- **Lucide React** - Icônes
- **Vite** - Build tool rapide

## Composants Implémentés

### StagingModal ✅

Modal complet pour l'édition de tables avec staging :

- **Mode édition** avec bannière orange et timer
- **Tabs** : Données / Changements / Preview SQL
- **Dry-run** avant commit avec détection de conflits
- **Commit atomique** avec backup automatique
- **Lock automatique** pour éviter éditions concurrentes

### FieldCalculator ✅

Calculatrice de champs complète (inspirée QGIS) :

- **8 zones fonctionnelles** exactement comme l'UI de référence
- **Créer nouveau champ** ou **Mettre à jour existant**
- **Champs virtuels** supportés
- **Éditeur d'expression** avec syntaxe highlighting
- **9 catégories de fonctions** : Agrégats, Chaîne, Math, Géométrie, Date, etc.
- **Barre d'opérateurs** : +, -, *, /, ^, ||, (), etc.
- **Prévisualisation** en temps réel
- **Aide contextuelle** pour chaque fonction

### DataGrid ✅

Table de données interactive avec TanStack Table :

- **Tri** par colonnes
- **Recherche globale** et filtres
- **Pagination** avec navigation
- **Édition inline** (optionnel)
- **Sélection** de lignes
- **Performance** optimisée pour grandes tables

### DiffViewer ✅

Visualiseur de différences :

- **Tabs** : Tous / Insertions / Modifications / Suppressions
- **Badges** colorés par type d'opération
- **Comparaison** avant/après pour les mises à jour
- **Formatage** JSON pour objets complexes

### ImportExport ✅

Interface d'import/export complète :

- **Export** : CSV, JSON, GeoJSON
- **Import** : CSV, JSON, GeoJSON avec auto-détection
- **Mapping** automatique des colonnes
- **Validation** des données avant import
- **Prévisualisation** et gestion d'erreurs
- **Sélection** de champs à exporter

### Composants UI de base ✅

- **Dialog** - Modal avec overlay
- **Button** - 6 variants (default, destructive, outline, secondary, ghost, link)
- **Alert** - 5 variants (default, destructive, warning, info, success)
- **Tabs** - Onglets avec contenu
- **Badge** - 7 variants avec couleurs
- **Input** - Champ texte
- **Textarea** - Zone de texte multiligne
- **Select** - Liste déroulante
- **Checkbox** - Case à cocher
- **Label** - Étiquette de formulaire

## API Endpoints Utilisés

- `POST /api/db/staging` - Créer staging
- `GET /api/db/staging/:id` - Info staging
- `POST /api/db/staging/:id/dryrun` - Dry-run
- `POST /api/db/staging/:id/commit` - Commit
- `POST /api/db/staging/:id/cancel` - Annuler

## Notes TypeScript

Les erreurs TypeScript dans l'IDE avant `npm install` sont normales. Elles disparaîtront après installation des dépendances.

## Statut d'Implémentation

✅ **Court Terme - 100% COMPLET**
- [x] Dépendances installées
- [x] Composants UI shadcn/ui (10 composants)
- [x] DataGrid avec TanStack Table
- [x] Diff Viewer
- [x] Field Calculator UI (8 zones)
- [x] Import/Export UI
- [x] Build réussi (3.19s)

🚧 **Moyen Terme - En Cours**
- [ ] RBAC UI (permissions, rôles)
- [ ] Monitoring Dashboard Grafana
- [ ] Tests unitaires React
- [ ] Tests E2E Playwright

## Prochaines Étapes

1. ~~Installer dépendances~~ ✅ FAIT
2. ~~Créer composants UI~~ ✅ FAIT
3. ~~Intégrer DataGrid~~ ✅ FAIT
4. ~~Implémenter diff viewer~~ ✅ FAIT
5. ~~Ajouter Field Calculator UI~~ ✅ FAIT
6. ~~Import/Export UI~~ ✅ FAIT
7. Intégrer composants dans application principale
8. Tests E2E avec Playwright
9. RBAC UI
10. Monitoring Dashboard
