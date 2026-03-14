# Audit remapping — état de vérité (M-1)

- **Date** : 2026-03-14
- **Repo** : `atlas_reclone`
- **DB** : `atlas_clean`
- **Exécution** : `docker compose exec -T db psql -U atlas -d atlas_clean -c "..."`

Ce document fige les résultats de l’audit M-1 (roadmap) afin de décider proprement si M-2/M-3 sont nécessaires.

---

## 1) Résultats (requêtes M-1)

### RQ-1 — Missions sans maille

Commande :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) AS missions_without_maille FROM atlas.colab_missions WHERE deleted_at IS NULL AND maille_id IS NULL;"
```

Résultat :

- `missions_without_maille = 0`

Extrait (liste, limitée à 20) :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT cm.id::text, cm.title, cm.created_at::date FROM atlas.colab_missions cm WHERE cm.deleted_at IS NULL AND cm.maille_id IS NULL ORDER BY cm.created_at LIMIT 20;"
```

Résultat :

- 0 ligne.

**Conclusion** : pas de mission active sans maille → M-2 non nécessaire (à ce stade).

---

### RQ-2 — Missions avec `maille_id` orphelin (FK rompue)

Commande :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) AS orphan_maille_fk FROM atlas.colab_missions cm LEFT JOIN atlas.mailles m ON m.id = cm.maille_id WHERE cm.deleted_at IS NULL AND cm.maille_id IS NOT NULL AND m.id IS NULL;"
```

Résultat :

- `orphan_maille_fk = 0`

**Conclusion** : pas de FK rompue sur `colab_missions.maille_id`.

---

### RQ-3 — État de la table de mapping legacy

Note : la table réelle n’a pas le schéma attendu initialement (colonnes `new_maille_id`, `mapping_method`). Elle expose :

- `legacy_code` (PK)
- `new_code`
- `new_spatial_id`
- `coverage_pct`
- `method`
- `created_at`

Inspection :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "\\d+ atlas.legacy_maille_code_map"
```

Mesure :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) AS total_rows, COUNT(DISTINCT new_code) AS distinct_new_codes, COUNT(*) FILTER (WHERE new_code IS NULL OR BTRIM(new_code)='') AS rows_without_new_code, COUNT(DISTINCT method) AS methods_used FROM atlas.legacy_maille_code_map;"
```

Résultat :

- `total_rows = 29407`
- `distinct_new_codes = 29407`
- `rows_without_new_code = 0`
- `methods_used = 1`

**Conclusion** : mapping legacy complet en volume (>= 29k) et homogène.

---

### RQ-4 — Répartition des méthodes de mapping

Commande :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT method, COUNT(*) FROM atlas.legacy_maille_code_map GROUP BY method ORDER BY COUNT(*) DESC;"
```

Résultat :

- `intersection = 29407`

**Conclusion** : un seul mode utilisé (intersection).

---

### RQ-5 — Étudiants avec mission active mais mission sans maille

Commande :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT DISTINCT u.username, u.first_name, u.last_name, cma.student_id::text FROM atlas.colab_mission_assignments cma JOIN atlas.colab_missions cm ON cm.id = cma.mission_id JOIN atlas.colab_students cs ON cs.id = cma.student_id JOIN atlas.users u ON u.id = cs.user_id WHERE cma.unassigned_at IS NULL AND cm.deleted_at IS NULL AND cm.maille_id IS NULL;"
```

Résultat :

- 0 ligne.

**Conclusion** : cohérence OK pour les assignments actifs.

---

### RQ-6 — Mailles actives couvertes par legacy mapping (adaptation)

Le schéma actuel de `legacy_maille_code_map` référence les mailles par `new_code` (et `new_spatial_id`).

On peut donc mesurer la couverture pour les mailles actives (au sens “au moins une mission active sur cette maille”) via un JOIN sur `mailles.code`.

Commande proposée (non exécutée automatiquement dans ce lot) :

```sql
SELECT
  COUNT(DISTINCT m.code) AS mailles_actives_total,
  COUNT(DISTINCT lm.new_code) AS mailles_actives_avec_legacy,
  COUNT(DISTINCT m.code) - COUNT(DISTINCT lm.new_code) AS mailles_actives_sans_legacy
