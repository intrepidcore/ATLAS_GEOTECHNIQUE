---
description: Session changelog raisonné — Atlas V1 Lama/IA-Kriging : stabilisation full-stack (DB/API/UI), export zone à la volée sans mv_mailles_geotech, seeds Oti/Fosse + recalcul mailles_zones_etude, import Lama GeoPackage, workflow thématique IA/Kriging, relance pipeline d'entraînement et validations curl/psql
date: 2026-03-26
weekday: jeudi
repo: atlas_reclone
backend: services/api-geo (Rust/Axum + sqlx)
db: PostgreSQL/PostGIS (migrations 145-148 + fonctions atlas.*)
ui: ui (Vite + React + vanilla Leaflet)
branch: atlas_v2_clean
---

# Session — Changelog raisonné (ultra détaillé)

## 1) Objectif et contexte

- **Objectif fonctionnel**
  - Livrer une V1 exploitable orientée métier géotechnique autour de la Dépression de la Lama, avec chaîne complète : zone d’étude, stylisation carte, IA supervisée, interpolation Kriging, module AG, exports et observabilité opérationnelle.
  - Corriger les incohérences métier côté Colab Studio (mailles actives, KPI/listes) en respectant la source de vérité cartographique et les règles InterpidCore.
  - Rendre les exports de zone robustes et découplés des vues matérialisées fragiles.

- **Contexte technique**
  - Stack hybride :
    - DB PostGIS (zones, mailles, features IA matérialisées, cache DSM).
    - API Rust/Axum (`api-geo`) orchestrant requêtes SQL et scripts Python.
    - UI Leaflet/TS + React pour panels thématiques et pilotage IA.
  - Forte contrainte de continuité : implémenter sans pause, tester en boucle (`curl`, `psql`, build), itérer sur bugs runtime réels.

### 1.1 Analyse demandée : informations explicites, implicites, manquantes

- **Informations explicites identifiées**
  - Exigence de terminer les blocs GEO/DB/UI/AI dans la même session.
  - Exigence de tests concrets (`curl`, `psql`) et validation comportementale UI.
  - Exigence de qualité visuelle Lama (mise en évidence professionnelle, non intrusive, cohérence légende).
  - Exigence de pipeline IA auto-améliorant (trigger sondages -> jobs -> training/infer).
  - Exigence d’export zone indépendant de `atlas.mv_mailles_geotech`.
  - Exigence de seeds Oti/Fosse + recalcul d’appartenance mailles-zones.
  - Exigence d’import GeoPackage pour la géométrie Lama.

- **Informations implicites déduites**
  - Priorité à la robustesse d’exploitation plutôt qu’à la pure complétude théorique (éviter point de défaillance unique : vues coûteuses, jobs bloquants).
  - Nécessité de distinguer strictement :
    - données mesurées (sondages/lab),
    - données interpolées (kriging),
    - données inférées (IA),
    - recommandations (AG/fondations).
  - Nécessité d’un pilotage UI actionnable (lancer/rejouer pipelines, lire états/metrics/jobs) pour une adoption métier.

- **Informations manquantes (et traitement)**
  - Absence de fichier GeoPackage officiel dans le workspace pour test réel `--gpkg-path`.
    - Traitement : script finalisé avec support complet + fallback CRS; test exécuté avec géométrie embarquée.
  - Variabilité de l’environnement live `api-geo` (binaire parfois pas reconstruit malgré code à jour).
    - Traitement : rebuild docker explicite `api-geo` puis re-tests thématiques.
  - Données lab inégales selon cibles (VBS/IP/CG), empêchant un modèle unique dense.
    - Traitement : approche multi-modèles partiels + dérivation déterministe RGA/portance/tassement.

## 2) Symptômes observés (départ)

- Endpoint thématique IA/Kriging renvoyant `400 unknown variant` (API en exécution non alignée avec enum récente).
- Entraînement supervisé initialement instable/lent sur vues coûteuses (`v_maille_features_ai`), avec seuils insuffisants et jeux partiels.
- Risque de duplication implicite dans exports zone (jointures spatiales sondages/mailles).
- Besoin utilisateur de résultats immédiats mesurables sur :
  - comptages zone,
  - exécution scripts IA/Kriging,
  - disponibilité paramètres thématiques.

## 3) Collecte des preuves (logs et signaux)

