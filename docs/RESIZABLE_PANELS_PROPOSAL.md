# Proposition: Panneaux Redimensionnables

## Objectif

Rendre les panneaux gauche, droite et central des différentes pages de l'application redimensionnables par l'utilisateur, sans casser le code existant.

## Pages concernées

| Page | Panneaux à rendre resizables |
|------|------------------------------|
| **Accueil (carte)** | Gauche (filtres), Droite (détails maille), Thématique |
| **Gestionnaire de sondages** | Gauche, Droite, Central (par onglet) |
| **Gestion de base de données** | Gauche, Droite |

## Solution proposée

### Composant `resizable-panel.ts`

Un composant réutilisable a été créé dans `c:\PROJET_ATLAS_MASTER\atlas\ui\src\components\resizable-panel.ts`.

### Caractéristiques

- **Non-invasif**: S'applique sur des éléments existants sans modifier leur structure
- **Persistance**: Sauvegarde automatique des tailles dans localStorage
- **Limites configurables**: min/max size pour éviter les panneaux trop petits/grands
- **Support tactile**: Fonctionne sur tablettes
- **Indicateur visuel**: Handle visible au survol

### Utilisation

```typescript
import { makeResizable } from './components/resizable-panel';

// Page d'accueil - Panneau gauche
makeResizable('#left-panel', {
  direction: 'horizontal',
  minSize: 200,
  maxSize: 500,
  defaultSize: 300,
  storageKey: 'atlas-home-left-panel-width',
  handlePosition: 'end'
});

// Page d'accueil - Panneau droite
makeResizable('#right-panel', {
  direction: 'horizontal',
  minSize: 250,
  maxSize: 600,
  defaultSize: 350,
  storageKey: 'atlas-home-right-panel-width',
  handlePosition: 'start'
});

// Page d'accueil - Panneau thématique
makeResizable('#thematic-panel', {
  direction: 'horizontal',
  minSize: 280,
  maxSize: 450,
  defaultSize: 320,
  storageKey: 'atlas-thematic-panel-width',
  handlePosition: 'start'
});
```

## Intégration recommandée

### Étape 1: Import du composant

Dans `main.ts` ou le fichier d'initialisation de chaque page:

```typescript
import { makeResizable } from './components/resizable-panel';
```

### Étape 2: Appliquer après le chargement du DOM

```typescript
document.addEventListener('DOMContentLoaded', () => {
  // Panneaux de la page d'accueil
  if (document.getElementById('left-panel')) {
    makeResizable('#left-panel', {
      direction: 'horizontal',
      minSize: 200,
      maxSize: 500,
      defaultSize: 300,
      storageKey: 'atlas-home-left-panel-width'
    });
  }
  
  // ... autres panneaux
});
```

### Étape 3: Ajuster le CSS si nécessaire

Le composant ajoute automatiquement `flex-shrink: 0` aux panneaux resizables. Assurez-vous que le conteneur parent utilise `display: flex`.

```css
.main-layout {
  display: flex;
  height: 100vh;
}

.main-content {
  flex: 1;
  overflow: hidden;
}
```

## Configuration par page

### Page d'accueil

| Panneau | ID suggéré | Min | Max | Default | Storage Key |
|---------|------------|-----|-----|---------|-------------|
| Gauche (filtres) | `#left-panel` | 200px | 500px | 300px | `atlas-home-left` |
| Droite (détails) | `#right-panel` | 250px | 600px | 350px | `atlas-home-right` |
| Thématique | `#thematic-panel` | 280px | 450px | 320px | `atlas-thematic` |

### Gestionnaire de sondages

| Panneau | ID suggéré | Min | Max | Default | Storage Key |
|---------|------------|-----|-----|---------|-------------|
| Gauche | `#surveys-left` | 200px | 400px | 280px | `atlas-surveys-left` |
| Central | `#surveys-center` | 400px | 800px | 600px | `atlas-surveys-center` |
| Droite | `#surveys-right` | 250px | 500px | 350px | `atlas-surveys-right` |

### Gestion BDD

| Panneau | ID suggéré | Min | Max | Default | Storage Key |
|---------|------------|-----|-----|---------|-------------|
| Gauche | `#db-left` | 200px | 400px | 280px | `atlas-db-left` |
| Droite | `#db-right` | 300px | 600px | 400px | `atlas-db-right` |

## Avantages de cette approche

1. **Pas de réécriture**: Le composant s'applique sur les éléments existants
2. **Progressif**: Peut être déployé page par page
3. **Réversible**: Facile à désactiver si problème
4. **Persistant**: L'utilisateur retrouve ses préférences
5. **Léger**: ~300 lignes de code, pas de dépendance externe

## Alternatives considérées

| Solution | Avantages | Inconvénients |
|----------|-----------|---------------|
| **react-resizable-panels** | Très complet | Nécessite React, réécriture |
| **split.js** | Léger, populaire | Modifie la structure DOM |
| **CSS resize** | Natif | Pas de persistance, UX limitée |
| **Solution custom (choisie)** | Adapté au projet, non-invasif | Maintenance interne |

## Prochaines étapes

1. [x] Tester le composant sur la page d'accueil
2. [x] Identifier les IDs exacts des panneaux existants
3. [x] Intégrer dans `main.ts`
4. [ ] Répéter pour les autres pages (Gestionnaire sondages, BDD)
5. [ ] Ajouter un bouton "Réinitialiser les panneaux" dans les préférences

## Fichiers créés

- `c:\PROJET_ATLAS_MASTER\atlas\ui\src\components\resizable-panel.ts`
- `c:\PROJET_ATLAS_MASTER\atlas\ui\src\components\ResizablePanelReact.tsx` (wrapper React)

## Implémentation v3.5.2 (02/01/2025)

### Page d'accueil (index.html)

✅ **Panneaux activés:**

| Panneau | ID | Min | Max | Default | Storage Key |
|---------|-----|-----|-----|---------|-------------|
| Gauche (stats) | `#dashboard` | 200px | 500px | 380px | `atlas-home-left-panel-width` |
| Droite (filtres) | `#sidebar` | 250px | 600px | 380px | `atlas-home-right-panel-width` |
| Thématique | `#thematicPanel` | 280px | 450px | 320px | `atlas-thematic-panel-width` |

**Fichier modifié:** `ui/src/main.ts`
- Import de `makeResizable` depuis `./components/resizable-panel`
- Fonction `initResizablePanels()` appelée au boot
- MutationObserver pour le panneau thématique (apparaît dynamiquement)

### Fonctionnalités

- ✅ Redimensionnement horizontal avec handle visible au survol
- ✅ Persistance dans localStorage (taille conservée après refresh)
- ✅ Limites min/max configurables
- ✅ Support panneau dynamique (thématique)
- ✅ Logs console pour debug

### Tests recommandés

```bash
# 1. Ouvrir la page d'accueil
# 2. Survoler le bord droit du panneau gauche → handle bleu visible
# 3. Glisser pour redimensionner → panneau change de largeur
# 4. Rafraîchir la page → taille conservée
# 5. Ouvrir le panneau thématique → vérifier qu'il est redimensionnable
```
