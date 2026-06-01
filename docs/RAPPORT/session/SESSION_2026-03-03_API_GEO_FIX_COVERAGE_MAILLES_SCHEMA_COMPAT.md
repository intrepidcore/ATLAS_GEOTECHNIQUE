---
description: Session changelog raisonné — Fix API-GEO (500) sur /coverage/mailles + correction panic sqlx DATE + stabilisation Docker Compose env
date: 2026-03-03
weekday: mardi
repo: atlas_reclone
service: services/api-geo
stack: docker-compose (db postgis + api-geo)
database: atlas_clean
---

# Session — Changelog raisonné (très verbeux)

## 1) Date / méta

- **Date** : 2026-03-03 (**mardi**)
- **Contexte d’exécution** : Windows (PowerShell), repo `c:\PROJET_ATLAS_MASTER\atlas_reclone`
- **Stack** : `docker compose` avec
  - `db` = PostGIS
  - `api-geo` = backend Rust/Axum
- **DB cible** : `atlas_clean` (seed “Base Saine v1”)
- **Objectif utilisateur** :
  - éliminer les `500` backend (principalement `/coverage/mailles`)
  - prendre des décisions **propres et complètes** (éviter patchs fragiles / dette technique)
  - conserver un audit trail (commandes + causes racines + références code)

---

## 2) Symptômes observés (départ)

### 2.1. Erreur API “visible” côté UI

- Appels UI vers `GET /coverage/mailles?grid=2km` renvoyaient **`500`**.
- Le backend répondait souvent un FeatureCollection vide (fallback existant) mais avec **HTTP 500**, donc l’UI considère l’appel en échec.

### 2.2. Panic Rust / sqlx (autre source de 500)

- Dans un autre endpoint (`/grid/.../details`), un champ SQL de type `DATE` était décodé comme `String` via `row.get("date")`, ce qui peut déclencher un panic `sqlx` (**erreur de décodage**).

---

## 3) Décisions structurantes (raisonnées)

### Décision A — Corriger côté API et **aligner avec le schéma réel** `atlas_clean` (pas “forcer” la DB)

**Choix retenu** : adapter les requêtes SQL de `api-geo` au schéma *effectivement présent* dans `atlas_clean`.

**Pourquoi (anti dette technique)** :
- Les erreurs provenaient majoritairement de **mismatches de schéma** (colonnes inexistantes, types incompatibles, soft-delete supposé mais absent).
- Créer en urgence des colonnes/vues “pour faire passer” l’API aurait :
  - augmenté la divergence entre environnements
  - rendu le seed “Base Saine v1” moins déterministe
  - masqué les vrais contrats de données

### Décision B — Instrumenter les erreurs SQL avec `query` + `error` (observabilité) avant d’itérer

**Choix retenu** : améliorer le log sur l’échec `coverage query` pour inclure la requête SQL générée.

**Pourquoi** :
- `docker logs` montrait peu d’indices (au début, seulement des `/healthz`).
- Sans la requête exacte, on corrige « à l’aveugle » et on risque de multiplier des patchs incomplets.

### Décision C — Réparer la chaîne Docker Compose de façon déterministe (fichier `.env` minimal)

**Choix retenu** : créer un `.env` minimal (valeurs canoniques) à la racine du repo afin que `docker compose up` ne bloque pas.

**Pourquoi** :
- `docker compose up` échouait si `.env` absent.
- La configuration doit être reproductible sur une machine neuve.

---

## 4) Root causes identifiées (preuves)

Cette section liste les causes racines *réelles* rencontrées pendant la session, avec les messages exacts ou observations DB.

### 4.1. Colonnes inexistantes dans `atlas.mailles`

- La requête `/coverage/mailles` utilisait (dans une version initiale) :
  - `m.adm1_name`
  - `m.adm3_name`

**Or** `atlas.mailles` ne contient pas ces colonnes (dans `atlas_clean`).

