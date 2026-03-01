# ADR_001 — Refonte Grille 2km/28km (Topologie parfaite + Iso-Code)

- **Statut**: Draft (à exécuter après validation)
- **Date**: 17/01/2026
- **Périmètre**: PostGIS (SRID 25231), tables `atlas.mailles` (2km) et `atlas.maille_28km` (28km)

---

# 1. Contexte et Problématique ("Pourquoi on fait ça ?")

- **Constat initial :** Apparition de "doubles traits" et de "canyons" (vides) entre les mailles sur l'interface cartographique (Leaflet).

- **Cause racine :**
  - La grille 2km initiale a été générée par découpage géométrique approximatif, introduisant des micro-dérives numériques (sommets quasi-identiques mais pas exactement égaux).
  - La grille 28km ayant été construite à partir de la 2km, elle hérite de ces défauts topologiques.
  - L'effet est aggravé par les opérations géométriques (`ST_Intersection`) qui peuvent introduire une dérive flottante (cf règle **[DB-23]** dans `atlas/docs/REGLE_BONNE_PRATIQUE_MEMOIRE.MD`).

- **Impact :**
  - Rendu Leaflet instable (shared boundaries dessinées deux fois, “canyons”).
  - Correctifs front coûteux / fragiles (arrondis `toFixed(...)`).
  - Difficulté à garantir une frontière partagée strictement identique entre deux mailles voisines.

---

# 2. Principes Directeurs ("La Règle d'Or")

- **Spécification hiérarchique :** Une maille 28km n'est **pas** une entité indépendante. Elle est **strictement** l'agrégation de 14x14 = 196 mailles de 2km.

- **Topologie parfaite :** Les mailles doivent être jointives mathématiquement (partage exact des coordonnées des sommets). La grille "mère" est la 2km.

- **Continuité de service (Backward Compatibility) :** Les codes mailles existants (ex: `TG-0488-0212-01`) doivent être conservés au maximum.

---

# 3. Stratégie de Migration ("L'Algorithme Iso-Code")

Objectif: régénérer une grille parfaite **sans casser** les codes existants.

## 3.1 Rétro-ingénierie de l'origine (X0, Y0)

Hypothèse: le code `TG-XXXX-YYYY-01` encode implicitement la position de la maille dans la grille :

- `X = X0 + (XXXX * 2000)`
- `Y = Y0 + (YYYY * 2000)`

On estime `X0` et `Y0` par analyse statistique (mode) des différences entre l'enveloppe réelle et l'index code.

Requête (à exécuter **avant** refonte, sur la table sauvegardée `atlas.mailles_legacy`) :

```sql
SELECT 
  mode() WITHIN GROUP (ORDER BY (ST_XMin(geom) - (CAST(split_part(code, '-', 2) AS INT) * 2000))) AS x_origin_probable,
  mode() WITHIN GROUP (ORDER BY (ST_YMin(geom) - (CAST(split_part(code, '-', 3) AS INT) * 2000))) AS y_origin_probable
FROM atlas.mailles_legacy
WHERE code LIKE 'TG-%-%-01';
```

## 3.2 Régénération mathématique (grille parfaite)

On abandonne toute construction par collecte/enveloppe sur géométries existantes.

- **Outil PostGIS**: `ST_MakeEnvelope(xmin, ymin, xmax, ymax, srid)`.
- **Formule**:
  - `xmin = X0 + (col * 2000)`
  - `ymin = Y0 + (row * 2000)`
  - `xmax = xmin + 2000`
  - `ymax = ymin + 2000`

Le code est regénéré de façon déterministe depuis `xmin/ymin` :

- `TG-` + `lpad(((xmin - X0) / 2000)::int, 4, '0')` + `-` + `lpad(((ymin - Y0) / 2000)::int, 4, '0')` + `-01`

## 3.3 Alignement (Snapping) au moment du clip ADM0

Le snapping ne doit pas déformer la grille intérieure.

- **Règle**: la grille théorique (2km) est parfaite.
- **Snapping**: on l'applique uniquement lors des opérations de découpe / intersection avec la frontière pays (ADM0).

Principe :

- `geom_theorique = ST_MakeEnvelope(...)`
- `geom_clip = ST_SnapToGrid(ST_Intersection(geom_theorique, adm0_geom_25231), tol)`

La tolérance `tol` doit être suffisamment fine pour stabiliser les sommets, sans “manger” la frontière (à calibrer; point de départ: `0.01` en 25231 = 1cm).

---

# 4. Architecture de Données

## 4.1 Tables impactées

- **`atlas.mailles` (référence 2km)**
  - Recréée / régénérée (grille parfaite).
  - Conserve les mêmes codes autant que possible (iso-code).

- **`atlas.mailles_legacy` (archivage)**
  - Copie/sauvegarde de la table avant refonte.
  - Sert de référence pour:
    - calcul `(X0, Y0)`
    - audit et traçabilité

- **`atlas.maille_28km` (agrégat 28km)**
  - Vidée et régénérée.
  - La 28km doit être construite **uniquement** à partir de `atlas.mailles.geom`.

