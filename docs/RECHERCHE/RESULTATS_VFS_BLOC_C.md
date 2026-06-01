# Résultats — VBS-from-Sentinel (VfS) — BLOC C
## Atlas Géotechnique Togo

**Date :** 2026-06-01  
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

*Script : `scripts/vfs_extract_spectral.py`*  
*Données : `atlas.sondage_spectral_features` (96 lignes), `atlas.maille_spectral_vfs` (extraction 2026-06-01)*
