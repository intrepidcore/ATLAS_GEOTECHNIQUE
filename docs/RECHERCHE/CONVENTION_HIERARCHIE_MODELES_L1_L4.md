# Convention Hiérarchie des Modèles L1–L4
## Atlas Géotechnique Togo — Référence officielle

> **Décision architecturale 2026-06-01 :** KED Hiérarchique 5 niveaux = L1 officiel en production.

---

## Pourquoi une hiérarchie ?

L'objectif est de produire une carte continue et incertaine de propriétés géotechniques
à partir de **122 sondages ponctuels** sur 56 600 km². Chaque niveau de la hiérarchie
est une stratégie différente, complémentaire, pour résoudre ce problème inverse.

La hiérarchie dit aussi : *si le modèle L2 n'existe pas pour un paramètre, on utilise L1*.
La fusion L2b combine automatiquement L1 et L2a pour minimiser l'incertitude.

---

## L1 — KED Hiérarchique 5 Niveaux (officiel production)

### Ce que ça fait
Krigeage avec Dérive Externe (KED) : interpole les résidus après avoir soustrait
un "prior" pédologique. Le prior est calculé à 5 niveaux de contexte géographique
emboîtés (zone → pédologie → risque gonflement → géologie).

### Explication simple
> "Dans cette zone avec ce type de sol argileux à risque élevé, le VBS est
> généralement autour de 8 g/100g."
> La valeur réelle est cette moyenne + un résidu interpolé spatialement.

### Paramètres techniques
- **Noyau :** variogramme sphérique (ajusté par PyKrige + gstools)
- **Dérive :** moyenne par contexte (4 niveaux de repli automatique, min 5 pts)
- **Vue support :** `atlas.v_contexte_geologique` (79 contextes distincts)
- **Méthode DB :** `ked_hierarchical_5levels`
- **Catalogue :** `drift_strategy = 'hierarchical_5levels_ked'`
- **Variance :** variance de krigeage PyKrige (clampée ≥ 0, jamais proxy)

### Paramètres couverts
VBS, IP, WL, WP, EG × H1/H2/H3 = **15 cartes × 29 407 mailles = 441 105 valeurs**

### LOO-RMSE H1 (référence)
VBS=2.94, IP=9.79, WL=13.21, WP=7.95, EG=1.67

---

## L2a — Régression Kriging SCORPAN

### Ce que ça fait
Régression Ridge sur 10 covariables terrain (altitude, pente, TPI, HAND,
distance rivière, précipitations annuelles/sèche/humide, lon/lat), puis krigeage
des résidus. La prédiction finale = tendance régressive + résidu krigé.

### Explication simple
> "VBS ≈ 0.3 × altitude − 0.2 × distance_rivière + … + résidu spatial"
> Le résidu capture ce que la régression ne voit pas (variation locale).

### Paramètres techniques
- **Régression :** Ridge (α=1.0), sklearn Pipeline avec StandardScaler
- **Krigeage résidus :** OrdinaryKriging PyKrige, variogramme sphérique
- **Covariables :** DEM, slope, TPI, HAND, dist_rivière, prec_annual, prec_dry, prec_wet, lon, lat
- **LOO :** complet (régression + krigeage résidus), jamais partiel — voir CONV-03
- **Méthode DB :** `regression_kriging_scorpan`

### Paramètres couverts
VBS, IP, WL, WP, EG × H1/H2/H3 = **15 cartes**

### LOO-RMSE H1
VBS=2.48, IP=12.79, WL=15.42, WP=8.07, EG=1.24

### Anomalie H2
L'horizon H2 (1.0–2.0m) capture une zone de transition hétérogène.
Les covariables de surface perdent leur pouvoir prédictif en profondeur.
→ H2 RK systematiquement plus mauvais que H1/H3 (VBS H2=5.29, WL H2=19.97).

---

## L2b — Fusion Bayésienne KED-RK (BLUP)

### Ce que ça fait
Combine L1 et L2a via pondération inverse de variance locale (Best Linear
Unbiased Predictor). Le modèle le plus sûr de lui (σ² le plus petit) reçoit
plus de poids. La variance résultante est TOUJOURS ≤ min(σ²_KED, σ²_RK).

### Explication simple
> Deux experts disent des valeurs différentes. On les combine en donnant plus de poids
> à celui qui est le plus précis. Résultat : meilleure précision que les deux seuls.

### Formule
```
w_KED(x) = 1/σ²_KED(x)
w_RK(x)  = 1/σ²_RK(x)
Z_fusion = (w_KED × Z_KED + w_RK × Z_RK) / (w_KED + w_RK)
σ²_fusion = 1/(w_KED + w_RK)   ← toujours ≤ min(σ²_KED, σ²_RK)
```

