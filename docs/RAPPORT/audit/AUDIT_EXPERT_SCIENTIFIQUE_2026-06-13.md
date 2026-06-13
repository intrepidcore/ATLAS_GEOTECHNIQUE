# Audit Expert Scientifique — Panneau UI/UX + Refonte Métier
## Atlas Géotechnique Togo — 2026-06-13

> **Auteur :** Claude Sonnet 4.6 + Serge TABE DJATO  
> **Périmètre :** `ui/src/components/ExpertScientificDbTab.tsx` (1 677 lignes)  
> **Sources :** docs/RECHERCHE/* · CONVENTION_HIERARCHIE_MODELES_L1_L4 · METRIQUES_PERFORMANCES_MODELES · METRIQUES_VALIDATION_COMPARATIVES · COUVERTURE_MODELES_PAR_PARAMETRE · DISTRIBUTION_SPATIALE_SONDAGES · INVENTAIRE_DONNEES_POST_V10 · MATRICE_CORRELATIONS_PARAMETRES · ARCHITECTURE_PIPELINE_ML

---

## 1. Diagnostic — État actuel

### 1.1 Architecture des onglets actuels

| # | Onglet | Sous-onglets | Tables lues |
|---|--------|-------------|-------------|
| 1 | **Données brutes** | Résumé (6 KPIs), Catalogue, **LOO RMSE**, **Couverture** | `ai_variograms`, `ai_interpolation_runs` |
| 2 | **EDA** | Histogrammes, boxplots | `ai_parameter_catalog` |
| 3 | **Variogrammes** | Modèles, multi-domaines | `ai_variograms` |
| 4 | **Validation** | LOO Validation, RMSE param., RMSE domaine | `ai_variograms`, `ai_interpolation_runs` |
| 5 | **Registre ML** | Pipeline L1-L5, Supervisés | `/api/ai/models/status`, `/api/stats/ml-registry` |
| 6 | **Comparaison** | Méthodes interpolation | `ai_variograms` |
| 7 | **Système** | Jobs, logs, santé | `ai_job_queue`, logs |

### 1.2 Confusions identifiées

#### CRITIQUE — Duplication LOO RMSE ×4
La colonne `loo_rmse` (issue de `ai_variograms`) apparaît dans **4 onglets distincts** avec des intitulés différents :
- Onglet "Données brutes" → sous-onglet **"LOO RMSE"**
- Onglet "Variogrammes" → colonne LOO RMSE dans le tableau des modèles
- Onglet "Validation" → sous-onglet **"LOO Validation"** + **"RMSE param."**
- Onglet "Comparaison" → colonne LOO RMSE dans la comparaison des méthodes

**Impact :** l'utilisateur ne sait pas où chercher la métrique de référence. Les 4 vues lisent `ai_variograms` (variogramme KED uniquement), sans exposer RK SCORPAN ni la validation bloc-spatial.

#### GRAVE — "Données brutes" ≠ données brutes
L'onglet "Données brutes" contient :
- LOO RMSE = métrique de **performance de modèle** (pas une donnée brute)
- Couverture = **résultat d'interpolation** (pas une donnée brute)
- Résumé 6 KPIs = **agrégats** (pas des données brutes)
- Seul "Catalogue" est réellement une donnée brute

**Impact :** confusion conceptuelle qui nuit à la navigation scientifique.

#### IMPORTANT — Validation LOO-CV vs Bloc-Spatial absente
Les docs (`METRIQUES_VALIDATION_COMPARATIVES.md`) documentent un **biais de +10 à +38 % du LOO-CV** par rapport à la validation bloc-spatial (Roberts et al. 2017). Cette distinction scientifique cruciale est totalement absente de l'UI.

| Paramètre | RMSE LOO affiché | RMSE réel (bloc) | Optimisme |
|-----------|-----------------|------------------|-----------|
| VBS H1 | 2.93 | 4.07 | **+38.7%** |
| IP H1 | 9.79 | 10.78 | +10.1% |
| WL H1 | 12.31 | 13.93 | +13.1% |

**Impact :** l'UI affiche des métriques optimistes sans avertissement. Risque réputationnel si présenté à un directeur de thèse.

#### IMPORTANT — Matrice couverture paramètre × niveau absente
`COUVERTURE_MODELES_PAR_PARAMETRE.md` documente 11 paramètres × 6 niveaux (L1–L5 + supervisé). L'UI n'expose aucune vue matricielle permettant de voir quels calculs existent et lesquels sont des gaps.

Exemples de gaps critiques à signaler :
- `em_mpa`, `pl_mpa` : n=5 sondages seulement → cartographie inadmissible
- CBR, γd, w_opt : aucun modèle RK (gap d'implémentation, pas limite de données)
- MTGP (+18% RMSE vs KED-H pour VBS) : ne doit pas être présenté comme "niveau supérieur"

#### IMPORTANT — Distribution sondages absente
`DISTRIBUTION_SPATIALE_SONDAGES.md` documente :
- 77.8% des sondages positionnés **algorithmiquement** (±5–20 km), pas GPS réels
- Déséquilibre nord/sud : Kara+Savanes = 10.3% des sondages, 0 GPS exact
- Zones structurellement blanches : Dankpen, Kpendjal, Tone

Sans cette vue, l'utilisateur peut croire que les cartes ont la même fiabilité sur tout le territoire.

#### MINEUR — Heatmap corrélations absente
`MATRICE_CORRELATIONS_PARAMETRES.md` : IP–WL=0.804, IP–EG=0.735 → justification du co-krigeage MTGP. VBS–WP=0.074 → WP doit être exclu du groupe VBS dans l'ICM. Non visible dans l'UI.

#### MINEUR — Registre ML peu paramétrable
Le bouton "Relancer" envoie uniquement `{ job_type, requested_by }`. Il n'y a pas :
- Sélection du paramètre cible (ex : relancer KED uniquement pour VBS)
- Sélection de l'horizon (H1 / H2 / H3)
- Option forçage (force_recompute)
- Visualisation des dépendances (KED → RK → BLUP)
- ETA estimé (KED ~5 min, MTGP ~30 min)

---

## 2. Règles de refonte — Objectifs clairs par onglet

### Principe directeur
> **Un concept = un onglet. Aucune métrique ne doit apparaître plus d'une fois.**

| Règle | Description |
|-------|-------------|
| R1 | LOO-RMSE centralisé dans un seul onglet "Performances" |
| R2 | "Données" = données sources uniquement (pas de métriques dérivées) |
| R3 | Toujours afficher LOO-CV **et** LOO-bloc côte à côte avec le biais calculé |
| R4 | Matrice paramètre × niveau obligatoire avec badges de statut |
| R5 | Fiabilité régionale affichée pour chaque carte (badges ⭐–⭐⭐⭐⭐) |
| R6 | Registre ML conservé + enrichi de filtres par paramètre/horizon |
| R7 | Alertes scientifiques intégrées (n=5 insuffisant, biais LOO, gaps pipeline) |

---

## 3. Architecture proposée — 6 onglets

### Vue d'ensemble

```
┌─────────┬────────────────┬──────────────┬─────────────┬────────────┬──────────┐
│ DONNÉES │ GÉOSTATISTIQUES│ PERFORMANCES │ COMPARAISON │ REGISTRE ML│ SYSTÈME  │
│ (brutes)│ (variogrammes) │ (métriques)  │ (méthodes)  │ (calculs)  │ (logs)   │
└─────────┴────────────────┴──────────────┴─────────────┴────────────┴──────────┘
```

---

### Onglet 1 — DONNÉES

**Objectif :** Inventaire des données sources. Aucune métrique de performance.

**Sous-onglets :**

| Sous-onglet | Contenu | Source |
|-------------|---------|--------|
| **Catalogue** | Liste paramètres (code, label, famille, unité, n_sondages) | `ai_parameter_catalog` |
| **Sondages** | Distribution spatiale : densité/région, GPS exact vs estimé, fiabilité régionale (badges ⭐), zones blanches | `sondages.location_mode` + ADM1 |
| **Horizons** | Compteurs H1/H2/H3 par famille, alertes n < 30 | `essais_*` agrégés |
| **EDA** | Histogrammes, boxplots, statistiques descriptives | `ai_parameter_catalog` + données essais |

**Alertes intégrées :**
- Badge rouge "n=5" pour em_mpa et pl_mpa
- Avertissement "Kara/Savanes : aucun GPS — carte extrapolée"
- Compteur GPS exact vs estimé avec tooltip

---

### Onglet 2 — GÉOSTATISTIQUES

**Objectif :** Structure spatiale des paramètres. Variogrammes, stationnarité. PAS de LOO RMSE ici.

**Sous-onglets :**

| Sous-onglet | Contenu | Source |
|-------------|---------|--------|
| **Modèles variogramme** | Nugget, Sill, Portée (km), Modèle (sphérique/exponentiel/gaussien) | `ai_variograms` |
| **Ajustement** | Qualité fit (alerte: nugget pur = absence de structure spatiale), courbe théorique vs empirique | `ai_variograms.fit_quality` |
| **Multi-domaines** | Variogrammes par domaine pédologique/géologique | `ai_variograms` (domaine split) |
| **Stationnarité** | Test de stationnarité par région (drift spatial) | `validation_stationnarite` |

**Supprimer :** colonne LOO RMSE de ce tableau (elle appartient à l'onglet Performances).

---

### Onglet 3 — PERFORMANCES

**Objectif :** TOUTES les métriques de validation au même endroit. Vue unique et exhaustive.

**Sous-onglets :**

| Sous-onglet | Contenu | Source |
|-------------|---------|--------|
| **LOO-CV** | RMSE par paramètre × horizon × méthode (KED-H, RK, BLUP). Colonne "Qualité" (Databar). | `ai_variograms.loo_rmse` |
| **Bloc-Spatial** | RMSE réel (5 blocs latitudinaux). Comparaison LOO-CV vs Bloc-Spatial. Biais en % avec badge couleur. | `validation_bloc_spatial` |
| **Couverture** | % mailles couvertes par paramètre/méthode. Carte choroplèthe de couverture. | `ai_interpolation_runs` |
| **Matrice statuts** | Tableau paramètre × niveau (L1–L5) avec badges : ✅ calculé / 🟡 gap d'impl. / ❌ impossible | `ai_interpolation_runs` + règles métier |

**Note LOO-CV vs Bloc-Spatial :** afficher ensemble avec explication :
> "Le LOO-CV sous-estime l'erreur réelle de 10–39% en raison de la corrélation spatiale. Le RMSE bloc représente l'erreur attendue en production. (Roberts et al. 2017)"

---

### Onglet 4 — COMPARAISON

**Objectif :** Comparer les méthodes entre elles. Aider à choisir le meilleur modèle par cas.

**Sous-onglets :**

| Sous-onglet | Contenu | Source |
|-------------|---------|--------|
| **KED vs RK** | Tableau 15 cas (5 params × 3 horizons). Gagnant par case. Δ RMSE. Anomalie H2 RK. | `ai_variograms` + `ai_interpolation_runs` |
| **Corrélations** | Heatmap 5×5 argilosité + 3×3 portance. Groupes ICM recommandés. Tooltip physique. | Matrice SQL M-6 (inline ou table dédiée) |
| **Incertitude** | Intervalles P10/P50/P90 SGS pour VBS et CBR. Carte d'incertitude. | `ai_interpolation_values` quantiles |

**Règle d'affichage KED vs RK :**
- KED gagne 9/15, RK gagne 6/15 → ne pas présenter RK comme "meilleur"
- H2 RK systématiquement mauvais → badge avertissement automatique
- MTGP RMSE 3.46 vs KED 2.93 pour VBS → MTGP n'est PAS la meilleure option pour VBS

---

### Onglet 5 — REGISTRE ML *(conservé + enrichi)*

**Objectif :** Lancer, paramétrer, surveiller les calculs. Vue opérationnelle.

**Sous-onglets :**

| Sous-onglet | Contenu | Nouveau ? |
|-------------|---------|-----------|
| **Pipeline L1-L5** | Tableau existant + améliorations | Enrichi |
| **Lancer un calcul** | Formulaire paramétré par niveau | NOUVEAU |
| **File de jobs** | État `ai_job_queue` en temps réel | NOUVEAU |
| **Supervisés** | CatBoost, ONNX, RGA | Existant |

**Améliorations Pipeline L1-L5 :**
- Ajouter colonne "Dépendances" avec icône chaîne (KED → RK → BLUP)
- Ajouter colonne "ETA estimé" (KED: ~5 min · RK: ~3 min · MTGP: ~30 min · SGS: ~30 min)
- Ajouter colonne "RMSE bloc" (pas seulement LOO)
- Badge "Dette technique" sur L2b BLUP (calcul intensif dans api-geo)
- Badge "Internet requis" sur L3 VfS (GEE)

**Formulaire "Lancer un calcul" (NOUVEAU) :**
```
Niveau    : [L1 KED-H ▼]
Paramètre : [Tous ▼] ou [VBS / IP / WL / WP / EG / CBR...]
Horizon   : [Tous ▼] ou [H1 / H2 / H3]
Options   : [ ] Force recompute  [ ] Inclure variogramme  [ ] Log verbeux
            [Lancer] — dépendances auto-résolues
```

**File de jobs (NOUVEAU) :**
- Tableau `ai_job_queue` en temps réel : job_id, type, statut, started_at, progress %
- Polling WebSocket ou interval 5s
- Bouton "Annuler" par job

---

### Onglet 6 — SYSTÈME

**Objectif :** Santé technique, logs, état infrastructure.

**Sous-onglets :**

| Sous-onglet | Contenu | Source |
|-------------|---------|--------|
| **État** | Trigger refresh_mailles (actif/désactivé), MV index, connexion DB | Health checks |
| **Historique jobs** | Tous les runs passés avec durée, erreurs, meta.script | `ai_interpolation_runs` |
| **Architecture** | Scripts canoniques vs archives, dette technique blup_fusion.rs | Règles métier documentées |
| **Cache plots** | Taille cache PNG, liste figures, bouton vider | `plotCache` state existant |

---

## 4. Règles UI/UX (ui-ux-pro-max)

### Palette & style
**Profil produit :** SaaS scientifique / Data Analysis Tool  
**Style :** Minimal data-dense, fond blanc, tokens sémantiques  
**Conserver :** Design tokens DT existants (cardShadow, cardBorder, headerBg) — déjà professionnels

### Améliorations prioritaires

| Règle | Problème actuel | Fix |
|-------|-----------------|-----|
| `color-not-only` | Databar RMSE = couleur seule | Ajouter valeur numérique à droite de la barre |
| `empty-data-state` | "Aucune donnée" sans explication | Afficher "Aucun run KED trouvé — lancez un calcul depuis Registre ML" avec bouton |
| `data-density` | Tableau LOO RMSE = 1 colonne métrique | Ajouter RMSE bloc, delta, badge qualité pour densifier l'information utile |
| `chart-type` | Pas de visualisation corrélations | Heatmap SVG (sans lib externe, CSS grid + couleur) ou recharts HeatMap |
| `error-state-chart` | Échec silencieux si API `/ai/models/status` 404 | Alert banner avec retry + lien vers Système |
| `sortable-table` | Tableaux non triables | Tri par clic header (paramètre, RMSE, qualité) |
| `legend-visible` | Databar sans légende | Mini-légende sous le tableau : "Barre = RMSE / max(RMSE)" |
| `progressive-disclosure` | Pipeline tout affiché d'un coup | Expandable row pour les détails métriques par modèle |
| `loading-states` | Loader unique pour tout | Skeleton par section (pas un seul spinner global) |

### Dark mode
Le composant utilise des `inline styles` avec codes hex hardcodés (`#FFFFFF`, `#F8FAFC`, etc.).  
**Problème :** incompatible dark mode natif de l'app.  
**Fix recommandé :** migrer progressivement vers classes Tailwind avec `dark:` prefixes pour les sections nouvelles. Conserver DT tokens pour rétrocompatibilité.

---

## 5. Plan de migration

### Phase 1 — Restructuration onglets (PRIORITAIRE)
**Durée estimée :** 1 session  
**Impact :** clarté immédiate, pas de régression fonctionnelle

1. Renommer "Données brutes" → **"Données"**
2. Déplacer sous-onglet "LOO RMSE" de Données → dans le nouvel onglet Performances
3. Déplacer sous-onglet "Couverture" → dans Performances
4. Supprimer colonne LOO RMSE du tableau Variogrammes
5. Fusionner onglet "Validation" dans onglet "Performances" (renommage + regroupement)
6. Ajouter sous-onglet "Matrice statuts" dans Performances (tableau paramètre × niveau)

### Phase 2 — Nouvelles vues (HAUTE VALEUR)
**Durée estimée :** 2 sessions

1. Onglet Données → sous-onglet Sondages (distribution + fiabilité régionale)
2. Onglet Performances → sous-onglet Bloc-Spatial (LOO-CV vs Bloc avec biais)
3. Onglet Comparaison → sous-onglet Corrélations (heatmap)
4. Registre ML → Formulaire "Lancer un calcul" paramétré
5. Registre ML → File de jobs `ai_job_queue` en temps réel

### Phase 3 — Polish UI/UX (QUALITÉ)
**Durée estimée :** 1 session

1. Tri par colonne dans tous les tableaux
2. États vides informatifs (avec boutons d'action)
3. Légendes sur les Databars
4. Skeleton loaders par section
5. Alertes scientifiques automatiques (n<30, biais LOO, gaps pipeline)
6. Dark mode tokens migration (nouvelles sections uniquement)

---

## 6. Conservations explicites

| Élément | Raison |
|---------|--------|
| Onglet Registre ML (structure) | Requis par l'utilisateur — à enrichir uniquement |
| Design tokens DT | Style déjà professionnel — ne pas casser |
| DataTable + SectionCard components | Réutilisables, bien codés |
| Databar component | Visuellement efficace — ajouter valeur texte seulement |
| Polling job pattern (MLTab) | Architecture correcte — garder |
| ExportBtn par section | Pratique, garder |

---

## 7. Tables DB à utiliser / créer

### Tables existantes (confirmées)

| Table | Utilisée | Colonnes clés |
|-------|----------|---------------|
| `atlas.ai_variograms` | Variogrammes, Validation, Comparaison | parameter_id, model_type, nugget, sill, range_m, loo_rmse, fit_quality |
| `atlas.ai_interpolation_runs` | Performances, Registre ML | parameter_id, method, status, n_mailles, metrics JSON |
| `atlas.ai_interpolation_values` | Couverture, Incertitude | maille_id, parameter_id, value, p10, p50, p90 |
| `atlas.ai_job_queue` | Système, File de jobs | job_id, job_type, status, started_at, finished_at |
| `atlas.ai_parameter_catalog` | Données → Catalogue | parameter_id, label, family, unit, n_sondages |

### Tables / vues à créer pour les nouvelles sections

| Artefact | Données | Priorité |
|----------|---------|---------|
| Vue `v_coverage_matrix` | Paramètre × niveau × statut | Phase 2 |
| Vue `v_sondage_distribution` | Compteurs par région + location_mode | Phase 2 |
| Vue `v_bloc_spatial_validation` | RMSE par bloc latitudinal | Phase 2 |
| Table inline `correlations_matrix` | Données de MATRICE_CORRELATIONS_PARAMETRES | Phase 2 (JSON statique possible) |

---

## 8. Cartographie DB — Résultats agent (2026-06-13)

### Tables clés confirmées par requête directe (atlas_clean:5433)

| Table | Lignes | Colonnes critiques pour l'UI |
|-------|--------|------------------------------|
| `atlas.ai_parameter_catalog` | 169 | parameter_id, category, unit, interpolation_enabled, depth_stratified, physical_min/max |
| `atlas.ai_variograms` | **516** | nugget, sill, range_m, loo_rmse, **block_cv_rmse** ✅, **spatial_kfold_rmse** ✅, fit_quality JSONB |
| `atlas.ai_interpolation_runs` | **1 377** | run_type, method (13 méthodes), status, metrics JSONB, model_version |
| `atlas.ai_interpolation_values` | **25 102 590** | value, variance, method, is_superseded (false = actif) |
| `atlas.ai_job_queue` | 169 | job_type (run_ked, run_rk, run_fusion, run_vfs, run_mtgp, 3d_render) |
| `atlas.ai_spatial_validation_runs` | 57 | PICP LOO, Moran I stationnarité |
| `atlas.ai_context_features_maille` | 29 407 | geol_code, pedo_code, risque_gonflement, dem_slope, altitude, HAND |
| `atlas.kriging_domains` | 522 | 119 géologie + 61 pédologie + 342 risque_gonflement |

### Découverte critique : `block_cv_rmse` DÉJÀ en DB

`ai_variograms.block_cv_rmse` et `ai_variograms.spatial_kfold_rmse` **existent déjà** dans le schéma.

**Impact Phase 2 :** le sous-onglet "Bloc-Spatial" dans Performances ne nécessite **aucune migration DB** — il suffit d'exposer la colonne existante dans le tableau LOO Validation (côté à côte avec `loo_rmse`).

### Méthodes dans ai_interpolation_runs (run actifs)

| Méthode | Lignes |
|---------|--------|
| `ked_rk_fusion_bayesian` | 588 |
| `ked_hierarchical_5levels` | 446 |
| `regression_kriging_scorpan` | 135 |
| `mtgp_icm_gpflow` | 48 |
| `sgs_gstools` | 10 |
| (+ 4 queued `ordinary_kriging`) | — |

### Vue `v_contexte_geologique` — clarification

La vue `atlas.v_contexte_geologique` **n'existe pas** avec ce nom. Utiliser :
- `atlas.ai_context_features_maille` (table complète, 29 407 lignes)
- `atlas.v_mailles_context` (vue simplifiée : code, geol_unit, pedo_unit, swelling_class)

---

*Document généré le 2026-06-13 · Prochaine révision après Phase 1 implémentée*
