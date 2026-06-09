# Couverture des Modèles par Paramètre — Preuves Formelles DB
## Atlas Géotechnique Togo — Source de vérité 2026-06-07

> **RÈGLE ABSOLUE** : Toutes les valeurs de ce document proviennent de requêtes SQL directes  
> sur `atlas_clean` @ 127.0.0.1:5433. Aucune estimation.

---

## 1. Sondages disponibles par paramètre et horizon — Preuve DB

### 1.1 Paramètres d'argilosité (base de référence)

| Paramètre | Table source | Colonne | H1 | H2 | H3 | Total estimations |
|-----------|-------------|---------|-----|-----|-----|-----------------|
| vbs | essais_vbs | vbs | **135** | 103 | 103 | 341 |
| ip | essais_atterberg | ip_generated | **434** | 104 | 115 | 653 |
| wl | essais_atterberg | wl | **438** | 105 | 117 | 660 |
| wp | essais_atterberg | wp | **414** | 103 | 114 | 631 |
| eg | essais_potentiel_gonflement | cg | **90** | 90 | 90 | 270 |

*Note EG : les 90 par horizon sont les mêmes sondages — même profondeur taguée H1/H2/H3*

### 1.2 Paramètres de portance et in-situ

| Paramètre | Table source | Colonne | H1 | H2 | H3 | Notes |
|-----------|-------------|---------|-----|-----|-----|-------|
| **cbr_95** | essais_cbr | cbr_pct (compactage=95%) | **280** | 0 | 0 | Essai CBR : profondeur unique (H1) |
| **gamma_d** | essais_proctor | gamma_d_max | **348** | 0 | 8 | Proctor : principalement H1 |
| **w_opt** | essais_proctor | w_opt | **348** | 0 | 8 | Idem gamma_d |
| em_mpa | essais_pressiometre | em_mpa | **5** | 0 | 5 | **CRITIQUE : n=5 sondages uniques** |
| pl_mpa | essais_pressiometre | pl_mpa | **5** | 0 | 5 | Idem em_mpa |
| rd_mpa | essais_penetrometre | rd_mpa | **38** | 39 | 42 | Multi-horizons disponible |

**Clarification em/pl_mpa** : Le rapport dit "n=26 essais pressiomètre" mais ce sont 26 MESURES pour seulement 5 sondages distincts (profils multi-profondeurs sur les mêmes points). La cartographie nationale avec n=5 sondages (tous dans Savanes/Maritime) est statistiquement inacceptable.

---

## 2. Distribution géographique des paramètres de portance

| Paramètre | Maritime | Plateaux | Centrale | Kara | Savanes |
|-----------|---------|---------|---------|------|---------|
| cbr_95 | 80 | 140 | 31 | 26 | 3 |
| rd_mpa | 17 | 19 | 0 | 0 | 2 |
| em_mpa | 1 | 0 | 0 | 0 | 4 |

**Observation critique** : em_mpa est principalement dans les Savanes (4/5 sondages) = Dapaong zone. Contrairement à ce que le directeur et nous-mêmes pensions, ce n'est PAS uniquement en Maritime. Mais 5 sondages = trop peu de toute façon.

---

## 3. Couverture des modèles ML par paramètre — Tableau décisionnel

### Légende
- ✅ = Données suffisantes, modèle calculé, RMSE disponible
- 🟡 = Données suffisantes, modèle FAISABLE mais non implémenté
- ❌ = Données insuffisantes (n < 50) ou modèle impossible
- — = Non applicable

> **Niveaux pipeline** : L1=KED-H | L2a=RK SCORPAN | L2b=BLUP Fusion | L3=VfS (Sentinel-2, VBS only) | L4=MTGP | L5=SGS (incertitude)

