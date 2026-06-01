# Session 2026-03-02 — Stabilisation bootstrap Desktop (Tauri) + alignement UI dev proxy + endpoints DB-Manager/Auth + préparation seed dump

## Date / méta

- **Date** : 2026-03-02 (lundi)
- **Objectif utilisateur** : stabiliser le bootstrap Desktop (migrations idempotentes + seed DB) et éliminer les erreurs UI (`500`/proxy), puis passer à **Desktop: seed/restore dump DB embarquée + lancer Tauri + valider UI sans 500**.
- **Contexte** : repo `atlas_reclone` sur Windows, stack Docker Compose (DB + `api-geo`) et application Desktop (Tauri) `apps/atlas-pro`.

---

## Contexte (problème racine)

### Symptômes initiaux (UI)

- L’UI en mode dev (`vite`) déclenchait des erreurs sur :
  - `/api/db/*` (db-manager)
  - `/api/auth/login`
- Ces erreurs étaient observées comme des `500`/échecs réseau via le proxy Vite.

### Cause racine

- **Le proxy Vite** routait `/api` vers **`http://127.0.0.1:8001`**, mais **aucun service n’écoutait** sur ce port.
- L’UI attend des endpoints:
  - `GET /db/schema`, `GET /db/table/:schema/:table`, `GET /db/table/:schema/:table/data`
  - `POST /auth/login` et aussi (pendant le boot UI) `GET /auth/me`, `POST /auth/refresh`, etc.
- **`api-geo`** (port 8000) ne fournissait pas ces endpoints dans la configuration observée.

---

## Choix / décisions (raisonnées)

### Décision A — Fix “propre” vs bricolage du proxy

- **Choix retenu** :
  - (1) corriger le proxy Vite pour pointer vers `api-geo` sur `8000`
  - (2) ajouter dans `api-geo` un module minimal **read-only** “db API” (`/db/*`) + un “auth dev/desktop” (`/auth/*`) pour débloquer le boot UI.
- **Pourquoi** :
  - évite un service fantôme sur 8001
  - centralise les routes sous `api-geo` (cohérent avec le routage actuel)
  - garantit que l’UI dev et l’UI Desktop ont un backend compatible

### Décision B — Auth “dev/desktop” explicitement *gated*

- **Choix retenu** : ces endpoints auth sont **désactivés** si `ATLAS_DESKTOP != 1`.
- **Pourquoi** :
  - ne pas exposer une authentification “fake” si le service est déployé hors contexte Desktop/dev.
  - élimine les 404 UI sans introduire un système JWT/roles complet hors scope.

### Décision C — DB-Manager read-only et sécurisé (baseline)

- **Choix retenu** :
  - endpoints **read-only**
  - validation stricte des identifiants (`schema`, `table`) pour éviter l’injection SQL via noms de tables.
- **Pourquoi** :
  - répondre au besoin UI immédiat (inspection schema/table/data)
  - minimiser le risque tout en restant utilisable.

---

## Changements effectués (par fichiers)

### UI

#### `ui/vite.config.ts`

- **Changement** : proxy `/api` → `http://127.0.0.1:8000` (au lieu de 8001)
- **But** : aligner le dev server sur un backend réel.

### Backend `api-geo`

#### `services/api-geo/src/db_api.rs` (nouveau)

- **Ajout** : router `GET /db/schema`, `GET /db/table/:schema/:table`, `GET /db/table/:schema/:table/data`.
- **Notes** :
  - `/db/schema` liste schémas/tables via `pg_class` / `pg_namespace`.
  - `/db/table/...` s’appuie sur `information_schema.columns` + introspection PK via `pg_index`.
  - `/db/table/.../data` retourne des lignes via `row_to_json`.

#### `services/api-geo/src/auth_dev.rs` (nouveau)

- **Ajout** :
  - `POST /auth/login` (desktop/dev)
  - `GET /auth/me`
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - `POST /auth/logout-all`
- **Token** : un token stable est renvoyé/attendu : `desktop-dev-token`.

#### `services/api-geo/src/main.rs`

- **Wiring** :
  - `.nest("/db", db_api::router())`
  - `.nest("/auth", auth_dev::router())`
- **CORS** : ajout des origines dev Vite
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
  - (en plus des origines `8080` déjà présentes)

---

## Commandes exécutées (journal opératoire)

### Rebuild + restart backend (`api-geo`) via Docker

```powershell
# cwd: c:\PROJET_ATLAS_MASTER\atlas_reclone
docker compose -f docker-compose.yml up -d --build api-geo
```

### Tests manuels endpoints DB

```powershell
curl -s -i http://127.0.0.1:8000/db/schema
curl -s -i http://127.0.0.1:8000/db/table/atlas/sondages
curl -s -i "http://127.0.0.1:8000/db/table/atlas/sondages/data?limit=1&offset=0"
```

### Tests auth (PowerShell)

Important: en PowerShell, l’échappement JSON est fragile. Recommandation:

