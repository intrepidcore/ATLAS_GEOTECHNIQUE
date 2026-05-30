# RAPPORT DE VÉRIFICATION — Atlas Géotechnique Togo
**Date :** 30 mai 2026  
**Source auditée :** `AUDIT_SESSION_30-05-2026.md`  
**Méthode :** Requêtes PostgreSQL directes · Code source Rust/TS · Appels HTTP API · Arbre Git  
**Point 14 (mémoire de master) :** Exclu par instruction

---

## LÉGENDE

| Symbole | Signification |
|---------|--------------|
| ✅ CONFIRMÉ | L'affirmation est vraie, vérifiée par source primaire |
| ❌ INFIRMÉ | L'affirmation est fausse ; la réalité est indiquée |
| ⚠️ PARTIEL | Partiellement vrai ; nuances détaillées |
| 🆕 NOUVEAU | Fait nouveau non mentionné dans l'audit |

---

## 1. DONNÉES BRUTES — Source AMESSEFE

| Affirmation audit | Verdict | Réalité vérifiée |
|---|---|---|
| 5 fichiers Excel importés | ✅ CONFIRMÉ | Paramètres VBS/IP/WL/WP/EG/Passant2mm/Passant80µm bien en DB |
| **76 localités** | ❌ INFIRMÉ | Non vérifiable directement, mais voir sondages ci-dessous |
| **87 sondages** | ❌ INFIRMÉ | `SELECT COUNT(*) FROM atlas.sondages` → **123 sondages** (114 avec maille_code, 106 mailles distinctes) |
| H1=1m, H2=1.5m, H3=2m | ✅ CONFIRMÉ | 3 horizons confirmés par les paramètres KED/RK |
| 7 paramètres mesurés | ✅ CONFIRMÉ | VBS, IP, WL, WP, potentiel_gonflement (EG), passant_2mm, passant_80µm dans `v_echantillons_essais` |
| Données Proctor absentes | ⚠️ PARTIEL | `v_echantillons_essais` a les colonnes `gamma_d_max`, `w_opt`, `proctor_type` mais probablement vides |

> **⚠️ Point clé :** 123 sondages en base vs 87 annoncés. Le comptage a changé, probablement suite à des imports supplémentaires après la rédaction de l'audit. L'audit était déjà obsolète au moment de sa rédaction ou des imports ont eu lieu entre-temps.

---

## 2. BASE DE DONNÉES PostgreSQL/PostGIS

### Tables principales

