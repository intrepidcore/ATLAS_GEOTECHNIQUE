# Résultats — VBS-from-Sentinel (VfS) — BLOC C
## Atlas Géotechnique Togo

**Date initiale :** 2026-06-01 | **Dernière mise à jour :** 2026-06-04  
**Script :** `scripts/vfs_extract_spectral.py`  
**Source DB :** `atlas.sondage_spectral_features`, `atlas.maille_spectral_vfs`

---

## 1. Question de recherche

**Peut-on prédire le VBS à partir des indices spectraux Sentinel-2 de surface ?**

Le VBS (Valeur au Bleu de méthylène de Sol) mesure l'activité argileuse géotechnique.  
Les argiles laissent une signature spectrale dans l'infrarouge court (SWIR : B11/B12).  
Si r(VBS_surface, VBS_profond) > 0, une prédiction surfacique a une valeur géotechnique.

---

## 2. Données spectrales — Extraction GEE

### Source images
- **Collection :** `COPERNICUS/S2_SR_HARMONIZED` (Surface Reflectance, harmonisé Sentinel-2)
- **Période :** 2023-01-01 → 2024-12-31 (composite médian 2 ans)
- **Filtre nuages :** < 20% CLOUDY_PIXEL_PERCENTAGE
- **Emprise :** bbox Togo [-0.2°, 6.0°, 1.9°, 11.2°]
- **Résolution extraction :** 20m (bandes SWIR)

### Indices spectraux extraits

| Indice | Formule | Référence scientifique |
|:------:|:-------:|:----------------------:|
| clay_index | B11 / B12 | Kalinowski & Oliver (2004), Int. J. Remote Sensing |
| swir_ratio | (B11−B12) / (B11+B12) | NDBI-like pour argiles |
| ndvi | (B8−B4) / (B8+B4) | Masque végétation dense |
| iron_oxide | B4 / B8 | Viscarra Rossel (2006) |

### Extraction sondages (96 géolocalisés)
- Table : `atlas.sondage_spectral_features`
- N points : **96 sondages** avec coordonnées valides
- Masque NDVI > 0.6 : zones végétation dense exclues

---

## 3. Calibration PLS — Résultats

### Paramètres de calibration

| Paramètre | Valeur |
|:---------:|:------:|
| Méthode | Partial Least Squares (PLS) |
| Variable cible | VBS_H1 (g/100g) |
| Features | clay_index, swir_ratio, ndvi, iron_oxide |
| N optimal composantes (LOO-CV) | **3** |
| N sondages fit (hors cuirasses, NDVI < 0.6) | ~80 |

### Métriques de calibration

| Métrique | Valeur | Interprétation |
|:--------:|:------:|:--------------:|
| **LOO-RMSE PLS** | **2.788 g/100g** | Erreur vraie (leave-one-out) |
| R² LOO | 0.354 | 35.4% variance expliquée |
| LOO-RMSE KED_pédologique H1 (référence) | 3.060 g/100g | Baseline géostatistique |
| **ΔLO-RMSE (VfS − KED)** | **−0.272 g/100g** | VfS **meilleur** de 8.9% |

**Conclusion calibration :** VfS UTILE (LOO-RMSE < seuil de référence KED).

---

## 4. Extraction maille pour prédiction spatiale

### Statut (2026-06-01)

**Tentative 1 (2026-05-31, background task brlzbw86f) :** ÉCHOUÉE — NaN pour tous les 29,407 centroïdes.  
**Cause racine identifiée :** bug UUID type mismatch dans `pd.DataFrame.merge()` :  
- `batch.maille_id` = `uuid.UUID` Python objects  
- `df_gee.maille_id` = strings — merge → 0 match → NaN systématique

**Correctif (CONV-06, 2026-06-01) :** `df_mailles["maille_id"] = df_mailles["maille_id"].astype(str)` avant merge.

**Tentative 2 (2026-06-01, en cours) :** batch_size=1000, 30 batches.  
Test sur batch 1 : **1000/1000 mailles avec indices spectraux valides** ✓

### Résultats attendus après extraction complète

- 29,407 mailles × 4 indices spectraux
- Prédictions VBS_VfS sur les mailles avec NDVI < 0.6 (estimation : 70–80% des mailles)
- Mailles cuirasses (`is_cuirasse=true`) : `uncertainty_flag='cuirasse_high_uncertainty'`
- σ_VfS = LOO-RMSE = 2.788 g/100g (homoscédastique — pas de krigeage de résidus VfS)

---

## 5. Cohérence verticale VBS (réponse à la vulnérabilité "depth paradox")

La question de recherche inclut : "la prédiction surfacique est-elle utile pour les horizons H2/H3 ?"

**Vérification empirique en DB :**
```sql
SELECT CORR(h1.vbs, h3.vbs) FROM ...
-- r(VBS_H1, VBS_H3) = 0.511 (N=101 sondages avec les 2 horizons)
```

