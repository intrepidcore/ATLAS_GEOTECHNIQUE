# Architecture — Frontière api-geo / api-infer
## Décisions d'architecture ML-backend — Atlas Géotechnique Togo

**Date** : 2026-06-07  
**Décidé par** : Claude Sonnet 4.7 (IA) / Serge TABE DJATO  
**Statut** : Architecture cible v2.0

---

## 1. État actuel — Deux services avec frontière floue

### api-geo (port 8000 — public)
```
Responsabilités actuelles :
  ✅ Authentification JWT (users, sessions, roles)
  ✅ Gestion sondages (CRUD, géocodage, suggestions)
  ✅ Cartographie (mailles, ADM, layers, thematic)
  ✅ Import de données (wizard, bulk)
  ✅ Export (formats, jobs)
  ✅ Orchestration ML via subprocess Python :
       KED-HIER   → run_ked_vbs_ip_wl_wp_horizons.py
       RK SCORPAN → atlas_regression_kriging_terrain.py
       BLUP Fusion → ked_rk_fusion.py (Python) ou blup_fusion.rs (Rust)
       MTGP       → mtgp_geotechnique.py
  ✅ Job queue (ai_job_queue)
  ✅ Variogramme, EDA, infer_runs tracking
```

### api-infer (port 8010 — interne, token X-Internal-Token)
```
Responsabilités actuelles :
  - /internal/kriging/recompute     → kriging_gp_global_interpolate.py
  - /internal/supervised/train      → supervised_rga_train_infer.py
  - /internal/infer/maille          → onnx_maille_infer.py (ONNX par maille)
```

**Problème** : api-infer est sous-utilisé et sa frontière avec api-geo est imprécise. Les deux orchestrent des scripts Python. api-infer est isolé pour protéger la façade principale de la charge CPU heavy.

---

## 2. Frontière cible — Décision architecturale

### RÈGLE FONDAMENTALE
```
api-geo  = FAÇADE UTILISATEUR + DONNÉES + ORCHESTRATION LÉGÈRE
api-infer = CALCUL LOURD INTERNE (non exposé)
```

| Catégorie | Service | Justification |
|-----------|---------|---------------|
| CRUD sondages / géocodage | **api-geo** | User-facing, temps réel |
| Cartographie / layers | **api-geo** | User-facing, temps réel |
| Import / Export | **api-geo** | User-facing |
| BLUP Fusion (Rust, < 1s) | **api-geo** | Calcul immédiat en Rust |
| KED-HIER (Python, 2-5 min) | **api-infer** | Charge CPU isolée |
| RK SCORPAN (Python, 2-5 min) | **api-infer** | Charge CPU isolée |
| MTGP (Python/GPU, 15-60 min) | **api-infer** | Charge GPU isolée |
| ONNX inference (Python, < 1s/maille) | **api-infer** | Déjà là |
| Variogramme/EDA | **api-infer** | Calcul moyen |
| Validation par blocs (Python, 10 min) | **api-infer** | Nouveau |
| SGS (Python/gstools, 10-30 min) | **api-infer** | Nouveau |

### Flux d'orchestration cible

```
UI → api-geo [JWT]
       ↓ POST /ai/jobs/enqueue
   ai_job_queue (PostgreSQL)
       ↓ worker tokio (api-geo)
   api-infer [X-Internal-Token]
       ↓
   Python script (KED, RK, MTGP, SGS, bloc-CV)
       ↓
   PostgreSQL 5433 (résultats)
       ↓ webhook
   api-geo notifie UI via WebSocket
```

---

## 3. Ce qui peut être Rust dans api-geo — Gain de performance

### 3.1 DÉJÀ en Rust (actif ou à redéployer)

| Composant | Fichier | Status | Gain |
|-----------|---------|--------|------|
| BLUP Fusion bayésienne | `blup_fusion.rs` + rayon | ✅ Actif (post-fix UNNEST) | 29 407 mailles en < 500ms |
| Déduplication résultats | `surveys_unified.rs` | ✅ | — |

### 3.2 À IMPLÉMENTER EN RUST (priorité haute)

