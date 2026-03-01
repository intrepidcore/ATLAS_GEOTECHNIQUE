# 🧪 Guide de Test - Interface de Géocodage

## 📋 Préparation

### 1. Vérifier que les services sont démarrés
```bash
docker-compose ps
```

Attendu :
- ✅ `atlas-db` : Running
- ✅ `atlas-api-geo` : Running
- ✅ UI (Vite dev server) : Running sur http://localhost:5173

### 2. Vérifier l'API
```bash
curl http://localhost:8000/sondages/stats
```

Attendu :
```json
{
  "total": 230,
  "geocoded": 2,
  "with_geom": 1,
  "with_adm3": 2,
  "missing_geom": 229,
  "missing_adm3": 228
}
```

---

## 🎯 Test 1 : Géocodage ADM3 via Suggestions

### Étapes

1. **Ouvrir l'UI**
   - Naviguer vers http://localhost:5173
   - Aller dans l'onglet "Géocodage Amélioré"

2. **Sélectionner un sondage**
   - Cliquer sur un sondage dans la liste (ex: "BLEU-TCHAMDE")
   - Le panneau de détails s'affiche à droite

3. **Vérifier les suggestions**
   - Les suggestions ADM3 s'affichent avec des scores de similarité
   - Ex: "Tchamba" (45%), "Tchaloude" (38%), etc.

4. **Cliquer sur une suggestion**
   - Cliquer sur la première suggestion
   - **Vérifier** : Le dropdown "Commune" se remplit automatiquement
   - **Ouvrir la console** : Vérifier le log `[SONDAGES] Suggestion sélectionnée: Tchamba gid: 328`

5. **Enregistrer le géocodage**
   - Cliquer sur "💾 Enregistrer le géocodage"
   - **Ouvrir la console** : Vérifier les logs :
     ```
     [GEOCODE] ADM3 select value: 328
     [GEOCODE] Sending payload: {mode: 'adm', adm3_id: 328}
     [SONDAGES] updateSondageGeometry - ID: b87f4500-...
     [SONDAGES] updateSondageGeometry - Payload: {"mode":"adm","adm3_id":328}
     ```
   - **Attendu** : Toast de succès "✅ Sondage géocodé avec ADM3: Tchamba"

6. **Vérifier la mise à jour**
   - Le sondage disparaît de la liste (car il est géocodé)
   - Les stats se mettent à jour : `geocoded: 3`, `with_adm3: 3`

### ✅ Critères de Succès
- [ ] Les suggestions s'affichent
- [ ] Cliquer sur une suggestion remplit le dropdown
- [ ] Le géocodage s'enregistre sans erreur HTTP 400
- [ ] Le sondage est mis à jour dans la base
- [ ] Les stats se mettent à jour

### ❌ Erreurs Possibles

**Erreur 1** : "❌ Veuillez sélectionner une commune"
- **Cause** : Le dropdown n'est pas rempli
- **Solution** : Vérifier les logs console, vérifier que `gid` correspond aux options

**Erreur 2** : "HTTP 400: Mode 'adm' requires 'adm3_id' field"
- **Cause** : Le payload est invalide
- **Solution** : Vérifier les logs console, vérifier que `adm3IdNum` est un nombre

**Erreur 3** : "❌ ID commune invalide"
- **Cause** : `parseInt()` a échoué
- **Solution** : Vérifier la valeur du dropdown

---

## 🎯 Test 2 : Géocodage ADM3 Manuel

### Étapes

1. **Sélectionner un sondage**
   - Choisir un sondage non géocodé

2. **Sélectionner manuellement une commune**
   - Dans le dropdown "Ou choisir manuellement", sélectionner une commune
   - Ex: "Tchamba (TG010410)"

3. **Enregistrer**
   - Cliquer sur "💾 Enregistrer le géocodage"
   - **Attendu** : Toast de succès

### ✅ Critères de Succès
- [ ] Le dropdown contient toutes les communes (373 options)
- [ ] La sélection manuelle fonctionne
- [ ] Le géocodage s'enregistre

---

## 🎯 Test 3 : Géocodage avec Coordonnées Exactes

### Étapes

1. **Sélectionner un sondage**
   - Choisir un sondage non géocodé

2. **Changer le mode**
   - Dans le dropdown "Mode de géocodage", sélectionner "Coordonnées exactes"
   - **Vérifier** : Les champs lat/lon apparaissent

3. **Saisir des coordonnées**
   - Latitude : `6.1234` (entre 5.8 et 11.5)
   - Longitude : `1.2345` (entre -0.2 et 1.9)

4. **Enregistrer**
   - Cliquer sur "💾 Enregistrer le géocodage"
   - **Attendu** : Toast de succès

5. **Vérifier l'ADM3 calculé**
   - Ouvrir la console SQL :
     ```sql
     SELECT id, code, adm3_id, adm3_name, location_mode 
     FROM sondages 
     WHERE code = 'CODE_DU_SONDAGE';
     ```
   - **Attendu** : `adm3_id` et `adm3_name` sont calculés automatiquement

### ✅ Critères de Succès
- [ ] Les champs lat/lon s'affichent
- [ ] La validation des coordonnées fonctionne (bbox Togo)
- [ ] Le géocodage s'enregistre
- [ ] L'ADM3 est calculé automatiquement par intersection spatiale

### ❌ Erreurs Possibles

**Erreur 1** : "❌ Coordonnées invalides"
- **Cause** : Lat/lon non numériques
- **Solution** : Vérifier la saisie

**Erreur 2** : "Latitude hors limites"
- **Cause** : Coordonnées hors bbox Togo
- **Solution** : Utiliser des coordonnées valides (lat: 5.8-11.5, lon: -0.2-1.9)

---