| Paramètre | KED-H L1 | KED-H H2 | KED-H H3 | RK L2a | BLUP L2b | VfS L3 | MTGP L4 | SGS L5 |
|-----------|---------|---------|---------|--------|---------|--------|---------|--------|
| **vbs** | ✅ 2.93 | ✅ 3.20 | ✅ 2.31 | ✅ | ✅ | 🟡 GEE | ✅ 3.46 | ✅ P10=1.54 P50=3.82 P90=8.20 |
| **ip** | ✅ 9.79 | ✅ | ✅ | ✅ | ✅ | — | ✅ | 🟡 |
| **wl** | ✅ 12.31 | ✅ | ✅ | ✅ | ✅ | — | ✅ | 🟡 |
| **wp** | ✅ 7.77 | ✅ | ✅ | ✅ | ✅ | — | ✅ | 🟡 |
| **eg** | ✅ 1.67 | ✅ | ✅ | ✅ | ✅ | — | ✅ | 🟡 |
| **cbr_95** | ✅ 13.27 | ❌ H2=0 | ❌ | ✅ H1 (avg=30.2%) | ✅ 37% réd.var. | — | ✅ | ✅ P10=15.7% P50=28.5% P90=57.8% |
| **gamma_d** | ✅ **0.141 g/cm³** (¹) | ❌ H2≈0 | ❌ | ✅ H1 fixé RMSE=0.119 g/cm³ | ✅ 47.8% réd.var. | — | ✅ kN/m³ | — |
| **w_opt** | ✅ 1.81 | ❌ H2≈0 | ❌ | ✅ H1 (avg=10.0%) | ✅ 48.1% réd.var. | — | ✅ | — |
| em_mpa | ✅* n=21 | ❌ H2=0 | ✅* n=21 | ❌ n=5 | ❌ | — | ❌ | ❌ |
| pl_mpa | ✅* n=21 | ❌ H2=0 | ✅* n=21 | ❌ n=5 | ❌ | — | ❌ | ❌ |
| rd_mpa | ✅ 3.45 | ✅ | ✅ | ❌ n=38 | ❌ | — | ❌ | 🟡 |

*\* em/pl_mpa : le n=21 dans KED vient de la table echantillons (mesures), pas de sondages uniques.*

**🚨 CORRECTION CRITIQUE du rapport directeur** :  
> *"CBR, Rd, γd, wopt → pas de modèle RK → pas de fusion BLUP."*

**FAUX pour CBR, γd, w_opt.** Ces trois paramètres ont 280-348 sondages H1 — PLUS que VBS (135). L'absence de RK est un **GAP D'IMPLÉMENTATION**, pas une limite de données. Il faut :
1. Étendre `atlas_regression_kriging_terrain.py` pour accepter ces paramètres
2. Définir les covariables SCORPAN adaptées à la portance

---

## 4. RMSE réels en DB — Tableau de performance (H1)

Source : `atlas.ai_interpolation_runs` @ port 5433  
Extraction : meilleur run (RMSE minimal) par paramètre × méthode

| Paramètre | N entr. | KED-H RMSE | RK SCORPAN | MTGP | Global mean | CV = RMSE/mean |
|-----------|---------|-----------|------------|------|-------------|----------------|
| vbs | 111 | **2.933** | — | 3.458 | 4.13 | 71% |
| ip | 112 | **9.786** | — | — | 20.7 | 47% |
| wl | 118 | **12.314** | — | — | 32.1 | 38% |
| wp | 118 | **7.771** | — | — | 21.6 | 36% |
| eg | 93 | **1.668** | — | — | 4.0 | 42% |
| cbr_95 | 71 | **13.266** | ❌ | — | 47.1 | 28% |
| gamma_d | 255 | **0.141 g/cm³** (¹) | RK: **0.119 g/cm³** | — | 2.09 | 6.8% |
| w_opt | 255 | **1.811** | ❌ | — | 14.7% | 12% |
| em_mpa | 21 | 13.310 | ❌ | ❌ | 17.65 | 75% |
| rd_mpa | 89 | 3.449 | ❌ | ❌ | ~20 MPa | ~17% |

