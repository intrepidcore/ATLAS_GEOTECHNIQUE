# 🐛 Bugs Identifiés - 2025-11-07

## 1. ❌ Erreur HTTP 400 lors du géocodage ADM3

### Symptôme
Lorsqu'on clique sur une suggestion ADM3 ou qu'on sélectionne manuellement une commune dans le dropdown, on obtient :
```
HTTP 400: Mode 'adm' requires 'adm3_id' field
```

### Cause Probable
Le payload envoyé par l'UI ne contient pas le champ `adm3_id` ou il est `null`/`undefined`.

### Code Concerné
**Fichier**: `ui/src/geocode-canon-panel.ts` ligne 348-351

```typescript
await updateSondageGeometry(this.selectedSurvey!.id, {
  mode: 'adm',
  adm3_id: parseInt(adm3Gid)  // ⚠️ Vérifier que adm3Gid n'est pas vide
});
```

### Solution
Ajouter une validation plus stricte avant l'envoi :

```typescript
const adm3Gid = (document.getElementById('adm3-select') as HTMLSelectElement).value;
if (!adm3Gid || adm3Gid === '') {
  toast.error('❌ Veuillez sélectionner une commune');
  return;
}

const adm3IdNum = parseInt(adm3Gid);
if (isNaN(adm3IdNum)) {
  toast.error('❌ ID commune invalide');
  return;
}

console.log('[DEBUG] Envoi géocodage ADM3:', { mode: 'adm', adm3_id: adm3IdNum });

await updateSondageGeometry(this.selectedSurvey!.id, {
  mode: 'adm',
  adm3_id: adm3IdNum
});
```

### Test de Vérification
1. Ouvrir "Géocodage Amélioré"
2. Sélectionner un sondage
3. Cliquer sur une suggestion ADM3
4. Vérifier dans la console que le dropdown est bien rempli
5. Cliquer sur "Enregistrer"
6. Vérifier les logs de la requête PATCH

---

## 2. ❓ Sondage géocodé invisible sur la carte

### Symptôme
Les stats indiquent :
```json
{
  "total": 230,
  "geocoded": 1,
  "with_geom": 1,
  "with_adm3": 0
}
```

Un sondage a `with_geom=1` mais n'apparaît pas sur la carte.

### Causes Possibles

#### A) **SRID incorrect**
Le sondage a une géométrie en SRID 4326 (lat/lon) mais la carte attend du SRID 25231 (projection Togo).

**Vérification SQL** :
```sql
SELECT 
    id, code, localite,
    ST_SRID(geom) as srid_geom,
    ST_AsText(geom) as geom_wkt,
    ST_AsText(ST_Transform(geom, 4326)) as geom_4326_wkt
FROM sondages 
WHERE geom IS NOT NULL
LIMIT 5;
```

**Solution** : S'assurer que l'API transforme correctement les coordonnées :
- Input UI : lat/lon (SRID 4326)
- Stockage DB : SRID 25231
- Affichage carte : SRID 4326

#### B) **Géométrie hors bbox**
Le sondage est en dehors de la bbox du Togo.

**Vérification SQL** :
```sql
SELECT 
    id, code,
    ST_X(ST_Transform(geom, 4326)) as lon,
    ST_Y(ST_Transform(geom, 4326)) as lat
FROM sondages 
WHERE geom IS NOT NULL;

-- Bbox Togo: lat [5.8, 11.5], lon [-0.2, 1.9]
```

#### C) **Couche carte non activée**
La couche des sondages n'est pas ajoutée à la carte ou est masquée.

**Vérification UI** :
- Ouvrir la console du navigateur
- Vérifier que la couche "Sondages" existe
- Vérifier les filtres de la carte

#### D) **Zoom insuffisant**
Le sondage est trop petit pour être visible au niveau de zoom actuel.

**Solution** : Ajouter un bouton "Zoomer sur les sondages géocodés"

---

## 3. ⚠️ Sélection de suggestion ne remplit pas toujours le dropdown

### Symptôme
Parfois, cliquer sur une suggestion ADM3 ne remplit pas le dropdown "Commune".

### Cause
Le code cherche l'option par `gid` mais les options utilisent peut-être `adm3_id` ou un autre champ.

**Code Concerné**: `geocode-canon-panel.ts` ligne 293-319

```typescript
const candidate = this.candidates.find(c => c.adm3_id === parseInt(adm3Id));
if (candidate) {
  select.value = candidate.gid.toString();  // ⚠️ Vérifier que gid existe dans les options
}
```

### Solution
Ajouter des logs pour déboguer :

```typescript
console.log('[DEBUG] Candidate sélectionné:', candidate);
console.log('[DEBUG] Options disponibles:', 
  Array.from(select.options).map(o => ({ value: o.value, text: o.text }))
);
console.log('[DEBUG] Tentative de set value:', candidate.gid.toString());
```

---

## 4. 📊 Statistiques : `with_adm3=0` mais géocodage ADM3 possible

### Symptôme
Tous les sondages ont `adm3_id=NULL` même après géocodage ADM3.

### Cause Probable
L'API `/sondages/:id/geometry` avec `mode=adm` ne met pas à jour la colonne `adm3_id`.

**Vérification API** :
```rust
// services/api-geo/src/sondages.rs ligne 332-350
sqlx::query(
    r#"
    UPDATE sondages 
    SET adm3_id = $1,
        adm3_name = $2,
        location_mode = 'adm_random_cell',
        updated_at = NOW()
    WHERE id = $3 AND deleted_at IS NULL
    "#,
)
.bind(adm3_id)  // ⚠️ Vérifier que cette valeur est bien passée
.bind(adm3_name)
.bind(id)
.execute(pool)
```

**Test SQL** :
```sql
-- Avant géocodage
SELECT id, code, adm3_id, adm3_name, location_mode FROM sondages WHERE id = 'xxx';

-- Après géocodage ADM3 avec gid=328
-- Attendu: adm3_id=328, adm3_name='Tchamba', location_mode='adm_random_cell'
```

---

## 🔧 Actions Prioritaires

1. **Ajouter logs détaillés** dans `geocode-canon-panel.ts` pour voir exactement ce qui est envoyé
2. **Vérifier la géométrie** du sondage géocodé (SRID, coordonnées)
3. **Tester le PATCH** manuellement avec `curl` pour isoler le problème
4. **Vérifier la couche carte** pour les sondages

---

## 🧪 Tests à Effectuer

### Test 1 : Géocodage ADM3 manuel
```bash
curl -X PATCH "http://localhost:8000/sondages/b87f4500-9665-4ebd-85fb-623711881de9/geometry" \
  -H "Content-Type: application/json" \
  -d '{"mode":"adm","adm3_id":328}'
```

**Attendu** : HTTP 200 + sondage mis à jour

### Test 2 : Vérifier le sondage géocodé
```sql
SELECT 
    id, code, localite,
    adm3_id, adm3_name,
    location_mode,
    ST_SRID(geom) as srid,
    ST_AsText(geom) as geom_wkt,
    is_geocoded
FROM sondages 
WHERE geom IS NOT NULL OR adm3_id IS NOT NULL;
```

### Test 3 : Vérifier l'affichage carte
1. Ouvrir la carte
2. Activer la couche "Sondages"
3. Zoomer sur le Togo
4. Chercher le point géocodé

---

## 📝 Notes

- Le système utilise deux APIs parallèles : `/surveys-canon` (villages) et `/sondages` (individuel)
- La confusion entre `gid` (table adm3) et `adm3_id` (table sondages) peut causer des bugs
- Les SRID doivent être gérés correctement : 25231 (stockage) ↔ 4326 (affichage)
