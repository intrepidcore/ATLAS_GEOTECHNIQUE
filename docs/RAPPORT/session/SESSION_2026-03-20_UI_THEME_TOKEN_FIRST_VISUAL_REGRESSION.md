---
description: Session changelog raisonné — Refactor UI theme (token-first), suppression whack-a-mole CSS overrides, design-tokens.css source de vérité, bootstrap thème partout (React + vanilla + db-manager), ajout tests Playwright visuels (login light/dark), build UI + installation navigateurs Playwright
date: 2026-03-20
weekday: vendredi
repo: atlas_reclone
ui: ui (Vite MPA + React + vanilla legacy)
desktop: apps/atlas-pro (Tauri v2)
branch: atlas_v2_clean
---

# Session — Changelog raisonné (ultra détaillé)

## 1) Objectif et contexte de session

### 1.1 Contexte

Cette session fait suite à une série de corrections UI autour du **thème sombre / clair** et des interactions modales (clic droit / assigner / transférer), où plusieurs composants (vanilla + React + CSS injecté) affichaient un rendu incohérent.

Le diagnostic principal était exact : **deux systèmes de design se battaient**.

- D’un côté :
  - UI vanilla historique (Leaflet, panneaux, exports) avec ses conventions.
  - CSS legacy (ex: `vanilla-theme-override.css`) employant des overrides agressifs.
- De l’autre :
  - Tailwind preflight (`@tailwind base`) + composants React (Radix / shadcn-like).
  - Réinitialisations CSS globales.

Le symptôme récurrent : composants ou dropdowns “en thème clair” dans une page sombre, ou textes illisibles.

### 1.2 Objectif de la session

Objectif prioritaire : **sortir du pattern whack-a-mole** (patch local modal par modal) et remonter le fix au bon niveau d’abstraction.

Livrables :

- Mettre en place un design system **token-first** avec une **source de vérité unique**.
- Réduire drastiquement la dette du fichier `vanilla-theme-override.css` (suppression des `!important` visant les modals).
- Assurer un bootstrap thème cohérent sur toutes les entrées (React + vanilla + pages standalone).
- Ajouter des tests de régression visuelle Playwright minimaux (screenshots) pour détecter les régressions de contraste.
- Commit + push.

## 2) Problèmes observés (avant refactor)

### 2.1 Whack-a-mole CSS

À force d’appliquer des correctifs localisés :

- Chaque nouveau correctif révélait un autre composant non couvert.
- Les overrides `!important` commençaient à se contredire.
- Des composants React étaient “réparés” par des overrides globaux, ce qui est fragile.

### 2.2 Architecture hybride vanilla / React (dette)

La page principale est hybride :

- `ui/src/main.ts` (vanilla entry) monte des panneaux, exports, etc.
- Des modals React sont montés via portals sur `document.body`.
- Le thème doit être cohérent dans les deux mondes.

Sans contrat clair et sans tokens centralisés, la cohérence UI n’est pas tenable.

### 2.3 Absence de non-régression visuelle

Sans tests de screenshots, les régressions de contraste ou de rendu sont quasi garanties à chaque refactor.

## 3) Décisions architecturales retenues (anti-dette)

### 3.1 Design system token-first (source de vérité)

**Décision** : créer un fichier unique de tokens et l’utiliser partout.

- **Fichier** : `ui/src/design-tokens.css`
- Contient :
  - `:root` (light)
  - `.dark` (dark)
  - `color-scheme: light/dark` (contrôles natifs)
  - Variables HSL : `--background`, `--foreground`, `--card`, `--border`, etc.

**Pourquoi** :

- Éliminer les couleurs hardcodées dans les composants.
- Garantir un rendu cohérent entre :
  - React
  - Vanilla
  - CSS injecté
  - Contrôles natifs (`<select>`, date pickers)

### 3.2 `index.css` devient “shell Tailwind”

**Décision** : `ui/src/index.css` ne définit plus les tokens.

- `index.css`:
  - conserve `@tailwind base/components/utilities`
  - importe `design-tokens.css`
  - garde uniquement les styles globaux de base (`body`, `border-color`).

