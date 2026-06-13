## 1. Scripts prédiction + artefacts carte/figure

### L1 — KED-H (Krigeage Externe Hiérarchique)

|Script|Rôle|
|---|---|
|`scripts/run_ked_vbs_ip_wl_wp_horizons.py`|KED VBS/IP/WL/WP H1-H3 → DB|
|`scripts/run_ked_eg_horizons.py`|KED EG (potentiel gonflement)|
|`scripts/run_ked_granulo_horizons.py`|KED granulo (passant 2mm, 80µm)|
|`scripts/run_ked_new_params_horizons.py`|KED CBR/γd/wopt/Rd/Em/Pl|
|`scripts/kriging_gp_global_interpolate.py`|kriging GP global (déclenché par api-infer)|
|`scripts/kriging_multi_param.py`|kriging multi-paramètre|
|`scripts/kriging_queue_stratified_vbs_ip_gate.py`|kriging stratifié + queue|

### L2a — RK-SCORPAN

|Script|Rôle|
|---|---|
|`scripts/atlas_regression_kriging.py`|RK SCORPAN principal|
|`scripts/atlas_regression_kriging_v2.py`|v2 améliorée|
|`scripts/atlas_regression_kriging_terrain.py`|variante terrain|
|`scripts/atlas_geostat_ml_pipeline.py`|pipeline geostat ML complet|
|`scripts/atlas_compute_scorpan_features.py`|features SCORPAN|
|`scripts/compute_loo_cv_rk.py`|LOO-CV pour RK|
|`scripts/rk_eg_terrain.py`|RK EG terrain|

### L2b — Fusion BLUP

|Script/Fichier|Rôle|
|---|---|
|`scripts/ked_rk_fusion.py`|fusion Python (prod)|
|`services/api-geo/src/blup_fusion.rs`|⚠️ fusion Rust `rayon::par_iter` **dans api-geo**|

### L3 — VfS-PLS + CatBoost

|Script|Rôle|
|---|---|
|`scripts/vfs_extract_spectral.py`|extraction Sentinel-2|
|`scripts/train_catboost_export_onnx.py`|entraîne CatBoost → ONNX|
|`scripts/onnx_maille_infer.py`|inférence ONNX par maille (via api-infer)|

### L4 — MTGP/ICM

|Script|Rôle|
|---|---|
|`scripts/mtgp_geotechnique.py`|MTGP GPflow|
|`scripts/compute_mtgp_loo_update.py`|mise à jour LOO MTGP|
|`scripts/inject_mtgp_fusion_new_params.py`|injection résultats en DB|

### L5 — SGS

|Script|Rôle|
|---|---|
|`scripts/sgs_interpolation.py`|simulation géostatistique séquentielle|

### ML supervisé RGA (via api-infer)

|Script|Rôle|
|---|---|
|`scripts/supervised_rga_train_infer.py`|sklearn/GB → classification RGA|

### Dérivations + features

```
scripts/derive_ip_ked_from_wl_wp.py
scripts/derive_rga_from_ked_h2.py
scripts/derive_wl_wp_avg.py
scripts/compute_climate_features.py
scripts/compute_dsm_features.py
scripts/compute_worldclim_real.py
```

### Validation

```
scripts/validation_bloc_spatial.py
scripts/validation_picp.py
scripts/validation_stationnarite.py
scripts/snapshot_rmse_traceability.py
```

### Runners globaux

```
scripts/run_all_models_nightly.py / _v2.py
scripts/pipeline_worker.py
```

### Génération cartes/figures