Preuve (inspection) :
- `\d+ atlas.mailles` => colonnes: `pref_name`, `adm2_name` (mais pas `adm1_name`/`adm3_name`).

### 4.2. Mismatch de types `uuid = text`

Erreur PostgreSQL observée lors de l’exécution de la requête (replay en DB) :
- `ERROR: operator does not exist: uuid = text`

Cause :
- jointure `cs.id = ca.student_id` alors que :
  - `atlas.colab_students.id` est `uuid`
  - `atlas.colab_maille_assignments.student_id` est `text`

### 4.3. Soft-delete “supposé” mais absent (colonnes `deleted_at` inexistantes)

- `atlas.colab_students` : pas de `deleted_at`
- `atlas.colab_missions` : pas de `deleted_at`

Donc toute clause `cs.deleted_at IS NULL` ou `cm.deleted_at IS NULL` casse la requête.

### 4.4. Décodage SQLx du champ `DATE`

Cause :
- SQL renvoyait `s.date` (type `DATE`) mais le Rust faisait `sondage_row.get("date")` en `Option<String>`.

Décision :
- cast SQL `s.date::text AS date` + lecture safe via `try_get`.

---

## 5) Changements effectués (par fichiers) — “changelog raisonné”

> Note: cette section décrit les changements **effectivement committables** et leurs raisons. Elle ne duplique pas le code complet, mais pointe vers les blocs.

### 5.1. `services/api-geo/src/routes.rs`

#### 5.1.1 Fix panic / mismatch `DATE` → `String` dans `get_grid_details`

- **Avant** :
  - SQL: `s.date`
  - Rust: `date: sondage_row.get("date")` (panic si type incompatible)
- **Après** :
  - SQL: `s.date::text AS date`
  - Rust: `date: sondage_row.try_get("date").ok()`

**Pourquoi** :
- empêche un panic `sqlx` (donc un `500`)
- garde un contrat API simple (`Option<String>`) sans imposer `chrono` dans toute la chaîne

Référence code :
- `services/api-geo/src/routes.rs` (section `get_grid_details`, requête sondages)

#### 5.1.2 Fix `/coverage/mailles` : requête compatible `atlas_clean`

Changements principaux :

- **Suppression des colonnes inexistantes** :
  - `m.adm1_name` et `m.adm3_name` retirées
  - fallback `adm1_name` assuré via `adm2_tg.adm1_name`

- **Fix mismatch types** (`uuid = text`) :
  - `WHERE cs.id::text = ca.student_id::text`
  - `JOIN atlas.colab_students cs ON cs.id::text = cma.student_id::text`

- **Suppression des soft-delete non existants** :
  - retrait `cs.deleted_at IS NULL`
  - retrait `cm.deleted_at IS NULL`
  - conservation de `u.deleted_at IS NULL` (qui existe dans `atlas.users`)

- **Observabilité** :
  - sur erreur SQL: log `tracing::error!(error=%e, query=%query, "coverage query")`

Référence code :
- `services/api-geo/src/routes.rs` fonction `get_coverage_mailles`

### 5.2. `c:\PROJET_ATLAS_MASTER\atlas_reclone\.env`

- **Ajout** d’un `.env` minimal pour `docker compose`.

Valeurs clés :
- `POSTGRES_USER=atlas`
- `POSTGRES_PASSWORD=atlas`
- `POSTGRES_DB=atlas_clean`

**Pourquoi** :
- `docker compose up` échouait si `.env` absent.
- rend la relance/rebuild reproductible.

### 5.3. `docker-compose.yml` (référence)

- `api-geo` utilise :
  - `DATABASE_URL: postgres://atlas:atlas@db:5432/atlas_clean`
  - port `8000:8000`

Ce fichier n’a pas été modifié dans cette session, mais il est important comme **source de vérité d’exécution**.

---

## 6) Commandes exécutées (audit trail)

> Toutes les commandes ci-dessous ont été utilisées pour diagnostiquer, rebuild, reproduire et valider.

