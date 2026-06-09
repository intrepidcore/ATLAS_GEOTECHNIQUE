# Résultats — Multi-Task Gaussian Process (MTGP) — BLOC D
## Atlas Géotechnique Togo

**Date initiale :** 2026-06-01 | **Dernière mise à jour :** 2026-06-04  
**Script :** `scripts/mtgp_geotechnique.py`  
**Méthode DB :** `mtgp_icm_gpflow`  
**Librairie :** GPflow 2.x, modèle ICM (Intrinsic Coregionalization Model), rang 2

> ⚠️ **STATUT 2026-06-04 — RÉSULTATS PROVISOIRES**
> Le MTGP a été entraîné sur 260 sondages (empilés VBS+IP+EG) dont une fraction
> inconnue appartient aux 187 sondages avec coordonnée fallback `POINT(1.0, 8.6)`.
> L'ICM apprend des corrélations spatiales r(VBS,EG)≈0.78 qui peuvent être biaisées
> par la concentration artificielle à Kaniamboua. Un relancement est planifié après
> le re-géocodage. Ref : `AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md` — Phase 4.

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

## 3. Résultats en base (H1/H2/H3)

| Paramètre | Horizon | N train | N mailles | Prédiction moy. | Variance GPflow moy. |
|:---------:|:-------:|:-------:|:---------:|:---------------:|:--------------------:|
| VBS | H1 | 260 | 29,407 | 4.090 g/100g | 8.928 |
| VBS | H2 | 260 | 29,407 | 4.007 g/100g | 8.710 |
| VBS | H3 | 258 | 29,407 | 4.021 g/100g | 9.051 |
| IP | H1 | 260 | 29,407 | 19.463 % | 100.257 |
| IP | H2 | 260 | 29,407 | 20.466 % | 95.285 |
| IP | H3 | 258 | 29,407 | 20.553 % | 102.278 |
| EG | H1 | 260 | 29,407 | 3.731 % | 3.546 |
| EG | H2 | 260 | 29,407 | 3.986 % | 3.051 |
| EG | H3 | 258 | 29,407 | 4.077 % | 3.260 |

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

## 7. Mise à jour post-audit (2026-06-04)

### Actions requises avant publication

| Action | Statut | Notes |
|--------|--------|-------|
| Re-géocodage 187 sondages | ⏳ En cours | `regeocod_fuzzy_v1.py` |
| Ré-extraction features GEE VBS/IP/EG | ⬜ Planifié | Après correction maille_code |
| Relancement MTGP complet | ⬜ Planifié | `run_all_models_nightly_v2.py --models l4` |
| Calcul LOO-RMSE MTGP | ⬜ Planifié | O(N³) tractable, N_corrigé < 260 |
| Comparaison MTGP vs L2b BLUP | ⬜ Planifié | Après disponibilité des deux LOO |

**Script de lancement post-correction :**
```bash
python scripts/run_all_models_nightly_v2.py --models l4
```

---

*Script : `scripts/mtgp_geotechnique.py`*  
*Paramètre catalog IDs : `vbs_mtgp_h1`, `ip_mtgp_h1`, `eg_mtgp_h1` (source='ia')*  
*Orchestration : `scripts/run_all_models_nightly_v2.py` (v2 via API Rust)*