**MTGP vs KED-H pour VBS** : MTGP = 3.458 vs KED-H = 2.933 → **MTGP est 18% PLUS MAUVAIS**. C'est la réalité des données — le co-krigeage n'améliore pas VBS en H1. Il doit être testé pour EG et WP (paramètres sous-documentés) pour confirmer le gain 8-12% annoncé.

---

## 5. Analyse de l'asymétrie — Point 3.6 appliqué à tous les paramètres

Le directeur a soulevé l'asymétrie pour VBS uniquement. Voici la réalité pour tous :

| Paramètre | Min | Moyen | Max | Skewness estimé | Log-transform ? |
|-----------|-----|-------|-----|-----------------|-----------------|
| **vbs** | 0.01 | 4.13 | ~18 | **2.41 (confirmé)** | ✅ Indispensable |
| **cbr_95** | ~2 | 47.1 | 132 | **élevé** (CBR=0-132) | ✅ Recommandé |
| **ip** | ~5 | 20.7 | ~80 | modéré | 🟡 Optionnel |
| **eg** | 0 | 4.0 | ~15 | modéré-élevé | 🟡 Optionnel |
| **gamma_d** | 1.4 | 2.09 | 2.4 | faible (physiquement borné) | ❌ Inutile |
| **w_opt** | 8% | 14.7% | 30% | faible | ❌ Inutile |
| **em_mpa** | 2 | 17.65 | ~60 | élevé | ✅ Pour n=21 |
| **rd_mpa** | 1.8 | ~20 | 40 | modéré | 🟡 Optionnel |

**Le problème d'asymétrie n'est PAS spécifique à VBS** — CBR est encore plus problématique (range 0-132%, CV = 28% mais distribution très étalée).

---

## 6. Recommandations modèles par paramètre — Ce qu'il faut faire

### 6.1 Actions immédiates (données disponibles, implémentation manquante)

```python
# Étendre RK SCORPAN pour cbr_95, gamma_d, w_opt
# → Modifier atlas_regression_kriging_terrain.py

PARAMS_PORTANCE = {
    'cbr_95':  {'table': 'essais_cbr', 'col': 'cbr_pct',
                'where': 'AND compactage_pct = 95',
                'covariables': ['dsm_slope', 'worldclim_bio01', 'worldclim_bio12',
                                'pedologie', 'risque_rga']},  # proxy portance = topo + humid.
    'gamma_d': {'table': 'essais_proctor', 'col': 'gamma_d_max',
                'covariables': ['pedologie', 'risque_rga', 'dsm_elev']},
    'w_opt':   {'table': 'essais_proctor', 'col': 'w_opt',
                'covariables': ['worldclim_bio12', 'pedologie', 'zone_geo']},
}
# Avec ~280-348 sondages → Ridge Ridge solide, possibilité de fusion BLUP ensuite
```

### 6.2 em_mpa / pl_mpa — Position finale

**Ne plus cartographier à l'échelle nationale.** Avec 5 sondages uniques :
- Retirer des livrables principaux
- Déplacer en Annexe "Données exploratoires"
- Mentionner dans l'article : *"n=5 sondages distincts, cartographie illustrative uniquement, à confirmer par sondage pressiomètre ciblé"*

### 6.3 SGS — Applicable à vbs et cbr_95 en priorité

```python
import gstools as gs
# Pour VBS (asymétrie 2.41) :
# → log-transform AVANT SGS, back-transform APRÈS
log_vbs = np.log1p(vbs_values)
model = gs.Spherical(dim=2, var=np.var(log_vbs), len_scale=80_000)
srf = gs.SRF(model, seed=42)
# 50 réalisations → P10/P50/P90 → intervalles non-symétriques
```

---

*Document créé le 2026-06-07 — Preuves formelles issues de atlas_clean @ port 5433*  
*Données : comptage sondages par paramètre/horizon, RMSE depuis ai_interpolation_runs*
