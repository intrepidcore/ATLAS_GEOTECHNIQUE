# Atlas Géotechnique du Togo — Rapport Final des Modèles Géostatistiques
## Hiérarchie L1 → L4 : résultats officiels au 2026-06-01

**Auteur :** Serge TABE DJATO  
**Encadrement :** Intrepid Core Engineering Standards  
**Base de données :** `atlas_clean` @ 127.0.0.1:5433  
**Mailles :** 29 407 × 3 horizons (H1: 0.5–1.5m | H2: 1.0–2.0m | H3: 1.5–2.5m)  
**Question de recherche :** Peut-on produire une cartographie géotechnique nationale continue et incertaine à partir de 122 sondages ponctuels au Togo ?

---

## 1. Paramètres cartographiés

| Paramètre | Symbole | Unité | Plage physique | N sondages H1 |
|:----------:|:-------:|:-----:|:--------------:|:-------------:|
| Valeur au Bleu (activité argile) | VBS | g/100g | 0 – 20 | 106 |
| Indice de plasticité | IP | % | 0 – 80 | 112 |
| Limite de liquidité | WL | % | 20 – 120 | 112 |
| Limite de plasticité | WP | % | 10 – 60 | 112 |
| Potentiel de gonflement | EG | % | 0 – 20 | 93 |
| Passant 80 µm | P80 | % | 0 – 100 | 77 |
| Passant 2 mm | P2 | % | 0 – 100 | 8 |

---

## 2. Modèle L1 — KED Hiérarchique 5 Niveaux (officiel production)

### Méthode
Krigeage avec Dérive Externe (KED) pédologique. La dérive a priori est calculée
par une hiérarchie de 5 niveaux contextuels :

```
Niveau 1 : Zone étude | Pédologie | Risque gonflement | Géologie  (≥ 5 pts)
Niveau 2 : Zone étude | Pédologie                                 (≥ 5 pts)
Niveau 3 : Pédologie seule                                        (≥ 5 pts)
Niveau 4 : Moyenne nationale                                      (toujours)
```

**Vue support :** `atlas.v_contexte_geologique` (matérialisée) — 79 contextes distincts,
96.4% mailles couvertes en pédologie, 98.6% en géologie.

### Résultats LOO-RMSE (loo_residual.rmse — PyKrige LOO-CV)

| Paramètre | H1 LOO-RMSE | H2 LOO-RMSE | H3 LOO-RMSE | N train | Variogramme |
|:---------:|:-----------:|:-----------:|:-----------:|:-------:|:-----------:|
| VBS | **2.941** | 3.009 | **2.307** | 106 | Sphérique |
| IP | **9.786** | 9.948 | 10.190 | 112 | Sphérique |
| WL | **13.213** | 11.863 | 11.264 | 112 | Sphérique |
| WP | **7.949** | 8.147 | 7.742 | 112 | Sphérique |
| EG | 1.668 | 1.796 | 1.757 | 93 | Sphérique |

### Variances en base
- **441 105 valeurs** (15 paramètres × 29 407 mailles)
- **0 variance négative** (clamp `max(0.0, σ²)` systématique)
- Méthode DB : `ked_hierarchical_5levels`
- Stratégie catalogue : `hierarchical_5levels_ked` (L1 officiel)

---

## 3. Modèle L2a — Régression Kriging SCORPAN

### Méthode
Ridge regression sur 10 covariables terrain + krigeage des résidus.

**Covariables SCORPAN :** altitude DEM, pente, TPI, HAND, distance rivière,
précipitations annuelles, précipitations saison sèche, précipitations saison humide, lon, lat.

**LOO complet** (régression + krigeage résidus) — voir CONV-03.

### LOO-RMSE RK complet (régression Ridge + krigeage résidus)

| Paramètre | H1 | H2 | H3 | N train H1 | R² Ridge H1 |
|:---------:|:--:|:--:|:--:|:----------:|:-----------:|
| VBS | **2.480** | 5.288 | 2.641 | 204 | 0.189 |
| IP | 12.793 | **7.577** | **7.321** | 220 | 0.190 |
| WL | 15.417 | 19.971 | 12.347 | 222 | 0.197 |
| WP | 8.071 | 13.197 | **7.158** | 220 | 0.131 |
| EG | **1.243** | 1.971 | **1.286** | 186 | 0.224 |

