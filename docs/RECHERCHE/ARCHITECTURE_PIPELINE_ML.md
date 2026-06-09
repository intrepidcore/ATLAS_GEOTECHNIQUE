# Architecture Pipeline ML — Atlas Géotechnique Togo
## Qui fait quoi : Python vs Rust, Traçabilité des runs

---

## 1. Cartographie des processus : Python vs Rust

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUÊTE HTTP (client)                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                 api-geo (Rust / Axum)                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Routeur HTTP (main.rs)                                  │   │
│  │  POST /ai/ked/recompute   → ai_opti::recompute_ked()     │   │
│  │  POST /ai/rk/recompute    → ai_opti::recompute_rk()  NEW │   │
│  │  POST /ai/fusion/run      → blup_fusion::run() ★NATIF    │   │
│  │  POST /ai/jobs/enqueue    → ai_jobs::enqueue_job()       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────── Rust natif ──────┐  ┌─── Rust → spawn Python ───┐    │
│  │ BLUP/fusion (rayon)     │  │ KED  → run_ked_*.py        │    │
│  │ Traitement parallèle    │  │ RK   → atlas_rk_terrain.py │    │
│  │ ~4× plus rapide Python  │  │ MTGP → mtgp_geotechnique.py│    │
│  └─────────────────────────┘  └────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              PostgreSQL (atlas.ai_interpolation_values)          │
│         + atlas.ai_interpolation_runs (traçabilité)              │
└─────────────────────────────────────────────────────────────────┘
```

### Détail par modèle

| Modèle | Langage | Endpoint | Parallélisme | GPU |
|--------|---------|----------|--------------|-----|
| **KED** (L1 — krigeage dérive externe) | Python (pykrige) | `POST /ai/ked/recompute` | 1 process/param×horizon | ✗ |
| **RK SCORPAN** (L2a — régression kriging) | Python (sklearn+pykrige) | `POST /ai/rk/recompute` | 15 threads parallèles (Rust) | ✗ |
| **BLUP/Fusion** (L2b — fusion KED⊕RK) | **Rust natif** (rayon) | `POST /ai/fusion/run` | Rayon par-iter ~4× Python | ✗ |
| **VfS** (L3 — spectral Sentinel-2, PLS) | Python (sklearn+GEE) | `POST /ai/jobs/enqueue` | 1 process (internet requis) | ✗ |
| **MTGP** (L4 — co-krigeage bayésien) | Python (gpflow+TF) | `POST /ai/jobs/enqueue` (queue) | 1 process GPU | ✅ RTX 2050 |
| **SGS** (L5 — simulation stochastique) | Python (gstools) | `POST /ai/jobs/enqueue` | 1 process CPU | ✗ |

### Pourquoi BLUP est Rust natif et pas les autres ?
BLUP est une **opération algébrique pure** (pondération inverse variance) sur des valeurs déjà en DB.
Rust avec `rayon` traite les 29 407 mailles en parallèle sans GIL.

KED et RK font du krigeage spatial avec variogramme et optimisation numérique — implémentés dans
`pykrige` (Python) sans équivalent Rust mature. Ce sont les scripts qui font le vrai travail.

---

## 2. Ordre logique d'exécution (dépendances)

```
KED  ──┐
       ├──→ [KED + RK terminés] ──→  BLUP/Fusion (L2b)
RK   ──┘

VfS  ──→ [L3 indépendant, requiert internet/GEE — VBS uniquement]

MTGP ──→ [L4 indépendant, GPU en parallèle de tout]

SGS  ──→ [L5 post-traitement incertitude : P10/P50/P90 depuis krigeage]
         (dépend de L1 KED-HIER pour les paramètres conditionnants)