## 🎯 Test 4 : Affichage sur la Carte

### Étapes

1. **Ouvrir la carte**
   - Aller dans l'onglet "Carte"

2. **Activer la couche Sondages**
   - Vérifier que la couche "Sondages" est activée
   - Si non, l'activer dans les contrôles de couches

3. **Zoomer sur le Togo**
   - Utiliser les contrôles de zoom
   - Chercher les points géocodés

4. **Vérifier les sondages géocodés**
   - **Attendu** : 2-3 points visibles sur la carte
   - Cliquer sur un point pour voir les détails

### ✅ Critères de Succès
- [ ] La couche Sondages existe
- [ ] Les sondages géocodés s'affichent
- [ ] Cliquer sur un point affiche les détails
- [ ] Les coordonnées sont correctes (dans le Togo)

### ❌ Problèmes Possibles

**Problème 1** : Aucun point visible
- **Cause 1** : Couche non activée
  - **Solution** : Activer la couche dans les contrôles
- **Cause 2** : Zoom insuffisant
  - **Solution** : Zoomer davantage
- **Cause 3** : SRID incorrect
  - **Solution** : Vérifier dans la console SQL :
    ```sql
    SELECT id, code, ST_SRID(geom), ST_AsText(ST_Transform(geom, 4326)) 
    FROM sondages WHERE geom IS NOT NULL;
    ```

**Problème 2** : Points hors du Togo
- **Cause** : Coordonnées inversées (lon/lat au lieu de lat/lon)
- **Solution** : Vérifier l'ordre dans le code UI

---

## 🎯 Test 5 : Workflow Complet

### Scénario : Géocoder 5 sondages

1. Ouvrir "Géocodage Amélioré"
2. Pour chaque sondage :
   - Sélectionner le sondage
   - Choisir une méthode (suggestion, manuel, ou exact)
   - Enregistrer
   - Vérifier le toast de succès
3. Vérifier les stats finales : `geocoded: 7`, `with_adm3: 7`
4. Ouvrir la carte et vérifier que les 7 points sont visibles

### ✅ Critères de Succès
- [ ] Tous les géocodages réussissent
- [ ] Les stats se mettent à jour après chaque géocodage
- [ ] Les sondages disparaissent de la liste "Sans géométrie"
- [ ] Les points apparaissent sur la carte

---

## 📊 Vérifications SQL

### Vérifier les sondages géocodés
```sql
SELECT 
    id, code, localite,
    adm3_id, adm3_name,
    location_mode,
    is_geocoded,
    ST_SRID(geom) as srid,
    ST_AsText(ST_Transform(geom, 4326)) as geom_4326
FROM sondages 
WHERE is_geocoded = true
ORDER BY updated_at DESC
LIMIT 10;
```

### Vérifier l'intersection ADM3
```sql
SELECT 
    s.id, s.code, s.localite,
    s.adm3_id as adm3_id_stored,
    a.gid as adm3_id_calculated,
    s.adm3_name as adm3_name_stored,
    a.adm3_fr as adm3_name_calculated,
    CASE 
        WHEN s.adm3_id = a.gid THEN '✅ Match'
        ELSE '❌ Mismatch'
    END as status
FROM sondages s
LEFT JOIN adm3 a ON ST_Contains(a.geom, ST_Transform(s.geom, 4326))
WHERE s.geom IS NOT NULL;
```

### Vérifier les stats
```sql
SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_geocoded) as geocoded,
    COUNT(*) FILTER (WHERE geom IS NOT NULL) as with_geom,
    COUNT(*) FILTER (WHERE adm3_id IS NOT NULL) as with_adm3,
    COUNT(*) FILTER (WHERE geom IS NULL) as missing_geom,
    COUNT(*) FILTER (WHERE adm3_id IS NULL) as missing_adm3
FROM sondages
WHERE deleted_at IS NULL;
```

---

## 🐛 Débogage

### Logs à surveiller

**Console navigateur** :
```
[GEOCODE] ADM3 select value: 328
[GEOCODE] Sending payload: {mode: 'adm', adm3_id: 328}
[SONDAGES] updateSondageGeometry - ID: xxx
[SONDAGES] updateSondageGeometry - Payload: {...}
```

**Logs API (docker-compose logs -f api-geo)** :
```
DEBUG: adm3_id = 328 (type: i32)
```

### Commandes utiles

**Redémarrer l'API** :
```bash
docker-compose restart api-geo
```

**Voir les logs de l'API** :
```bash
docker-compose logs -f api-geo | Select-String "ERROR|WARN|DEBUG"
```

**Vérifier la base de données** :
```bash
docker exec -i atlas-db psql -U atlas -d atlas_clean
```

---

## ✅ Checklist Finale

- [ ] Test 1 : Géocodage ADM3 via suggestions ✅
- [ ] Test 2 : Géocodage ADM3 manuel ✅
- [ ] Test 3 : Géocodage avec coordonnées exactes ✅
- [ ] Test 4 : Affichage sur la carte ⏳
- [ ] Test 5 : Workflow complet (5 sondages) ⏳
- [ ] Vérifications SQL ✅
- [ ] Pas d'erreurs dans les logs ⏳

---

## 📝 Rapport de Test

**Date** : 2025-11-07  
**Testeur** : _____________________  
**Version** : v2.5.0

### Résultats

| Test | Statut | Notes |
|------|--------|-------|
| Géocodage ADM3 (suggestions) | ⏳ | |
| Géocodage ADM3 (manuel) | ⏳ | |
| Géocodage exact | ⏳ | |
| Affichage carte | ⏳ | |
| Workflow complet | ⏳ | |

### Bugs trouvés

1. _____________________
2. _____________________
3. _____________________

### Améliorations suggérées

1. _____________________
2. _____________________
3. _____________________