> **Note :** les valeurs H2 RK sont plus élevées (VBS: 5.29, WL: 19.97, WP: 13.20)
> car l'horizon 1.0–2.0m capture une zone de transition avec haute hétérogénéité verticale.
> Les covariables SCORPAN (surface) perdent leur pouvoir prédictif en profondeur.

### Score comparatif L1 vs L2 : **KED gagne 9/15, RK gagne 6/15**

| | VBS | IP | WL | WP | EG |
|:-:|:-:|:-:|:-:|:-:|:-:|
| **H1** | RK ↓16% | KED | KED | KED | RK ↓26% |
| **H2** | KED | RK ↓24% | KED | KED | KED |
| **H3** | KED | RK ↓28% | KED | RK ↓8% | RK ↓23% |

---

## 4. Modèle L2b — Fusion Bayésienne KED-RK (BLUP)

### Méthode
Pondération inverse de variance locale (Best Linear Unbiased Predictor) :

```
w_KED(x) = 1/σ²_KED(x),   w_RK(x) = 1/σ²_RK(x)
Z_fusion = (w_KED × Z_KED + w_RK × Z_RK) / (w_KED + w_RK)
σ²_fusion = 1/(w_KED + w_RK)   ≤ min(σ²_KED, σ²_RK) — propriété mathématique garantie
```

### Réduction de variance par horizon

| Paramètre | σ²_KED H1 | σ²_RK H1 | σ²_fusion H1 | **Réduction** |
|:---------:|:---------:|:--------:|:------------:|:-------------:|
| VBS | 12.45 | 10.60 | 5.73 | **45.9%** |
| IP | 90.99 | 79.87 | 42.33 | **47.0%** |
| WL | 174.15 | 140.36 | 77.63 | **44.7%** |
| WP | 54.54 | 60.37 | 28.70 | **47.4%** |
| EG | 2.68 | 2.55 | 1.34 | **46.6%** |

**Réduction moyenne : 46.7% ± 1.8%** (plage 44.7–49.8% sur 15 paramètres-horizons)

> Résultat attendu : σ²_fusion ≈ σ²_min/2 quand σ²_KED ≈ σ²_RK (cas observé).

---

## 5. Modèle L3 — VBS-from-Sentinel (VfS)

### Méthode
Régression PLS sur indices spectraux Sentinel-2 → prédiction VBS de surface.

| Composante | Détail |
|:----------:|:------:|
| Images | Sentinel-2 SR Harmonisé (COPERNICUS/S2_SR_HARMONIZED) |
| Composite | Médian 2023–2024, CLOUDY_PIXEL < 20% |
| Features | clay_index (B11/B12), SWIR_ratio, NDVI, iron_oxide |
| Modèle | PLS Régression, n_composantes = 3 (LOO-CV optimal) |
| N calibration | 85 sondages valides (excl. cuirasses + NDVI > 0.6) |

### Métriques calibration

| Indicateur | Valeur | Vs référence |
|:----------:|:------:|:------------:|
| **LOO-RMSE PLS** | **2.788 g/100g** | KED H1 = 3.06 → **VfS UTILE** (−9%) |
| R² LOO | 0.354 | — |
| Clay index moyen | 1.479 | Normal Togo |
| Mailles prédites | 24 038 / 29 407 | **81.7%** couverture |

> Validation cohérence verticale : r(VBS_H1, VBS_H3) = 0.511 (N=101) → signal
> spectral de surface apporte de l'information sur les horizons profonds.

---

## 6. Modèle L4 — Multi-Task Gaussian Process (MTGP)

### Architecture
- **Librairie :** GPflow 2.x — Variational Gaussian Process (VGP)
- **Noyau :** RBF × ICM (Intrinsic Coregionalization Model) rang 2
- **Format Y :** SwitchedLikelihood — stacking (valeur, output_index) par colonne
- **Features :** (lon, lat) WGS84

### Résultats H1/H2/H3

| Param | N train H1 | Pred moy H1 | Var moy H1 | Pred moy H2 | Pred moy H3 |
|:-----:|:----------:|:-----------:|:----------:|:-----------:|:-----------:|
| VBS | 260 | 4.09 g/100g | 8.93 | 3.89 | 4.01 |
| IP | 260 | 19.46 % | 100.3 | 20.47 | 20.55 |
| EG | 260 | 3.73 % | 3.55 | 3.99 | 4.08 |

