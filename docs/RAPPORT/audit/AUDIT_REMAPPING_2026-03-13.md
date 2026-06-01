# Audit remapping — état de vérité (M-1)

- **Date** : 2026-03-13
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

---

### RQ-2 — Missions avec `maille_id` orphelin (FK rompue)

Commande :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) AS orphan_maille_fk FROM atlas.colab_missions cm LEFT JOIN atlas.mailles m ON m.id = cm.maille_id WHERE cm.deleted_at IS NULL AND cm.maille_id IS NOT NULL AND m.id IS NULL;"
```

Résultat :

- `orphan_maille_fk = 0`

---

### RQ-3 — État de la table de mapping legacy

Commande :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) AS total_rows, COUNT(DISTINCT new_code) AS distinct_new_codes, COUNT(*) FILTER (WHERE new_code IS NULL OR BTRIM(new_code)='') AS rows_without_new_code, COUNT(DISTINCT method) AS methods_used FROM atlas.legacy_maille_code_map;"
```

Résultat :

- `total_rows = 29407`
- `distinct_new_codes = 29407`
- `rows_without_new_code = 0`
- `methods_used = 1`

---

### RQ-4 — Répartition des méthodes de mapping

Commande :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT method, COUNT(*) FROM atlas.legacy_maille_code_map GROUP BY method ORDER BY COUNT(*) DESC;"
```

Résultat :

- `intersection = 29407`

---

### RQ-5 — Assignations actives pointant vers mission sans maille

Commande (test d’existence, 0/1) :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) FROM (SELECT 1 FROM atlas.colab_mission_assignments cma JOIN atlas.colab_missions cm ON cm.id = cma.mission_id WHERE cma.unassigned_at IS NULL AND cm.deleted_at IS NULL AND cm.maille_id IS NULL LIMIT 1) t;"
```

Résultat :

- `0` (aucun cas)

---

### RQ-6 — Couverture legacy mapping pour les mailles actives

Définition (alignée BM-01/BM-07) : maille active = maille liée à au moins une mission active (`colab_mission_assignments.unassigned_at IS NULL`).

Commande :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT COUNT(DISTINCT m.code) AS mailles_actives_total, COUNT(DISTINCT lm.new_code) AS mailles_actives_avec_legacy, COUNT(DISTINCT m.code) - COUNT(DISTINCT lm.new_code) AS mailles_actives_sans_legacy FROM atlas.mailles m JOIN atlas.colab_missions cm ON cm.maille_id = m.id AND cm.deleted_at IS NULL JOIN atlas.colab_mission_assignments cma ON cma.mission_id = cm.id AND cma.unassigned_at IS NULL LEFT JOIN atlas.legacy_maille_code_map lm ON lm.new_code = m.code;"
```

Résultat :

- `mailles_actives_total = 8`
- `mailles_actives_avec_legacy = 8`
- `mailles_actives_sans_legacy = 0`

---

### RQ-7 — Vérification vue de lookup

Commande :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) AS total_lookup_entries FROM atlas.v_api_legacy_lookup;"
```

Résultat :

- `total_lookup_entries = 29407`

---

## 2) Conclusions M-2 / M-3 (décision)

### M-2 — Corriger les missions sans maille

- **Non nécessaire** : `missions_without_maille = 0`.

### M-3 — Compléter legacy mapping pour mailles actives

- **Non nécessaire** : `mailles_actives_sans_legacy = 0`.

---

## 3) Notes

- Les incohérences observées côté UI sur `active_mailles` sont compatibles avec un binaire backend non rebuild (cf. règle GEN-05). Après rebuild, l’API expose des `active_mailles` cohérents avec BM-07.
