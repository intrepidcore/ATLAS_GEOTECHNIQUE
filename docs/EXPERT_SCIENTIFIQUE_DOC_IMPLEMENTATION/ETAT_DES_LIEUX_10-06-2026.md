Trouvé : `services/api-geo`, `services/api-infer`, `services/api-opti`. Lire leurs sources + chercher docs microservices + refonte :

Maintenant lire le contenu clé : api-infer/main.rs, ai_infer.rs dans api-geo, ARCHITECTURE, et docs refonte :

---

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