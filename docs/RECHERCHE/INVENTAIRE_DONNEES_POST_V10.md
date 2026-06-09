# Inventaire des données géotechniques — Post-import V10_MASTER
**Date** : 2026-06-01 | **Batch** : `v10_master_import_2026` | **DB** : `atlas_clean` port 5433

---

## 1. Sondages

| Indicateur | Avant V10 | Après V10 | Δ V10 |
|---|---|---|---|
| Sondages total | 123 | 493 | **+370** |
| Échantillons total | 445 | 1 244 | **+799** |
| Sondages géocodés | ~100 | ~492 | +370 (incl. adm3 fallback) |
| Sondages avec maille_code | ~100 | **492** | +370 (spatial join EPSG:25231) |

### Distribution géographique (top régions)

| Région | Sondages |
|---|---|
| Maritime | 49 |
| Plateaux | 34 |
| Kara | 18 |
| Centrale | 10 |
| Savanes | 2 |
| (NULL — à géocoder) | 379 |

> **Note** : 379 sondages ont `adm1_name IS NULL` car le trigger `trg_sondage_geocode` appelle une MV sans index UNIQUE. À corriger via migration séparée (`CREATE UNIQUE INDEX ON atlas.mv_mailles_geotech(maille_code)`).

---

## 2. Paramètres géotechniques — Recensement complet

### Paramètres argilosité / plasticité (modèles KED-H, RK-SCORPAN)

| Paramètre | Unité | Total DB | Dont V10 | Horizons couverts |
|---|---|---|---|---|
| **VBS** (valeur au bleu de méthylène) | g/100g | 810 | 0 | H1/H2/H3 |
| **WL** (limite de liquidité) | % | 909 | **291** | H1/H2/H3 |
| **WP** (limite de plasticité) | % | 909 | **291** (dérivé WL-IP) | H1/H2/H3 |
| **IP** (indice de plasticité) | % | 892 | **291** | H1/H2/H3 |
| **EG** (essai de gonflement) | % | ~45 | 0 | H1/H2/H3 |

### Paramètres granulométrie

| Paramètre | Total DB | Dont V10 |
|---|---|---|
| Passant 2 mm | ~200 | ~200 |
| Passant 80 µm | ~200 | ~200 |

### Paramètres portance / compactage (NOUVEAUX V10)

| Paramètre | Unité | Total DB | Dont V10 | Modèle |
|---|---|---|---|---|
| **OPM gamma_d max** | kN/m³ | **292** | 292 | kriging KED / RK |
| **OPM w_opt** | % | 292 | 292 | kriging KED / RK |
| **CBR @ 95% Proctor** | % | **318** | 318 | kriging KED / RK |
| **CBR courbe complète** (55/25/12 coups) | % | **567** | 567 | catalogue multi-niveau |

### Paramètres in-situ (NOUVEAUX V10)

| Paramètre | Unité | Total DB | Dont V10 | Modèle |
|---|---|---|---|---|
| **Rd pénétromètre** | MPa | **411** | 411 | kriging KED / RK |
| **ELU pénétromètre** | MPa | ~400 | ~400 | dérivé Rd |
| **ELS pénétromètre** | MPa | ~400 | ~400 | dérivé Rd |
| **Em pressiomètre** | MPa | **26** | 26 | kriging KED (données insuffisantes) |
| **Pl pressiomètre** | MPa | 26 | 26 | kriging KED (données insuffisantes) |

### Paramètres classification sol

| Paramètre               | Total DB | Dont V10 |
| ----------------------- | -------- | -------- |
| Classe HRB              | 583      | **261**  |
| Indice de Groupe (IG)   | **261**  | 261      |
| Densité sèche naturelle | 71       | 29       |

---

## 3. Distribution horizons canoniques (h_canon)

| Horizon | Définition | Échantillons |
|---|---|---|
| **H1** | Centroïde 0–1.0 m | 566 (45.5%) |
| **H2** | Centroïde 1.0–1.5 m | 184 (14.8%) |
| **H3** | Centroïde > 1.5 m (incl. > 2 m) | 494 (39.7%) |

> Profondeurs > 2 m : **26 horizons** mappés en H3, profondeur réelle conservée dans `depth_z_max` pour audit.

---

## 4. État du pipeline géostatistique

### Jobs injectés dans `ai_job_queue` (2026-06-01)

