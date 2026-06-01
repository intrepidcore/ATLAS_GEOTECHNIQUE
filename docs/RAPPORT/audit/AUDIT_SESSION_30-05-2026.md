## État exhaustif du projet Atlas Géotechnique Togo

---

### 1. DONNÉES BRUTES — Source AMESSEFE

|Élément|État|Détail|
|---|---|---|
|Fichiers Excel source|✅ Importés|5 fichiers : Granulométrie, Bleu, Limites Atterberg, Potentiel gonflement, Classification|
|Nombre de localités|✅ 76 localités|Réparties sur 5 zones pédologiques|
|Nombre de sondages|✅ 87 sondages|Densité ~1/652 km² — faible mais unique au Togo|
|Profondeurs|✅ H1=1m, H2=1.5m, H3=2m|3 horizons par sondage|
|Paramètres disponibles|✅ VBS, IP, WL, WP, EG, passant 2mm, passant 80µm|7 paramètres mesurés|
|Données manquantes|⚠️ Variables|Quelques NaN par localité selon les essais|
|Données Proctor|❌ Absentes|Non disponibles dans AMESSEFE|

---

### 2. BASE DE DONNÉES PostgreSQL/PostGIS

**Schéma général :**

|Table/Vue|État|Contenu|
|---|---|---|
|`atlas.mailles`|✅|29 407 mailles 2 km², UTM 31N (EPSG:25231)|
|`atlas.sondages`|✅|87 sondages géolocalisés|
|`atlas.essais`|✅|Mesures terrain par sondage|
|`atlas.v_echantillons_essais`|✅|Vue unifiée 204-333 échantillons selon param|
|`atlas.ai_interpolation_values`|✅|Table unifiée toutes méthodes|
|`atlas.ai_interpolation_runs`|✅|Traçabilité de chaque calcul|
|`atlas.ai_variograms`|✅|Paramètres variogrammes par paramètre|
|`atlas.ai_parameter_catalog`|✅|Catalogue des paramètres (à compléter EG_RK)|
|`atlas.ai_model_registry`|✅|Modèles ML CatBoost archivés|
|`atlas.ai_context_features_maille`|✅|Features DSM par maille|
|`atlas.maille_climate_features`|⚠️ Partiel|prec_annual/bio ok, prec_dry/wet = NULL|
|`atlas.v_scorpan_features`|✅ Migration 150|29 407 lignes, sans prec_dry/wet|
|`atlas.worldclim_prec`|✅ En DB|24 540 tuiles, 1 bande/tuile (12 fichiers séparés)|
|`atlas.worldclim_bio`|✅ En DB|38 855 tuiles, BIO1-19|
|`atlas.zones_etude`|⚠️ Partiel|Dépression de la Lama ✅, 4 autres zones ❌|
|`atlas.ai_rga_score`|✅|Scores RGA CHASSAGNEUX 1996 calculés|

**Migrations appliquées :**

|Plage|État|Contenu|
|---|---|---|
|001 – 136|✅ Complètes|Base géostatistique + schéma initial|
|141 – 148|✅ Complètes|Feature stores, kriging, ML supervisé, MLOps registry|
|150|✅ Complète|Vue SCORPAN (sans prec_dry/wet)|
|151|❌ À faire|Colonnes prec_dry/prec_wet|
|152|❌ À faire|EG_rk_h1/h2/h3 dans catalog|

---

### 3. PIPELINE KED — Niveau 1 (complet)

|Paramètre|H1|H2|H3|Mailles|LOO-RMSE|
|---|---|---|---|---|---|
|VBS|✅|✅|✅|29 407|3.06 g/100g|
|IP|✅|✅|✅|29 407|~10.5 %|
|WL|✅|✅|✅|29 407|~13.7 %|
|WP|✅|✅|✅|29 407|~8.4 %|
|EG|✅|✅|✅|29 407|~1.7 %|
|Passant 2mm|✅|—|—|29 407|6.3 %|
|Passant 80µm|✅|—|—|29 407|16.2 %|
|**_avg dérivés**|✅|—|—|29 407|Moyennes H1/H2/H3|

Méthode stockée : `ked_pedologie_ked`. Modèle variogramme : sphérique. Variable drift : DSM COP30 altitude. **Couverture nationale 100% confirmée.**

---

### 4. COVARIABLES DSM — Features topographiques (complet)

