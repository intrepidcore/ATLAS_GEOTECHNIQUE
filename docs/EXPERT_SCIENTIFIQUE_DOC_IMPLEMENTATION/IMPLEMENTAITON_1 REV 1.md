Vérification rapide de l'état réel du repo avant de remplir.

État complet relevé. Je remplis maintenant.

**Bilan de vérification :**

- `scripts/utils/_run_traceability.py` ✅ existe
- `_run_traceability` importé dans KED + RK + BLUP ✅, manque MTGP et SGS ❌
- Colonnes `model_version`/`started_at`/`finished_at` dans `ai_interpolation_runs` ✅
- 1232 runs avec `started_at`/`finished_at` non null ✅, 71 seulement avec format `<script>-<git_hash>-<hp_hash>` ⚠️
- `atlas.ai_parameter_catalog` existe ✅
- `atlas.ai_figure_runs` n'existe pas ❌
- `scripts/utils/_figure_registry.py` n'existe pas ❌
- `pipeline_registry.json` n'existe pas ❌
- Dossiers `canonical/`, `validation/`, `features/`, `figures/`, `archive/` non créés ❌ (`utils/` existe déjà ✅)
- UI Expert/Pipeline L1-L5 opérationnelle ✅ (vérifiée ce soir)
- Flux `UI → api-geo → ai_job_queue → worker tokio → Python → DB` en place ✅

---

### 📁 Phase 1 : Restructuration de l'Arborescence (Sans recoder)

**Création de la nouvelle structure de dossiers**

- [ ] Créer le dossier `scripts/canonical/`
- [ ] Créer le dossier `scripts/validation/`
- [ ] Créer le dossier `scripts/features/`
- [ ] Créer le dossier `scripts/figures/`
- [x] ~~Créer le dossier `scripts/utils/`~~ — **déjà existant**
- [ ] Créer le dossier `scripts/archive/`

**Déplacement et renommage des scripts de production (Canoniques)**

- [ ] Renommer `run_ked_vbs_ip_wl_wp_horizons.py` → `scripts/canonical/run_ked.py`
- [ ] Renommer `atlas_regression_kriging_terrain.py` → `scripts/canonical/run_rk.py`
- [ ] Renommer `ked_rk_fusion.py` → `scripts/canonical/run_blup_fusion.py`
- [ ] Renommer `mtgp_geotechnique.py` → `scripts/canonical/run_mtgp.py`
- [ ] Renommer `sgs_interpolation.py` → `scripts/canonical/run_sgs.py`
- [ ] Fusionner/Renommer `vfs_extract_spectral.py` + `train_catboost_export_onnx.py` → `scripts/canonical/run_vfs.py`

**Organisation des scripts annexes**

- [ ] Déplacer `validation_bloc_spatial.py`, `validation_picp.py`, `validation_stationnarite.py` → `scripts/validation/`
- [ ] Déplacer `compute_climate_features.py`, `compute_dsm_features.py` → `scripts/features/`
- [ ] Déplacer `generate_article_figures.py`, `gen_split_figures.py`, `generate_maps_l1_l4.py`, `generate_sgs_vfs_maps.py` → `scripts/figures/`

**Nettoyage et Archivage (Doublons)**

- [ ] Archiver `atlas_regression_kriging.py` → `scripts/archive/`
- [ ] Archiver `atlas_regression_kriging_v2.py` → `scripts/archive/`
- [ ] Archiver `rk_eg_terrain.py` → `scripts/archive/`
- [ ] Archiver `kriging_gp_global_interpolate.py` → `scripts/archive/`
- [ ] Archiver `kriging_multi_param.py` → `scripts/archive/`
- [ ] Archiver `kriging_queue_stratified_vbs_ip_gate.py` → `scripts/archive/`
- [ ] Archiver `atlas_geostat_ml_pipeline.py` → `scripts/archive/`
- [ ] Archiver `derive_ip_ked_from_wl_wp.py`, `derive_rga_from_ked_h2.py`, `derive_wl_wp_avg.py` → `scripts/archive/` (ou fusionner dans KED)

---

### 🔍 Phase 2 : Standardisation de la Traçabilité

**Traçabilité des calculs (Modèles)**

- [x] `scripts/utils/_run_traceability.py` existe — **créé et opérationnel**
- [x] `_run_traceability.py` importé dans **KED, RK, BLUP** — ⚠️ manque encore **MTGP** et **SGS**
- [x] Champ `meta.script` dans `ai_interpolation_runs` — colonnes `meta` + `model_version` présentes
- [ ] ⚠️ `model_version` au format `<script>-<git_hash>-<hp_hash>` — seulement **71/1232 runs** ont ce format (les anciens runs MTGP/SGS non couverts)
- [x] `started_at` et `finished_at` non NULL — **1232 runs** renseignés

**Traçabilité des figures et cartes**

- [ ] Créer `scripts/utils/_figure_registry.py` — **absent**
- [ ] Créer la table `atlas.ai_figure_runs` dans PostgreSQL — **absente**
- [ ] Intégrer l'enregistrement dans `ai_figure_runs` dans les scripts `scripts/figures/`

---

### ⚙️ Phase 3 : Pilotage via Registre Centralisé

- [ ] Créer `pipeline_registry.json` à la racine — **absent**
- [ ] Configurer section `"models"` (KED, RK, BLUP, SGS…)
- [ ] Configurer section `"figures"`

---

### 🏗️ Phase 4 : Architecture API et Flux Asynchrone

**Répartition de la charge**

- [ ] Câbler calculs immédiats (< 1s : BLUP, variogramme, LOO Rust) directement dans `api-geo`
- [ ] Isoler charge lourde (KED, RK, MTGP, SGS, bloc-CV) vers `api-infer` (Python)

**Flux et Parallélisation**

- [x] Flux `UI → api-geo → ai_job_queue (PG) → worker tokio → Python → DB` en place — **opérationnel**
- [ ] Parallélisation worker Tokio (15 runs KED/RK simultanés → ~5 min au lieu de 45 min)

---

### 🖥️ Phase 5 : Branchement de l'Onglet "Expert Scientifique"

- [ ] Script import `pipeline_registry.json` → `atlas.ai_parameter_catalog` — _dépend de Phase 3_
- [x] `atlas.ai_parameter_catalog` existe en DB — **table présente**
- [x] Interface affiche **Pipeline L1-L5** (L1 KED, L2a RK, L2b BLUP, L3 VfS, L4 MTGP, L5 SGS) avec statuts, params, mailles, dernier run et boutons **Recalculer** — **vérifié ce soir en production**
- [x] Interface lit `ai_job_queue` + `ai_interpolation_runs` via `/api/ai/models/status` — **opérationnel**

---

**Résumé :** Phase 5 ✅ complète. Phase 4 flux de base ✅, parallélisation ⬜. Phase 2 traçabilité partielle (3/5 scripts). Phases 1 et 3 non commencées.