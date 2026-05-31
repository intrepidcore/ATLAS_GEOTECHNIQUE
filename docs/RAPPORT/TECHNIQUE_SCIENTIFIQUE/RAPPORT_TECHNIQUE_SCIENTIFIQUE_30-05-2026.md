# Rapport Technique et Scientifique — Atlas Géotechnique Togo
## État de l'implémentation au 30 mai 2026

**Destinataire :** Ingénieur intégrant le projet  
**Rédigé le :** 30 mai 2026  
**Sources :** Audit `AUDIT_SESSION_30-05-2026.md` · Roadmap `ROADMAP_30-05-2026_SCORPAN.md` · Vérification directe DB/API/code  
**Base de données :** `postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean` (desktop) · `@127.0.0.1:5432` (container Docker/API)

---

## 1. Vue d'ensemble du projet

### Objectif scientifique

L'Atlas Géotechnique Togo est une plateforme nationale de cartographie des propriétés mécaniques des sols du Togo. Elle est destinée à la fois à un usage scientifique (mémoire de master, publication) et opérationnel (application desktop Tauri pour les ingénieurs géotechniciens).

Le problème central est d'interpoler spatialement 7 paramètres géotechniques mesurés sur un réseau clairsemé de **123 sondages** pour couvrir **29 407 mailles** de 2 km² couvrant l'ensemble du territoire togolais (~56 600 km²). La densité de sondages (~1 par 460 km²) est faible mais unique au Togo.

### Architecture en 3 niveaux hiérarchiques

```
L1 — KED (Krigeage avec Dérive Externe)
     → Production, 21 paramètres × 3 horizons
     → Covariable drift : altitude DSM COP30

L2 — Régression Kriging SCORPAN
     → Production, 5 paramètres × 3 horizons
     → Covariables : DSM + WorldClim + coordonnées

L3 — ML Gradient Boosting (CatBoost)
     → Expérience documentée (R² < 0)
     → Non utilisable en production tant que N < 200
```

La règle de priorité est immuable : L3 > L2 > L1 pour la qualité de prédiction **théorique**, mais L1 reste la référence opérationnelle tant que L2/L3 ne surpassent pas ses performances.

---

## 2. Données terrain — Source AMESSEFE

### 2.1 Inventaire des données

| Élément | Valeur vérifiée |
|---|---|
| Sondages en base | Variable — N sondages importés à date (actuellement 123). Ce nombre augmentera avec chaque nouvelle campagne AMESSEFE. |
| Sondages avec maille_code | ~114 géolocalisés sur la grille 2 km² (les autres manquent de coordonnées précises) |
| Horizons mesurés | H1 ≈ 1.0 m · H2 ≈ 1.5 m · H3 ≈ 2.0 m |
| Paramètres mesurés | 7 (voir tableau 2.2) |
| Données Proctor (γd, wopt) | ❌ **Inexistantes** — colonnes présentes dans le schéma mais `COUNT(gamma_d_max) = 0` sur tous les échantillons (vérification directe DB). Fonctionnalité prévue pour une future campagne. |

### 2.2 Paramètres géotechniques disponibles — mesures réelles par horizon

Les colonnes "N mesures H1/H2/H3" correspondent aux mesures **réelles terrain** (vérifiées par `SELECT COUNT()` dans `atlas.v_echantillons_essais`, fenêtres ±0.25m autour de la profondeur nominale).

| Paramètre | Colonne DB exacte | Plage physique | N H1 (1.0m) | N H2 (1.5m) | N H3 (2.0m) | Modèles |
|---|---|---|---|---|---|---|
| **VBS** | `vbs` | 0–20 g/100g | 113 | 103 | 113 | KED + RK |
| **IP** | `ip` (calculé : `ip_generated` ou `wl-wp`) | 0–80 % | 121 | 117 | 118 | KED + RK |
| **WL** | `wl` | 20–120 % | 121 | 119 | 120 | KED + RK |
| **WP** | `wp` | 10–60 % | 121 | 117 | 118 | KED + RK |
| **EG** | `potentiel_gonflement` ⚠️ | 0–20 % | 101 | 101 | 101 | KED + RK |
| **Passant 2mm** | `passant_2mm` | 0–100 % | **9** | **7** | **9** | KED uniquement |
| **Passant 80µm** | `passant_80um` | 0–100 % | 83 | 81 | 83 | KED uniquement |
| **Proctor γd, wopt** | `gamma_d_max`, `w_opt` | — | **0** | **0** | **0** | Non disponible |