FROM atlas.mailles m
JOIN atlas.colab_missions cm ON cm.maille_id = m.id AND cm.deleted_at IS NULL
JOIN atlas.colab_mission_assignments cma ON cma.mission_id = cm.id AND cma.unassigned_at IS NULL
LEFT JOIN atlas.legacy_maille_code_map lm ON lm.new_code = m.code;
```

Interprétation attendue :

- si `mailles_actives_sans_legacy = 0` → M-3 inutile.

---

### RQ-7 — Vérification vue de lookup

Commande :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) AS total_lookup_entries FROM atlas.v_api_legacy_lookup;"
```

Résultat :

- `total_lookup_entries = 29407`

**Conclusion** : la vue `atlas.v_api_legacy_lookup` est peuplée (volume cohérent avec legacy mapping).

---

## 2) Conclusions M-2 / M-3 (décision)

### M-2 — Correction missions sans maille

- **Non activée** : `missions_without_maille = 0`.

### M-3 — Compléter legacy mapping pour mailles actives

- **À confirmer** via RQ-6 adaptée (`new_code` vs `new_maille_id`).
- Si RQ-6 conclut que toutes les mailles actives sont couvertes : **M-3 non nécessaire**.

---

## 3) Notes de cohérence avec le bug R-2 (active_mailles UI)

- La DB contient des assignments actifs cohérents.
- Le bug R-2 observé (active_mailles=0) était dû à un **binaire `api-geo` non rebuild** (conteneur tournant sur une version ancienne). Après rebuild + restart, l’API renvoie `active_mailles=1`.

---

## 4) Grille provisoire TG-00xx — état de preuve (remapping)

### 4.1. Preuve du rattachement actuel (fallback) : ADM3 → centroïde → maille V2

Pour les missions portant un code provisoire `TG-00xx` (présent dans `colab_missions.notes_internal` sous la forme `maille_code=TG-....`), le rattachement actuel vers V2 est cohérent avec :

- `colab_missions.commune` ↔ `public.adm3.adm3_fr`
- puis `ST_Transform(ST_Centroid(adm3.geom), 25231)`
- puis `ST_Contains(atlas.mailles.geom, point)`

Commande (preuve) :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "WITH missions AS (\
  SELECT cm.id, cm.code, cm.commune, cm.maille_id,\
         ST_Transform(ST_Centroid(a.geom),25231) AS adm3_centroid_25231\
  FROM atlas.colab_missions cm\
  JOIN public.adm3 a ON lower(a.adm3_fr)=lower(cm.commune)\
  WHERE cm.notes_internal ILIKE '%maille_code=TG-00%'\
), resolved AS (\
  SELECT m.code AS mission_code, m.commune,\
         m.maille_id::text AS maille_id_current,\
         g.id::text AS maille_id_from_adm3_centroid,\
         g.code AS v2_code_from_adm3_centroid\
  FROM missions m\
  LEFT JOIN atlas.mailles g ON ST_Contains(g.geom, m.adm3_centroid_25231)\
)\
SELECT * FROM resolved ORDER BY mission_code;"
```

Résultat (interprétation) : correspondance exacte `maille_id_current = maille_id_from_adm3_centroid` sur l’échantillon (21 missions).

### 4.2. Test d’hypothèse “Iso-Code inverse” (grille provisoire reconstructible)

Hypothèse testée : `step=0.01°`, `X0=0.687`, `Y0=5.795`.

Commande :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "WITH missions AS (\
  SELECT (SUBSTRING(cm.notes_internal FROM 'maille_code=TG-([0-9]+)-[0-9]+-[0-9]+')::int) AS col_prov,\
         (SUBSTRING(cm.notes_internal FROM 'maille_code=TG-[0-9]+-([0-9]+)-[0-9]+')::int) AS row_prov,\
         ST_X(ST_Transform(ST_Centroid(m.geom), 4326)) AS lon_v2,\
         ST_Y(ST_Transform(ST_Centroid(m.geom), 4326)) AS lat_v2\
  FROM atlas.colab_missions cm\
  JOIN atlas.mailles m ON m.id = cm.maille_id\
  WHERE cm.notes_internal ILIKE '%maille_code=TG-00%'\
), calc AS (\
  SELECT *,\
         ROUND((lon_v2 - 0.687) / 0.01)::int AS col_calc,\
         ROUND((lat_v2 - 5.795) / 0.01)::int AS row_calc\
  FROM missions\
)\
SELECT COUNT(*) AS n,\
       SUM(CASE WHEN ABS(col_prov-col_calc) <= 1 AND ABS(row_prov-row_calc) <= 1 THEN 1 ELSE 0 END) AS ok\
FROM calc;"
```

