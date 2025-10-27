# ✅ Checklist de Test - Wizard Import XLSX

## 🎯 Objectif
Valider que la solution robuste fonctionne correctement avec détection automatique des colonnes et envoi multi-contrat.

## 📋 Préparation

### 1. Déploiement
- ✅ Build frontend : `npm run build` dans `ui/`
- ✅ Déploiement : `powershell -ExecutionPolicy Bypass -File deploy_dist.ps1`
- ✅ Vérification : Les logs `[WZ]` sont présents dans le JS

### 2. Navigateur
- [ ] Ouvrir http://127.0.0.1:8080
- [ ] Hard refresh : `Ctrl + Shift + R` (ou navigation privée)
- [ ] Ouvrir la console développeur (F12)
- [ ] Onglet Console : filtrer sur `[WZ]`

## 🧪 Tests Étape par Étape

### Étape 0 : Upload du Fichier
- [ ] Cliquer sur "Import Bulk"
- [ ] Sélectionner `atlas_import_example.xlsx`
- [ ] **Vérifier Console** : `📊 Fichier XLSX détecté — import multi-feuilles activé`

### Étape 1 : Détection des En-têtes
**Logs attendus dans la console :**
```
[WZ] HEADERS PAR FEUILLE = {
  sondages: ['code_site', 'localite', 'date', 'lat', 'lon', 'source', ...],
  echantillons: ['code_site', 'depth_m', 'date', ...],
  atterberg: ['code_site', 'depth_m', 'wl', 'wp'],
  vbs: ['code_site', 'depth_m', 'vbs', ...],
  proctor: ['code_site', 'depth_m', 'rho_d_max', 'w_opt', ...],
  granulo_tamisage_large: ['sieve_mm', '@0.063', '@0.080', ...],
  granulo_sedimento_large: ['sieve_mm', '@0.002', '@0.005', ...]
}
[WZ] Total: XX colonnes détectées dans 7 feuilles
```

**Vérifications :**
- [ ] Le nombre de colonnes est > 0 pour chaque feuille
- [ ] Les noms de colonnes sont normalisés (minuscules, underscores)
- [ ] Le caractère `@` est préservé pour les colonnes granulo

### Étape 2 : Mapping Automatique
**Logs attendus :**
```
[WZ] Mapping XLSX initialisé: {
  sondages: {
    code: 'code_site',
    localite: 'localite',
    date: 'date',
    lat: 'lat',
    lon: 'lon',
    source: 'source',
    ...
  },
  echantillons: { code: 'code_site', depth_m: 'depth_m', ... },
  ...
}
```

**Vérifications :**
- [ ] Les champs requis (code, localite, date, lat, lon) sont mappés
- [ ] Les valeurs ne sont pas `null` pour les champs obligatoires
- [ ] Le mapping utilise les colonnes détectées (pas de valeurs hardcodées)

### Étape 3 : Sélection des Feuilles
**UI attendue :**
- [ ] Liste des 7 feuilles détectées
- [ ] Chaque feuille a un rôle auto-détecté
- [ ] Bouton "Suivant" activé

### Étape 4 : Validation du Mapping (TODO UI)
**Comportement attendu :**
- [ ] Les listes déroulantes contiennent les colonnes détectées
- [ ] Les champs requis sont pré-remplis
- [ ] Bouton "Suivant" désactivé si mapping incomplet (à implémenter)

### Étape 5 : Import avec Fallbacks
**Logs attendus :**
```
[IMPORT] Envoi fichier XLSX: atlas_import_example.xlsx, XXXXX bytes
[WZ] TRY A as config { format: 'xlsx', structure: {...}, mapping: {...}, options: {...} }
[WZ] RESP 400 missing field 'mapping'
[WZ] TRY B as config { format: 'xlsx', structure: {sheets: {...}, mapping: {...}}, options: {...} }
[WZ] RESP 200 ...
[WZ] ✅ SUCCESS with B as config
[IMPORT] Succès: ...
```

**Vérifications :**
- [ ] Au moins une des 6 variantes retourne 200
- [ ] Le log `✅ SUCCESS with [variante]` apparaît
- [ ] Pas d'erreur JavaScript dans la console
- [ ] Le wizard affiche "Import réussi"

## 🔍 Diagnostics en Cas d'Échec

### Problème : "0 colonnes détectées"
**Causes possibles :**
- Le fichier XLSX est corrompu
- Les en-têtes ne sont pas en ligne 1
- `cell.text` retourne vide

**Actions :**
1. Vérifier le fichier avec Excel/LibreOffice
2. Inspecter `this.columnsBySheet` dans le debugger
3. Ajouter un log dans `extractHeaders()` pour voir `cell.text`

### Problème : Mapping vide ou incomplet
**Causes possibles :**
- Les noms de colonnes ne correspondent pas aux attendus
- La fonction `pick()` ne trouve pas les colonnes

**Actions :**
1. Comparer `columnsBySheet` avec les noms attendus
2. Ajouter des alias dans `pick()` (ex: `code` → `code_site`)
3. Vérifier la normalisation (espaces, majuscules)

### Problème : Toutes les variantes retournent 400
**Causes possibles :**
- Le contrat backend a changé
- Le fichier XLSX est invalide
- Un champ requis manque

**Actions :**
1. Copier le log `[WZ] RESP` complet
2. Analyser le message d'erreur backend
3. Tester avec `curl` (voir `test_curl_import.ps1`)
4. Vérifier les logs backend

### Problème : Erreur JavaScript
**Causes possibles :**
- Type mismatch (ex: `null.property`)
- Propriété manquante dans `xlsxMapping`

**Actions :**
1. Lire la stack trace complète
2. Vérifier que `initializeXlsxMapping()` est appelé
3. Ajouter des guards `?.` pour les accès optionnels

## 📊 Résultats Attendus

| Étape | Statut | Logs Clés |
|-------|--------|-----------|
| Upload | ✅ | `📊 Fichier XLSX détecté` |
| Extraction | ✅ | `[WZ] HEADERS PAR FEUILLE` + comptage |
| Mapping | ✅ | `[WZ] Mapping XLSX initialisé` |
| Envoi | ✅ | `[WZ] TRY` × 6 + `✅ SUCCESS` |
| Import | ✅ | `[IMPORT] Succès` |

## 🎓 Notes Importantes

1. **Cache Navigateur** : Toujours faire `Ctrl + Shift + R` après déploiement
2. **Logs Backend** : Consulter `docker compose logs api-geo` en cas de 400
3. **Fichier Test** : Utiliser `atlas_import_example.xlsx` avec données valides
4. **Contrat Backend** : Noter quelle variante fonctionne pour documenter le contrat

## ✅ Validation Finale

- [ ] Toutes les étapes passent sans erreur
- [ ] Les logs `[WZ]` sont présents et corrects
- [ ] Une variante retourne 200
- [ ] Les données sont importées dans la base
- [ ] Le wizard peut être réutilisé sans recharger la page

---

**Date du test** : _____________
**Variante qui fonctionne** : _____________
**Remarques** : _____________