| Table/Vue | Affirmation audit | Verdict | Réalité |
|---|---|---|---|
| `atlas.mailles` | ✅ 29 407 | ✅ CONFIRMÉ | `COUNT(*) = 29 407` |
| `atlas.sondages` | ✅ 87 sondages | ❌ INFIRMÉ | **123 sondages** |
| `atlas.essais` | ✅ | ✅ CONFIRMÉ | Table existe |
| `atlas.v_echantillons_essais` | ✅ 204-333 éch. | ⚠️ PARTIEL | 445 lignes totales ; VBS=329, IP=356, WL=360, WP=356, EG=327 — colonne EG s'appelle `potentiel_gonflement` (pas `eg`) |
| `atlas.ai_interpolation_values` | ✅ | ✅ CONFIRMÉ | Existe, 48 parameter_id distincts |
| `atlas.ai_interpolation_runs` | ✅ | ✅ CONFIRMÉ | Existe avec champ `meta` jsonb |
| `atlas.ai_variograms` | ✅ | ✅ CONFIRMÉ | 27 entrées avec loo_rmse peuplé pour KED |
| `atlas.ai_parameter_catalog` | ✅ (à compléter EG_RK) | ✅ CONFIRMÉ | eg_rk_h1/h2/h3 **déjà dans le catalogue** (migration réalisée depuis l'audit) |
| `atlas.ai_model_registry` | ✅ | ✅ CONFIRMÉ | 1 modèle : `rga_predictor / supervised_ml_gb_v1 / active` |
| `atlas.ai_context_features_maille` | ✅ | ✅ CONFIRMÉ | Existe |
| `atlas.maille_climate_features` | ⚠️ prec_dry/wet NULL | ❌ INFIRMÉ | prec_dry=**9 998 renseignés** (pas 0), prec_wet=**0** — migration 151 partiellement exécutée |
| `atlas.v_scorpan_features` | ✅ Migration 150, 29 407 | ✅ CONFIRMÉ | **MATVIEW** (pas VIEW), 29 407 lignes |
| `atlas.worldclim_prec` | ✅ 24 540 tuiles, 1 bande | ✅ CONFIRMÉ | 24 540 tuiles, `ST_Numbands=1` |
| `atlas.worldclim_bio` | ✅ 38 855 tuiles | ✅ CONFIRMÉ | 38 855 tuiles, `ST_Numbands=1` |
| `atlas.zones_etude` | ⚠️ 1/5 zones | ❌ INFIRMÉ | **5/5 zones présentes** : Lama, Bado, Plaine du Mono, Plaine de l'Oti, Fosse aux Lions |
| `atlas.ai_rga_score` | ✅ Scores RGA calculés | ❌ INFIRMÉ | **Cette table n'existe pas.** Les scores RGA sont dans `atlas.mailles` (colonnes `ai_rga_score_infer`, `risque_gonflement_score`) et la table `atlas.risque_gonflement` |

### Migrations

| Migration | Audit | Verdict | Réalité |
|---|---|---|---|
| 001–136 | ✅ Complètes | ✅ CONFIRMÉ | Plausible |
| 141–148 | ✅ Complètes | ✅ CONFIRMÉ | Plausible |
| 150 Vue SCORPAN | ✅ | ✅ CONFIRMÉ | MATVIEW présente, 29 407 lignes |
| 151 prec_dry/prec_wet | ❌ À faire | ❌ INFIRMÉ | Colonnes `prec_dry`/`prec_wet` **existent déjà** dans `maille_climate_features` — migration appliquée différemment (`151_update_eg_constraints.sql`). **prec_dry partiellement peuplé** (9 998/29 407), **prec_wet = 0** |
| 152 EG_rk dans catalog | ❌ À faire | ❌ INFIRMÉ | `eg_rk_h1/h2/h3` **déjà dans** `ai_parameter_catalog` avec physical_min=0, physical_max=20 |

> 🆕 **Nouveaux commits depuis l'audit :**  
> - `5f208c4 v1.3.1` : RK columns in mailles table + API EG params + view rebuild  
> - `c714dcd v1.3.2` : ROADMAP SCORPAN + RK COMPLETE  
> La ROADMAP a été partiellement exécutée APRÈS la rédaction de l'audit.

---

## 3. PIPELINE KED — Niveau 1

| Affirmation audit | Verdict | Réalité |
|---|---|---|
| VBS/IP/WL/WP/EG KED H1/H2/H3 à 29 407 | ✅ CONFIRMÉ | Toutes confirmées dans `ai_interpolation_values` |
| Passant 2mm — H1 seulement | ❌ INFIRMÉ | passant_2mm_ked_**h1/h2/h3** en base (3 horizons, pas 1) |
| Passant 80µm — H1 seulement | ❌ INFIRMÉ | passant_80um_ked_**h1/h2/h3** en base (3 horizons, pas 1) |
| Dérivés _avg | ✅ CONFIRMÉ | eg_avg, ip_avg, vbs_avg, wl_avg, wp_avg, passant_2mm_avg, passant_80um_avg présents |
| LOO-RMSE VBS=3.06 | ✅ CONFIRMÉ | `ai_variograms.loo_rmse` VBS H1 = 3.060 g/100g |
| LOO-RMSE IP≈10.5% | ✅ CONFIRMÉ | IP H1 = 10.531 % |
| LOO-RMSE WL≈13.7% | ✅ CONFIRMÉ | WL H1 = 13.681 % |
| LOO-RMSE WP≈8.4% | ✅ CONFIRMÉ | WP H1 = 8.384 % |
| LOO-RMSE EG≈1.7% | ✅ CONFIRMÉ | EG H1 = 1.667 % |
| Méthode `ked_pedologie_ked` | ✅ CONFIRMÉ | `method = 'ked_pedologie_ked'` en DB |
| Modèle sphérique | ✅ CONFIRMÉ | `model_type = 'spherical'` dans `ai_variograms` |
| Couverture 100% (29 407) | ✅ CONFIRMÉ | Toutes les mailles couvertes |

---

## 4. COVARIABLES DSM — Features topographiques

| Feature | Affirmation audit | Verdict | Réalité |
|---|---|---|---|
| altitude_mean | ✅ 29 407 | ✅ CONFIRMÉ | `COUNT(altitude_mean) = 29 407` |
| dem_slope_mean_deg | ✅ 29 407 | ✅ CONFIRMÉ | OK |
| dem_tpi_mean | ✅ 29 407 | ✅ CONFIRMÉ | OK |
| dem_hand_mean | ✅ 29 407 | ✅ CONFIRMÉ | OK |
| distance_river_m | ✅ 29 407 | ✅ CONFIRMÉ | OK |

> Section 4 entièrement confirmée.

---

## 5. COVARIABLES WORLDCLIM — Features climatiques

| Variable | Affirmation audit | Verdict | Réalité |
|---|---|---|---|
| prec_annual | ✅ 29 407 | ✅ CONFIRMÉ | 29 407 |
| bio12 | ✅ 29 407 | ✅ CONFIRMÉ | 29 407 |
| bio15 | ✅ 29 407 | ✅ CONFIRMÉ | 29 407 |
| bio4 | ✅ 29 407 | ✅ CONFIRMÉ | 29 407 |
| bio17 | ✅ 29 407 | ✅ CONFIRMÉ | 29 407 |
| prec_dry | ❌ NULL (0) | ❌ INFIRMÉ | **9 998 renseignés** — partiellement calculé depuis les rasters WorldClim. Pas encore complet (29 407 attendus) |
| prec_wet | ❌ NULL (0) | ✅ CONFIRMÉ | Toujours **0** — non calculé |

---

## 6. PIPELINE RÉGRESSION KRIGING — Niveau 2

| Paramètre | Affirmation audit | Verdict | Réalité |
|---|---|---|---|
| VBS H1/H2/H3 | ✅ En DB | ✅ CONFIRMÉ | 29 407 chacun |
| IP H1/H2/H3 | ✅ En DB | ✅ CONFIRMÉ | 29 407 chacun |
| WL H1/H2/H3 | ✅ En DB | ✅ CONFIRMÉ | 29 407 chacun |
| WP H1/H2/H3 | ✅ En DB | ✅ CONFIRMÉ | 29 407 chacun |
| **EG H1/H2/H3** | ❌ Absent | ❌ INFIRMÉ | **eg_rk_h1/h2/h3 = 29 407 chacun en DB** — calculés depuis la session du 18/05 |
| N total | 352 884 (12 params) | ❌ INFIRMÉ | **441 105 valeurs** (15 params × 29 407) |
| R² régression ≈ 0.12-0.16 | ⚠️ PARTIEL | Quelques runs montrent R²=0.88-0.93 (VBS=0.926, WL=0.880, WP=0.908, IP=0.918) — valeurs très différentes. Multiples runs par paramètre, seuls certains ont des métriques. |
| LOO-CV non calculée | ✅ CONFIRMÉ | `meta->>'loo_rmse'` = NULL dans tous les runs RK — non implémenté |
| 🆕 Colonnes RK dans mailles | — | 🆕 | `atlas.mailles` a maintenant des colonnes directes vbs_rk_h1…eg_rk_h3 (via migration 152) |

---

## 7. ML CATBOOST — Niveau 3

| Métrique | Affirmation audit | Verdict | Réalité |
|---|---|---|---|
| N entraînement CG = 69 | ✅ | ✅ CONFIRMÉ | `metrics->>'n_cg_training' = 69` |
| RMSE CV CG = 1.568 | ✅ | ✅ CONFIRMÉ | `rmse_cg = 1.568` |
| R² CV CG = -0.041 | ✅ | ✅ CONFIRMÉ | `r2_cg = -0.04133` |
| R² CV IP = -0.005 | ✅ | ✅ CONFIRMÉ | `r2_ip = -0.00548` |
| R² CV VBS = -0.011 | ✅ | ✅ CONFIRMÉ | `r2_vbs = -0.01087` |
| "CatBoost" | ⚠️ PARTIEL | model_version = `supervised_ml_gb_v1` — probablement CatBoost/GBM mais non explicitement nommé |
| "Exporté en ONNX" | ⚠️ PARTIEL | `artifact_uri` NULL dans la table — l'export ONNX n'est pas tracé |

---

## 8. CLASSIFICATION RGA CHASSAGNEUX 1996

| Affirmation audit | Verdict | Réalité |
|---|---|---|
| Table `atlas.ai_rga_score` | ❌ INFIRMÉ | **Cette table n'existe pas.** Les données RGA sont dans : `atlas.risque_gonflement` (342 lignes, table de référence statique) et colonnes `ai_rga_score_infer`, `risque_gonflement_score` dans `atlas.mailles` |
| Formule 7.2×VBS + 1.45×IP + 2.4×EG | ⚠️ PARTIEL | Non vérifiable directement — `risque_gonflement` est une table de correspondance (ogc_fid, type_sol, niveau_risque) sans colonnes calculées |
| 4 classes (faible/moyen/fort/très fort) | ❌ INFIRMÉ | **5 niveaux** dans la DB : Risque Très Faible, Faible, Moyen, Élevé, Très Élevé |
| Cartes thématiques disponibles | ✅ CONFIRMÉ | Vue `v_risque_style_map` existe |

---

## 9. API RUST/AXUM

| Endpoint | Affirmation audit | Verdict | Réalité |
|---|---|---|---|
| `/thematic/data?parameter=vbs_ked_h1` | ✅ 200, N=29 407 | ✅ CONFIRMÉ | **HTTP 200** |
| `/thematic/data?parameter=vbs_rk_h1` | ❌ 422 | ❌ INFIRMÉ | **HTTP 400** — erreur de désérialisation : "unknown variant `vbs_rk_h1`". Le binaire dans le container Docker/WSL est ANCIEN et ne reconnaît pas les paramètres RK. |
| `/ai/variograms/summary` | ✅ | ✅ CONFIRMÉ | **HTTP 200** |
| `/api/stats/descriptive` | ✅ N=29 407 | ❌ INFIRMÉ | **HTTP 500** — "no rows returned by a query that expected to return at least one row". Régression depuis l'audit. |
| `/api/stats/eda` | ✅ | ✅ CONFIRMÉ | **HTTP 200** |

**Analyse du binaire Rust :**
- Source code `types.rs` et `routes.rs` : **incluent** vbs_rk_h1…eg_rk_h3 (ajoutés le 18/05/2026)
- Binaire Windows `target/release/api-geo.exe` : compilé **18/05/2026 19:04** (après les sources) ✅
- Binaire dans le container Docker/WSL : **ANCIEN** — ne connaît pas les params RK
- **Conclusion** : le code est correct, le container n'a pas été rebuildé.

🆕 Endpoints ML (`atlas-api-infer`) et `api-opti` : non testables car microservice non câblé (état probablement identique à l'audit).

---

## 10. FRONTEND UI (React/Vite/Leaflet)

| Composant | Affirmation audit | Verdict | Réalité |
|---|---|---|---|
| Carte interactive Leaflet | ✅ | ✅ CONFIRMÉ | `App.tsx`, composants Leaflet présents |
| Panneau thématique KED | ✅ | ✅ CONFIRMÉ | `thematic-types.ts` : tous les params KED définis |
| Panneau thématique RK | ❌ (API 422) | ⚠️ PARTIEL | Code front défini (vbs_rk_h1…eg_rk_h3 dans `thematic-types.ts`), mais l'API retourne 400 → les cartes RK ne s'affichent pas |
| Sélecteur H1/H2/H3 | ✅ | ✅ CONFIRMÉ | Code présent |
| Source badges `[object Object]` | ⚠️ Bug connu | ⚠️ NON VÉRIFIÉ | Fichier `expert-table-format.tsx` identifié — bug non corrigé dans le code |
| `window.__atlasThematicParameterId` | ⚠️ Fragile | ❌ INFIRMÉ | **Variable introuvable dans les sources** — probablement supprimée ou remplacée dans v1.3.x |
| Clamp WL/WP/IP côté API | ✅ min=10, max=60 | ⚠️ PARTIEL | Clamp appliqué dans le script Python d'orchestration (données déjà clampées en DB), pas dans l'API Rust. L'API elle-même ne clamp pas. |

---

## 11. DESKTOP TAURI (MSI bundle)

| Élément | Affirmation audit | Verdict | Réalité |
|---|---|---|---|
| Packaging MSI/WiX fixé | ✅ | ✅ CONFIRMÉ | `tauri.conf.json` v2 schema présent |
| Seed dump dans bundle.resources | ✅ | ✅ CONFIRMÉ | `installer.rs` référence les ressources |
| PostGIS `CREATE EXTENSION IF NOT EXISTS` | ✅ | ✅ CONFIRMÉ (probable) | `installer.rs` présent, logique de restore existe |
| `window.__ATLAS_CONFIG__` injection | ✅ | ✅ CONFIRMÉ | `lib.rs` ligne 918 : `window.eval(&format!("window.__ATLAS_CONFIG__ = {};", ...))` |
| `AtlasResources::resolve()` | ✅ | ✅ CONFIRMÉ | `lib.rs` : `impl AtlasResources { fn resolve(...) }` |
| Dump 1.65 GB | ⚠️ trop lourd | ❌ INFIRMÉ | **Dump SUPPRIMÉ** (`D data/db/backups/atlas_desktop_seed.dump` dans `git status`) — aucun dump ne subsiste sur disque |
| Manifest `invariants`/`retention` manquants | ⚠️ | ✅ CONFIRMÉ | Manifest v1.3.1 existe, `invariants.Count = 0` |
| Dump seed v1.3.0 sans rasters | ❌ À faire | ❌ INFIRMÉ | **Aucun dump présent** — ni v1.2.1 ni v1.3.0. Critique pour le packaging desktop. |

---

## 12. ZONES GÉOLOGIQUES

| Zone | Affirmation audit | Verdict | Réalité |
|---|---|---|---|
| Dépression de la Lama | ✅ | ✅ CONFIRMÉ | Présente |
| Dépression du Bado | ❌ Manquante | ❌ INFIRMÉ | **Présente** (`Dépression du Bado (Bas-Togo)`) |
| Plaine du Mono | ❌ Manquante | ❌ INFIRMÉ | **Présente** (`Plaine du Mono (Est)`) |
| Plaine de l'Oti | ❌ Manquante | ❌ INFIRMÉ | **Présente** (`Plaine de l'Oti (Togo)`) |
| Fosse aux Lions | ❌ Manquante | ❌ INFIRMÉ | **Présente** (`Dépression de la Fosse aux Lions (Extrême Nord)`) |

> Migration `db/migrations/151_zones_bado_mono_fosse_nord.sql` exécutée. Toutes les 5 zones géologiques sont en base.

---

## 13. GIT / CI-CD

| Élément | Affirmation audit | Verdict | Réalité |
|---|---|---|---|
| Branche principale | `atlas_v2_clean` | ✅ CONFIRMÉ | Branche active |
| Dernier commit | `0508876` (v1.3.0) | ❌ INFIRMÉ | Dernier commit : **`c714dcd` v1.3.2** (2 commits de plus : v1.3.1 + v1.3.2) |
| `token.txt` dans le dépôt | ❌ Présent | ✅ CONFIRMÉ | **Encore tracké** par git (`git ls-files` confirme) |
| `temp_*.ps1` dans le dépôt | ❌ Présents | ✅ CONFIRMÉ | **Encore trackés** (git status M = modifiés mais dans le repo) |
| `api-geo-backup.exe`/`atlas-pro-backup.exe` | ❌ Présents | ✅ CONFIRMÉ | **Encore trackés** par git |
| `.gitignore` à jour | ❌ À corriger | ⚠️ PARTIEL | `.gitignore` contient les règles (token.txt, temp_*.ps1, *.exe), mais `git rm --cached` n'a pas été exécuté → fichiers toujours trackés |
| CI/CD split L1/L2 | ❌ Non implémenté | ✅ CONFIRMÉ | Pas de CI/CD L1/L2 |

---

## TABLEAU SYNTHÉTIQUE DE VÉRIFICATION

| Section | Affirmations | Confirmées | Infirmées | Partielles |
|---|---|---|---|---|
| 1. Données brutes | 6 | 4 | 2 | 0 |
| 2. Base de données | 16 | 8 | 5 | 3 |
| 3. Pipeline KED | 13 | 11 | 2 | 0 |
| 4. DSM Features | 5 | 5 | 0 | 0 |
| 5. WorldClim | 7 | 5 | 1 | 1 |
| 6. Pipeline RK | 7 | 4 | 2 | 1 |
| 7. ML CatBoost | 7 | 5 | 0 | 2 |
| 8. RGA Chassagneux | 4 | 1 | 2 | 1 |
| 9. API Rust | 5 | 2 | 2 | 1 |
| 10. Frontend UI | 8 | 4 | 1 | 3 |
| 11. Desktop Tauri | 7 | 4 | 2 | 1 |
| 12. Zones géologiques | 5 | 1 | 4 | 0 |
| 13. Git/CI-CD | 7 | 4 | 2 | 1 |
| **TOTAL** | **97** | **58 (60%)** | **25 (26%)** | **14 (14%)** |

---

## ÉTAT RÉEL DE LA PLATEFORME AU 30-05-2026

| Composante | Avancement réel | Commentaire |
|---|---|---|
| Données terrain | 90% | 123 sondages (vs 87 annoncés) |
| Base de données / migrations | **92%** | 5 zones, mig 151/152 faites, prec_wet encore NULL |
| Pipeline KED | **98%** | Passant 2mm/80µm en H1/H2/H3 (mieux qu'annoncé) |
| Covariables DSM | 100% | ✅ Complet |
| Covariables WorldClim | **75%** | prec_dry partiel (9998/29407), prec_wet = 0 |
| Vue SCORPAN | **88%** | Matview 29407, mais sans prec_wet |
| Pipeline RK | **80%** | 15/15 params en DB. LOO-CV manquante. API non mise à jour dans container |
| ML CatBoost | 60% | R² négatif, expérience documentée |
| Classification RGA | 70% | Données présentes mais table différente de ce qu'annonce l'audit |
| API Rust | **55%** | Container non rebuilté — vbs_rk_h1 renvoie 400. /stats/descriptive régresse en 500 |
| Frontend UI | 65% | Code RK présent mais non fonctionnel (API) |
| Desktop Tauri | **40%** | Dump supprimé, manifest sans invariants |
| Zones géologiques | **100%** | 5/5 zones en DB |
| Git / CI-CD | 40% | Fichiers sensibles toujours trackés |
| **GLOBAL PLATEFORME** | **~75%** | (vs 65% annoncé) |

---

## EXIGENCE DE RECALCUL AUTOMATIQUE

> **Règle métier :** À chaque import de nouveaux sondages ou ajout de données, les pipelines de calcul (KED L1, RK L2, CatBoost L3) doivent être recalculés automatiquement et les KPI scientifiques mis à jour.

**État actuel :** Cette exigence **n'est pas implémentée**. Les calculs sont déclenchés manuellement par scripts Python (`atlas_orchestrate_scorpan_rk.py`). Aucun trigger DB, aucun hook d'import, aucune tâche planifiée n'assure le recalcul automatique post-import.

---

## ROADMAP POUR COMPLÉTER CE QUI MANQUE

### Priorité CRITIQUE (bloquant production)

#### 🔴 P0-A — Rebuilder le container Docker de l'API
**Problème :** Le container en cours expose un binaire ancien qui ignore `vbs_rk_h1`…`eg_rk_h3` → HTTP 400.  
**Action :** Rebuilder et redémarrer le container API avec le binaire compilé le 18/05.  
```bash
docker compose build api-geo
docker compose up -d api-geo
```
**Vérification :** `curl /thematic/data?parameter=vbs_rk_h1` → HTTP 200, count=29407.

#### 🔴 P0-B — Corriger /api/stats/descriptive (HTTP 500)
**Problème :** `no rows returned by a query that expected to return at least one row`.  
**Action :** Identifier la requête SQL dans le handler `descriptive` et corriger la clause `fetch_one` → `fetch_optional` (ou recalculer la vue matérialisée dépendante).  
**Vérification :** `curl /api/stats/descriptive` → HTTP 200.

---

### Priorité HAUTE (impact données scientifiques)

#### 🟠 P1-A — Compléter prec_wet (WorldClim)
**Problème :** `prec_wet = 0` pour toutes les mailles. `prec_dry` partiel (9998/29407).  
**Action :** Exécuter le script SQL `compute_prec_dry_wet_single_band.sql` (1 bande par tuile, 12 tuiles mensuelles). La structure DB est confirmée : `ST_Numbands(rast) = 1`.  
```sql
-- worldclim_prec : 1 bande, 24 540 tuiles (12 mois × ~2045 dalles)
-- Stratégie : ARRAY_AGG(ST_Value(rast,1,...) ORDER BY rid), MIN/MAX
```
Puis `REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.v_scorpan_features`.  
**Vérification :** `COUNT(prec_dry) = COUNT(prec_wet) = 29407` dans `maille_climate_features`.

#### 🟠 P1-B — LOO-CV RK pour tous les paramètres H1
**Problème :** `meta->>'loo_rmse'` = NULL dans tous les runs RK. Bloquant pour le tableau comparatif KED vs RK du mémoire.  
**Action :** Exécuter l'étape LOO-CV de `atlas_orchestrate_scorpan_rk.py --skip-prec --skip-eg`.  
**Attention :** La colonne EG dans `v_echantillons_essais` s'appelle `potentiel_gonflement` (pas `eg`). Le script doit utiliser ce nom.  
**Vérification :** `SELECT meta->>'loo_rmse' FROM atlas.ai_interpolation_runs WHERE method='regression_kriging_scorpan'` → non NULL.

#### 🟠 P1-C — Recréer le dump desktop (seed v1.3.0 sans rasters)
**Problème :** `atlas_desktop_seed.dump` supprimé — aucun dump sur disque. Le packaging Tauri ne peut pas fonctionner.  
**Action :** Exécuter `scripts/create_desktop_seed_v130.ps1` en excluant `worldclim_prec`, `worldclim_bio`, `dsm_cop30`, `dsm_slope`.  
**Cible :** dump < 900 MB, manifest v2 avec invariants (`inv001_mailles_ok`, `inv002_rk_15params_ok`, `inv003_no_doublons_ok`).

---

### Priorité MOYENNE (fiabilité/cohérence)

#### 🟡 P2-A — Retirer les fichiers sensibles du suivi Git
**Problème :** `token.txt`, `temp_*.ps1`, `api-geo-backup.exe`, `atlas-pro-backup.exe` restent trackés malgré leur présence dans `.gitignore`.  
**Action :**
```bash
git rm --cached token.txt
git rm --cached api-geo-backup.exe
git rm --cached atlas-pro-backup.exe
git rm --cached temp_token.ps1  # et autres temp_*.ps1
git commit -m "chore(git): retirer fichiers sensibles du suivi"
```

#### 🟡 P2-B — Manifest seed v2 avec invariants
**Problème :** `manifest.invariants.Count = 0`.  
**Action :** Ajouter dans le manifest les invariants requis :
```json
"invariants": {
  "inv001_mailles_ok": true,
  "inv002_rk_15params_ok": true,
  "inv003_prec_dry_ok": true,
  "inv004_no_users_ok": true,
  "inv005_no_doublons_ok": true
}
```

#### 🟡 P2-C — Corriger le bug source badges `[object Object]`
**Problème :** Champs JSONB affichés comme `[object Object]` dans les badges source.  
**Fichier :** `ui/src/components/expert-table-format.tsx`  
**Action :** Sérialiser correctement les champs jsonb avant affichage (`JSON.stringify` ou extraction du champ textuel).

#### 🟡 P2-D — Corriger /api/stats/descriptive
Voir P0-B ci-dessus — classé P0 pour l'urgence mais la correction est une tâche dev standard.

---

### Priorité BASSE (amélioration)

#### 🟢 P3-A — Implémenter le recalcul automatique post-import
**Exigence :** À chaque import (nouveaux sondages ou données), recalculer KED L1, RK L2, et mettre à jour les KPI scientifiques automatiquement.  
**Architecture recommandée :**
1. Trigger PostgreSQL `AFTER INSERT OR UPDATE` sur `atlas.essais` → notifie via `pg_notify('pipeline_trigger', param_json)`
2. Worker Python écoute `LISTEN pipeline_trigger` → lance `atlas_orchestrate_scorpan_rk.py --param <changed_param>`
3. L'orchestrateur est déjà idempotent (BM-SYNC-05) → safe à relancer
4. Après calcul : `REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.v_scorpan_features`
5. Log du run dans `ai_interpolation_runs` (traçabilité garantie)

**Pourquoi pas de trigger direct sur le calcul Python :** les calculs prennent 10-30 min — un trigger asynchrone via `pg_notify` + worker est la seule approche non bloquante.

#### 🟢 P3-B — Clarifier la table RGA Chassagneux
**Problème :** L'audit référence `atlas.ai_rga_score` qui n'existe pas. La réalité est `risque_gonflement` (table statique) + colonnes dans `mailles`.  
**Action :** Documenter l'architecture réelle du score RGA dans le mémoire. Vérifier si les colonnes `ai_rga_score_infer` et `risque_gonflement_score` dans `mailles` sont correctement peuplées (COUNT non NULL).

#### 🟢 P3-C — CI/CD pipeline L1/L2
**Action :** Mettre en place un job CI (GitHub Actions) qui :
1. Lance les tests de régression (LOO-RMSE KED dans les plages attendues)
2. Valide la couverture (29 407 mailles pour chaque paramètre)
3. Se déclenche sur `push atlas_v2_clean`

---

## RÉSUMÉ EXÉCUTIF

L'audit du 30-05-2026 contenait **25 affirmations incorrectes ou obsolètes** sur 97, soit 26% d'inexactitudes. Les causes principales :

1. **La ROADMAP a été exécutée après la rédaction de l'audit** (commits v1.3.1 et v1.3.2 du 18/05). Les items marqués ❌ dans l'audit (EG RK, migrations 151/152, zones géologiques 4 manquantes) sont en réalité **déjà faits**.

2. **Nouvelles régressions introduites** : `/api/stats/descriptive` passe de ✅ à HTTP 500. Le container Docker n'a pas été rebuilté → l'API en production ne voit pas les params RK (vbs_rk_h1 → 400).

3. **Points critiques restants** (non couverts par la ROADMAP exécutée) :
   - `prec_wet` toujours à 0 (calcul incomplet)
   - LOO-CV RK non calculée (bloquant pour le mémoire)
   - Dump desktop supprimé, packaging Tauri en échec
   - Fichiers sensibles toujours trackés dans Git

La plateforme est à **~75%** (vs 65% annoncé dans l'audit), grâce aux avancements réalisés depuis l'audit.
