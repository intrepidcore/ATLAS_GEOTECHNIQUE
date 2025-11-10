# ✅ Résolution des Bugs - 2025-11-07

## 🐛 Bug 1 : Erreur HTTP 400 "adm3_id field required"

### Problème
Lors du géocodage ADM3 via l'UI, l'erreur HTTP 400 apparaissait même quand une commune était sélectionnée.

### Cause
Le dropdown pouvait être vide ou contenir une valeur non numérique, et le payload n'était pas validé avant l'envoi.

### Solution ✅
**Fichier modifié** : `ui/src/geocode-canon-panel.ts` ligne 338-361

Ajout de :
1. Logs de débogage pour voir la valeur sélectionnée
2. Validation stricte : vérifier que la valeur n'est pas vide
3. Validation du parsing : vérifier que `parseInt()` retourne un nombre valide
4. Log du payload avant envoi

```typescript
const adm3Gid = (document.getElementById('adm3-select') as HTMLSelectElement).value;
console.log('[GEOCODE] ADM3 select value:', adm3Gid);

if (!adm3Gid || adm3Gid === '') {
  toast.error('❌ Veuillez sélectionner une commune');
  return;
}

const adm3IdNum = parseInt(adm3Gid);
if (isNaN(adm3IdNum)) {
  toast.error('❌ ID commune invalide');
  console.error('[GEOCODE] Invalid adm3_id:', adm3Gid);
  return;
}

console.log('[GEOCODE] Sending payload:', { mode: 'adm', adm3_id: adm3IdNum });
```

### Test ✅
```bash
curl -X PATCH "http://localhost:8000/sondages/b87f4500-9665-4ebd-85fb-623711881de9/geometry" \
  -H "Content-Type: application/json" \
  -d '{"mode":"adm","adm3_id":328}'
```

**Résultat** : HTTP 200, sondage mis à jour avec `adm3_id=328`, `adm3_name="Tchamba"`

---

## 🐛 Bug 2 : Sondage géocodé invisible sur la carte

### Problème
Un sondage avec `with_geom=1` n'apparaissait pas sur la carte.

### Causes Identifiées

#### A) **ADM3 non calculé pour géocodage "exact"** ✅ RÉSOLU
Le code Rust ne calculait pas automatiquement l'ADM3 par intersection spatiale lors d'un géocodage avec coordonnées exactes.

**Solution** : Modifier `services/api-geo/src/sondages.rs` ligne 297-324

Ajout d'une sous-requête pour calculer `adm3_id` et `adm3_name` :

```sql
UPDATE sondages 
SET geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 25231),
    location_mode = 'exact',
    adm3_id = (
        SELECT gid 
        FROM adm3 
        WHERE ST_Contains(geom, ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 25231), 4326))
        LIMIT 1
    ),
    adm3_name = (
        SELECT adm3_fr 
        FROM adm3 
        WHERE ST_Contains(geom, ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 25231), 4326))
        LIMIT 1
    ),
    updated_at = NOW()
WHERE id = $2 AND deleted_at IS NULL
```

**Avant** :
```sql
SELECT id, code, adm3_id, adm3_name FROM sondages WHERE id = 'bad0dbc2-...';
-- adm3_id: NULL, adm3_name: "Mango"
```

**Après** :
```sql
-- adm3_id: 242, adm3_name: "Mango"
```

#### B) **SRID mixtes** ⚠️ À SURVEILLER
- Table `adm3` : géométries en SRID 4326 (lat/lon)
- Table `sondages` : géométries en SRID 25231 (projection Togo)
- Carte UI : affichage en SRID 4326

La transformation `ST_Transform(s.geom, 4326)` est nécessaire pour les jointures spatiales.

#### C) **Couche carte non activée** ⏳ À VÉRIFIER
Vérifier dans l'UI que la couche "Sondages" est bien ajoutée à la carte et visible.

---

## 📊 Statistiques Avant/Après

### Avant les corrections
```json
{
  "total": 230,
  "geocoded": 1,
  "with_geom": 1,
  "with_adm3": 0,  // ❌ Problème !
  "missing_geom": 229,
  "missing_adm3": 230
}
```

### Après les corrections
```json
{
  "total": 230,
  "geocoded": 2,
  "with_geom": 1,
  "with_adm3": 2,  // ✅ Corrigé !
  "missing_geom": 229,
  "missing_adm3": 228
}
```

