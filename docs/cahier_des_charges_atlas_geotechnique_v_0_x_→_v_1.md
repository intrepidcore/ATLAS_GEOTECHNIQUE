# Cahier des charges

> Projet : **Atlas Géotechnique**  
> Périmètre : **Plateforme locale (localhost) d’exploration géotechnique**  
> Destinataire : **Mémoire d’ingénieur** (démo locale, non SaaS)  
> Rédaction : **v0.1.0-CCD**  
> Date : 2025-10-17

---

## 0. Vision & objectifs

**Vision.** Mettre à disposition une application locale, reproductible et performante permettant d’agréger, visualiser et calculer des indicateurs géotechniques (ex. SPT_N) sur une grille nationale (Togo), avec calculs lourds implémentés en **Rust** et stockage **PostGIS**.

**Objectifs clés.**
1. Visualiser une **grille couvrant tout le Togo** ; colorer uniquement les mailles contenant des sondages.  
2. Intégrer des **algorithmes d’interpolation** (IDW p=2 initialement) et des agrégations par maille.  
3. Offrir une **UI simple** (Leaflet) pour consulter les résultats et déclencher les recalculs.  
4. Garantir une **exécution 100% locale** (localhost), reproductible via Docker Compose, sans exposition publique.

**Hors périmètre (Contexte académique).** Pas de déploiement SaaS, pas de gestion d’utilisateurs, pas d’authentification.

---

## 1. Cadre & livrables

### 1.1 Livrables principaux
- **L1. Monorepo** `atlas/` : services, ETL, UI, migrations, Makefile, CI de base.  
- **L2. Base de données** PostGIS avec schéma standard (mailles, sondages, essais, stats).  
- **L3. API Rust (Axum)** `api-geo` : endpoints `/grid`, `/coverage`, `/recompute`, `/shape`.  
- **L4. UI (Vite + TS + Leaflet)** : carte nationale, couche grille, panneau d’infos, actions GET/POST.  
- **L5. Données seed** fictives couvrant le Togo (EPSG interne 25231 ; sorties 4326).  
- **L6. Documentation** : README, schéma d’archi, protocole de test, captures pour le mémoire.

### 1.2 Livrables secondaires
- **Scripts utilitaires** (ex. redémarrage `api-geo`).  
- **Profils Docker Compose** pour isoler les services non nécessaires.  
- **Plan d’extension** (v1.x) : ajout d’interpolations/optimisations, import de données réelles.

---

## 2. Exigences (fonctionnelles & non-fonctionnelles)

### 2.1 Exigences fonctionnelles (EF)
- **EF-01. Grille nationale** : exposer toutes les mailles (Togo) ; renvoyer `has_data`, `n_sondages`, `n_essais` par maille.  
- **EF-02. Sélection maille** : par code (ex. `TG-001`) et par clic carte ; affichage bbox, comptes et stats.  
- **EF-03. Interpolation IDW** : recalcul `POST /grid/recompute/{code}` (paramètre SPT_N, p=2 par défaut).  
- **EF-04. Couche carte** : afficher la grille (contours fins), **colorer uniquement** les mailles ayant `has_data=true`.  
- **EF-05. Export minimal** : télécharger la maille active en GeoJSON.  
- **EF-06. Seed** : fournir des mailles & sondages fictifs (au moins Lomé, Sokodé, Kara, Dapaong).  
- **EF-07. Aide & état** : zone de statut (Loading/OK/Error), logs succincts, page README locale.

### 2.2 Exigences non-fonctionnelles (ENF)
- **ENF-01. Localhost** : tous les services bindés sur `127.0.0.1`.  
- **ENF-02. Reproductibilité** : infra Docker Compose, migrations, seed automatisé.  
- **ENF-03. Performance** : calculs gourmands en **Rust** (concurrence via Rayon possible).  
- **ENF-04. Projection** : SRID interne **EPSG:25231** ; interfaces extérieures **EPSG:4326**.  
- **ENF-05. Traçabilité** : logs structurés (tracing), `GET /healthz`, CI basique (format/clippy/build).  
- **ENF-06. Simplicité** : UI légère, pas d’authentification, pas de back-office.

---

## 3. Architecture cible

### 3.1 Vue d’ensemble
- **DB** : Postgres 16 + PostGIS.  
- **API** : Rust + Axum + SQLx (mode online), `tls-rustls`.  
- **UI** : Vite + TypeScript + Leaflet (Nginx en prod locale).  
- **ETL** : Python + Poetry (chargement seed, imports simples).  
- **Orchestration** : Docker Compose (réseau `atlas-net`, healthchecks).  

### 3.2 Modèle de données (simplifié)
- `mailles (code TEXT PK, geom POLYGON(25231), stats JSONB, created_at, updated_at)`  
- `sondages (id SERIAL PK, geom POINT(25231), date, source)`  
- `essais (id SERIAL PK, sondage_id FK, type TEXT, value NUMERIC, depth REAL, unit TEXT)`  
- Index GIST sur `geom`, FK strictes.

---

## 4. Spécification des API (v0.7.0)

### 4.1 Endpoints
- **GET `/healthz`** → `{status:"ok"}`  
- **GET `/grid/{code}`** → `{ code, bbox(4326), stats(JSON), summary{ by_type, n_sondages, n_essais } }`  
- **POST `/grid/recompute/{code}`** → recalcul IDW SPT_N (p=2) et mise à jour `mailles.stats`  
- **GET `/grid/{code}/shape`** → `Feature<Polygon>` (4326)  
- **GET `/coverage/mailles`** → `FeatureCollection` (4326) avec `properties{ code, has_data, n_sondages, n_essais }`