## 4.2 Gestion des dépréciations

Cas rare: certains anciens codes peuvent devenir introuvables après refonte (bords / clip).

- **Stratégie**: mapping spatial (centre ou recouvrement).

- **Table de mapping (optionnel)**: `atlas.migration_mailles_logs`
  - `old_code` → `new_code` + % recouvrement

Exemple de génération:

```sql
CREATE TABLE IF NOT EXISTS atlas.migration_mailles_logs AS
SELECT 
  l.code AS old_code,
  n.code AS new_code,
  (ST_Area(ST_Intersection(l.geom, n.geom)) / NULLIF(ST_Area(l.geom), 0)) * 100.0 AS coverage_pct
FROM atlas.mailles_legacy l
LEFT JOIN atlas.mailles n
  ON ST_Intersects(ST_Centroid(l.geom), n.geom);
```

---

# 5. Procédure Technique (Pas à pas)

## 5.1 Pré-requis

- Base en EPSG:25231 (interne) conformément à **[DB-01]**.
- Frontière pays disponible: `public.adm0_raw` (WGS84) utilisée dans les scripts existants (ex: `atlas/db/migrations/103_mailles_28km_clip_adm0.sql`).

## 5.2 Ordre d’exécution (scripts)

Note: certains scripts existent déjà, d’autres sont à créer pour cette refonte.

1. **Backup / Archivage** (à créer)
   - Renommer ou copier la table actuelle:
     - `ALTER TABLE atlas.mailles RENAME TO mailles_legacy;` (si acceptable)
     - ou `CREATE TABLE atlas.mailles_legacy AS SELECT * FROM atlas.mailles;`

2. **Analyse X0/Y0** (à créer)
   - Exécuter la requête de mode (section 3.1) sur `atlas.mailles_legacy`.

3. **Recréation table `atlas.mailles`** (à créer)
   - Recréer la structure (mêmes colonnes utiles + contraintes), puis regénérer par `generate_series` + `ST_MakeEnvelope`.

4. **Clip ADM0 + SnapToGrid** (à créer)
   - Appliquer `ST_Intersection` avec `public.adm0_raw` transformée en 25231, puis `ST_SnapToGrid`.

5. **Régénération 28km**
   - Point d’attention: l’implémentation historique (`atlas/db/migrations/080_create_maille_28km.sql`) agrège via `ST_Envelope(ST_Collect(...))`, ce qui peut masquer des micro-trous.
   - Cible de refonte: reconstruire `atlas.maille_28km` via agrégation **topologique**:
     - `ST_Union(atlas.mailles.geom)` groupé par bloc 14x14.

6. **Re-link (FK / rattachements)**
   - `atlas/db/migrations/080_create_maille_28km.sql` contient déjà:
     - `atlas.mailles.id_m28` + contrainte + backfill via centroid
     - `atlas.sondages.id_m28` + backfill via `grid_code`
   - Après refonte, ces updates doivent être relancées.

7. **Refresh vues / matviews**
   - Exemple: `atlas/db/migrations/081_create_kpi_views.sql` dépend de `atlas.maille_28km` et des liens 2km→28km.
   - Si matviews existent ailleurs, les rafraîchir (`REFRESH MATERIALIZED VIEW`).

---

# 6. Validation et Recette

## 6.1 Test visuel (Leaflet)

- Zoom fort sur des frontières partagées.
- Critère d’acceptation: absence de doubles traits et de “canyons”.

## 6.2 Tests d’intégrité SQL

- **Cardinalité**

```sql
SELECT COUNT(*) FROM atlas.mailles;
SELECT COUNT(*) FROM atlas.mailles_legacy;
SELECT COUNT(*) FROM atlas.maille_28km;
```

- **Orphelins sondages**

```sql
SELECT COUNT(*)
FROM atlas.sondages
WHERE id_m28 IS NULL;
```

- **Orphelins 2km**

```sql
SELECT COUNT(*)
FROM atlas.mailles
WHERE id_m28 IS NULL;
```

## 6.3 Test de régression “code stable”

- Exemple: vérifier qu’un code emblématique pointe toujours la même zone.

```sql
SELECT code, ST_AsText(ST_Centroid(geom))
FROM atlas.mailles
WHERE code = 'TG-0488-0212-01';
```

- Optionnel: comparer centroid avant/après via `atlas.mailles_legacy`.

---

# Décision

Adopter une refonte bottom-up :

- Régénérer `atlas.mailles` (2km) par construction mathématique (topologie parfaite).
- Construire `atlas.maille_28km` comme agrégat strict (14x14) des mailles 2km.
- Conserver au maximum les codes par “Iso-Code” en recalant l’origine `(X0, Y0)` sur l’existant.

# Conséquences

- **Bénéfices**:
  - Rendues cartographiques stables.
  - Simplification du frontend (moins de dédup/arrondis agressifs).
  - Base saine pour les agrégations et KPIs.

- **Risques**:
  - Rupture partielle de codes en bordure (à gérer via mapping).
  - Opération lourde: nécessite backup + procédure strictement ordonnée.