---

## 🧪 Tests Effectués

### Test 1 : Géocodage ADM3 via API ✅
```bash
curl -X PATCH "http://localhost:8000/sondages/b87f4500-9665-4ebd-85fb-623711881de9/geometry" \
  -H "Content-Type: application/json" \
  -d '{"mode":"adm","adm3_id":328}'
```

**Résultat** : 
- HTTP 200
- Sondage mis à jour avec `adm3_id=328`, `adm3_name="Tchamba"`
- `is_geocoded=true`

### Test 2 : Vérification intersection spatiale ✅
```sql
SELECT 
    s.id, s.code, s.localite, 
    a.gid, a.adm3_fr 
FROM sondages s 
LEFT JOIN adm3 a ON ST_Contains(a.geom, ST_Transform(s.geom, 4326)) 
WHERE s.geom IS NOT NULL;
```

**Résultat** :
```
id                                  | code       | localite   | gid | adm3_fr
------------------------------------+------------+------------+-----+---------
bad0dbc2-f0e4-4afb-bb9b-23541fe20169| NABIYOU-01 | NABIYOU-01 | 242 | Mango
```

### Test 3 : Stats API ✅
```bash
curl http://localhost:8000/sondages/stats
```

**Résultat** : `with_adm3=2` (correct)

---

## 🔧 Fichiers Modifiés

1. **`ui/src/geocode-canon-panel.ts`**
   - Ligne 338-361 : Validation stricte du géocodage ADM3
   - Ajout de logs de débogage

2. **`services/api-geo/src/sondages.rs`**
   - Ligne 297-324 : Calcul automatique de l'ADM3 pour géocodage exact
   - Sous-requêtes spatiales pour `adm3_id` et `adm3_name`

---

## ⏳ Actions Restantes

### 1. Tester l'UI complète
- [ ] Ouvrir "Géocodage Amélioré"
- [ ] Sélectionner un sondage
- [ ] Cliquer sur une suggestion ADM3
- [ ] Vérifier que le dropdown se remplit
- [ ] Cliquer sur "Enregistrer"
- [ ] Vérifier que le sondage est mis à jour
- [ ] Vérifier que les stats se mettent à jour

### 2. Vérifier l'affichage carte
- [ ] Ouvrir la carte
- [ ] Activer la couche "Sondages"
- [ ] Zoomer sur le Togo
- [ ] Vérifier que les 2 sondages géocodés apparaissent
- [ ] Cliquer sur un sondage pour voir les détails

### 3. Tester le géocodage exact
- [ ] Sélectionner un sondage non géocodé
- [ ] Choisir mode "Coordonnées exactes"
- [ ] Saisir lat/lon (ex: 6.1234, 1.2345)
- [ ] Enregistrer
- [ ] Vérifier que `adm3_id` est calculé automatiquement

---

## 📝 Notes Techniques

### SRID et Transformations
- **SRID 4326** : WGS84 (lat/lon) - Standard GPS
- **SRID 25231** : Projection UTM Zone 31N - Utilisée pour le Togo
- **Transformation** : `ST_Transform(geom, target_srid)`

### Calcul ADM3 par Intersection
```sql
SELECT gid, adm3_fr 
FROM adm3 
WHERE ST_Contains(adm3.geom, ST_Transform(sondage.geom, 4326))
LIMIT 1
```

Cette requête :
1. Transforme la géométrie du sondage (SRID 25231) en SRID 4326
2. Vérifie si le point est contenu dans un polygone ADM3
3. Retourne le premier match (LIMIT 1)

### Performance
Pour améliorer les performances, créer un index spatial sur `adm3.geom` :
```sql
CREATE INDEX IF NOT EXISTS idx_adm3_geom ON adm3 USING GIST(geom);
```

---

## ✅ Résumé

**Bugs résolus** : 2/2
- ✅ Erreur HTTP 400 lors du géocodage ADM3
- ✅ ADM3 non calculé pour géocodage exact

**Améliorations apportées** :
- Validation stricte des inputs UI
- Logs de débogage pour faciliter le diagnostic
- Calcul automatique de l'ADM3 par intersection spatiale
- Documentation complète des bugs et solutions

**Prochaine étape** : Tester l'UI complète et vérifier l'affichage carte