```powershell
$body = '{"email":"admin@local","password":"admin"}'
curl.exe -s -i -X POST "http://127.0.0.1:8000/auth/login" -H "Content-Type: application/json" --data-raw $body

curl.exe -s -i "http://127.0.0.1:8000/auth/me" -H "Authorization: Bearer desktop-dev-token"

$body2 = '{"refresh_token":"desktop-dev-refresh"}'
curl.exe -s -i -X POST "http://127.0.0.1:8000/auth/refresh" -H "Content-Type: application/json" --data-raw $body2
```

---

## Résultats observés / validation

- `/db/schema` : **200** et renvoie la liste schemas/tables.
- `/db/table/atlas/sondages` : **200** et renvoie colonnes + PK.
- `/db/table/atlas/sondages/data` : **200** et renvoie des lignes.
- `/auth/me` : **200** si header `Authorization: Bearer desktop-dev-token`.
- Les erreurs UI de type `db/schema` “non trouvé” sont éliminées.

---

## Points restants identifiés (console UI)

- **WebSocket** `ws://127.0.0.1:8000/ws` : non implémenté / non disponible → warnings de reconnect.
- **/adm0/geojson** : `404` côté backend → le front tente de charger un contour pays.
- **tiles offline** : `http://localhost:8081/data/togo_map.json` refusé → tileserver offline non lancé (non bloquant).
- **/colab/** : certaines routes 404 en dev (selon bundle UI et modules activés).

Ces points ne bloquent pas le DB-Manager/auth et seront revalidés en contexte Desktop (sidecar) lors de la phase suivante.

---

## Prochaine étape (engagée après ce document)

### Desktop: seed/restore dump dans DB embarquée + lancer Tauri + valider UI sans 500

- La logique de seed Desktop (Tauri) cherche un dump via:
  - `ATLAS_DESKTOP_SEED_DUMP_PATH` (si défini)
  - ou `data/db/backups/atlas_desktop_seed.dump|.sql|.backup`
  - sinon “newest” fichier dump-like dans `data/db/backups/`

**Attention** : le dump seed n’était pas présent dans `atlas_reclone` au moment de la recherche initiale.

- Le dump existe en dehors du workspace, sur le disque `E:` :
  - `E:\PROJET_ATLAS_MASTER\atlas\data\db\backups\pre_refonte_grille_v2_20260117.dump`

Il faut donc:

- soit **copier** ce dump dans `atlas_reclone/data/db/backups/` (pour la détection automatique)
- soit définir `ATLAS_DESKTOP_SEED_DUMP_PATH` vers ce chemin absolu.

---

## Références

- UI proxy:
  - `ui/vite.config.ts`
- Backend db-manager:
  - `services/api-geo/src/db_api.rs`
- Backend auth dev/desktop:
  - `services/api-geo/src/auth_dev.rs`
- CORS + wiring:
  - `services/api-geo/src/main.rs`
- Seed Desktop:
  - `apps/atlas-pro/src-tauri/src/postgres.rs` (`find_seed_dump`, `restore_seed_dump`)

---

## Compléments ajoutés (historique de dev reconstitué depuis la session)

Cette section consolide ce qui a été fait / diagnostiqué pendant la session mais qui n’était pas encore écrit dans la première version du document.

### 1) Seed Desktop (Tauri) : restauration automatique d’un dump au 1er lancement

#### Objectif fonctionnel visé

- Au **premier lancement** du Desktop :
  - créer/initialiser un cluster PostgreSQL local (embarqué)
  - restaurer un dump de dev (seed) si la base est “vide”
  - puis appliquer les mécanismes nécessaires pour que le **deuxième lancement** ne réimporte pas tout (idempotence / fingerprint)

#### Implémentation observée (code)

Fichier de référence :

- `apps/atlas-pro/src-tauri/src/postgres.rs`

Points importants :

- `find_seed_dump(repo_root)` :
  - priorité à `ATLAS_DESKTOP_SEED_DUMP_PATH` si définie
  - sinon recherche dans `data/db/backups/` de :
    - `atlas_desktop_seed.dump`
    - `atlas_desktop_seed.sql`
    - `atlas_desktop_seed.backup`
  - fallback : prend le **plus récent** fichier `dump|backup|sql` dans ce dossier

- `database_looks_initialized(...)` : heuristique basée sur l’existence d’une table “core” (actuellement `public.sondages`).

- `restore_seed_dump(...)` :
  - si extension `.sql` : applique via `psql.exe -f <file>`
  - sinon : utilise `pg_restore.exe` (formats custom/tar/directory)

#### Scénarios prévus (E2E)

- **Scénario S1 (boot 1, DB vide)** :
  - `database_looks_initialized` → false
  - `find_seed_dump` → trouve un dump
  - `restore_seed_dump` restaure
  - la table `atlas.desktop_state` est (re)créée après restore

- **Scénario S2 (boot 2, DB déjà seedée)** :
  - `database_looks_initialized` → true
  - skip restore dump
  - application démarre rapidement

- **Scénario S3 (forcer restore)** :
  - possible via un flag/env (à confirmer selon le reste du fichier), sinon suppression du data dir.

### 2) Recherche / récupération de dump (état réel)

#### Attendu

- Dump demandé : `pre_refonte_grille_v2_20260117.dump`.

#### Recherche effectuée

- Recherche dans le workspace `c:\PROJET_ATLAS_MASTER\atlas_reclone` : aucun dump trouvé.
- Recherche élargie : dump localisé sur `E:` :
  - `E:\PROJET_ATLAS_MASTER\atlas\data\db\backups\pre_refonte_grille_v2_20260117.dump`
  - autre dump proche (un peu plus ancien) :
    - `E:\PROJET_ATLAS_MASTER\atlas\db\dumps\atlas_clean_pre_clip_20260114_103839.dump`

#### Décision proposée

- Option A (préférée) : localiser le dump exact `pre_refonte_grille_v2_20260117.dump` et définir :
  - `ATLAS_DESKTOP_SEED_DUMP_PATH=<chemin absolu>`

- Option B (fallback) : utiliser temporairement `atlas_clean.dump` comme seed, si son contenu correspond au schéma attendu.

### 3) Audit “systématique” de `db/migrations/` (patterns et implications)

Une revue structurée du dossier `db/migrations/` a été faite pour repérer les patterns et risques :

- **Migrations alternatives / doublons contrôlés** :
  - ex `020_upgrade_types_to_proper_schema.sql` + `020_upgrade_types_to_proper_schema_v2.sql`
- **Migrations désactivées** :
  - ex `096_clip_mailles_28km_to_border.sql.DISABLED`
- **Gros paliers fonctionnels** :
  - `050_*` RBAC
  - `060_*` colab
  - `090_*` context layers + dsm
  - `106_*` refonte grille v2

Implication Desktop : éviter “appliquer tout sans stratégie”. Le modèle recommandé est :

- un dump de base (seed)
- puis un set de migrations strictement nécessaires / idempotentes
- et un fingerprint dans `atlas.desktop_state` pour éviter les ré-exécutions.

### 4) Divergence UI (Tauri dev / bundle) vs `origin/main`

Constat implicite pendant la session :

- Certains comportements UI (ex: éléments manquants, panels/onglets non alignés) suggèrent que **l’UI utilisée par Tauri** (via `beforeDevCommand`/`frontendDist`) peut ne pas être la dernière version attendue.

Hypothèse :

- La branche courante n’embarque pas certains fichiers UI présents dans `origin/main`.

Décision proposée (méthode robuste) :

- restaurer depuis `origin/main` des dossiers complets plutôt que des fichiers isolés.

Commandes (à lancer volontairement, car elles modifient le working tree) :

```powershell
git fetch origin
git checkout origin/main -- docs db/migrations

# Si l’UI doit être resynchronisée également
# git checkout origin/main -- ui
```

### 5) Génération du token Bearer via l’API (commande exacte PowerShell)

Le token est obtenu via : `POST /auth/login` (mode `ATLAS_DESKTOP=1`).

Commande stable PowerShell :

```powershell
$body = '{"email":"admin@local","password":"admin"}'
curl.exe -s -X POST "http://127.0.0.1:8000/auth/login" -H "Content-Type: application/json" --data-raw $body
```

Puis test :

```powershell
curl.exe -s -i "http://127.0.0.1:8000/auth/me" -H "Authorization: Bearer desktop-dev-token"
```

### 6) Notes “restore Docker” (tentatives, erreurs, état)

Cette partie est volontairement factuelle : ce qui a été tenté, et ce qui a échoué, avec les messages observés.

- Tentative 1 (restauration côté conteneur DB en PG16) :
  - `pg_restore: error: unsupported version (1.16) in file header`
  - interprétation : dump “custom format” produit par `pg_dump` v17.x, incompatible avec `pg_restore` v16.

- Tentative 2 (restauration depuis Windows vers la DB Docker PG16) :
  - `ERROR: unrecognized configuration parameter "transaction_timeout"`
  - interprétation : dump PG17 contient des `SET transaction_timeout = 0;` que PG16 ne reconnaît pas.

- Décision de correction : aligner Docker DB sur PG17 (pour matcher le dump).
  - tag tenté `postgis/postgis:17-3.6` : introuvable
  - tag utilisé `postgis/postgis:17-3.4` : OK

- Erreur au démarrage init SQL (PostGIS pas activé au bon moment) :
  - `ERROR: type "geometry" does not exist` pendant l’exécution de `migrations/007_grid_v0.7.0.sql`
  - implication : il faut garantir `CREATE EXTENSION postgis;` avant toute table qui déclare une colonne `geometry(...)`.

### 7) Source de vérité (journal brut)

Le journal de conversation et sorties de commandes ayant servi à reconstruire cette session est conservé ici :

- `docs/session/RAW_CHATLOG_2026-03-02_DESKTOP_DOCKER_DESKTOP_RESTORE_NOTES.md`

Fin de session.