### Résultats
- **Réduction σ² :** 44.7% à 49.8% sur tous les 15 paramètres-horizons
- **Théorique :** σ²_fusion ≈ σ²_min/2 quand les deux modèles ont des variances similaires
- **Méthode DB :** `ked_rk_fusion_bayesian`

---

## L3 — VBS-from-Sentinel (VfS, spectral)

### Ce que ça fait
Prédit le VBS de surface à partir d'indices spectraux Sentinel-2 (infrarouge court).
L'argile absorbe différemment les longueurs d'onde B11/B12 → signature spectrale.
Modèle PLS (Partial Least Squares) calibré sur les 96 sondages géolocalisés.

### Explication simple
> "La couleur de la terre vue depuis l'espace contient de l'information sur
> son activité argileuse géotechnique."

### Paramètres techniques
- **Images :** Sentinel-2 SR Harmonisé, composite médian 2023–2024
- **Features :** clay_index (B11/B12), SWIR_ratio, NDVI, iron_oxide
- **Modèle :** PLS régression, n_composantes=3 (sélection LOO-CV)
- **LOO-RMSE :** 2.788 g/100g (< KED H1 = 3.06 → UTILE)
- **Couverture :** 24 038 / 29 407 mailles (81.7%, excl. végétation dense + cuirasses)
- **Table DB :** `atlas.maille_spectral_vfs`

### Paramètre couvert
VBS surface uniquement (corrélation verticale r=0.511 validée pour H3)

---

## L3b — CatBoost ML (non déployé)

### Ce que ça fait
Gradient Boosting machine learning sur les mêmes covariables SCORPAN que L2a,
mais avec un modèle non-linéaire capable de capturer des interactions complexes.

### Pourquoi non déployé
- Nécessite N > 200–300 sondages pour éviter le sur-apprentissage
- Avec N=122, LOO-RMSE > KED et RK dans nos tests
- **Roadmap :** activer quand N_sondages > 300

### Méthode DB (quand déployé)
`regression_kriging_catboost`

---

## L4 — MTGP (Multi-Task Gaussian Process)

### Ce que ça fait
Processus gaussien multi-tâche : apprend *simultanément* VBS, IP et EG en
exploitant leurs corrélations (r(VBS,EG)≈0.78, r(VBS,IP)≈0.65).
Un sondage riche (avec VBS+IP+EG) aide les sondages pauvres (avec une seule mesure).

### Explication simple
> "Si VBS est élevé ici, IP l'est probablement aussi — le modèle l'apprend
> et partage l'information entre les paramètres corrélés."

### Paramètres techniques
- **Librairie :** GPflow 2.x — Variational GP (VGP)
- **Noyau :** RBF × ICM (Intrinsic Coregionalization Model) rang 2
- **Format :** SwitchedLikelihood, Y=(N, 2) — (valeur, output_index)
- **Features :** (lon, lat) WGS84
- **Statut :** Expérimental H1+H2+H3
- **Méthode DB :** `mtgp_icm_gpflow`

### Paramètres couverts
VBS, IP, EG × H1/H2/H3 = **9 cartes**

---

## Tableau récapitulatif

| Niveau | Modèle | Statut | N params | LOO-RMSE VBS H1 | σ² fournie |
|:------:|:------:|:------:|:--------:|:---------------:|:----------:|
| **L1** | KED Hiérarchique | ✅ **Prod officiel** | 15 | 2.94 | ✅ PyKrige |
| **L2a** | RK SCORPAN | ✅ Prod | 15 | 2.48 | ✅ PyKrige |
| **L2b** | Fusion BLUP | ✅ Prod | 15 | n/a (σ²↓47%) | ✅ Bayesian |
| **L3** | VfS PLS | ✅ Prod (VBS surf.) | 1 | 2.79 | ✅ homoscéd. |
| **L3b** | CatBoost | ❌ N<300 | — | — | ❌ |
| **L4** | MTGP GPflow | ✅ Expérimental | 9 | n/a | ✅ GPflow |

---

## Décisions clés

| Décision | Raison |
|:--------:|:------:|
| L1 = KED hier (pas RK) | Robustesse géostatistique + connaissance terrain encodée |
| L2b stocké en prod | σ²_fusion ≤ σ²_min toujours — amélioration gratuite |
| L3b non déployé | Sur-apprentissage avec N=122 |
| Pas de proxy σ² | LOO-RMSE² = scalaire ≠ variance spatiale → invalide la fusion |
| LOO complet pour RK | LOO partiel (régression seule) sous-estime l'erreur réelle de 30-40% |

---

*Document de référence — mis à jour 2026-06-01*  
*CONVENTIONS_TECHNIQUES_LITIGES.md pour les litiges résolus*
