# Conventions Techniques et Résolutions de Litiges
## Atlas Géotechnique Togo — Référence pour le Mémoire

> Ce document enregistre toutes les décisions techniques prises à la suite de litiges,
> bugs, ou ambiguïtés découvertes pendant l'implémentation.
> Il sert de référence lors de la rédaction du mémoire pour justifier les choix.

---

## CONV-01 : Harmonisation colonne EG (potentiel_gonflement vs cg)

**Date :** 2026-05-31  
**Litige :** Deux noms de colonnes pour le même paramètre (EG = Expansion/Gonflement).

| Contexte | Nom de colonne | Justification |
|:--------:|:--------------:|:-------------:|
| Table brute `atlas.essais_potentiel_gonflement` | `cg` | Nom historique de la table |
| Vue canonique `atlas.v_echantillons_essais` | `potentiel_gonflement` | Vue unifiée de tous les essais |
| Scripts de calcul (KED, RK, Fusion) | `potentiel_gonflement` | **Toujours via la vue** |
| Script MTGP (`mtgp_geotechnique.py`) | `epg.cg` | Accès direct table nécessaire pour jointure spéciale |

**Règle canonique :**
- Utiliser **toujours** `v_echantillons_essais.potentiel_gonflement` dans tous les scripts.
- Accès direct à `essais_potentiel_gonflement.cg` uniquement si la vue n'est pas disponible  
  ou dans un contexte de jointure qui l'exige (ex: MTGP stacking).
- Documenter explicitement dans le code tout accès à `epg.cg` avec un commentaire :  
  `# HARMONISATION: accès direct à essais_potentiel_gonflement.cg car [raison]`

---

## CONV-02 : Pas de proxy pour les variances (règle absolue)

**Date :** 2026-05-30  
**Litige :** Tentation d'utiliser LOO-RMSE² comme substitute à la variance de krigeage.

**Règle :**  
La variance de krigeage `σ²(x)` doit TOUJOURS être la **variance réelle** de `pykrige.ok.OrdinaryKriging.execute()`.  
Il est interdit d'utiliser un proxy tel que `LOO-RMSE²` à la place de `σ²_krige`.

**Justification scientifique :**  
- `σ²_krige(x)` est la variance **spatiale** (dépend de la configuration des voisins).  
- `LOO-RMSE²` est une **statistique globale** (une seule valeur pour tout le domaine).  
- Utiliser un scalaire constant comme variance revient à supposer l'homoscédasticité  
  parfaite, ce qui invalide la fusion Bayésienne BLUP (les poids seraient identiques pour toutes les mailles).

**Valeurs négatives PyKrige :** Artefact d'inversion de matrice aux points d'entraînement.  
Correction standard : `max(0.0, float(z_var[i]))` — **pas un proxy**, c'est un clamp numérique.

---

## CONV-03 : LOO-RMSE RK = régression + krigeage des résidus (LOO complet)

**Date :** 2026-06-01  
**Litige :** La LOO-CV de `atlas_regression_kriging_terrain.py` ne validait que la régression Ridge,  
pas le krigeage des résidus → LOO-RMSE stocké = NULL.

**Décision :** Le LOO complet RK doit inclure :
1. Entraîner Ridge sur N−1 points (train_idx sans point i)
2. Calculer les résidus sur les N−1 points
3. Kriger les résidus → prédire le résidu au point i
4. Prédiction finale = trend(i) + résidu_krigé(i)
5. Erreur = (prédiction − valeur_réelle)²

**Implémentation :** Fonction `loo_cross_validation()` dans `atlas_regression_kriging_terrain.py` (v2, 2026-06-01).  
**Complexité :** O(N³) acceptable pour N < 300. Durée ~30s pour N=220.

---

## CONV-04 : Variance fusion — métrique agrégée vs per-maille

**Date :** 2026-06-01  
**Litige :** La métrique `mean_var_reduction_pct` dans `ked_rk_fusion.py` retournait −5843%  
pour EG et −55% pour IP à cause d'outliers numériques dans le calcul per-maille.

**Cause :** La formule per-maille `(best_indiv − σ²_fusion) / best_indiv` produit des outliers  
quand `best_indiv = s²_ked ≈ 0` (clamped at training points) et σ²_fusion est non-zéro.  
Mathématiquement σ²_fusion ≤ min(σ²_KED, σ²_RK) toujours, mais la formule peut diverger  
si `best_indiv` utilisé dans le numérateur diffère de la valeur réelle dans le dénominateur  
(due au fallback `global_var` dans `bayesian_fusion` vs `global_var` dans les métriques).

**Correction :** La réduction est calculée via les **moyennes agrégées** :
```
réduction = 1 − mean(σ²_fusion) / min(mean(σ²_KED), mean(σ²_RK))
```
Cette formule est robuste car elle ne dépend pas des outliers individuels.

**Note :** Les **valeurs stockées** dans `ai_interpolation_values` (value, variance) sont correctes.  
Seule la métrique de log était incorrecte. Les runs précédents ont été re-exécutés (2026-06-01).

---