|Script|Rôle|
|---|---|
|`docs/RECHERCHE/.../generate_figures.py`|1933 lignes — toutes figures article|
|`docs/RECHERCHE/.../gen_split_figures.py`|fig15, fig20-22 PNG|
|`docs/RECHERCHE/.../regen_maps_figures.py`|régénération cartes article|
|`scripts/generate_maps_300dpi.py`|cartes 300 dpi export|
|`scripts/generate_maps_l1_l4.py`|cartes L1→L4 par paramètre|
|`scripts/generate_sgs_vfs_maps.py`|cartes SGS + VfS|
|`scripts/generate_article_figures.py`|figures (version scripts/)|
|`scripts/generate_3d_exports.py` / `render_3d_archetypes.py`|exports 3D|
|`scripts/generate_variogram_plot.py`|plots variogrammes|
|`scripts/generate_national_graphs.py` / `generate_national_analysis.py`|stats nationales|
|`scripts/headless_render_300dpi.py`|rendu headless matplotlib|
|`qgis_worker/src/worker.py`|rendu QGIS headless|

### Dans api-geo (Rust) — côté orchestration

```
services/api-geo/src/ai_infer.rs    → façade infer + rule-based fallback
services/api-geo/src/ai_jobs.rs     → queue jobs ML
services/api-geo/src/ai_opti.rs     → interface api-opti
services/api-geo/src/ai_plots.rs    → plots variogrammes
services/api-geo/src/ai_stats.rs    → stats ML
services/api-geo/src/blup_fusion.rs → fusion BLUP Rust
services/api-geo/src/thematic/      → distribution cartes thématiques
```

---

## 2. Limite microservices — respectée ?

**Principe documenté** (`ROADMAP_KRIGING_IA.md`) :

```
api-geo   → façade métier/carto/auth  (ZÉRO CPU intensif)
api-infer → training/inference Python (charge CPU isolée)
api-opti  → optimisation planification
```

**Bilan :**

|Élément|Où|Attendu|Statut|
|---|---|---|---|
|`blup_fusion.rs` — rayon 29 407 mailles|`api-geo`|`api-infer`|❌ violation|
|`build_prediction()` rule-based|`api-geo/ai_infer.rs`|`api-infer`|❌ violation (même si fallback)|
|`ai_jobs.rs` — spawn `python` via `Command::new`|`api-geo`|border|⚠️ borderline|
|`prediction_with_ml_fallback()` → HTTP vers api-infer|`api-geo`|pattern correct|✅|
|kriging/onnx/supervised déclenché via subprocess|`api-infer`|ici|✅|

**Violation principale** : `blup_fusion.rs` fait du calcul intensif (Rayon par_iter) **dans la façade api-geo**, contrairement à l'ADR. La fusion BLUP était en Python (`ked_rk_fusion.py`) mais a été réimplémentée en Rust directement dans api-geo sans être extraite vers api-infer.

---

## 3. Doc "expert scientifique" / branchement

**Trouvée** : `docs/ROADMAP/roadmap_03_04_2026.md` — **AXE 3**

> **"DB Manager — onglet expert scientifique + migration ai_job_queue"** (~1 session, Priorité 3)

Décrit le **branchement d'un onglet expert** dans `DbManagerModalComponent.ts` avec 4 sous-sections :

- **T3.2-b** : Catalog paramètres (`atlas.ai_parameter_catalog`)
- **T3.2-c** : File de jobs (`atlas.ai_job_queue`) + bouton "Déclencher un job" → `POST /ai/jobs/run-once`
- **T3.2-d** : Cache graphiques (`atlas.ai_plot_cache`) + bouton "Vider le cache"
- **T3.2-e** : Tableau LOO RMSE (`atlas.ai_variograms`) exportable CSV

`roadmap_25_04_2026.md` confirme que l'onglet a été **partiellement implémenté** (`<TabsContent value="expert-scientifique">` existe dans le code UI avec `ExpertScientificDbTab`) mais avait un bug FloatablePanel + blanc CSS.

**État** : onglet UI existant, backend partiellement branché (T3.1 migration `ai_job_queue` en attente selon le plan).

Docs récents (7 derniers jours) clés identifiés. Lecture en parallèle des plus pertinents + query DB last run :

---

## 1. Scripts canoniques confirmés par DB (qui a peuplé le dernier run)

La DB `ai_interpolation_runs.meta.script` révèle :