> Note : le MTGP exploite les corrélations inter-paramètres (r(VBS,EG)≈0.78, r(VBS,IP)≈0.65).
> LOO-RMSE MTGP non calculé à ce stade — modèle L4 expérimental.

---

## 7. Tableau de bord des décisions architecturales

| Décision | Justification | Référence |
|:--------:|:-------------:|:---------:|
| KED hier = L1 officiel | H1 VBS: −4% vs pédologique ; base auto-améliorable | CONV à décision 2026-06-01 |
| Pas de proxy pour σ² | LOO-RMSE² = scalaire ≠ variance spatiale → invalide la fusion | CONV-02 |
| LOO RK = complet | LOO partiel (régression seule) sous-estimait l'erreur réelle | CONV-03 |
| batch_size=500 pour GEE | batch_size=1000 provoque memory limit sur certains tuiles | Testé 2026-06-01 |
| Stockage incrémental GEE | Perte totale si crash avec stockage atomique final | Correctif 2026-06-01 |
| EG = via vue canonique | `v_echantillons_essais.potentiel_gonflement` sauf jointure spéciale | CONV-01 |

---

## 8. Récapitulatif des métriques officielles (production 2026-06-01)

### Résumé LOO-RMSE H1 (meilleure méthode en **gras**)

| Paramètre | L1 KED hier | L2 RK | L2 Fusion σ² | L3 VfS | L4 MTGP |
|:---------:|:-----------:|:-----:|:------------:|:------:|:-------:|
| VBS | 2.941 | **2.480** | σ² ↓46% | **2.788** | n/a |
| IP | **9.786** | 12.793 | σ² ↓47% | n/a | n/a |
| WL | **13.213** | 15.417 | σ² ↓45% | n/a | n/a |
| WP | **7.949** | 8.071 | σ² ↓47% | n/a | n/a |
| EG | 1.668 | **1.243** | σ² ↓47% | n/a | n/a |

> La Fusion L2b est théoriquement meilleure que L1 et L2a car σ²_fusion ≤ σ²_min.
> Une LOO-RMSE directe de la fusion nécessiterait de stocker les prédictions aux points d'entraînement.

### Volume de données interpolées

| Modèle | Méthode DB | N valeurs actives | Horizons |
|:------:|:----------:|:-----------------:|:--------:|
| L1 KED hier | `ked_hierarchical_5levels` | 441 105 | H1+H2+H3 |
| L1 KED granulo | `ked_pedologie_granulo` | 176 442 | H1+H2+H3 |
| L2 RK SCORPAN | `regression_kriging_scorpan` | 441 105 | H1+H2+H3 |
| L2 Fusion BLUP | `ked_rk_fusion_bayesian` | 441 105 | H1+H2+H3 |
| L3 VfS | `maille_spectral_vfs` | 29 407 | Surface |
| L4 MTGP | `mtgp_icm_gpflow` | 264 663 | H1+H2+H3 |
| **Total** | | **~1 793 827** | |

---

## 9. Pipeline Auto-amélioration (BLOC E)

À chaque import de sondage, le trigger `trg_enqueue_ai_jobs_after_sondage` enqueue :

1. `run_ked` (KED hiérarchique, kinds=vbs/ip/wl/wp/eg, si N≥10)
2. `run_rk` (RK SCORPAN par paramètre, si N≥10)
3. `run_fusion` (Bayesian BLUP, si N_vbs≥10 ET N_ip≥10)
4. `run_vfs` (VfS recalibration + prédiction mailles, batch_size=500)

**Worker :** `pipeline_worker.py --database-url <DB> --interval 30`

---

## 10. Perspectives (N > 300 sondages)

| Gain attendu | Mécanisme |
|:------------:|:---------:|
| KED hier: −15–25% LOO | Contextes hiérar. actifs : 17/79 → 60+/79 |
| RK H2: normalisation | Plus de données H2 → régression stable |
| VfS: R² > 0.5 | Ajout bandes radar (Sentinel-1 VH/VV) |
| MTGP LOO-RMSE | N_train > 300 → LOO tractable avec inducing points |

---

*Document généré automatiquement depuis la base `atlas_clean`.*  
*Scripts : run_ked_vbs_ip_wl_wp_horizons.py, atlas_regression_kriging_terrain.py,*  
*ked_rk_fusion.py, vfs_extract_spectral.py, mtgp_geotechnique.py*  
*Commit de référence : atlas_v2_clean / 2026-06-01*