#### A. Variogramme empirique expérimental (rayon parallelism)

**Justification** : Le variogramme empirique calcule N×(N-1)/2 distances et γ(h) paires. Pour N=300 sondages → 44 850 paires. En Python séquentiel : 3-5 secondes. En Rust + rayon : < 50ms.

```rust
// services/api-geo/src/variogram.rs
use rayon::prelude::*;

pub fn compute_empirical_variogram(
    coords: &[(f64, f64)],  // (lon, lat) des sondages
    values: &[f64],
    n_lags: usize,
    lag_size: f64,          // en km
) -> Vec<VariogramPoint> {
    let n = coords.len();
    let pairs: Vec<(f64, f64)> = (0..n).into_par_iter()
        .flat_map(|i| {
            (i+1..n).map(|j| {
                let dist_km = haversine_km(coords[i], coords[j]);
                let gamma = 0.5 * (values[i] - values[j]).powi(2);
                (dist_km, gamma)
            }).collect::<Vec<_>>()
        }).collect();

    // Agréger par lag
    let mut lags = vec![(0_f64, 0_f64, 0_usize); n_lags];
    for (dist, gamma) in &pairs {
        let lag_idx = (*dist / lag_size).floor() as usize;
        if lag_idx < n_lags {
            lags[lag_idx].0 += dist;
            lags[lag_idx].1 += gamma;
            lags[lag_idx].2 += 1;
        }
    }
    // Retourner (h_moyen, gamma_moyen, n_paires)
    lags.into_iter().enumerate()
        .filter(|(_, (_, _, n))| *n > 0)
        .map(|(i, (sum_h, sum_g, n))| VariogramPoint {
            lag: sum_h / n as f64,
            gamma: sum_g / n as f64,
            n_pairs: n,
        })
        .collect()
}
```

**Endpoint** : `POST /ai/variogram/compute` — accepte les points d'entraînement, retourne le variogramme empirique JSON.

---

#### B. LOO-CV statistiques de base (rayon)

Le calcul des métriques LOO (RMSE, MAE, biais) est trivial en Rust. Le krigeage lui-même reste Python, mais la boucle LOO et les statistiques peuvent être Rust.

```rust
pub fn compute_loo_metrics(
    observations: &[f64],
    predictions: &[f64],
) -> LooMetrics {
    let n = observations.len() as f64;
    let pairs: Vec<_> = observations.iter().zip(predictions.iter()).collect();
    
    let mse: f64 = pairs.par_iter()
        .map(|(&obs, &pred)| (obs - pred).powi(2))
        .sum::<f64>() / n;
    
    let mae: f64 = pairs.par_iter()
        .map(|(&obs, &pred)| (obs - pred).abs())
        .sum::<f64>() / n;
    
    let bias: f64 = pairs.par_iter()
        .map(|(&obs, &pred)| pred - obs)
        .sum::<f64>() / n;
    
    LooMetrics { rmse: mse.sqrt(), mae, bias, n: n as usize }
}
```

---

#### C. Statistiques par maille (agrégation rapide)

Pour chaque maille, calculer mean/variance/percentiles sur les N réalisations SGS :

```rust
// POST /ai/sgs/aggregate — agrège les réalisations SGS en P10/P50/P90
pub async fn aggregate_sgs_realizations(
    pool: &PgPool,
    parameter_id: &str,
    n_realizations: usize,
) -> Vec<MailleStat> {
    // Charger les N réalisations depuis ai_sgs_simulations
    // Calculer P10/P50/P90 par maille avec rayon::par_iter
    // Stocker dans ai_interpolation_values avec method='sgs_p50'
}
```

---

#### D. Validation par blocs — extraction données (Rust) + krigeage (Python)

La partie lente du bloc-CV est l'extraction des données et l'organisation des folds. En Rust, on peut :
1. Charger tous les sondages avec coordonnées et valeurs depuis DB
2. Assigner chaque sondage à son bloc (lat_min, lat_max)
3. Écrire les jeux train/test comme JSON
4. Python fait le krigeage
5. Rust calcule les métriques finales