|Niveau|Script canonique (utilisé)|Dernière exécution|
|---|---|---|
|**L1 KED**|`run_ked_vbs_ip_wl_wp_horizons.py`|2026-06-07|
|**L2a RK**|`atlas_regression_kriging_terrain.py`|2026-06-07|
|**L2b BLUP**|`ked_rk_fusion.py` (Python)|2026-06-07|
|**L4 MTGP**|`mtgp_geotechnique.py`|2026-06-05|
|**L5 SGS**|`sgs_interpolation.py`|2026-06-07|

**Problème traçabilité** : `started_at`, `finished_at`, `model_version` = NULL pour la majorité des runs. Le `meta` est vide (`{}`) sur les anciens. Seuls les runs récents (depuis ~juin) ont `meta.script` renseigné.

**Scripts doublons confirmés à archiver** :

|Doublon(s)|Canonique|Action|
|---|---|---|
|`atlas_regression_kriging.py`, `atlas_regression_kriging_v2.py`|`atlas_regression_kriging_terrain.py`|archiver|
|`rk_eg_terrain.py`|intégré dans `atlas_regression_kriging_terrain.py`|archiver|
|`kriging_gp_global_interpolate.py`, `kriging_multi_param.py`, `kriging_queue_stratified_vbs_ip_gate.py`, `atlas_geostat_ml_pipeline.py`|`run_ked_vbs_ip_wl_wp_horizons.py`|archiver|
|`derive_ip_ked_from_wl_wp.py`, `derive_rga_from_ked_h2.py`, `derive_wl_wp_avg.py`|logique déjà dans KED script|archiver ou merger|

**Figures/cartes** : aucune traçabilité DB pour elles. Pas de table `ai_figure_runs`. Git log seul ne suffit pas non plus car pas de commit systématique.

---

## 2. Docs récents (7 derniers jours) — ce qu'ils disent

### `ARCHITECTURE_API_GEO_INFER_FRONTIERE.md` _(2026-06-07 — le plus important)_

Décision formelle de la frontière api-geo/api-infer :

- **BLUP Rust dans api-geo = OK** (< 1s, calcul immédiat)
- **KED/RK/MTGP/SGS/bloc-CV → api-infer** (charge CPU isolée)
- Flux cible : `UI → api-geo → ai_job_queue (PG) → worker tokio → api-infer → Python → DB → WebSocket`
- Propose R1/R2 : variogramme empirique + LOO métriques en Rust (rayon, ~60× speedup)
- Propose I2 : 15 runs KED/RK en parallèle tokio → 45min → ~5min

### `ARCHITECTURE_PIPELINE_ML.md` _(récent)_

