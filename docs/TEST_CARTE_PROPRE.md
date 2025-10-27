# 🧪 Test Carte Thématique Propre

## ✅ Modifications Appliquées

### 1. Exposition de `gridLayer` globalement
**Fichier** : `ui/src/main.ts`
- ✅ `window.gridLayer` exposé
- ✅ Mise à jour après création de la couche

### 2. Masquage de la couverture
**Fichier** : `ui/src/thematic/thematic-maps.ts`
- ✅ Masquage de `window.gridLayer` lors de l'affichage thématique
- ✅ Restauration lors de la fermeture
- ✅ Logs console pour debug

---

## 🧪 Procédure de Test

### 1. Ouvrir le navigateur
```
Ctrl + Shift + N (mode privé)
http://127.0.0.1:8080
```

### 2. Ouvrir la console (F12)
Vérifier les logs :
```
[ThematicMap] Masquage de la couche de couverture
```

### 3. Afficher la carte thématique
1. Cliquer sur l'icône carte thématique (bas droite)
2. Sélectionner "Nombre de sondages"
3. Cliquer "Appliquer"

### 4. Vérifier dans la console
```javascript
// Vérifier que gridLayer n'est plus sur la carte
map.hasLayer(window.gridLayer)
// → false ✅

// Vérifier le pane thématique
map.getPane('thematicPane').style.zIndex
// → "650" ✅

// Vérifier la couche thématique
window.thematicLayer
// → Object (GeoJSON layer) ✅
```

---

## ✅ Résultat Attendu

### Avant (❌)
- Carte avec carrés rouges par-dessus les couleurs bleues
- Couverture visible en permanence

### Après (✅)
- **Carte propre** : uniquement les couleurs thématiques (bleu)
- **Pas de rouge** : couverture masquée
- **Légende cohérente** : couleurs affichées = couleurs de la légende

---

## 🔍 Debug si Problème

### Si les carrés rouges sont toujours visibles

1. **Vérifier la console** :
```javascript
console.log('gridLayer:', window.gridLayer)
console.log('hasLayer:', map.hasLayer(window.gridLayer))
```

2. **Vérifier manuellement** :
```javascript
// Masquer manuellement
if (window.gridLayer && map.hasLayer(window.gridLayer)) {
  map.removeLayer(window.gridLayer)
}
```

3. **Vérifier le zIndex** :
```javascript
// Tous les panes
Object.keys(map.getPanes()).forEach(name => {
  const pane = map.getPane(name)
  console.log(name, pane.style.zIndex)
})
```

### Si la couche thématique ne s'affiche pas

1. **Vérifier les données** :
```javascript
// Dans Network → /api/thematic/data
// Vérifier features[0].properties.value
```

2. **Vérifier la classification** :
```javascript
// Dans la console après "Appliquer"
console.log('breaks:', breaks)
console.log('colors:', colors)
```

---

## 📝 Notes

- **gridLayer** : Couche de couverture (mailles rouges/grises)
- **thematicLayer** : Couche thématique (couleurs selon valeurs)
- **thematicPane** : Pane dédié avec zIndex 650 (au-dessus)

---

## 🎯 Checklist

- [ ] Build UI terminé
- [ ] Container UI redémarré
- [ ] Navigateur en mode privé
- [ ] Console ouverte (F12)
- [ ] Carte thématique appliquée
- [ ] Log "Masquage de la couche de couverture" visible
- [ ] Pas de carrés rouges sur la carte
- [ ] Couleurs cohérentes avec la légende