- Audit de code ciblé :
  - `services/api-geo/src/exports.rs`
  - `scripts/import_zone_lama.py`
  - `ui/src/thematic/thematic-panel.ts`
  - migrations zones (`139`, `140`) + IA (`145-148`), backend IA (`ai_opti.rs`, `ai_jobs.rs`, `main.rs`).
- Vérifications runtime :
  - Santé API (`/healthz`),
  - présence containers (`atlas-api-geo`, `atlas-db`),
  - tests endpoint exports zone + thématique IA/Kriging.
- Validation DB :
  - existence zones seeds,
  - comptages `mailles_zones_etude`,
  - volumétrie tables IA (`infer/interpolation/foundation`),
  - métriques model registry.

## 4) Root-cause (cause racine)

### Root-cause #1 — Drift runtime entre code source et API active

- Les nouveaux paramètres `ThematicParameter` existaient dans le code, mais l’instance `api-geo` active répondait encore avec l’ancienne enum.
- Impact : `400 Bad Request` sur `ai_rga_score_infer`, `kriging_ip`, etc.

### Root-cause #2 — Fragilité d’exports zone sous jointures spatiales

- Les jointures zone->mailles->sondages pouvaient produire des doublons logiques si non contraints (multi-correspondances spatiales).
- Impact : risque de surcomptage sur couches exportées.

### Root-cause #3 — Hétérogénéité données lab pour training supervisé

- Les cibles VBS/IP/CG n’ont pas les mêmes couvertures; un modèle global unique est fragile et sous-performant.
- Impact : blocages training ou métriques dégradées si stratégie monolithique.

## 5) Décisions retenues (anti-dette technique)

- **Décision A — Export zone strictement à la volée**
  - Conserver et durcir l’endpoint dédié `/exports/geopackage/zone/:code` indépendant de `mv_mailles_geotech`.
  - Justification : éviter dépendance à une vue lourde/non rafraîchie.

- **Décision B — Déduplication explicite des ensembles exportés**
  - Ajout de `DISTINCT ON` et `EXISTS` ciblés sur sondages/essais en contexte zone.
  - Justification : garantir des comptages stables malgré topologies géométriques complexes.

- **Décision C — Import Lama GeoPackage industrialisable**
  - Gérer CRS GeoPackage avec `to_epsg()` + fallback contrôlé.
  - Justification : fiabiliser ingestion de géométries externes non homogènes.

- **Décision D — Workflow UI de pilotage IA directement dans le panneau thématique**
  - Ajout actions Kriging / Train IA / Recompute sources depuis la UI métier.
  - Justification : réduire friction opérationnelle et rendre le pipeline actionnable par les utilisateurs.

- **Décision E — Pipeline IA multi-tâches partiel**
  - Modèles séparés VBS/IP/CG + dérivation déterministe RGA/portance/tassement.
  - Justification : maximiser exploitation des données partielles réelles et garantir couverture 100% mailles.

## 6) Changements implémentés (par fichiers)

### 6.1 Export zone (API)

- **Fichier** : `services/api-geo/src/exports.rs`
- **Changements**
  - Consolidation de `export_geopackage_zone` (déjà à la volée sans `mv_mailles_geotech`).
  - Durcissement requêtes :
    - sondages : `DISTINCT ON (s.id)` + ciblage `target_codes`/`EXISTS`.
    - essais : sélection via `target_sondage` distinct.
  - Validation stricte `zone_code` (retour `400` sur format invalide).

### 6.2 Import géométrie Lama

- **Fichier** : `scripts/import_zone_lama.py`
- **Changements**
  - Support GeoPackage déjà présent consolidé.
  - Robustesse CRS :
    - résolution EPSG via `crs.to_epsg()`,
    - fallback explicite (`--srid-in` / 4326) si CRS incomplet.
  - Maintien du flux transactionnel :
    - update `atlas.zones_etude.geom`,
    - `atlas.recalc_mailles_zones_etude(zone_code)`,
    - restitution stats `total/prio1`.

### 6.3 Workflow thématique IA/Kriging (UI)

- **Fichier** : `ui/src/thematic/thematic-panel.ts`
- **Changements**
  - Ajout commandes utilisateur :
    - bouton `Kriging` -> `POST /ai/kriging/recompute`,
    - bouton `Train IA` -> `POST /ai/infer/train-supervised`,
    - bouton existant `Recalculer sources IA/AG` conservé.
  - Gestion token auth + toasts succès/erreur.
  - Intégration dans le flux du panneau thématique existant.