> ⚠️ **Piège critique :** La colonne EG s'appelle `potentiel_gonflement` dans `v_echantillons_essais`, pas `eg`. Tout script Python qui accède à `eg` directement retournera 0 échantillons silencieusement.

> **Passant 2mm vs 80µm :** Le Passant 2mm n'a que 9 mesures par horizon — ces données existent mais sont rares. Le KED les interpole depuis ces 9 points. Le Passant 80µm dispose de 83 mesures, soit une base correcte pour l'interpolation.

> **N pour le RK SCORPAN :** Les N du tableau RK (204, 220, 211…) sont légèrement supérieurs car le script RK utilise des fenêtres d'horizon élargies (H1 = 0.5m–1.5m) qui capturent les mesures à profondeurs voisines.

---

## 3. Infrastructure de la base de données

### 3.1 Schéma principal (`atlas`)

| Table / Vue | Type | Contenu | Lignes |
|---|---|---|---|
| `atlas.mailles` | Table | 29 407 mailles 2 km² · EPSG:25231 · colonnes DSM et RK | 29 407 |
| `atlas.sondages` | Table | Sondages géolocalisés | 123 |
| `atlas.v_echantillons_essais` | Vue | Mesures terrain unifiées | 445 |
| `atlas.ai_interpolation_values` | Table | Valeurs interpolées (KED + RK) | ~1.0 M |
| `atlas.ai_interpolation_runs` | Table | Traçabilité des calculs avec métriques JSON | — |
| `atlas.ai_variograms` | Table | Paramètres variogrammes (nugget, sill, portée, LOO-RMSE) | 27 |
| `atlas.ai_parameter_catalog` | Table | Catalogue des 15 paramètres RK + métadonnées | 15 RK |
| `atlas.ai_model_registry` | Table | Modèle ML archivé | 1 |
| `atlas.ai_context_features_maille` | Table | Features DSM par maille | 29 407 |
| `atlas.maille_climate_features` | Table | Features WorldClim (prec, bio12–17) | 29 407 |
| `atlas.v_scorpan_features` | Matview | Covariables SCORPAN complètes (DSM + climat) | 29 407 |
| `atlas.v_thematic_ai_geotech` | Vue | Données thématiques exposées à l'API | 29 407 |
| `atlas.v_thematic_ai_rk` | Vue | Pivot des valeurs RK depuis ai_interpolation_values | 29 407 |
| `atlas.zones_etude` | Table | 5 zones géologiques spéciales | 5 |
| `atlas.risque_gonflement` | Table | Classes de risque RGA Chassagneux 342 unités 5 niveaux | 342 |
| `atlas.unites_geologiques` | Table | Carte géologique nationale 120 polygones 15 formations | 120 |
| `atlas.unites_pedologiques` | Table | Carte pédologique FAO/IRD 61 polygones 13 types | 61 |
| `atlas.hydrogeologie` | Table | Carte hydrogéologique 14 polygones | 14 |
| `atlas.pedological_drift_priors` | Table | Moyennes KED pré-calculées par type de sol et paramètre | ~390 |

**Couverture des couches géologiques sur les mailles :**

| Couche | Couverture territoire | Utilisation actuelle |
|---|---|---|
| `unites_pedologiques` | 100% | ✅ Dérive du KED (active) |
| `unites_geologiques` | 100% | ❌ Non utilisée dans les calculs |
| `risque_gonflement` | 100% | ❌ Affichage seulement |
| `hydrogeologie` | Partielle | ❌ Non utilisée |
| `zones_etude` | 14.5% | ⚠️ Partiellement (Lama + Bado uniquement) |

> **Opportunité de recherche :** Les couches `unites_geologiques` et `risque_gonflement` encodent des connaissances expertes sur le comportement géotechnique national. Leur intégration dans la dérive du KED (dérive hiérarchique multi-niveaux) est une des innovations scientifiques proposées dans `docs/RECHERCHE/PROPOSITION_SCIENTIFIQUE_MODELES_RUPTURE.md`.

### 3.2 Deux instances PostgreSQL — attention critique

Il y a **deux bases distinctes** dans ce projet. Ne pas les confondre :