Résultat :

- `n=21`, `ok=6`

**Conclusion** : l’hypothèse `X0=0.687/Y0=5.795` n’explique pas de façon robuste les 21 codes provisoires à partir des centroïdes des mailles V2.

### 4.3. Distribution observée X0/Y0 (dérivée des missions)

On peut dériver `X0` et `Y0` “observés” par mission via :

- `x0 = lon_v2 - col_prov*step`
- `y0 = lat_v2 - row_prov*step`

Commande :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "WITH missions AS (\
  SELECT (SUBSTRING(cm.notes_internal FROM 'maille_code=TG-([0-9]+)-[0-9]+-[0-9]+')::int) AS col_prov,\
         (SUBSTRING(cm.notes_internal FROM 'maille_code=TG-[0-9]+-([0-9]+)-[0-9]+')::int) AS row_prov,\
         ST_X(ST_Transform(ST_Centroid(m.geom), 4326)) AS lon_v2,\
         ST_Y(ST_Transform(ST_Centroid(m.geom), 4326)) AS lat_v2\
  FROM atlas.colab_missions cm\
  JOIN atlas.mailles m ON m.id = cm.maille_id\
  WHERE cm.notes_internal ILIKE '%maille_code=TG-00%'\
), x0y0 AS (\
  SELECT *, (lon_v2 - (col_prov * 0.01)) AS x0, (lat_v2 - (row_prov * 0.01)) AS y0\
  FROM missions\
)\
SELECT COUNT(*) AS n,\
       ROUND(MIN(x0)::numeric,6) AS x0_min,\
       ROUND(MAX(x0)::numeric,6) AS x0_max,\
       ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x0)::numeric,6) AS x0_median,\
       ROUND(MIN(y0)::numeric,6) AS y0_min,\
       ROUND(MAX(y0)::numeric,6) AS y0_max,\
       ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY y0)::numeric,6) AS y0_median\
FROM x0y0;"
```

Résultat :

- `x0_min=0.660574`, `x0_max=0.735646`, `x0_median=0.707058`
- `y0_min=5.738121`, `y0_max=5.829724`, `y0_median=5.790341`

**Conclusion** : la variabilité observée de `X0/Y0` est non négligeable sur l’échantillon ; à ce stade, on ne fige pas une origine unique comme vérité.

### 4.4. Backfill du mapping explicite `atlas.colab_maille_code_map` (TG-00xx → V2)

La table `atlas.colab_maille_code_map` contient les codes provisoires (18 entrées) et a été backfillée avec `target_code` via le fallback ADM3-centroid.

Migration :

- `db/migrations/129_backfill_colab_maille_code_map_from_adm3_centroid.sql`

Exécution (log) : `UPDATE 18`.

Vérification :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "\
  SELECT source_code, target_code, match_type\
  FROM atlas.colab_maille_code_map\
  WHERE source_code LIKE 'TG-00%'\
  ORDER BY source_code;"
```

---

## 5) Décision

- Le rattachement ADM3→centroïde→V2 est validé comme **fallback opérationnel** (BM-14) et rendu traçable via `colab_maille_code_map`.
- La reconstruction géométrique “pleine” de la grille TG-00xx reste **non validée** sur l’échantillon ; aucune migration ne doit créer une géométrie “source de vérité” tant que l’origine n’est pas confirmée par une référence externe (export/shapefile/paramètres terrain).