- Table `ai_interpolation_runs` avec `meta.script` = source de vérité
- Champ `model_version` = `<script>-<git_hash>-<hp_hash>` (pas encore rempli partout)
- Utilitaire `scripts/utils/_run_traceability.py` → doit être importé dans **tous** les scripts
- Confirme ordre dépendances : KED → RK → BLUP (SGS/MTGP/VfS indépendants)
- État au 2026-06-05 : SGS = "relancer sgs_interpolation.py" (mais DB montre qu'il a tourné le 07)

### `session_2026_06_07.md`

Session qui a créé les 5 nouveaux scripts :

- `validation_bloc_spatial.py` (A1)
- `validation_picp.py` (A2)
- `validation_stationnarite.py` (A8)
- `sgs_interpolation.py` (P1)
- Extension RK aux paramètres portance
- Vue matérialisée `atlas.v_contexte_geologique` (5 niveaux hiérarchiques)

### `RAPPORT D'AUDIT Article vs DB (run production 07-juin 2026.md`

C'est l'audit complet article↔DB utilisé pour les corrections main.tex. Documente les sources de chaque valeur numérique. Confirme que les scripts canoniques ci-dessus ont produit les valeurs de référence.

---

## 3. Proposition d'organisation — sans trop recoder

### Structure cible

```
scripts/
  canonical/              ← scripts de production (1 par niveau)
    run_ked.py            ← renommé depuis run_ked_vbs_ip_wl_wp_horizons.py
    run_rk.py             ← atlas_regression_kriging_terrain.py
    run_blup_fusion.py    ← ked_rk_fusion.py
    run_mtgp.py           ← mtgp_geotechnique.py
    run_sgs.py            ← sgs_interpolation.py
    run_vfs.py            ← vfs_extract_spectral.py + train_catboost_export_onnx.py
  validation/
    validation_bloc_spatial.py   (déjà propre)
    validation_picp.py           (déjà propre)
    validation_stationnarite.py  (déjà propre)
  features/
    compute_climate_features.py
    compute_dsm_features.py
  figures/
    generate_figures.py          (article)
    gen_split_figures.py         (article split)
    generate_maps_l1_l4.py       (cartes production)
    generate_sgs_vfs_maps.py
  utils/
    _run_traceability.py         (déjà là — à imposer partout)
    _figure_registry.py          ← NOUVEAU (voir ci-dessous)
  archive/                       ← tous les doublons
    atlas_regression_kriging.py
    atlas_regression_kriging_v2.py
    kriging_gp_global_interpolate.py
    ...
```

### Pilote sans recoder — `pipeline_registry.json`

Créer **un seul fichier JSON** de registre. Aucun recode des scripts :

```json
{
  "models": [
    {
      "id": "ked_hierarchical",
      "level": "L1",
      "script": "canonical/run_ked.py",
      "endpoint_apigeo": "POST /ai/ked/recompute",
      "params_supported": ["vbs","ip","wl","wp","eg","cbr_95","gamma_d"],
      "horizons": ["H1","H2","H3"],
      "runtime_min": 5,
      "requires_gpu": false,
      "ai_job_type": "ked_recompute"
    },
    {
      "id": "rk_scorpan",
      "level": "L2a",
      "script": "canonical/run_rk.py",
      "endpoint_apigeo": "POST /ai/rk/recompute",
      "params_supported": ["vbs","ip","wl","wp","eg","cbr_95","gamma_d","w_opt"],
      "runtime_min": 5
    },
    {
      "id": "blup_fusion",
      "level": "L2b",
      "script": "canonical/run_blup_fusion.py",
      "endpoint_apigeo": "POST /ai/fusion/run",
      "depends_on": ["ked_hierarchical","rk_scorpan"],
      "runtime_min": 1
    },
    {
      "id": "sgs",
      "level": "L5",
      "script": "canonical/run_sgs.py",
      "endpoint_apigeo": "POST /ai/jobs/enqueue",
      "depends_on": ["ked_hierarchical"],
      "runtime_min": 30
    }
  ],
  "figures": [
    {
      "id": "fig06_loo_scatter_vbs",
      "script": "figures/generate_figures.py",
      "function": "fig06_loo_scatter_vbs",
      "source_data": "ai_interpolation_values WHERE parameter_id='vbs_ked_h1'",
      "output": "figures/fig06_loo_scatter_vbs.pdf"
    }
  ]
}
```

### Branchement onglet expert scientifique

Déjà documenté dans `roadmap_03_04_2026.md` (T3.2). Le registre JSON devient le **catalogue `atlas.ai_parameter_catalog`** que l'onglet lit. Il suffit de :

1. **Peupler `atlas.ai_parameter_catalog`** depuis le JSON (une migration SQL ou script d'import)
2. **Imposer `_run_traceability.py`** dans les 6 scripts canoniques → `meta.script` renseigné partout
3. **Ajouter `ai_figure_runs`** (table légère) dans les scripts figures → traçabilité équivalente
4. L'onglet expert lit déjà `ai_job_queue` + `ai_interpolation_runs` + `ai_variograms` → **tout est déjà câblé côté backend, manque juste la cohérence des scripts**

**Aucun recode** des scripts de calcul. Seul travail : renommage/déplacement, ajout `_run_traceability.py` import, et création du JSON registre.