|Feature|Source|Méthode|Couverture|
|---|---|---|---|
|`altitude_mean`|DSM COP30 30m|ST_Clip + ST_SummaryStats|✅ 29 407|
|`dem_slope_mean_deg`|DSM COP30|ST_Slope|✅ 29 407|
|`dem_tpi_mean`|DSM COP30|Anneau 3-6 km|✅ 29 407|
|`dem_hand_mean`|DSM COP30|HAND 10 km|✅ 29 407|
|`distance_river_m`|DSM COP30|ST_Distance|✅ 29 407|

**Toutes à 29 407. Références scientifiques : Wilson & Gallant 2000, Rennó 2008.**

---

### 5. COVARIABLES WORLDCLIM — Features climatiques (partiel)

|Variable|État|Couverture|
|---|---|---|
|`prec_annual`|✅|29 407|
|`bio12` (précip annuelle)|✅|29 407|
|`bio15` (saisonnalité précip)|✅|29 407|
|`bio4` (saisonnalité temp.)|✅|29 407|
|`bio17` (précip trimestre sec)|✅|29 407|
|`prec_dry` (min mensuel)|❌ NULL|0|
|`prec_wet` (max mensuel)|❌ NULL|0|

**Blocage identifié** : worldclim_prec en DB a 1 bande par tuile (12 fichiers séparés) — le script SQL doit agréger sur les 12 tuiles, pas LEAST/GREATEST sur 12 bandes. Migration 151 non faite.

---

### 6. PIPELINE RÉGRESSION KRIGING — Niveau 2 (partiel)

|Paramètre|H1|H2|H3|N terrain|R² régression|Statut|
|---|---|---|---|---|---|---|
|VBS|✅|✅|✅|~200|~0.16|En DB|
|IP|✅|✅|✅|~280|~0.12|En DB|
|WL|✅|✅|✅|~333|~0.16|En DB|
|WP|✅|✅|✅|~333|~0.12|En DB|
|EG|❌|❌|❌|?|—|**Absent**|

352 884 valeurs en DB (12 params × 29 407). Méthode : `regression_kriging_scorpan`. Données d'entraînement : `v_echantillons_essais` (vraies mesures terrain). **LOO-CV non calculée** — bloquant pour le tableau de comparaison KED vs RK du mémoire.

---

### 7. ML CATBOOST — Niveau 3 (en production, sous-performant)

|Métrique|Valeur|Interprétation|
|---|---|---|
|N entraînement (CG)|69|Insuffisant|
|RMSE CV (CG)|1.568||
|R² CV (CG)|-0.041|**Négatif** = pire que la moyenne|
|R² CV (IP)|-0.005|Négatif|
|R² CV (VBS)|-0.011|Négatif|

Le modèle existe dans `atlas.ai_model_registry`, est exporté en ONNX, mais ne prédit pas mieux que la moyenne. C'est une **expérience négative documentée** — précieuse scientifiquement car elle justifie pourquoi RK reste la référence tant que N < 200 sondages.

---

### 8. CLASSIFICATION RGA CHASSAGNEUX 1996 (complet)

|Élément|État|
|---|---|
|Formule implémentée|✅ score = 7.2×VBS + 1.45×IP + 2.4×EG|
|4 classes (faible/moyen/fort/très fort)|✅|
|Stockage `atlas.ai_rga_score`|✅|
|Cartes thématiques disponibles|✅|

---

### 9. API RUST/AXUM

|Endpoint|État|Note|
|---|---|---|
|`/thematic/data?parameter=vbs_ked_h1`|✅ 200, N=29 407|OK|
|`/thematic/data?parameter=vbs_rk_h1`|❌ 422|API non recompilée|
|`/ai/variograms/summary`|✅|Retourne vraies valeurs|
|`/api/stats/descriptive`|✅|N=29 407 corrigé|
|`/api/stats/eda`|✅|Corrigé (fix `fetch_optional`)|
|Endpoints ML `atlas-api-infer`|❌ 404|Non enregistrés dans `main.rs`|
|Endpoints `api-opti`|❌|Microservice non câblé|

**Problème critique** : le code Rust `types.rs` et `routes.rs` contiennent les paramètres RK mais **le binaire n'a pas été recompilé**. L'API déployée ne sert donc pas les données RK.

---

### 10. FRONTEND UI (React/Vite/Leaflet)

