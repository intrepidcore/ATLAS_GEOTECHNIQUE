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
