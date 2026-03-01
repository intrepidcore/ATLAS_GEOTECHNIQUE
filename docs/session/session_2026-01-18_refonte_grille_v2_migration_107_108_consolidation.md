# Session 2026-01-18 — Refonte Grille V2 : consolidation (migrations 107 + 108)

## Contexte

Objectif : obtenir une **grille 2km “vraie”** (carrés 2000m x 2000m en EPSG:25231, origine (200000,600000)) et une grille **28km strictement dérivée** des mailles 2km (agrégation 14×14), puis relier :

- `atlas.mailles.id_m28`
- `atlas.sondages.id_m28`

Contrainte : la migration précédente avait produit une couche 28km incomplète → apparition de mailles 2km “orphelines” (`id_m28 IS NULL`).

## Résultat final (fin de session)

- `atlas.mailles` : `14821` mailles 2km générées (clippées à la frontière)
- `atlas.maille_28km` : `111` mailles 28km reconstruites “bottom-up”
- `atlas.mailles` orphelines (`id_m28 IS NULL`) : `0`
- `atlas.sondages` : `9` sondages sans `id_m28`, **tous sans géométrie (`geom IS NULL`)**

## Analyse : pourquoi la 28km était incomplète

Les mailles 2km étaient correctes, mais la génération 28km “top-down” (boucles / emprise) ne couvrait pas toute l’étendue des 2km.
Conséquence : des mailles 2km (et leurs sondages) se retrouvaient hors de l’emprise des 28km, rendant impossible tout relink via `ST_Intersects` / `PointOnSurface`.

La décision prise : **ne pas bricoler les orphelines**, mais reconstruire `maille_28km` **exclusivement** à partir des mailles 2km existantes.

## Commandes / exécutions (journal)

### 1) Restauration de la DB (référence)

- Restauration dans `atlas_clean` depuis un dump pré-refonte.

### 2) Migration 107 — “vrai 2km” (breaking change)

- Exécution (via conteneur PostGIS) :

```powershell
docker exec -i atlas-db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/107_correction_taille_reelle_2km.sql
```

Points notables :

- Correction de la génération des couples `(i,j)` par produit cartésien (`generate_series` cross-join).
- Gestion des `MultiPolygon` potentiels lors des `ST_Intersection` / `ST_Union` via `ST_Dump` et sélection du polygone principal, pour rester compatible avec les colonnes de type `geometry(Polygon,25231)`.

### 3) Diagnostic : mailles 2km orphelines

- Constats : certaines mailles 2km n’étaient pas rattachées à une 28km parce que la couche 28km ne couvrait pas toute l’étendue des 2km.

### 4) Migration 108 — reconstruction robuste 28km depuis 2km

Décision : reconstruire `atlas.maille_28km` “bottom-up”.

- Script : `atlas/migrations/108_fix_coverage_28km.sql`
- Exécution :

```powershell
docker exec -i atlas-db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/108_fix_coverage_28km.sql
```

Implémentation :

- Drop temporaire des FK vers `maille_28km` (éviter `TRUNCATE ... CASCADE` destructif)
- Suppression des vues dépendantes pour pouvoir ajuster le type `geom`
- Passage de `atlas.maille_28km.geom` en `geometry(MultiPolygon,25231)`
- Reconstruction :
  - calcul du groupe `(col_28,row_28)` pour chaque maille 2km par la position du centroid
  - agrégation par `ST_UnaryUnion(ST_Collect(geom))`
  - insertion de `ST_Multi(ST_CollectionExtract(ST_MakeValid(...),3))`
- Relink :
  - `atlas.mailles.id_m28` via `ST_CoveredBy(ST_PointOnSurface(m.geom), m28.geom)`
  - `atlas.sondages.id_m28` via la maille 2km (par `grid_code`) + fallback spatial si `grid_code` absent
- Recréation d’une vue minimale `atlas.v_coverage_mailles_28km`

## Vérifications SQL clés

- Orphelins mailles :

```sql
SELECT COUNT(*) FROM atlas.mailles WHERE id_m28 IS NULL;
```

- Géométrie 28km :

```sql
SELECT
  COUNT(*) AS n_m28,
  COUNT(*) FILTER (WHERE GeometryType(geom)='MULTIPOLYGON') AS n_multipoly,
  COUNT(*) FILTER (WHERE GeometryType(geom)='POLYGON') AS n_poly
FROM atlas.maille_28km;
```

- Sondages orphelins (explication) :

```sql
SELECT
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND id_m28 IS NULL) AS active_orphans,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND geom IS NULL) AS active_geom_null
FROM atlas.sondages;
```

## Notes / suites

- Les `9` sondages “orphelins” restants n’ont pas de géométrie (`geom IS NULL`) : ils ne peuvent pas être reliés spatialement.
- La refonte 28km est maintenant **pérenne** : si la 2km évolue, on peut reconstruire la 28km par agrégation “depuis la matière”.
