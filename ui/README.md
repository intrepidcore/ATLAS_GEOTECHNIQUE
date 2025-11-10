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

### StagingModal

Modal complet pour l'édition de tables avec staging :

- **Mode édition** avec bannière orange et timer
- **Tabs** : Données / Changements / Preview SQL
- **Dry-run** avant commit avec détection de conflits
- **Commit atomique** avec backup automatique
- **Lock automatique** pour éviter éditions concurrentes

### Composants UI de base

- Dialog (modal)
- Button
- Alert
- Tabs
- Badge

## API Endpoints Utilisés

- `POST /api/db/staging` - Créer staging
- `GET /api/db/staging/:id` - Info staging
- `POST /api/db/staging/:id/dryrun` - Dry-run
- `POST /api/db/staging/:id/commit` - Commit
- `POST /api/db/staging/:id/cancel` - Annuler

## Notes TypeScript

Les erreurs TypeScript dans l'IDE avant `npm install` sont normales. Elles disparaîtront après installation des dépendances.

## Prochaines Étapes

1. Installer dépendances : `npm install`
2. Créer composants UI manquants (Button, Alert, Tabs, Badge)
3. Intégrer DataGrid (AG-Grid ou TanStack Table)
4. Implémenter diff viewer
5. Ajouter Field Calculator UI