```

**BLUP lit les résultats de KED et RK** depuis `ai_interpolation_values`
(colonnes `ked_pedologie_ked` et `regression_kriging_scorpan`).
Lancer BLUP avant KED+RK = fusion sur les anciennes valeurs.

**VfS (L3)** est indépendant de L1/L2 — il utilise des signatures spectrales Sentinel-2
(GEE) pour prédire VBS via PLS. Produit `vbs_vfs_pred` → utilisable comme feature SCORPAN.

**SGS (L5)** post-traite les prédictions KED-HIER (L1) pour générer 50 réalisations
stochastiques et calculer P10/P50/P90 par maille. Enrichit L1 sans remplacer L4.
Statut actuel : script créé, calcul VBS H1 à relancer (gstools 1.7.0 installé).

---

## 3. Traçabilité des runs : ce qui est enregistré

Chaque run écrit une ligne dans `atlas.ai_interpolation_runs` + les valeurs dans
`atlas.ai_interpolation_values` avec `is_superseded=false`.

### Champs clés dans `ai_interpolation_runs`

| Colonne | Contenu | Exemple |
|---------|---------|---------|
| `model_version` | `<script>-<git_hash>-<hp_hash>` | `ked-a3f2c1b-d4e8f123` |
| `status` | `finished` / `failed` / `running` | `finished` |
| `started_at` | Horodatage UTC début réel | `2026-06-05 09:11:35+00` |
| `finished_at` | Horodatage UTC fin réelle | `2026-06-05 09:22:33+00` |
| `metrics` | RMSE LOO-CV, R², n_train | `{"loo_rmse": 0.42, "n_train": 304}` |
| `meta` | Hyperparamètres + versions logicielles | voir ci-dessous |

### Structure du champ `meta` (jsonb)

```json
{
  "script": "run_ked_vbs_ip_wl_wp_horizons",
  "git_hash": "a3f2c1b",
  "hp_hash": "d4e8f123",
  "hyperparams": {
    "drift_method": "pedological_prior",
    "depth_m": 1.0,
    "param_kind": "vbs",
    "horizon_label": "h1"
  },
  "software": {
    "python": "3.11.2",
    "numpy": "1.24.3",
    "pykrige": "1.7.2",
    "sklearn": "1.3.2"
  },
  "started_at_utc": "2026-06-05T09:11:35.000Z",
  "finished_at_utc": "2026-06-05T09:22:33.000Z",
  "duration_sec": 658.2,
  "metrics": {
    "n_train": 112,
    "n_grid": 29407,
    "loo_rmse": 0.42
  }
}
```

### Versioning des valeurs (`is_superseded`)

```
Run 1 (mars 2026) : valeurs vbs_ked_h1 → is_superseded=false
           ↓ Nouveau run (juin 2026)
Run 2 (juin 2026) : anciennes valeurs → is_superseded=true
                    nouvelles valeurs → is_superseded=false