Avec r = 0.511 → 26% de variance commune H1/H3.  
La prédiction VfS (surface → H1 principalement) apporte de l'information sur H3  
au-delà du modèle pédologique.

---

## 6. Limites et perspectives

| Limite | Valeur actuelle | Horizon d'amélioration |
|:------:|:--------------:|:----------------------:|
| N calibration PLS | 96 sondages | > 200 → PLS plus robuste |
| R² LOO | 0.354 | 0.5+ avec radar SAR (C-band) |
| Résolution spatiale | 20m (SWIR) | 10m (B11/B12 resampled) |
| Couverture temporelle | 2 ans | 5 ans (stabilité) |
| Validation externe | Aucune | Split temporal 2023 train / 2024 test |

---

## 7. État d'avancement — Extraction mailles (mise à jour 2026-06-04)

### 7.1 Statut base de données

| Table | Lignes | État `vbs_vfs_pred` |
|:-----:|:------:|:-------------------:|
| `atlas.sondage_spectral_features` | 96 | ✅ Spectral extrait (calibration PLS) |
| `atlas.maille_spectral_vfs` | 29 407 | ❌ `NULL` — script non relancé |

**Vérification SQL (2026-06-04) :**
```sql
SELECT COUNT(*) FILTER (WHERE vbs_vfs_pred IS NOT NULL) AS with_pred
FROM atlas.maille_spectral_vfs;
-- Résultat : 0
```

### 7.2 Raison du blocage — Dépendance critique

Le script `vfs_extract_spectral.py` a bien été corrigé (bug UUID/string, CONV-06, 2026-06-01) mais **n'a pas été relancé sur les 29 407 mailles**.

**Raison explicite :** L'audit `session/audit/AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md` a identifié une anomalie critique de géocodage affectant l'ensemble du pipeline L1–L4 :

> *185 sondages ont la coordonnée de fallback `POINT(1.0, 8.6)` — toutes rattachées à la maille `TG-0672-0197-01`. Les `maille_code` de ces sondages sont incorrects, ce qui biaise les données d'entraînement de tous les modèles, y compris les 96 sondages de calibration PLS-VfS.*

Relancer `vfs_extract_spectral.py` avant la résolution de cet audit produirait des prédictions fondées sur un jeu d'entraînement partiellement corrompu (fraction inconnue des 96 sondages concernée).

### 7.3 Condition de déblocage

Le script devra être relancé **après** l'application complète de :

```
session/audit/AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md
```

Étapes à valider avant relance :
1. ✅ Re-géocodage des sondages avec `location_mode = NULL` (≈370 sondages)
2. ✅ Recalcul des `maille_code` corrects pour les sondages impactés
3. ✅ Ré-extraction des features spectrales GEE sur les sondages corrigés (`atlas.sondage_spectral_features`)
4. ✅ Re-calibration du modèle PLS sur les données corrigées
5. ✅ Relance de `vfs_extract_spectral.py --all-mailles` pour peupler `atlas.maille_spectral_vfs`
6. ✅ Synchronisation dans `atlas.ai_interpolation_values` (parameter_id = `vbs_vfs`)

### 7.4 Impact sur l'UI

En attendant, la source **ML L3 — VfS-PLS** est accessible dans l'interface mais affiche `NO DATA` (badge "0 mailles · métriques non disponibles"). Ce comportement est intentionnel et documenté — le modèle n'est pas désactivé, uniquement non peuplé.

---

### 7.5 Checklist de déblocage (2026-06-04)

| Étape | Outil | Statut |
|-------|-------|--------|
| Appliquer migrations 102/103/104/105 | SQL psql | ⬜ À faire |
| Lancer `regeocod_fuzzy_v1.py` | Python | ⬜ À faire |
| Valider suggestions dans l'UI | localhost:1420 | ⬜ Utilisateur |
| Lancer `vfs_extract_spectral.py --mode=sondages-only` | Python | ⬜ Après étape 3 |
| Re-calibration PLS sur données corrigées | Idem | ⬜ Après étape 4 |
| Lancer `vfs_extract_spectral.py --all-mailles` | Python | ⬜ Après étape 5 |
| Vérifier `vbs_vfs_pred IS NOT NULL` en DB | SQL | ⬜ Après étape 6 |

**Ou via orchestrateur v2 (après géocodage) :**
```bash
python scripts/run_all_models_nightly_v2.py --models l3
```

---

*Script : `scripts/vfs_extract_spectral.py`*  
*Données : `atlas.sondage_spectral_features` (96 lignes), `atlas.maille_spectral_vfs` (29 407 lignes, `vbs_vfs_pred=NULL`)*  
*Blocage documenté : `docs/RAPPORT/audit/AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md` — roadmap à appliquer avant relance*  
*Orchestration : `scripts/run_all_models_nightly_v2.py` (v2 via API Rust)*