### 4.2 Règles & contraintes
- **CORS** : autoriser GET/POST/OPTIONS depuis l’UI locale (tower_http::cors).  
- **Erreurs** : statuts HTTP + message structuré `{error, details?}` ; logs.

---

## 5. Spécifications UI (v0.7.0)

### 5.1 Carte & couches
- Fond OSM.  
- Couche **grille nationale** (GeoJSON) :  
  - `has_data=false` → contour gris, remplissage transparent (`fillOpacity=0`).  
  - `has_data=true` → couleur semi-transparente (`fillOpacity≈0.45`).  
- Couche **maille active** : surbrillance + bbox (rectangle) + zoom sur la maille.

### 5.2 Panneau latéral
- Champ « Code maille » + boutons :  
  - `GET /grid/{code}`, `POST /grid/recompute/{code}`, `GET /grid/{code}/shape`, `Export GeoJSON`.  
- Zone **statut** (spinner Loading, badges OK/Error).  
- Bloc **résumé** (code, bbox, comptes, IDW) + bloc **JSON brut**.

### 5.3 Interactions
- Clic sur une maille de la grille :  
  - renseigne l’input code,  
  - déclenche `GET /grid/{code}`,  
  - option « zoom sur la maille ».

---

## 6. Déploiement local & exploitation

### 6.1 Docker Compose
- Services : `db`, `api-geo`, `ui`, `etl` (+ `api-infer`, `api-opti` sous profils).  
- Ports : `db:5432`, `api-geo:8001→8000`, `ui:8080→80`.  
- Variables `.env` : `POSTGRES_*`, `DATABASE_URL`, `VITE_API_*`, `MODEL_PATH?`.

### 6.2 Procédures
- **Bootstrap**  
  `docker compose up -d db api-geo`  
  `docker compose run --rm etl etl load-sample`  
  `docker compose up -d --no-build --no-deps ui`
- **Santé**  
  `Invoke-RestMethod http://127.0.0.1:8001/healthz`  
- **Restart auto** (script PowerShell)  
  si healthz ≠ 200 → `docker compose restart api-geo`.

---

## 7. Qualité & tests

### 7.1 Critères d’acceptation (CA)
- **CA-01.** `/coverage/mailles` renvoie un **FeatureCollection** couvrant tout le Togo.  
- **CA-02.** L’UI affiche la **grille complète** ; **seules** les mailles avec `has_data=true` sont colorées.  
- **CA-03.** Clic sur une maille → `GET /grid/{code}` fonctionne et affiche bbox, comptes et stats.  
- **CA-04.** `POST /grid/recompute/{code}` met à jour `stats.idw` et reflète la valeur dans l’UI.  
- **CA-05.** L’ensemble tourne **sans accès Internet** après build (hors téléchargement d’images Docker initial).  
- **CA-06.** L’exécution répétée des commandes (start/stop/seed) est **idempotente**.

### 7.2 Tests recommandés
- Tests d’intégration API (Rust) pour `/grid`, `/recompute`, `/coverage`.  
- Tests UI manuels (scénarios utilisateur) + captures pour mémoire.  
- Vérifications SRID & transformations (ST_Transform, ST_Within) sur échantillons.

---

## 8. Planning & versions

### 8.1 Jalons
- **M1 – v0.5.0** : Monorepo + DB + API squelette + UI basique _(fait en référence)_.  
- **M2 – v0.6.0** : IDW, seed initiale, appels UI -> API _(fait en référence)_.  
- **M3 – v0.7.0** : **Grille Togo + coverage + coloration conditionnelle + exports** _(objectif immédiat)_.  
- **M4 – v0.8.0** : Filtres d’essais, légende avancée, optimisation UX.  
- **M5 – v1.0.0 (Mémoire)** : Documentation finale + protocole expérimental + annexes.

### 8.2 Gestion de versions (tags)
- `v0.7.0-rc.1` – première release candidate de la couverture nationale.  
- `v0.7.0` – release stable UI+API coverage.  
- `v0.8.x` – itérations UX/fonctionnelles.  
- `v1.0.0` – version mémoire (freeze des features, docs validées).

---

## 9. Risques & mitigations
- **Données réelles indisponibles** → seed fictif riche + architecture prête à l’import.  
- **Performances calcul** → Rust + parallélisme ; limiter les recalculs aux mailles cliquées.  
- **SRID/confusions** → convention stricte : interne 25231, sorties 4326, doc claire.  
- **Rebuild Docker lents** → caches BuildKit + `.dockerignore` + builds ciblés.

---

## 10. Annexes

### 10.1 Glossaire
- **Maille** : polygone de la grille nationale (indexé `code`).  
- **Sondage** : point d’un essai géotechnique.  
- **Essai** : mesure associée à un sondage (SPT_N, qc…).  
- **IDW** : Inverse Distance Weighting.

### 10.2 Technologies
- **Back** : Rust 1.86, Axum, SQLx, Postgres 16, PostGIS.  
- **Front** : Vite, TypeScript, Leaflet, Nginx (serve).  
- **ETL** : Python 3.11, Poetry.  
- **Ops** : Docker / Compose, Makefile, GitHub Actions (lint/build).

---

## 11. Périmètre futur (post-mémoire)
- Import de données réelles, normalisation métadonnées.  
- Ajout d’interpolations supplémentaires (krigeage), optimisation multi-objectif.  
- Packaging pré-SaaS (HTTPS, reverse proxy, observabilité).