```rust
// POST /ai/validation/bloc-cv/prepare
// Prépare les 5 blocs et retourne les indices train/test
pub async fn prepare_bloc_cv(
    pool: &PgPool,
    param: &str,
    horizon: &str,
    n_blocs: usize,
) -> Vec<BlocCVFold>
```

---

### 3.3 À GARDER EN PYTHON

| Composant | Raison |
|-----------|--------|
| Krigeage (PyKrige) | Bibliothèque mature, optimisée, variogramme fitting inclus |
| Ridge SCORPAN (sklearn) | Régularisation + CV intégrés |
| MTGP (GPflow) | GPU natif, backend TensorFlow |
| SGS (gstools) | Simulation stochastique complexe |
| Validation par blocs — krigeage lui-même | Python PyKrige |

---

## 4. SGS — Simulation Séquentielle Gaussienne

### 4.1 Pourquoi ajouter SGS

Le krigeage produit l'espérance conditionnelle E[Z(x)|data] — **smooth, sous-estime les extrêmes**.  
SGS produit des réalisations équiprobables qui **reproduisent la variabilité et la distribution**.

| | Krigeage | SGS |
|--|---------|-----|
| Sortie | Valeur unique (moyenne) | N réalisations (typiquement 50-100) |
| Distribution | Lisse, sous-estime pics | Reproduit l'histogramme |
| Intervalles | Gaussiens (faux si skewness > 1) | Non-paramétriques (vrais P10/P90) |
| Coût calcul | Faible | N × krigeage |
| Pertinence VBS | Mauvais (skewness 2.41) | ✅ Idéal |
| Pertinence CBR | Mauvais (range 0-132%) | ✅ Idéal |
| Pertinence γd | OK (distribution normale) | 🟡 Optionnel |

### 4.2 Implémentation proposée

```python
# scripts/sgs_interpolation.py
import gstools as gs
import numpy as np
import psycopg2

def run_sgs(
    param: str,          # 'vbs', 'cbr_95'
    horizon: str,        # 'H1', 'H2', 'H3'
    n_realizations: int, # 50 minimum
    seed_base: int = 42,
    log_transform: bool = True,  # True pour VBS et CBR (asymétriques)
):
    """
    Simulation Séquentielle Gaussienne pour un paramètre/horizon.
    
    Workflow :
    1. Charger sondages (lon, lat, valeur) depuis DB
    2. Log-transform si nécessaire (pour normaliser la distribution)
    3. Fitter le variogramme (Spherical ou Matérn)
    4. Générer N réalisations SRF avec gstools
    5. Back-transform si nécessaire
    6. Stocker P10/P50/P90 dans atlas.ai_interpolation_values
       avec method='sgs_p50' / 'sgs_p10' / 'sgs_p90'
    7. Stocker la matrice des réalisations dans atlas.ai_sgs_simulations
    """
    # Charger données
    with psycopg2.connect(DB_URL) as conn:
        train = load_training_points(conn, param, horizon)
    
    x = np.array([r[0] for r in train])
    y = np.array([r[1] for r in train])
    v = np.array([r[2] for r in train])
    
    # Log-transform
    if log_transform:
        v_tf = np.log1p(v)
    else:
        v_tf = v.copy()
    
    # Variogramme
    bin_edges = np.linspace(0, 300_000, 20)  # 300 km max, 20 lags
    bin_center, gamma = gs.vario_estimate((x, y), v_tf, bin_edges)
    model = gs.Spherical(dim=2)
    model.fit_variogram(bin_center, gamma)
    
    # Krigeage ordinaire conditionnel (base pour SGS)
    krige = gs.krige.Ordinary(model, cond_pos=(x, y), cond_val=v_tf)
    
    # Grille 29407 mailles
    grid_x, grid_y = load_grid_coords()
    
    # N réalisations SGS
    srf = gs.SRF(model, generator='VectorField')
    realizations = []
    for i in range(n_realizations):
        field = srf((grid_x, grid_y), seed=seed_base + i)
        # Conditionner sur les données observées
        field_cond = krige.field + field - krige.field  # Conditioning trick
        if log_transform:
            field_cond = np.expm1(field_cond)
        realizations.append(field_cond)
    
    # Statistiques
    stack = np.array(realizations)
    p10 = np.percentile(stack, 10, axis=0)
    p50 = np.percentile(stack, 50, axis=0)
    p90 = np.percentile(stack, 90, axis=0)
    
    # Stocker P10/P50/P90 comme 3 entrées dans ai_interpolation_values
    store_sgs_results(conn, param, horizon, p10, p50, p90, n_realizations)

```