| Instance | Port | Utilisateur | Usage |
|---|---|---|---|
| **Desktop** (PostgreSQL 17) | **5433** | `atlas` / `atlas` | Calculs scientifiques, scripts Python |
| **Container Docker** (`atlas-db`) | **5432** | `atlas` / `atlas` | API REST en production (ce que l'UI interroge) |

Les deux bases sont synchronisées manuellement (les calculs sont faits sur 5433 puis copiés vers 5432). Pour se connecter à la bonne instance, vérifier toujours le port dans `DATABASE_URL`.

---

## 4. Modèle L1 — Krigeage avec Dérive Pédologique (KED)

### 4.1 Principe

> **Correction importante par rapport à une version précédente de ce rapport :** La dérive du KED n'est pas l'altitude DSM. C'est la **moyenne pédologique par type de sol** (`atlas.unites_pedologiques`). Cette correction a été établie par lecture directe du code source `run_ked_vbs_ip_wl_wp_horizons.py`.

Le KED tel qu'implémenté dans ce projet est une **Kriging with Pedological External Drift** : la dérive est la valeur moyenne du paramètre (VBS, IP, WL…) au sein de chaque unité pédologique, calculée à partir des sondages disponibles dans cette unité. Le modèle de variogramme **sphérique** est ensuite ajusté sur les résidus après soustraction de cette dérive.

**Algorithme exact (code source `run_ked_vbs_ip_wl_wp_horizons.py`) :**
```python
# 1. Assigner un type de sol à chaque sondage et à chaque maille
#    depuis atlas.unites_pedologiques (61 polygones, 13 types)
type_sol = intersect(sondage/maille, unites_pedologiques)

# 2. Calculer la moyenne par type de sol (la "dérive")
prior[type_sol] = mean(valeurs_terrain[type_sol])

# 3. Calculer les résidus
residuals_i = valeur_terrain_i - prior[type_sol_du_sondage_i]

# 4. Krigeage ordinaire PyKrige sur les résidus
z_residus(s₀) = OrdinaryKriging(x, y, residuals).execute(s₀)

# 5. Prédiction finale
Z_KED*(s₀) = z_residus(s₀) + prior[type_sol_de_la_maille(s₀)]
```

Les moyennes pré-calculées par type de sol et par paramètre sont **persistées** dans `atlas.pedological_drift_priors` à chaque exécution (traçabilité complète).

**Les variables DSM (altitude, pente, TPI, HAND, distance_rivière) ne sont PAS utilisées dans le KED.** Elles sont exclusivement utilisées dans le modèle L2 RK SCORPAN (section 5).

### 4.2 Couches géologiques utilisées par le KED

| Couche | Table | N entrées | Couverture | Rôle |
|---|---|---|---|---|
| Unités pédologiques | `atlas.unites_pedologiques` | 61 polygones, 13 types | 100% Togo | **Dérive principale** |
| Priors stockés | `atlas.pedological_drift_priors` | ~390 lignes | Auto-mis à jour | Cache des moyennes par type de sol |

### 4.3 Résultats LOO-CV (Leave-One-Out Cross-Validation) KED

La LOO-CV est calculée **analytiquement** via la résolution du système de krigeage (stockée dans `atlas.ai_variograms.loo_rmse`). Elle représente l'erreur de prédiction en chaque site en le retirant du jeu d'entraînement.

#### Paramètres Atterberg et VBS

| Paramètre | Horizons | Nugget | Sill | Portée (km) | LOO-RMSE H1 | LOO-RMSE H2 | LOO-RMSE H3 |
|---|---|---|---|---|---|---|---|
| **VBS** (g/100g) | H1/H2/H3 | 9.29 | 11.17 | 187.9 | **3.060** | 2.922 | 2.572 |
| **IP** (%) | H1/H2/H3 | 76.53 | 106.20 | 536.3 | **10.531** | 9.395 | 9.595 |
| **WL** (%) | H1/H2/H3 | 135.76 | 169.52 | 209.4 | **13.681** | 11.765 | 10.783 |
| **WP** (%) | H1/H2/H3 | 56.53 | 58.99 | 76.1 | **8.384** | 7.857 | 7.729 |
| **EG** (%) | H1/H2/H3 | 2.22 | 3.20 | 214.5 | **1.667** | 1.690 | 1.669 |

#### Granulométrie

| Paramètre | Horizons | LOO-RMSE H1 | H2 | H3 |
|---|---|---|---|---|
| **Passant 2mm** (%) | H1/H2/H3 | 6.297 | 3.666 | 4.394 |
| **Passant 80µm** (%) | H1/H2/H3 | 16.146 | 14.330 | 14.115 |

**Interprétation :** Un LOO-RMSE VBS H1 de 3.06 g/100g sur une plage [0-20] représente une erreur relative de ~15%. Acceptable pour la densité de sondages disponible.

### 4.4 Paramètres dérivés (L1 bis)

Calculés comme moyennes H1/H2/H3, stockés en base :
- `vbs_avg`, `ip_avg`, `wl_avg`, `wp_avg`, `eg_avg`, `passant_2mm_avg`, `passant_80um_avg`

**Total L1 :** 21 paramètres × 29 407 mailles = **617 547 valeurs en production**

---

## 5. Modèle L2 — Régression Kriging SCORPAN

### 5.1 Principe

Le Regression Kriging (RK) décompose la variation spatiale en :
1. **Tendance déterministe** : modélisée par régression Ridge sur covariables SCORPAN
2. **Résidu stochastique** : interpolé par krigeage ordinaire (OrdinaryKriging via PyKrige)

**Formule :**
```
Z*(s₀) = m̂(s₀) + ê*(s₀)
m̂(s₀) = Ridge(covariables SCORPAN à s₀)     # tendance déterministe
ê*(s₀) = Krigeage ordinaire des résidus      # composante stochastique
```

### 5.2 Covariables SCORPAN complètes

C'est **ici** que les variables DSM (altitude, pente, TPI, HAND) sont utilisées — pas dans le KED L1. Le framework SCORPAN (McBratney et al., 2003) modélise les propriétés du sol comme fonction de facteurs environnementaux :

| Facteur SCORPAN | Variable | Source | Disponibilité | Rôle |
|---|---|---|---|---|
| **S** — Substrat (topographie) | `dem_altitude`, `dem_slope`, `dem_tpi`, `dem_hand` | DSM COP30 30m | ✅ 29 407/29 407 | Contrôle pédogénèse, drainage |
| **O** — Organismes (végétation) | `distance_river_m` (proxy humidité) | OSM/DSM | ✅ 29 407/29 407 | Zones humides, sols hydromorphes |
| **C** — Climat (quantitatif) | `prec_annual`, `prec_dry`, `prec_wet` | WorldClim 2.5' | ✅ 29 404/29 407 | Lixiviation, altération |
| **C** — Climat (saisonnalité) | `bio4`, `bio12`, `bio15`, `bio17` | WorldClim BIO | ✅ 29 407/29 407 | Saisonnalité (gonflement cyclique) |
| **P** — Position géographique | `lon`, `lat` | Coordonnées | ✅ 29 407/29 407 | Gradient spatial résiduel |

> **Variables BIO WorldClim (définitions pour référence) :**
> - `bio4` = saisonnalité de la température (écart-type × 100)
> - `bio12` = précipitation annuelle totale (mm) — redondant avec `prec_annual`, gardé pour compatibilité  
> - `bio15` = saisonnalité des précipitations (coefficient de variation)
> - `bio17` = précipitation du trimestre le plus sec (mm)

**Features effectives dans le modèle Ridge (vérifiées dans le code `compute_loo_cv_rk.py`) :**
```python
NUMERIC_FEATURES = [
    'dem_altitude', 'dem_slope', 'dem_tpi', 'dem_hand',
    'distance_river_m', 'prec_annual', 'prec_dry', 'prec_wet',
    'lon', 'lat'   # 10 features au total
]
# Note : le script vérifie dynamiquement quelles colonnes existent
# dans v_scorpan_features (compatible matview ET table)
```

> **Note :** `prec_dry` (minimum mensuel) et `prec_wet` (maximum mensuel) ont été calculés depuis les rasters WorldClim (1 bande/tuile, 24 540 tuiles/12 mois). Couverture : 29 404/29 407 (3 mailles hors emprise, normal).

### 5.3 Résultats de la régression Ridge

La régression Ridge (α = 1.0) modélise la tendance déterministe. Les R² mesurés sur données terrain constituent un indicateur de l'explication par les covariables SCORPAN.

| Paramètre | N (H1) | R² Ridge H1 | R² Ridge H2 | R² Ridge H3 | Interprétation |
|---|---|---|---|---|---|
| **VBS** | 204 | 0.19 | 0.20 | 0.21 | Faible — attendu avec N=200 |
| **IP** | 220 | 0.19 | 0.19 | 0.19 | Faible — forte variabilité locale |
| **WL** | 211 | 0.20 | 0.20 | 0.22 | Faible — idem |
| **WP** | 202 | 0.10 | 0.11 | 0.11 | Très faible — WP peu corrélé au DSM/climat |
| **EG** | 186 | 0.17 | 0.17 | 0.18 | Faible |

**Interprétation scientifique :** R² de 0.10–0.22 signifie que les covariables SCORPAN n'expliquent que 10–22% de la variance. Ceci est **cohérent avec la littérature** pour des propriétés géotechniques à densité d'échantillonnage < 200 points. L'essentiel de la variance reste expliqué par la structure spatiale des résidus (krigeage).

### 5.4 LOO-CV Régression Kriging (résultats finaux)

La LOO-CV a été calculée par la **méthode numérique complète** (N itérations, chaque point retiré à tour de rôle). Elle mesure la performance prédictive du modèle RK complet (régression + krigeage des résidus).

| Paramètre | N H1 | LOO-RMSE H1 | N H2 | LOO-RMSE H2 | N H3 | LOO-RMSE H3 |
|---|---|---|---|---|---|---|
| **VBS** (g/100g) | 204 | **1.81** | 310 | 2.72 | 204 | 1.98 |
| **IP** (%) | 220 | **12.47** | 329 | 21.29 | 217 | 11.73 |
| **WL** (%) | 211 | **15.18** | 319 | 23.54 | 213 | 11.99 |
| **WP** (%) | 202 | **7.07** | 307 | 9.10 | 205 | 5.87 |
| **EG** (%) | 186 | **1.04** | 279 | 1.51 | 186 | 1.17 |

**Comparaison KED vs RK (H1) :**

| Paramètre | LOO-RMSE KED | LOO-RMSE RK | Δ | Interprétation |
|---|---|---|---|---|
| VBS | 3.06 g/100g | 1.81 g/100g | **−41%** | RK nettement meilleur |
| IP | 10.53 % | 12.47 % | +18% | KED légèrement meilleur en H1 |
| WL | 13.68 % | 15.18 % | +11% | KED légèrement meilleur |
| WP | 8.38 % | 7.07 % | **−16%** | RK meilleur |
| EG | 1.67 % | 1.04 % | **−38%** | RK nettement meilleur |

> **Conclusion pour le mémoire :** Le RK améliore VBS et EG de façon significative. Pour IP et WL, le KED reste compétitif — le faible R² Ridge (+19-22%) ne parvient pas à dominer la structure spatiale bien capturée par le variogramme KED à large portée (400-530 km pour IP). Cette nuance est scientifiquement importante.

### 5.5 Stockage des résultats RK

Les valeurs RK sont stockées à **deux niveaux** pour performance API :
1. `atlas.ai_interpolation_values` (table de référence, 441 105 lignes)
2. `atlas.mailles` (colonnes directes `vbs_rk_h1`…`eg_rk_h3` pour requêtes rapides)
3. `atlas.v_thematic_ai_rk` (vue pivot pour l'API)

**Total L2 :** 15 paramètres × 29 407 mailles = **441 105 valeurs en production**

---

## 6. Modèle L3 — Machine Learning (Gradient Boosting / CatBoost)

### 6.1 État du modèle

| Attribut | Valeur |
|---|---|
| Nom | `rga_predictor` |
| Version | `supervised_ml_gb_v1` |
| Statut | `active` (archivé, non utilisé en production) |
| Cible | Prédiction multi-cible (CG, IP, VBS simultanément) |

### 6.2 Métriques de performance

| Cible | N entraînement | R² CV | RMSE CV | Interprétation |
|---|---|---|---|---|
| CG (class. gonflement) | **69** | **−0.041** | 1.568 | Pire que prédire la moyenne |
| IP | 24 | −0.005 | 4.328 % | Pire que prédire la moyenne |
| VBS | 24 | −0.011 | 2.423 g/100g | Pire que prédire la moyenne |

### 6.3 Interprétation scientifique

Un R² négatif signifie que le modèle est **moins performant** qu'un simple prédicteur naïf (la moyenne). Cela n'est pas un bug — c'est une **expérience négative documentée** qui répond à une question scientifique précise :

> *"Un modèle ML supervisé améliore-t-il la prédiction géotechnique au Togo avec N < 100 sondages ?"*
> **Réponse : Non.**

Cette réponse est précieuse car elle **justifie algorithmiquement** le choix de conserver L2 RK comme référence. La règle de déclenchement de L3 est fixée à **N > 200 sondages** (soit 77 sondages supplémentaires vs. la situation actuelle).

---

## 7. Classification RGA — Chassagneux 1996

### 7.1 Principe

La classification du risque de gonflement des argiles (RGA) selon Chassagneux (1996) utilise une formule empirique basée sur VBS, IP et EG :

```
Score RGA = 7.2 × VBS + 1.45 × IP + 2.4 × EG
```

### 7.2 Stockage

- Table de référence : `atlas.risque_gonflement` (342 unités géologiques, 5 niveaux de risque)
- Scores calculés : colonnes `ai_rga_score_infer` et `risque_gonflement_score` dans `atlas.mailles`
- Vue thématique : `atlas.v_risque_style_map` pour cartographie

> **Attention (écart avec l'audit) :** L'audit référençait `atlas.ai_rga_score` qui n'existe pas. Les scores sont dans les colonnes de `atlas.mailles` et la table `atlas.risque_gonflement` est une table de correspondance statique (pas une table de scores calculés dynamiquement).

---

## 8. API REST — Services exposés

### 8.1 Architecture des services

```
Client (UI React / Tauri)
    ↓
atlas-api-geo  (port 8000)   ← service principal
    ↓
atlas-db       (port 5432)   ← PostgreSQL container
    ↓
atlas-api-infer (port 8002)  ← microservice ML (non câblé)
atlas-api-opti  (port 8003)  ← microservice optim. (non câblé)
```

### 8.2 Endpoints critiques et leur état

| Endpoint | Méthode | État | Réponse |
|---|---|---|---|
| `/api/auth/login` | POST | ✅ | JWT token |
| `/thematic/data?parameter=vbs_ked_h1` | GET | ✅ | GeoJSON 29 407 features |
| `/thematic/data?parameter=vbs_rk_h1` | GET | ✅ | GeoJSON 29 407 features (~9.5 MB) |
| `/thematic/data?parameter=eg_rk_h1` | GET | ✅ | GeoJSON 29 407 features (~9.2 MB) |
| `/ai/variograms/summary` | GET | ✅ | Paramètres variogrammes + LOO-RMSE |
| `/api/stats/descriptive?parameter=vbs` | GET | ✅ | Stats (mean, stddev, quartiles) |
| `/api/stats/eda?parameter=vbs_ked_h1` | GET | ✅ | Histogramme EDA |
| Endpoints `atlas-api-infer` | GET | ❌ | 404 — microservice non câblé |

### 8.3 Paramètres thématiques disponibles

L'API reconnaît les `parameter=` suivants (vérifiés dans `services/api-geo/src/thematic/types.rs`) :

**KED (Krigeage avec Dérive Externe) :**
`vbs_ked_h1`, `vbs_ked_h2`, `vbs_ked_h3`, `ip_ked_h1`…`wp_ked_h3`, `eg_ked_h1`…`eg_ked_h3`, `passant_2mm_ked_h1`…`passant_80um_ked_h3`

**Régression Kriging SCORPAN :**
`vbs_rk_h1`, `vbs_rk_h2`, `vbs_rk_h3`, `ip_rk_h1`…`wp_rk_h3`, `eg_rk_h1`…`eg_rk_h3`

**ML / Divers :**
`kriging_ip`, `kriging_vbs`, `ip_derived_h1`…`ip_derived_h3`, `ai_rga_score_infer`

### 8.4 Source de données selon le paramètre

| Type de paramètre | Table source API | Vitesse |
|---|---|---|
| KED (`*_ked_*`) | `atlas.v_latest_ai_interpolation` (via ai_interpolation_values) | Rapide |
| RK (`*_rk_*`) | `atlas.v_thematic_ai_geotech` → `v_thematic_ai_rk` | ~30s (vue lourde, sans cache) |
| ML (`ai_rga*`, `kriging_*`) | `atlas.v_thematic_ai_geotech` | Rapide |

> **Note performance :** Les endpoints RK sont lents (~30 secondes pour 9.5 MB de GeoJSON) car `v_thematic_ai_geotech` joint 6 tables en LEFT JOIN. Un index ou une matview dédiée améliorerait les performances.

---

## 9. Frontend et application desktop

### 9.1 Stack technique

- **UI** : React + Vite + TypeScript + Leaflet (cartes choroplèthes)
- **Desktop** : Tauri v2 (packaging MSI/NSIS/WiX pour Windows)
- **Connexion API** : `window.__ATLAS_CONFIG__.apiBase` injecté à l'initialisation Tauri

### 9.2 Fonctionnalités opérationnelles

- ✅ Carte interactive Leaflet avec sélecteur de paramètres (KED + RK + dérivés)
- ✅ Panneau thématique avec 15 paramètres RK visibles (code TypeScript prêt)
- ✅ Sélecteur d'horizon H1/H2/H3
- ✅ Expert DB tab avec tableau LOO-RMSE (affiche `—` si NULL)
- ✅ API health indicator

### 9.3 Application desktop — Seed v1.3.0

| Attribut | Valeur |
|---|---|
| Taille dump | **153.7 MB** (sans rasters WorldClim/DSM, inutiles au runtime) |
| Format | pg_dump -Fc (PostgreSQL custom format) |
| SHA256 | `EE23ACBD30824E106D41E34F00815625BFC551DCD275CB10F875A6C215B98F68` |
| Manifest | v2 · 6 invariants · `seed_version: 1.3.0` |
| Contenu inclus | 29 407 mailles · 15 params RK · 12 params KED · 5 zones · prec_dry/wet |
| Contenu exclu | worldclim_prec · worldclim_bio · dsm_cop30 · dsm_slope |

---

## 10. Zones géologiques

5 zones en base (contrairement à l'audit qui en mentionnait 1) :

| Zone | ID | Statut |
|---|---|---|
| Dépression de la Lama (Togo) | `ddfdedcc-...` | ✅ Opérationnelle |
| Dépression du Bado (Bas-Togo) | `d209fe67-...` | ✅ Ajoutée (migration 151) |
| Plaine du Mono (Est) | `41eb6bd2-...` | ✅ Ajoutée |
| Plaine de l'Oti (Togo) | `443bc1c6-...` | ✅ Ajoutée |
| Dépression de la Fosse aux Lions (Extrême Nord) | `ce4036b9-...` | ✅ Ajoutée |

---

## 11. Écarts entre l'audit initial et l'état réel

> L'audit a été rédigé le 30 mai 2026 matin. La roadmap a été exécutée dans la même journée. Ce tableau réconcilie ce qui était annoncé avec ce qui existe réellement.

| Section audit | Affirmation audit | Réalité vérifiée | Verdict |
|---|---|---|---|
| Sondages | 87 | **123** | ❌ Audit périmé |
| `atlas.ai_rga_score` ✅ | Table existante | Table inexistante — scores dans `mailles` | ❌ Audit incorrect |
| EG RK ❌ Absent | Pas de données | **29 407 valeurs eg_rk_h1/h2/h3** | ❌ Audit périmé |
| Zones 1/5 | Bado/Mono/Oti/Lions manquantes | **5/5 zones présentes** | ❌ Audit périmé |
| Migration 151 ❌ | prec_dry/wet à faire | **29 404/29 407 calculées** | ❌ Audit périmé |
| Migration 152 ❌ | EG RK catalog à faire | **15 params RK dans catalog** | ❌ Audit périmé |
| API vbs_rk_h1 → 422 | Non servi | **HTTP 200 · 9.5 MB** | ❌ Audit périmé |
| stats/descriptive ✅ | OK | **HTTP 500** → corrigé → **HTTP 200** | Régression puis fix |
| LOO-CV ❌ NULL | Non calculée | **15/15 LOO-RMSE calculées** | ❌ Audit périmé |
| Dump 1.65 GB | Trop lourd | **153.7 MB** sans rasters | ✅ Audit correct → corrigé |
| token.txt ❌ | Dans git | Retiré du suivi (git rm --cached) | ✅ Corrigé |
| 4 classes RGA | faible/moyen/fort/très fort | 5 niveaux en DB (Très Faible → Très Élevé) | ⚠️ Écart nomenclature |

---

## 12. État des migrations post-v1

| Migration | Fichier | Contenu | Statut |
|---|---|---|---|
| 150 | `150_create_scorpan_view_final.sql` | Matview v_scorpan_features initiale | ✅ Appliquée |
| 151 | `151_update_eg_constraints.sql` | Contraintes physiques EG dans catalog | ✅ Appliquée |
| 151 (db/) | `151_zones_bado_mono_fosse_nord.sql` | 4 zones géologiques ajoutées | ✅ Appliquée |
| 152 | `152_add_rk_columns_mailles.sql` | Colonnes vbs_rk_h1…eg_rk_h3 dans mailles | ✅ Appliquée |
| 153–155 | Vues RK | v_thematic_ai_rk + v_thematic_ai_geotech mis à jour | ✅ Appliquées |
| **Nouvelle** | (Recréation) | v_scorpan_features avec prec_dry/prec_wet | ✅ Appliquée |

---

## 13. Scripts de calcul disponibles

Tous les scripts sont dans `scripts/` du repository.

### 13.1 Scripts Python

| Script | Usage | Durée | Idempotent |
|---|---|---|---|
| `compute_loo_cv_rk.py` | Calcul LOO-CV Ridge+PyKrige pour les 15 params RK | ~2 min | ✅ (BM-SYNC-05) |
| `compute_prec_dry_wet_fast.py` | Extraction valeurs WorldClim raster → prec_dry/prec_wet | ~80 min | ✅ |

**Lancement LOO-CV :**
```powershell
$env:PYTHONUTF8 = "1"
python scripts\compute_loo_cv_rk.py `
    --database-url "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean" `
    --horizons "h1,h2,h3" `
    --params "vbs,ip,wl,wp,eg"
```

**Lancement calcul prec_dry/wet :**
```powershell
$env:PYTHONUTF8 = "1"
python scripts\compute_prec_dry_wet_fast.py `
    --database-url "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
```

### 13.2 Script SQL

| Script | Usage |
|---|---|
| `scripts/sql/compute_prec_dry_wet_single_band.sql` | Calcul SQL pur (alternative lente ~80 min) |

---

## 14. Ce qui reste à implémenter (work in progress)

Les points suivants ne sont **pas bloquants pour la production** mais sont requis pour le mémoire et la complétude scientifique :

| Priorité   | Item                           | Description                                                 | Effort   |
| ---------- | ------------------------------ | ----------------------------------------------------------- | -------- |
| 🟠 Haute   | Trigger post-import            | `pg_notify` → worker Python → recalcul KED+RK auto          | 1 jour   |
| 🟠 Haute   | CI/CD L1/L2                    | Tests de régression LOO-RMSE sur push                       | 0.5 jour |
| 🟡 Moyenne | Performance API RK             | Index/matview sur v_thematic_ai_geotech (30s → < 5s)        | 2h       |
| 🟡 Moyenne | LOO-CV analytique PyKrige      | Remplacer N itérations par formule analytique               | 2h       |
| 🟢 Basse   | EG RK LOO-CV avec prec_dry/wet | Recalculer les 3 horizons EG avec le modèle SCORPAN complet | 30 min   |
| 🟢 Basse   | Microservices api-infer/opti   | Câbler dans main.rs                                         | 1 jour   |

### Trigger automatique post-import (architecture recommandée)

```
Import Excel → API /import
    → INSERT dans essais_*
    → pg_notify('pipeline_trigger', '{"params":["vbs","ip"]}')
    → Worker Python écoute LISTEN pipeline_trigger
    → compute_loo_cv_rk.py --params vbs,ip
    → REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.v_scorpan_features
    → LOG dans ai_interpolation_runs
```

Cette architecture respecte les règles Intrepid Core : ETL-03 (gestion d'erreurs), BM-SYNC-05 (idempotence), DB-11 (atomicité).

---

## 15. Arbre de décision — quel modèle utiliser ?

```
Nouveau sondage importé
        │
        ▼
N total < 200 ?
   │          │
  OUI         NON (futur)
   │           └─→ Déclencher L3 CatBoost (recalcul complet)
   ▼
Utiliser L2 Régression Kriging SCORPAN
   └─→ LOO-RMSE disponible pour comparer avec L1 KED
   └─→ Si RK LOO-RMSE > KED LOO-RMSE → afficher L1 pour ce paramètre
   └─→ Sinon → afficher L2

API : ?parameter=vbs_rk_h1  (L2 disponible)
API : ?parameter=vbs_ked_h1 (L1 toujours disponible comme référence)
```

---

## 16. Résumé pour l'ingénieur qui intègre le projet

**Ce qui fonctionne en production (aujourd'hui) :**
- ✅ L'API sert les 21 paramètres KED et les 15 paramètres RK via `GET /thematic/data?parameter=<id>`
- ✅ Les LOO-CV sont calculées et stockées pour tous les modèles
- ✅ Le dump desktop seed v1.3.0 (153.7 MB) est prêt pour packaging Tauri
- ✅ Les 5 zones géologiques togolaises sont en base

**Ce qu'il faut comprendre avant de modifier quoi que ce soit :**
1. Toujours travailler sur la DB desktop (port **5433**) pour les calculs
2. Copier manuellement vers la DB container (port **5432**) après chaque calcul lourd
3. La colonne EG dans `v_echantillons_essais` s'appelle `potentiel_gonflement`
4. `$env:PYTHONUTF8 = "1"` avant tout script Python sur Windows (encodage)
5. Le binaire API dans le container peut diverger de la source — toujours vérifier la version

**Références scientifiques clés :**
- KED : Goovaerts (1997), *Geostatistics for Natural Resources Evaluation*
- RK SCORPAN : McBratney et al. (2003), *On digital soil mapping*
- Variogramme sphérique : Matheron (1963), *Principles of geostatistics*
- Chassagneux RGA : Chassagneux & Chaussier (1996), *Carte géotechnique des risques de gonflement*
- Covariables topographiques : Wilson & Gallant (2000) ; HAND : Rennó et al. (2008)