→ L'historique complet est conservé en DB.
→ Requête des valeurs actives : WHERE is_superseded=false
→ Requête historique run N    : WHERE run_id='...'
```

### Utilitaire partagé

Tous les scripts importent `scripts/utils/_run_traceability.py` :
- `build_version_tag(prefix, hyperparams)` → tag reproductible
- `make_run_meta(script, hyperparams, metrics, t_start)` → dict complet pour `meta`

---

## 4. Explication Entraînement vs Évaluation (MTGP) — niveau junior

### Analogie pédagogique

Imagine que tu veux **prédire le type de sol** dans une zone sans sondage,
à partir des sondages existants (tes données terrain).

#### Phase 1 : Entraînement (Training)
> "Le modèle **apprend** à partir des données connues."

Le MTGP (Multi-Task Gaussian Process) prend tes 304 sondages avec leurs
mesures de VBS, IP, WL, WP, EG et cherche :
1. **La structure spatiale** : à quelle distance deux points ont-ils des valeurs similaires ?
   → C'est le **variogramme** dans le krigeage classique, ici c'est le **kernel Matérn 3/2**.
2. **Les corrélations entre paramètres** : si VBS est élevé, IP est-il aussi élevé ?
   → C'est la **matrice de coregionalisation (ICM)**.

L'optimisation Adam (gradient descent) ajuste ces paramètres pour maximiser
l'**ELBO** (Evidence Lower BOund) — une mesure de "à quel point le modèle
explique bien les données observées". Plus l'ELBO monte (moins négatif → 0), mieux c'est.

```
Iteration 0   : ELBO = -1527  ← modèle encore "ignorant"
Iteration 250 : ELBO = -1185  ← modèle apprend
Iteration 500 : ELBO = -1090  ← modèle convergé ✓
```

**Durée** : ~10 min sur GPU RTX 2050 (903 points d'entraînement, 5 paramètres).

#### Phase 2 : Prédiction (Inference)
> "Le modèle applique ce qu'il a appris sur les 29 407 mailles."

Avec les paramètres appris, le modèle calcule pour **chaque maille** :
- Une valeur prédite : `vbs_mtgp_h1 = 3.2 g/100g`
- Une incertitude (variance) : `σ² = 0.8` → plus c'est grand, moins on est sûr

**Durée** : ~1 min (calcul matriciel, GPU bien utilisé).

#### Phase 3 : Évaluation LOO-CV (Leave-One-Out Cross-Validation)
> "On vérifie si le modèle est **honnête** — pas juste bon sur les données connues."

Pour chaque sondage i (sur 30 tirés aléatoirement) :
1. On **cache** le sondage i
2. On entraîne un mini-modèle sur les N-1 sondages restants
3. On prédit la valeur au sondage i
4. On mesure l'erreur : `(prédit - réel)²`

La racine de la moyenne de ces erreurs = **LOO-RMSE**.

**Pourquoi l'ELBO=0 pendant la LOO-CV ?**
Chaque mini-modèle LOO a très peu de points (~29 points, 1 seul paramètre).
Avec si peu de données, le modèle VGP converge vers une solution dégénérée
(ELBO=0 = "je ne peux rien apprendre"). Ce n'est **pas un problème** car :
- Les prédictions sur les 29 407 mailles sont déjà calculées (phase 2 terminée)
- Le LOO-RMSE ne sert qu'à stocker une métrique dans `meta` pour comparaison future

**Durée** : ~30 min (30 mini-entraînements × 1 min chacun).

#### Résumé visuel

```
[Données terrain] ─→ [ENTRAÎNEMENT GPU ~10min] ─→ [Modèle paramétré]
                                                           │
                                              [PRÉDICTION ~1min sur 29 407 mailles]
                                                           │
                                              → Valeurs insérées en DB ✓
                                                           │
                                              [ÉVALUATION LOO-CV ~30min]
                                                           │
                                              → RMSE stocké dans meta (qualité)
                                                           │
                                              [HORIZON SUIVANT : h2, h3...]
```

---

## 5. État des runs au 2026-06-05

| Modèle | Niveau | Dernier run | Valeurs actives | Traçabilité |
|--------|--------|-------------|-----------------|-------------|
| KED Hiérarchique | **L1** | 2026-06-07 | 29 407 / param / horizon (vbs/ip/wl/wp/eg H1-H3 + portance H1) | ✅ |
| RK SCORPAN | **L2a** | 2026-06-07 | 29 407 (cbr_95/w_opt H1) + en cours (gamma_d bug /10.0 fixé) | ✅ |
| BLUP/Fusion | **L2b** | 2026-06-05 | 29 407 / param / horizon (vbs/ip/wl/wp/eg) | ✅ |
| VfS Sentinel-2 (PLS) | **L3** | jamais | 0 | Internet/GEE requis |
| MTGP/ICM GPflow | **L4** | 2026-06-05 | 29 407 / param / horizon | ✅ |
| SGS gstools P10/P50/P90 | **L5** | non calculé | 0 | ⬜ Relancer sgs_interpolation.py |