|Composant|État|Note|
|---|---|---|
|Carte interactive principale|✅|Leaflet, EPSG:4326|
|Panneau thématique KED|✅|VBS/IP/WL/WP/EG visible|
|Panneau thématique RK|❌|Non visible (API 422)|
|Sélecteur H1/H2/H3|✅|Endpoint OK|
|Source badges|⚠️ Bug connu|`[object Object]` sur champs JSONB|
|Drawer scientifique|⚠️ Bug connu|Oscillation positionnement|
|DB Manager onglet Expert|⚠️ Bug connu|LOO-RMSE affiche 0.0000|
|`window.__atlasThematicParameterId`|⚠️ Fragile|Variable globale, à refactorer|
|Clamp WL/WP/IP côté API|✅|min=10, max=60 validé|
|Indicateur santé API|⚠️ Non vérifié visuellement||

---

### 11. DESKTOP TAURI (MSI bundle)

|Élément|État|Note|
|---|---|---|
|Packaging MSI/NSIS/WiX|✅ Fixé|Roots causes résolues|
|Seed dump inclus dans bundle.resources|✅|Fix de la session SDD|
|PostGIS non détruit au restore|✅|`CREATE EXTENSION IF NOT EXISTS postgis`|
|`window.__ATLAS_CONFIG__` injection|✅|`.initialization_script()`|
|`AtlasResources::resolve()`|✅|Point unique de résolution|
|Taille dump desktop v1.2.1|⚠️ 1.65 GB|Contient rasters WorldClim (~900 MB inutiles)|
|Manifest seed v2 complet|⚠️ Incomplet|Champs `invariants`, `retention` manquants|
|Dump seed v1.3.0|❌ À faire|Sans rasters, < 900 MB|

---

### 12. ZONES GÉOLOGIQUES

|Zone|État|
|---|---|
|Dépression de la Lama|✅ Implémentée|
|Dépression du Bado|❌ Manquante|
|Plaine du Mono|❌ Manquante|
|Plaine de l'Oti|❌ Manquante|
|Fosse aux Lions|❌ Manquante|

---

### 13. GIT / CI-CD

|Élément|État|
|---|---|
|Branche principale|`atlas_v2_clean`|
|Dernier commit significatif|`0508876` (RK pipeline)|
|`token.txt` dans le dépôt|❌ Présent (à nettoyer)|
|`temp_*.ps1` dans le dépôt|❌ Présents|
|Binaires `.exe` dans le dépôt|❌ `api-geo-backup.exe`, `atlas-pro-backup.exe`|
|`.gitignore` à jour|❌ À corriger|
|CI/CD split L1/L2|❌ Non implémenté|

---

### 14. MÉMOIRE DE MASTER

|Chapitre|Avancement|
|---|---|
|Introduction|~20%|
|Revue de littérature (géostatistique)|~25%|
|Revue de littérature (pédologie Togo)|~10%|
|Méthodologie (KED)|~30%|
|Méthodologie (RK + SCORPAN)|~15%|
|Résultats cartographiques|~10%|
|Discussion / Limitations|~5%|
|Conclusion + Perspectives|~5%|
|**TOTAL rédigé**|**~15%**|
|Figures/planches SIG (~90 attendues)|~20 produites|

**Deadline estimée : octobre 2026. Risque principal : la plateforme est à ~65%, le mémoire à 15%. Le déséquilibre est critique.**

---

### 15. TABLEAU DE BORD SYNTHÉTIQUE

|Composante|Avancement|
|---|---|
|Données terrain AMESSEFE|✅ 90%|
|Base de données / migrations|✅ 85%|
|Pipeline KED (L1)|✅ 95%|
|Covariables DSM|✅ 100%|
|Covariables WorldClim|⚠️ 71% (prec_dry/wet manquants)|
|Vue SCORPAN|✅ 85%|
|Pipeline RK (L2)|⚠️ 65% (EG absent, LOO-CV manquante, API 422)|
|ML CatBoost (L3)|⚠️ 60% (R² négatif, expérience documentée)|
|Classification CHASSAGNEUX|✅ 90%|
|API Rust|⚠️ 70% (params RK non servis)|
|Frontend UI|⚠️ 60% (bugs connus)|
|Desktop Tauri|⚠️ 75% (dump trop lourd)|
|Zones géologiques|⚠️ 20% (1/5)|
|CI/CD|⚠️ 40%|
|Mémoire rédigé|❌ 15%|
|**GLOBAL PLATEFORME**|**~65%**|
|**GLOBAL MÉMOIRE**|**~15%**|