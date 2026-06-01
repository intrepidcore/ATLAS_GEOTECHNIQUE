# Résultats — Multi-Task Gaussian Process (MTGP) — BLOC D
## Atlas Géotechnique Togo

**Date :** 2026-06-01  
**Script :** `scripts/mtgp_geotechnique.py`  
**Méthode DB :** `mtgp_icm_gpflow`  
**Librairie :** GPflow 2.x, modèle ICM (Intrinsic Coregionalization Model), rang 2

---

## 1. Motivation

Le MTGP apprend simultanément les corrélations entre VBS, IP et EG.  
La structure de covariance inter-paramètres (ICM) peut capturer :
- `r(VBS, IP) ≈ 0.65` (argile active → plasticité élevée)
- `r(VBS, EG) ≈ 0.78` (potentiel de gonflement ∝ VBS)

**Avantage théorique :** les sondages riches (VBS+IP+EG) informent les sondages pauvres.  
**Condition :** N × n_outputs doit rester tractable pour O(N³) inversion.

---

## 2. Architecture du modèle

### Format des données (SwitchedLikelihood GPflow)

```python
# Y format requis par SwitchedLikelihood GPflow :
# Y = [[valeur, output_index], ...]  → shape (N_total, 2)
# X = [[x1, x2, output_index], ...] → shape (N_total, n_features+1)
#
# NB : pas [[val1, val2, val3], ...] (n_outputs colonnes) — mauvais format
```

### Paramètres d'entraînement

| Paramètre | Valeur |
|:---------:|:------:|
| Noyau | RBF (ARD=False) + ICM rang 2 |
| Modèle variationnel | VGP (Variational Gaussian Process) |
| num_latent_gps | 1 (obligatoire pour SwitchedLikelihood) |
| Optimiseur | Adam, max_iter=500 |
| Features | lon, lat (WGS84) |

### Données d'entraînement empilées

| Paramètre | Source colonne | N points H1 |
|:---------:|:-------------:|:-----------:|
| VBS | `v_echantillons_essais.vbs` | ~88 |
| IP | `v_echantillons_essais.ip` | ~92 |
| EG | `essais_potentiel_gonflement.cg` | ~80 |
| **Total empilé** | | **260** |

Note CONV-01 : EG utilise `essais_potentiel_gonflement.cg` directement (pas la vue canonique),  
car le MTGP nécessite une jointure spéciale pour le stacking. Ce cas est documenté explicitement.

---

## 3. Résultats en base (H1 uniquement)

| Paramètre | N mailles | Prédiction moyenne | Variance GPflow moyenne |
|:---------:|:---------:|:-----------------:|:----------------------:|
| vbs_mtgp_h1 | 29,407 | 4.090 g/100g | 8.928 |
| ip_mtgp_h1 | 29,407 | 19.463 % | 100.257 |
| eg_mtgp_h1 | 29,407 | 3.731 % | 3.546 |

### Cohérence avec plages physiques DATA-02

| Paramètre | Min_préd | Max_préd | Dans [min, max] ? |
|:---------:|:--------:|:--------:|:-----------------:|
| VBS [0, 20] | 0.0 | ~12 | ✓ |
| IP [0, 80] | 0.0 | ~60 | ✓ |
| EG [0, 20] | 0.0 | ~15 | ✓ |

---

## 4. Bugs corrigés pendant l'implémentation

| Bug | Cause | Correction |
|:---:|:-----:|:----------:|
| `AssertionError: num_latent_gps > 0` | VGP avec SwitchedLikelihood nécessite param explicite | `num_latent_gps=1` |
| Y format `(N,1)` → erreur SwitchedLikelihood | Le format requis est `(N, 2)` avec (valeur, output_index) | `np.column_stack([vals, indices])` |
| Prédiction shape (88221 vs 29407) | SwitchedLikelihood retourne `(N, n_outputs)` | `mean_arr[:, idx]` |
| FK violation `parameter_id='mtgp_h1'` | Non présent dans `ai_parameter_catalog` | INSERT catalogue avant runs |
| `source='mtgp'` CHECK violation | Contrainte `IN ('base','interpolation','ia')` | `source='ia'` |
| `epg.potentiel_gonflement` n'existe pas | Colonne raw est `cg` | `epg.cg` + documentation CONV-01 |

---

## 5. Limitations et perspectives

| Limitation | Valeur actuelle | Roadmap |
|:----------:|:--------------:|:-------:|
| Horizons couverts | H1 seulement | H2, H3 → triple le temps de calcul |
| LOO-RMSE MTGP | Non calculé | LOO complet O(N³) tractable pour N=260 |
| Comparaison MTGP vs KED | N/A (pas de LOO) | Nécessaire pour valider apport MTGP |
| Rang ICM | 2 | Rang 3+ possible si corrélations plus complexes |
| Scalabilité | O(N³) pour N=260 | Approx. inducing points si N > 1000 |

---

## 6. Code clé — prédiction correcte avec SwitchedLikelihood

```python
# Format Y correct (SwitchedLikelihood GPflow)
Y_stacked = np.column_stack([
    np.concatenate([vals_vbs, vals_ip, vals_eg]),     # valeurs
    np.concatenate([
        np.zeros(len(vals_vbs)),   # output index 0 = VBS
        np.ones(len(vals_ip)),     # output index 1 = IP
        np.full(len(vals_eg), 2),  # output index 2 = EG
    ])
]).astype(float)  # shape (N_total, 2)

# Prédiction — retourne (N_pred, n_outputs)
mean, var = model.predict_y(X_pred_all)
mean_vbs = mean[:, 0]  # ← CORRECT (pas mean.flatten())
mean_ip  = mean[:, 1]
mean_eg  = mean[:, 2]
```

---

*Script : `scripts/mtgp_geotechnique.py`*  
*Paramètre catalog IDs : `vbs_mtgp_h1`, `ip_mtgp_h1`, `eg_mtgp_h1` (source='ia')*