**Pourquoi** :

- Une seule source de vérité.
- Réduction de la duplication.

### 3.3 Réduction de `vanilla-theme-override.css`

**Décision** : supprimer la section “FIX MODALS REACT” (overrides `!important`).

- Avant : le fichier modifiait le rendu des modals via des sélecteurs globaux `role="dialog"` et des `!important`.
- Après : il ne reste que les styles vanilla de base (topbar/dashboard/sidebar/typo).

**Pourquoi** :

- Les modals doivent être stylés par les composants (fix forward).
- Un override global sur `[role="dialog"]` casse les composants dès qu’on change la structure DOM.

### 3.4 Bootstrap thème sur toutes les entrées

**Décision** : s’assurer que les pages standalone appliquent le thème (classe `.dark`) et ont accès aux tokens.

- Entrées React : import `design-tokens.css` puis `index.css`.
- Entrée DB Manager :
  - import dans le bon ordre (tokens -> index)
  - appel `initTheme()`.

## 4) Changements effectués (références code)

### 4.1 Nouveau fichier tokens

- **Ajout** : `ui/src/design-tokens.css`
  - Tokens HSL light/dark + `color-scheme`.
  - Alias legacy conservés : `--text`, `--panel`, `--bg`.

### 4.2 `index.css` refactor

- **Modification** : `ui/src/index.css`
  - Suppression des définitions `:root` et `.dark`.
  - Ajout `@import './design-tokens.css';`.

### 4.3 Entrypoints (ordre d’import)

- **Modifiés** :
  - `ui/src/main.tsx`
  - `ui/src/login-main.tsx`
  - `ui/src/mobile-main.tsx`
  - `ui/src/installer-main.tsx`
  - `ui/src/db-manager-entry.ts`

Objectif : **tokens avant styles** + `initTheme()` là où nécessaire.

### 4.4 Nettoyage overrides modals

- **Modification** : `ui/src/vanilla-theme-override.css`
  - Suppression de la section modals React (`!important` sur `[role="dialog"]`).

## 5) Tests & non-régression

### 5.1 Ajout tests visuels Playwright

- **Ajout** : `ui/tests/e2e/theme-visual.spec.ts`
  - Screenshot `login-light.png`
  - Screenshot `login-dark.png`
  - Forçage du thème via `localStorage.atlas_theme_mode`.

- **Snapshots générés** :
  - `ui/tests/e2e/theme-visual.spec.ts-snapshots/`.

### 5.2 Installation navigateurs Playwright

Les tests étaient bloqués car le binaire Chromium Playwright n’était pas installé sur la machine.

Commande exécutée :

- `npx playwright install chromium`

## 6) Commandes exécutées (audit trail)

- Build UI :
  - `npm --prefix ui run build`

- Installation navigateur Playwright :
  - `npx --prefix ui playwright install chromium`

- Génération snapshots visuels :
  - `npm --prefix ui run test:e2e -- tests/e2e/theme-visual.spec.ts --update-snapshots`

## 7) Résultats

- ✅ Build UI OK après correction Tailwind/PostCSS (`@layer` supprimé dans `design-tokens.css`).
- ✅ Tokens centralisés et importés de manière cohérente.
- ✅ Réduction nette de la dette : suppression des `!important` globaux sur modals.
- ✅ Tests Playwright visuels ajoutés + snapshots générés.

## 8) Prochaines étapes recommandées (non bloquantes)

1) Continuer la migration “never use raw colors” :
   - repérer et remplacer les `#xxxxxx` dans les CSS injectés / legacy.

2) Centraliser les modals :
   - créer un composant `Modal` unique (wrapper Radix) pour éliminer la duplication de styles.

3) Étendre les tests visuels :
   - ajouter un screenshot du panneau thématique
   - ajouter un screenshot du modal mission

4) Stabiliser les tests e2e existants :
   - les specs `staging*.spec.ts` dépendent d’un backend disponible.
   - formaliser un mode mock/stub ou isoler les suites “visual” vs “workflow”.
