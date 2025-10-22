# 🔧 Correctifs d'Accessibilité v1.5.0

**Date** : 2025-10-20  
**Priorité** : Moyenne (non bloquant pour v1.5.0)

---

## 📋 Problèmes Détectés

### ✅ Critiques (Corrigés)

1. **IDs dupliqués** : `filterAdm1` utilisé 2 fois
   - ✅ Renommé en `thematicFilterAdm1` dans le panneau thématique
   - ✅ Ajouté `for` dans le label

### ⚠️ À Corriger (Phase 2)

#### Accessibilité

1. **Labels manquants** : Ajouter `for` sur tous les labels
   ```html
   <!-- Avant -->
   <label>Région (ADM1)</label>
   <select id="filterAdm1">
   
   <!-- Après -->
   <label for="filterAdm1">Région (ADM1)</label>
   <select id="filterAdm1" title="Sélectionner une région">
   ```

2. **Attributs title manquants** : Ajouter sur tous les selects
   - `filterAdm1`, `filterAdm2`, `filterAdm3`
   - `printFormat`, `printOrientation`, `printScale`, `printDPI`
   - `locationMode`, `selectAdm1`, `selectAdm2`, `selectAdm3`
   - Tous les selects du panneau thématique

3. **Placeholder manquants** : Ajouter sur les inputs
   ```html
   <input type="text" placeholder="Entrez le code de la maille">
   ```

#### Compatibilité CSS

1. **Préfixes vendor manquants** :
   ```css
   /* Avant */
   user-select: none;
   
   /* Après */
   -webkit-user-select: none;
   -moz-user-select: none;
   -ms-user-select: none;
   user-select: none;
   ```

2. **mask-image** : Ajouter préfixe `-webkit-`
3. **scrollbar-color/width** : Ajouter fallback pour Safari

#### Performance

1. **Cache busting** : Ajouter hash aux fichiers statiques
   ```html
   <!-- Avant -->
   <link rel="stylesheet" href="style.css">
   
   <!-- Après -->
   <link rel="stylesheet" href="style.css?v=1.5.0">
   ```

2. **Headers HTTP** :
   - Ajouter `X-Content-Type-Options: nosniff`
   - Remplacer `Expires` par `Cache-Control`
   - Corriger `Content-Type` pour JS/CSS

#### Sécurité

1. **Headers manquants** :
   ```
   X-Content-Type-Options: nosniff
   X-Frame-Options: SAMEORIGIN
   X-XSS-Protection: 1; mode=block
   ```

2. **CSP** : Optimiser Content-Security-Policy

---

## 🔧 Script de Correction Automatique

```javascript
// accessibility-fix.js
// À exécuter pour corriger automatiquement les problèmes

document.querySelectorAll('select:not([title])').forEach(select => {
  const label = document.querySelector(`label[for="${select.id}"]`)
  const text = label?.textContent || 'Sélectionner une option'
  select.setAttribute('title', text)
})

document.querySelectorAll('label').forEach(label => {
  const nextElement = label.nextElementSibling
  if (nextElement && (nextElement.tagName === 'SELECT' || nextElement.tagName === 'INPUT')) {
    if (nextElement.id && !label.hasAttribute('for')) {
      label.setAttribute('for', nextElement.id)
    }
  }
})
```

---

## 📊 Priorités

| Problème | Impact | Priorité | Effort |
|----------|--------|----------|--------|
| IDs dupliqués | ❌ Critique | P0 | ✅ Fait |
| Labels manquants | ⚠️ Moyen | P1 | 1h |
| Préfixes CSS | ℹ️ Faible | P2 | 30min |
| Headers HTTP | ⚠️ Moyen | P1 | 2h |
| Cache busting | ℹ️ Faible | P3 | 1h |

---

## ✅ Actions Immédiates (v1.5.0)

- [x] Corriger ID dupliqué `filterAdm1`
- [x] Ajouter `title` sur select thématique
- [ ] Documenter les correctifs restants

## 📅 Actions Différées (v1.5.1)

- [ ] Ajouter tous les attributs `for` et `title`
- [ ] Ajouter préfixes CSS vendor
- [ ] Configurer headers HTTP sécurisés
- [ ] Implémenter cache busting

---

**Note** : Ces correctifs n'affectent pas la fonctionnalité. Ils améliorent l'accessibilité, la compatibilité et les performances. Peuvent être traités en v1.5.1.
