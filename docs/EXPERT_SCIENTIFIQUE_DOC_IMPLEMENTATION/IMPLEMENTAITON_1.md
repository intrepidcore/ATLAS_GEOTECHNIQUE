
### 📁 Phase 1 : Restructuration de l'Arborescence (Sans recoder)

**Création de la nouvelle structure de dossiers**

- [ ] Créer le dossier `scripts/canonical/`
    
- [ ] Créer le dossier `scripts/validation/`
    
- [ ] Créer le dossier `scripts/features/`
    
- [ ] Créer le dossier `scripts/figures/`
    
- [ ] Créer le dossier `scripts/utils/`
    
- [ ] Créer le dossier `scripts/archive/`
    

**Déplacement et renommage des scripts de production (Canoniques)**

- [ ] Renommer `run_ked_vbs_ip_wl_wp_horizons.py` en `scripts/canonical/run_ked.py`
    
- [ ] Renommer `atlas_regression_kriging_terrain.py` en `scripts/canonical/run_rk.py`
    
- [ ] Renommer `ked_rk_fusion.py` en `scripts/canonical/run_blup_fusion.py`
    
- [ ] Renommer `mtgp_geotechnique.py` en `scripts/canonical/run_mtgp.py`
    
- [ ] Renommer `sgs_interpolation.py` en `scripts/canonical/run_sgs.py`
    
- [ ] Fusionner/Renommer `vfs_extract_spectral.py` et `train_catboost_export_onnx.py` en `scripts/canonical/run_vfs.py`
    

**Organisation des scripts annexes**

- [ ] Déplacer `validation_bloc_spatial.py`, `validation_picp.py` et `validation_stationnarite.py` dans `scripts/validation/`
    
- [ ] Déplacer `compute_climate_features.py` et `compute_dsm_features.py` dans `scripts/features/`
    
- [ ] Déplacer `generate_figures.py`, `gen_split_figures.py`, `generate_maps_l1_l4.py` et `generate_sgs_vfs_maps.py` dans `scripts/figures/`
    

**Nettoyage et Archivage (Doublons)**

- [ ] Archiver `atlas_regression_kriging.py` dans `scripts/archive/`
    
- [ ] Archiver `atlas_regression_kriging_v2.py` dans `scripts/archive/`
    
- [ ] Archiver `rk_eg_terrain.py` dans `scripts/archive/`
    
- [ ] Archiver `kriging_gp_global_interpolate.py` dans `scripts/archive/`
    
- [ ] Archiver `kriging_multi_param.py` dans `scripts/archive/`
    
- [ ] Archiver `kriging_queue_stratified_vbs_ip_gate.py` dans `scripts/archive/`
    
- [ ] Archiver `atlas_geostat_ml_pipeline.py` dans `scripts/archive/`
    
- [ ] Archiver (ou fusionner la logique dans KED) : `derive_ip_ked_from_wl_wp.py`, `derive_rga_from_ked_h2.py`, `derive_wl_wp_avg.py`
    

### 🔍 Phase 2 : Standardisation de la Traçabilité

**Traçabilité des calculs (Modèles)**

- [ ] S'assurer que le fichier `scripts/utils/_run_traceability.py` existe.
    
- [ ] Importer et utiliser `_run_traceability.py` dans les 6 scripts canoniques.
    
- [ ] Vérifier que le champ `meta.script` est correctement rempli dans la table `ai_interpolation_runs` pour chaque exécution.
    
- [ ] Vérifier que le champ `model_version` adopte le format `<script>-<git_hash>-<hp_hash>`.
    
- [ ] Vérifier que les champs `started_at` et `finished_at` ne sont plus `NULL`.
    

**Traçabilité des figures et cartes**

- [ ] Créer le nouvel utilitaire `scripts/utils/_figure_registry.py`.
    
- [ ] Créer la table allégée `ai_figure_runs` dans la base de données PostgreSQL.
    
- [ ] Intégrer l'enregistrement dans `ai_figure_runs` au sein des scripts du dossier `scripts/figures/`.
    

### ⚙️ Phase 3 : Pilotage via Registre Centralisé

- [ ] Créer le fichier `pipeline_registry.json` à la racine.
    
- [ ] Configurer la section `"models"` du JSON avec les métadonnées (id, level, script, endpoint_apigeo, params_supported, depends_on, runtime_min, etc.) pour KED, RK, BLUP, et SGS.
    
- [ ] Configurer la section `"figures"` du JSON (id, script, function, source_data, output).
    

### 🏗️ Phase 4 : Architecture API et Flux Asynchrone

**Répartition de la charge (`api-geo` vs `api-infer`)**

- [ ] Câbler les calculs immédiats (< 1s, ex: BLUP, variogramme empirique + LOO Rust) directement dans `api-geo` (Rust).
    
- [ ] Isoler la charge CPU lourde (KED, RK, MTGP, SGS, bloc-CV) vers `api-infer` (Python).
    

**Flux et Parallélisation**

- [ ] Mettre en place le flux cible : `UI → api-geo → ai_job_queue (PG) → worker tokio → api-infer → Python → DB → WebSocket`.
    
- [ ] Configurer le worker Tokio pour paralléliser l'exécution des requêtes (ex: 15 runs KED/RK en parallèle pour réduire le temps de 45 min à ~5 min).
    

### 🖥️ Phase 5 : Branchement de l'Onglet "Expert Scientifique"

- [ ] Créer un script d'import (ou une migration SQL) pour peupler la table `atlas.ai_parameter_catalog` à partir de `pipeline_registry.json`.
    
- [ ] Vérifier que l'interface lit correctement le catalogue `atlas.ai_parameter_catalog`.
    
- [ ] Vérifier que l'interface affiche correctement les données issues de `ai_job_queue`, `ai_interpolation_runs` et `ai_variograms`.


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