| Modèle | Paramètres | Jobs |
|---|---|---|
| KED-H (run_ked) | vbs/ip/wl/wp/eg + rd_mpa/cbr_95/gamma_d (H1/H2/H3) | 27 |
| RK-SCORPAN (run_rk) | ip/wl/wp/rd_mpa/em_mpa/pl_mpa/cbr_95/gamma_d (H1/H2/H3) | 27 |
| Fusion BLUP (run_fusion) | vbs/ip/wl/wp/eg (H1/H2/H3) | 6 |
| VfS-PLS (run_vfs) | — | 0 (non applicable aux nouveaux paramètres) |
| MTGP/ICM (run_mtgp) | vbs/ip/wl/wp/eg (H1/H2/H3) | 0 (après KED/RK) |
| **Total** | | **60** |

### `ai_interpolation_runs` (2026-06-01 17:30)

| Métrique | Valeur |
|---|---|
| Runs avant import | 310 |
| Runs après import | 314 |
| Δ (pipeline en cours) | +4 (worker actif) |
| Valeurs interpolées | 6 399 738 (stable — recalcul en cours) |

---

## 5. Nouveaux paramètres dans `ai_parameter_catalog`

Ajoutés par migrations 176–178 :

| `parameter_id`         | Catégorie | Unité | Source                |
| ---------------------- | --------- | ----- | --------------------- |
| `rd_mpa_ked_h1/h2/h3`  | geotech   | MPa   | `essais_penetrometre` |
| `rd_mpa_rk_h1/h2/h3`   | geotech   | MPa   | `essais_penetrometre` |
| `em_mpa_ked_h1/h2/h3`  | geotech   | MPa   | `essais_pressiometre` |
| `em_mpa_rk_h1/h2/h3`   | geotech   | MPa   | `essais_pressiometre` |
| `pl_mpa_ked_h1/h2/h3`  | geotech   | MPa   | `essais_pressiometre` |
| `cbr_95_ked_h1/h2/h3`  | portance  | %     | `essais_cbr`          |
| `cbr_95_rk_h1/h2/h3`   | portance  | %     | `essais_cbr`          |
| `cbr_95_avg`           | portance  | %     | `essais_cbr`          |
| `gamma_d_ked_h1/h2/h3` | compacite | g/cm³ | `essais_proctor`      |

---

## 6. Points de vigilance — Données V10

### Valeurs aberrantes filtrées
- **OPM gamma_d** : 38 lignes avec `densite_seche_opm` hors plage physique [1.4–2.5 g/cm³].
  Les colonnes CSV `densite_seche_opm` et `teneur_eau_opt_opm` semblent inversées dans certains projets (ex: gamma_d=8.0, w_opt=2.25). Ces valeurs sont **signalées en warning** et non insérées dans `essais_proctor` (conservées dans les logs).

### Coordonnées
- **61** sondages avec coordonnées WGS84 valides (GPS terrain)
- **125** sondages convertis UTM31N → WGS84 via `ST_Transform(EPSG:32631→4326)`
- **209** sondages sans coordonnées → centroïde adm3 (localité déclarée) ou centroïde national Togo (1.0°E, 8.6°N) en fallback
  - `location_mode = 'estimated_adm3_centroid'` | `location_accuracy = 'low'`

### Trigger `trigger_refresh_mailles` désactivé
Ce trigger appelle `REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech` qui échoue faute d'index UNIQUE sur la MV. Il est **désactivé** pour éviter les erreurs silencieuses.

**Action requise** (migration 179 proposée) :
```sql
CREATE UNIQUE INDEX IF NOT EXISTS mv_mailles_geotech_maille_code_idx
  ON atlas.mv_mailles_geotech (maille_code);
ALTER TABLE atlas.sondages ENABLE TRIGGER trigger_refresh_mailles;
```

---

## 7. Seed Dump — Contrat v2

| Propriété | Valeur |
|---|---|
| Fichier | `J:\atlas_backups\atlas_schema_only_20260601_160937.dump` |
| Taille | 2 328 257 357 bytes (2 220 MB) |
| SHA256 | `253b19209952978e0f9a53fefb6ceedf...` |
| Manifest | `data/db/backups/atlas_desktop_seed.dump.json` |
| Seed ID | `atlas-seed-20260601-966e51a` |
| Version | `2.0.0` (MINOR bump : nouvelles données + tables) |
| Migration max | 178 |

---

## 8. Prochaines étapes

1. **[ ] Migration 179** : `CREATE UNIQUE INDEX` sur `mv_mailles_geotech` + réactivation trigger
2. **[ ] Attendre fin pipeline** : 60 jobs → calculs KED/RK/Fusion pour tous les paramètres
3. **[ ] Recalculer ai_interpolation_values** : nouvelles valeurs CBR/Rd/Em par maille
4. **[ ] Mettre à jour les figures de l'article** (run `generate_figures.py` après pipeline)
5. **[ ] Rédiger article V2** avec nouvelles métriques (LOO-RMSE CBR, Rd, Em)