### 6.4 Stabilisation pipeline IA/Kriging (session globale)

- **Fichiers principaux déjà modifiés durant la session**
  - `scripts/kriging_gp_global_interpolate.py`
  - `scripts/supervised_rga_train_infer.py`
  - `services/api-geo/src/ai_opti.rs`
  - `services/api-geo/src/ai_jobs.rs`
  - `services/api-geo/src/main.rs`
  - `db/migrations/145_ai_geotech_sources_v1.sql`
  - `db/migrations/146_ai_maille_features_fast.sql`
  - `db/migrations/147_ai_feature_store_fast_refresh.sql`
  - `db/migrations/148_dsm_flat_cache.sql`
- **Résultat d’architecture**
  - queue jobs + worker SKIP LOCKED,
  - feature store matérialisé + refresh incrémental,
  - cache DSM dédié,
  - inférence et interpolation persistées par maille.

## 7) Commandes exécutées / audit trail

### 7.1 Build et santé services

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}"
curl -sS -o NUL -w "%{http_code}" "http://localhost:8000/healthz"
npm run build
cargo check -p api-geo
```

### 7.2 Vérifications DB zones + recalcul

```powershell
docker exec atlas-db psql -U atlas -d atlas_clean -c "SELECT code, is_published FROM atlas.zones_etude WHERE code IN ('DEPRESSION_LAMA_TG','PLAINE_OTI_TG','FOSSE_LIONS_TG') ORDER BY code;"
docker exec atlas-db psql -U atlas -d atlas_clean -c "SELECT ze.code, COUNT(*) AS n_mailles, COUNT(*) FILTER (WHERE mze.priorite_recherche=1) AS n_prio1 FROM atlas.mailles_zones_etude mze JOIN atlas.zones_etude ze ON ze.id=mze.zone_id WHERE ze.code IN ('DEPRESSION_LAMA_TG','PLAINE_OTI_TG','FOSSE_LIONS_TG') GROUP BY ze.code ORDER BY ze.code;"
python "scripts/import_zone_lama.py" --database-url "postgresql://atlas:atlas@localhost:5432/atlas_clean"
```

### 7.3 Tests exports zone

```powershell
python -c "import json,urllib.request;u='http://localhost:8000/exports/geopackage/zone/DEPRESSION_LAMA_TG';d=json.loads(urllib.request.urlopen(u, timeout=120).read().decode());print(d['metadata'])"
python -c "import json,urllib.request;u='http://localhost:8000/exports/geopackage/zone/PLAINE_OTI_TG';d=json.loads(urllib.request.urlopen(u, timeout=120).read().decode());print(d['metadata'])"
python -c "import json,urllib.request;u='http://localhost:8000/exports/geopackage/zone/FOSSE_LIONS_TG';d=json.loads(urllib.request.urlopen(u, timeout=120).read().decode());print(d['metadata'])"
curl -sS -o NUL -w "%{http_code}" "http://localhost:8000/exports/geopackage/zone/INVALID%20zone"
```

### 7.4 Exécution pipeline IA/Kriging et vérifications

```powershell
python "scripts/kriging_gp_global_interpolate.py" --database-url "postgresql://atlas:atlas@localhost:5432/atlas_clean"
python "scripts/supervised_rga_train_infer.py" --database-url "postgresql://atlas:atlas@localhost:5432/atlas_clean"
docker exec atlas-db psql -U atlas -d atlas_clean -c "SELECT (SELECT COUNT(*) FROM atlas.maille_geotech_infer) AS infer_rows, (SELECT COUNT(*) FROM atlas.maille_geotech_interpolation) AS interp_rows, (SELECT COUNT(*) FROM atlas.maille_geotech_foundation) AS foundation_rows;"
docker exec atlas-db psql -U atlas -d atlas_clean -c "SELECT model_target, model_version, created_at, metrics->>'n_vbs_training' AS n_vbs, metrics->>'n_ip_training' AS n_ip, metrics->>'n_cg_training' AS n_cg FROM atlas.ai_model_registry ORDER BY created_at DESC LIMIT 5;"
```

### 7.5 Rebuild API pour aligner runtime et code

```powershell
docker compose up -d --build api-geo
curl -sS "http://localhost:8000/healthz"
python -c "import urllib.request,json;params=['ai_rga_score_infer','kriging_ip','kriging_vbs','ag_safety_factor']; ... "
```

## 8) Debug / itérations et points d’attention

- **Itération 1** : endpoints thématiques IA/Kriging en `400 unknown variant`.
  - Diagnostic : API active pas reconstruite.
  - Action : rebuild docker `api-geo`.
  - Validation : paramètres IA/Kriging répondent ensuite avec `29407` features.

- **Itération 2** : test code invalide export zone.
  - Validation HTTP explicite (`400`) pour sécuriser contrat d’entrée endpoint.

- **Itération 3** : robustesse import Lama GeoPackage.
  - Renforcement gestion CRS pour cas réel de fichiers externes incomplets.

- **Point d’attention perf/modeling**
  - Warning `ConvergenceWarning` sur GP length_scale proche borne basse : non bloquant fonctionnellement, à surveiller pour tuning hyperparamètres.
  - Métriques R2 supervisé encore faibles sur jeu courant (coverage lab limitée), cohérent avec stratégie multi-tâches partielle adoptée.

## 9) Résultats obtenus (validations intermédiaires et finales)

- **Zones et recalculs**
  - `DEPRESSION_LAMA_TG`: `1549` mailles (`1456` prio1).
  - `PLAINE_OTI_TG`: `1270` mailles (`1198` prio1).
  - `FOSSE_LIONS_TG`: `268` mailles (`213` prio1).

- **Exports zone à la volée**
  - Lama : `n_mailles=1549`, `n_sondages=35`.
  - Oti : `n_mailles=1270`.
  - Fosse : `n_mailles=268`.
  - Entrée invalide : `400`.

- **Pipelines IA/Kriging**
  - Kriging : `29407` mailles interpolées.
  - Supervised infer : `29407` mailles prédites.
  - Tables IA :
    - `maille_geotech_infer=29407`
    - `maille_geotech_interpolation=29407`
    - `maille_geotech_foundation=29407`
  - Modèle registry (dernier run): `supervised_ml_gb_v1`, training rows `n_vbs=24`, `n_ip=24`, `n_cg=69`.

- **Thématique IA/Kriging (post-rebuild API)**
  - `ai_rga_score_infer`: OK (`29407` features)
  - `kriging_ip`: OK (`29407`)
  - `kriging_vbs`: OK (`29407`)
  - `ag_safety_factor`: OK (`29407`)

## 10) Impacts, arbitrages et informations manquantes à clôturer

- **Impacts front**
  - Panneau thématique enrichi en pilotage opérationnel IA/Kriging.
  - Réduction du couplage “action IA” vs DB Manager uniquement.

- **Impacts backend**
  - Export zone plus robuste (dédup et règles d’accès explicites).
  - Contrat endpoint thématique validé après alignement binaire runtime.

- **Impacts DB / SIG**
  - Consolidation de la chaîne zones_etude -> mailles_zones_etude.
  - Réattribution complète des données IA/Kriging sur la grille nationale.

- **Arbitrages**
  - Favoriser robustesse et traçabilité des flux sur la sophistication prématurée des modèles.
  - Conserver fallback déterministes pour garantir couverture 100% mailles.

- **Manquants pour clôture définitive**
  - Test e2e avec un vrai fichier GeoPackage officiel Lama (non présent dans workspace).
  - Finalisation complète KPI Colab (missions/étudiants/superviseurs/documents) sur tous filtres métier.
  - Calibration qualité modèle (features DSM stabilisées + tuning GP/GB) pour amélioration R2.

## 11) Statut

- **Fait (session du jour)**
  - Export zone indépendant + durci + testé.
  - Seeds Oti/Fosse + recalcul mailles_zones_etude validés.
  - Import Lama GeoPackage consolidé (CRS/fallback) + run script validé.
  - Workflow thématique IA/Kriging connecté UI + build validé.
  - Rebuild API + validation paramètres thématiques IA/Kriging.
  - Relance pipelines Kriging/supervised avec résultats persistés.

- **En cours global roadmap**
  - Alignement KPI Colab multi-objets selon règles métier, et stabilisation qualité prédictive avancée (features + tuning) pour passage “production-ready” V1.