## CONV-05 : Harmonisation EG KED — clamp variances négatives

**Date :** 2026-06-01  
**Litige :** `run_ked_eg_horizons.py` ne clampait pas les variances négatives PyKrige.  
Résultat : `min_var = −5.41` pour `eg_ked_h1` en base.

**Correction :**  
```python
# Avant (bug)
float(z_var[i]) if math.isfinite(float(z_var[i])) else None

# Après (correction)
max(0.0, float(z_var[i])) if math.isfinite(float(z_var[i])) else None  # clamp artefacts négatifs PyKrige (DATA-02)
```

**Règle générale :** Tout script KED ou OK doit utiliser `max(0.0, ...)` avant stockage.  
Référence : `run_ked_vbs_ip_wl_wp_horizons.py` (déjà corrigé), `run_ked_eg_horizons.py` (corrigé 2026-06-01).

---

## CONV-06 : VfS maille — bug UUID type mismatch dans merge

**Date :** 2026-06-01  
**Litige :** L'extraction GEE pour 29,407 centroïdes de mailles retournait NaN pour tous  
les indices spectraux, même si GEE fonctionnait correctement.

**Cause :** Dans `run_extract_mailles()` :
- `batch["maille_id"]` = objets `uuid.UUID` Python (retournés par psycopg2)
- `df_gee["maille_id"]` = strings `"0a0efff8-..."` (retournés par GEE `getInfo()`)
- `pd.DataFrame.merge(on="maille_id")` → comparaison UUID vs string → 0 match → NaN

**Correction :**
```python
# Avant merge : unifier le type en string
df_mailles["maille_id"] = df_mailles["maille_id"].astype(str)
df_gee["maille_id"] = df_gee["maille_id"].astype(str)
```

**Règle :** Toute jointure sur UUID (PostgreSQL) depuis Python doit normaliser en `str` avant merge.

---

## CONV-07 : Port DB — 5433 (calculs desktop) vs 5432 (Docker API)

**Date :** 2026-05-30  
**Litige :** Deux instances PostgreSQL sur la même machine.

| Port | Usage | URL |
|:----:|:-----:|:---:|
| 5433 | Desktop PostgreSQL 17 (calculs géostat) | `postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean` |
| 5432 | Docker PostgreSQL (API REST) | `postgresql://atlas:atlas@127.0.0.1:5432/atlas_clean` |

**Règle :** Tous les scripts de calcul utilisent le port **5433**.

---

## CONV-08 : GEE Authentication — gcloud ADC vs earthengine CLI

**Date :** 2026-05-31  
**Litige :** `earthengine authenticate` était bloqué par Google (scope drive refusé).

**Solution :** Utiliser `gcloud auth application-default login` (Application Default Credentials).  
- Projet GEE : `gen-lang-client-0964618990`  
- Initialisation dans le code : `ee.Initialize(project='gen-lang-client-0964618990')`

**Ne PAS utiliser :**
```bash
earthengine authenticate  # bloqué par Google pour ce compte
```

**Utiliser :**
```bash
gcloud auth application-default login
```

---

## CONV-09 : Dérive KED — pedologie vs DSM altitude

**Date :** 2026-05-30  
**Litige :** Confusion possible entre dérive pédologique (L1) et altitude DSM.

**Décision canonique :**
- **Modèle L1 (KED)** : dérive = moyennes pédologiques par `atlas.unites_pedologiques.type_sols`  
  (lues depuis `atlas.pedological_drift_priors`).
- **L'altitude DSM** est utilisée comme **covariable SCORPAN** dans RK (modèle L2), pas comme dérive KED.
- Source de confusion : certains papiers utilisent "external drift = DEM altitude" pour KED de pluie.  
  Ici, le contexte géotechnique nécessite une dérive pédologique, pas altimétrique.

---

## CONV-10 : CHECK constraint source dans ai_parameter_catalog

**Date :** 2026-05-31  
**Litige :** Insertion dans `ai_parameter_catalog` échouait avec `source='fusion'` ou `source='mtgp'`.

**Contrainte DB :** `CHECK (source IN ('base', 'interpolation', 'ia'))`

| Script | source à utiliser |
|:------:|:-----------------:|
| KED, RK | `'interpolation'` |
| Fusion | `'interpolation'` |
| MTGP, VfS | `'ia'` |

---

## CONV-11 : LOO-RMSE KED — clé JSON `loo_residual.rmse`

**Date :** 2026-06-01  
**Litige :** La requête `metrics->>'loo_rmse'` retournait NULL pour tous les runs KED.

**Cause :** Le KED stocke la LOO dans `metrics->'loo_residual'->>'rmse'` (pas `loo_rmse` direct).

**Requête correcte :**
```sql
SELECT ROUND((metrics->'loo_residual'->>'rmse')::numeric, 4) AS loo_rmse
FROM atlas.ai_interpolation_runs
WHERE method = 'ked_hierarchical_5levels';
```

---

*Document maintenu par Claude Code (Intrepid Core Engineering Standards)*  
*Dernière mise à jour : 2026-06-01*