### 6.1. Build/rebuild du service `api-geo`

```powershell
# cwd: c:\PROJET_ATLAS_MASTER\atlas_reclone
docker compose build api-geo
```

### 6.2. Redéploiement du conteneur sans toucher aux autres services

```powershell
# Recrée uniquement api-geo
docker compose up -d --no-deps --force-recreate api-geo
```

### 6.3. Logs backend

```powershell
docker logs --tail 250 atlas-api-geo
```

### 6.4. Tests HTTP PowerShell (sans wrapper)

```powershell
$u='http://127.0.0.1:8000/coverage/mailles?grid=2km&limit=10'
$r=Invoke-WebRequest -UseBasicParsing -SkipHttpErrorCheck $u
$r.StatusCode
```

Validation du volume (features) :

```powershell
$u='http://127.0.0.1:8000/coverage/mailles?grid=2km&limit=10'
$r=Invoke-WebRequest -UseBasicParsing -SkipHttpErrorCheck $u
($r.Content | ConvertFrom-Json).features.Count
```

### 6.5. Debug DB : inspection schéma / reproduction SQL

```powershell
# Schémas / colonnes
docker exec atlas-db psql -U atlas -d atlas_clean -c "\\d+ atlas.mailles"
docker exec atlas-db psql -U atlas -d atlas_clean -c "\\d+ atlas.colab_students"
docker exec atlas-db psql -U atlas -d atlas_clean -c "\\d+ atlas.colab_maille_assignments"
docker exec atlas-db psql -U atlas -d atlas_clean -c "\\d+ atlas.colab_mission_assignments"
docker exec atlas-db psql -U atlas -d atlas_clean -c "\\d+ atlas.colab_missions"
```

---

## 7) Résultats / validations

### 7.1. `/coverage/mailles` est redevenu stable

- `GET /coverage/mailles?grid=2km&limit=10` => **HTTP 200**
- nombre de `features` => **29407** (cohérent avec la grille).

### 7.2. Amélioration du signal de debug

- En cas de future régression, `docker logs` contient maintenant :
  - l’erreur SQL
  - la requête exacte (`query`) ayant échoué

Cela réduit drastiquement le coût de debug et évite les “patchs au hasard”.

---

## 8) Notes de qualité / dette technique évitée

- **Pas de migration “pansement”** pour ajouter des colonnes manquantes : on a corrigé le backend pour respecter le seed `atlas_clean`.
- **Pas de `unwrap()` sur des colonnes fragiles** (date) : on a rendu le décodage tolérant.
- **Pas de dépendance à une vue legacy** (`public.v_maille_kpi_v2`) : les KPI côté `cells_kpi.rs` utilisent `atlas.mv_mailles_geotech`.
- **Observabilité** améliorée à l’endroit exact où l’API retournait `500`.

---

## 9) Références (code & docs)

### Code

- `services/api-geo/src/routes.rs`
  - `get_coverage_mailles` (requête principale + joins colab + bbox)
  - `get_grid_details` (cast `s.date::text` + `try_get`)

- `docker-compose.yml`
  - service `api-geo` (DATABASE_URL vers `atlas_clean`)

- `.env`
  - valeurs minimales pour Compose

### Docs de style “session / changelog raisonné” utilisées comme référence

- `docs/session/SESSION_2026-03-02_DESKTOP_BOOTSTRAP_STABILIZATION_DB_MANAGER_AUTH_SEED.md`
- `docs/session/SESSION_2026-03-02_COLAB_EXPORT_REINTEGRATION_GIT_DESKTOP_IMPORT.md`

---

## 10) Prochaines étapes (logique)

- **Stabiliser les endpoints `colab/*`** signalés en erreur (si 500 persistants dans d’autres handlers).
- Ensuite : **valider le boot complet Desktop/Tauri** (PG start → restore seed → post-v1 migrations only → start api-geo → UI).

Fin de session.