### 4.3 Endpoint api-infer pour SGS

```rust
// À ajouter dans api-infer/src/main.rs
async fn sgs_compute(Json(body): Json<SgsRequest>) -> Result<Json<Value>, ...> {
    let script = script_path("sgs_interpolation.py");
    let args = vec![
        script,
        "--param".into(), body.param,
        "--horizon".into(), body.horizon,
        "--n-realizations".into(), body.n_realizations.to_string(),
        "--database-url".into(), db_url,
    ];
    tokio::task::spawn_blocking(move || run_python_json(&args)).await...
}

// Route : POST /internal/sgs/compute
```

---

## 5. Multithreading — Stratégie rayon + tokio

### Actuel : séquentiel
```
KED vbs H1 → KED vbs H2 → KED vbs H3 → KED ip H1 → ... (15 appels séquentiels)
```

### Cible : parallèle avec pool de connexions limité

```rust
// Dans api-infer : exécuter N scripts Python en parallèle via tokio::spawn
use futures::future::join_all;

async fn ked_recompute_all_parallel(
    params: Vec<&str>,
    horizons: Vec<&str>,
) -> Vec<Result<Value, String>> {
    let tasks: Vec<_> = params.iter()
        .flat_map(|param| horizons.iter().map(move |hz| (*param, *hz)))
        .map(|(param, hz)| {
            let args = build_ked_args(param, hz);
            tokio::task::spawn_blocking(move || run_python_json(&args))
        })
        .collect();
    
    join_all(tasks).await
        .into_iter()
        .map(|r| r.unwrap_or_else(|e| Err(e.to_string())))
        .collect()
}
// → Parallélise 5 params × 3 horizons = 15 runs simultanés
// → Gain estimé : 15×3min séquentiel = 45 min → ~5 min parallèle (CPU-bound)
```

**Contrainte** : limiter à `min(N_cores, N_params_horizons)` threads simultanés.  
Sur votre machine (AMD Ryzen 5 / Intel Core, 8-12 cœurs) : max 8 simultanés.

```rust
// Semaphore pour limiter la parallelism
let semaphore = Arc::new(Semaphore::new(8)); // max 8 Python process simultanés
```

---

## 6. Résumé des actions techniques

| # | Action | Fichier | Effort | Gain |
|---|--------|---------|--------|------|
| R1 | Variogramme empirique Rust + rayon | `api-geo/src/variogram.rs` (nouveau) | 2j | 60x speedup |
| R2 | LOO métriques Rust | `api-geo/src/loo_metrics.rs` (nouveau) | 0.5j | marginal |
| R3 | BLUP Fusion — redéployer fix UNNEST | `api-geo/src/blup_fusion.rs` | ✅ Fait | < 1s |
| I1 | SGS endpoint api-infer | `api-infer/src/main.rs` | 0.5j | nouveau |
| I2 | Parallélisme 15 KED/RK en tokio | `api-infer/src/main.rs` | 1j | 45min → 5min |
| I3 | Bloc-CV endpoint api-infer | `api-infer/src/main.rs` | 0.5j | nouveau |
| P1 | `scripts/sgs_interpolation.py` | `scripts/` | 2j | nouveau |
| P2 | `scripts/validation_bloc_spatial.py` | `scripts/` | 1j | nouveau |
| P3 | Étendre RK pour cbr_95, gamma_d, w_opt | `scripts/atlas_regression_kriging_terrain.py` | 1j | fusion BLUP possible |

---

*Document créé le 2026-06-07*  
*Frontière api-geo/api-infer décidée et documentée — Architecture v2.0*
