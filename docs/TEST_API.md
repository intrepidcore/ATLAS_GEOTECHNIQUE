# 🧪 Tests API Atlas v1.3.1

## ✅ Tests Backend

### 1. Health Check
```bash
curl http://localhost:8000/healthz
# Résultat attendu: {"status":"ok"}
```

### 2. Grille complète
```bash
curl http://localhost:8000/coverage/mailles
# Résultat: GeoJSON FeatureCollection avec toutes les mailles
```

### 3. Détails d'une maille (NOUVEAU)
```bash
curl http://localhost:8000/grid/TG-0493-0212-01/details
# Résultat: JSON avec code, adm, kpi, sondages[]
```

### 4. Shape d'une maille
```bash
curl http://localhost:8000/grid/TG-0493-0212-01/shape
# Résultat: GeoJSON Feature (Polygon)
```

## 🔍 Vérifications Frontend

### Ouvrir la console du navigateur (F12)
1. Aller sur http://localhost:5173
2. Ouvrir DevTools (F12)
3. Onglet Console
4. Chercher les erreurs en rouge

### Vérifications à faire:
- [ ] La grille se charge-t-elle ? (mailles visibles sur la carte)
- [ ] Y a-t-il des erreurs dans la console ?
- [ ] Les boutons répondent-ils au clic ?
- [ ] Le clic sur une maille charge-t-il la fiche ?

## 🐛 Problèmes Possibles

### Si la grille ne s'affiche pas:
1. Vérifier la console: erreur CORS ?
2. Vérifier l'URL de l'API dans `.env`
3. Vérifier que le backend est bien démarré

### Si les boutons ne fonctionnent pas:
1. Vérifier qu'il n'y a pas d'erreur JS dans la console
2. Vérifier que les IDs des boutons correspondent au HTML
3. Vérifier que les event listeners sont bien attachés

### Si la fiche ne s'affiche pas au clic:
1. Vérifier l'endpoint `/grid/{code}/details` dans la console Network
2. Vérifier qu'il n'y a pas d'erreur 404 ou 500
3. Vérifier que `loadMailleDetails()` est bien appelée

## 📋 Checklist Débogage

```javascript
// Dans la console du navigateur, tester:

// 1. Vérifier que l'API est accessible
fetch('http://localhost:8000/healthz').then(r => r.json()).then(console.log)

// 2. Vérifier que la grille se charge
fetch('http://localhost:8000/coverage/mailles').then(r => r.json()).then(d => console.log(d.features.length + ' mailles'))

// 3. Tester l'endpoint details
fetch('http://localhost:8000/grid/TG-0493-0212-01/details').then(r => r.json()).then(console.log)

// 4. Vérifier que Chart.js est chargé
console.log(typeof Chart)  // devrait afficher "function"

// 5. Vérifier que les fonctions existent
console.log(typeof loadMailleDetails)  // devrait afficher "function"
```

## 🔧 Actions Correctives

### Si erreur CORS:
Le backend devrait déjà avoir CORS activé, mais vérifier dans `main.rs`:
```rust
.layer(CorsLayer::permissive())
```

### Si Chart.js non trouvé:
```bash
cd ui
npm install chart.js
```

### Si erreur de compilation TypeScript:
```bash
cd ui
npm run build
```

## ✅ Test Complet

Ouvrir http://localhost:5173 et:
1. ✅ La carte s'affiche
2. ✅ Les mailles se chargent (polygones visibles)
3. ✅ Cliquer sur une maille
4. ✅ La fiche s'affiche à gauche
5. ✅ Les KPIs sont remplis
6. ✅ Les graphiques s'affichent
7. ✅ La liste des sondages s'affiche
8. ✅ Les boutons fonctionnent
