---
description: Session changelog raisonné — Desktop/Tauri boot complet (dev) + CORS /db/* + correction UI API base (suppression fallback /api) + propagation patch vers binaire sidecar api-geo
date: 2026-03-03
weekday: mardi
repo: atlas_reclone
apps: apps/atlas-pro (Tauri)
backend: services/api-geo (sidecar)
ui: ui (Vite)
database: atlas_clean
---

# Session — Changelog raisonné (très verbeux)

## 1) Date / méta

- **Date** : 2026-03-03 (mardi)
- **OS / shell** : Windows + PowerShell
- **Repo** : `c:\PROJET_ATLAS_MASTER\atlas_reclone`
- **Objectif utilisateur** :
  - Reprendre la phase **boot Tauri complet** (démarrage dev + vérifs runtime/bin/seed + validation UI)
  - Corriger la **commande de lancement Tauri** (pas de `package.json` sous `src-tauri`)
  - Éliminer les erreurs UI bloquantes observées pendant le boot (notamment CORS et `404 /api/auth/login`)
  - Prendre des décisions **propres et complètes** (pas de “bricolage” fragile)

## 2) Symptômes observés au départ (UI/console)

### 2.1. CORS bloquant sur `/db/*`

Dans la console UI (origin `http://localhost:1420`) :

- `Access to fetch at 'http://127.0.0.1:8000/db/schema' from origin 'http://localhost:1420' has been blocked by CORS policy`
- Erreurs similaires sur :
  - `/db/table/public/sondages`
  - `/db/table/public/sondages/data?...`

Conséquence :
- Le **DB-Manager UI** ne peut pas se charger (échec sur schema/tables).

### 2.2. `404 /api/auth/login`

- `api/auth/login:1 Failed to load resource: 404 (Not Found)`

Interprétation :
- L’UI effectuait des appels sur une base relative `/api/...` (donc sur le serveur Vite `:1420`),
  au lieu d’utiliser la base runtime `window.__API_GEO__ = http://127.0.0.1:<port>` injectée par Tauri.

## 3) Décisions structurantes (raisonnées)

### Décision A — Lancement Tauri : **Cargo comme source de vérité**

- **Choix retenu** : utiliser `cargo tauri dev` depuis `apps/atlas-pro/src-tauri`.
- **Pourquoi** :
  - `src-tauri` ne contient pas de `package.json` ⇒ `npm --prefix ... run tauri dev` échoue.
  - `tauri.conf.json` configure déjà `beforeDevCommand` pour démarrer l’UI (`npm --prefix ../../ui run dev -- --host 127.0.0.1 --port 1420`).
  - Lancer Tauri via Cargo colle au modèle Tauri v2 et limite les scripts "sur mesure".

### Décision B — CORS Desktop : **allowlist explicite** (pas `Any`)

- **Choix retenu** : en Desktop (`ATLAS_DESKTOP=1`), ne pas utiliser `allow_origin(Any)`.
- **Pourquoi** :
  - Certaines requêtes peuvent nécessiter `credentials` (cookies/session) ⇒ `Any` est incompatible avec `allow_credentials(true)`.
  - On veut un comportement reproductible et sécurisé : allowlist de quelques origins dev attendues.

### Décision C — Propagation patch backend : **rebuild + copy vers le binaire sidecar**

- **Choix retenu** : quand un fix backend est requis pour le Desktop, il faut :
  - rebuild `api-geo.exe` **dans `services/api-geo`**
  - copier le binaire vers `apps/atlas-pro/src-tauri/bin/api-geo-x86_64-pc-windows-msvc.exe`
- **Pourquoi** :
  - Desktop/Tauri ne lance pas automatiquement le backend depuis le source : il lance un **binaire embarqué**.
  - Sans copie, on corrige le source mais on exécute toujours une version ancienne ⇒ itérations "fantômes".

### Décision D — UI API base : **centralisation via `getApiBase()`** (pas de fallback `/api`)

- **Choix retenu** : utiliser partout `getApiBase()` (qui supporte `window.__API_GEO__`) au lieu de :
  - `window.location.origin + '/api'`
  - `'/api'` par défaut
- **Pourquoi** :
  - En Tauri dev, l’UI est sur `:1420` et l’API sur `:8000` ⇒ le fallback `/api` casse.
  - `window.__API_GEO__` est la source de vérité runtime (injectée par Tauri).

## 4) Changements effectués (par fichiers)

### 4.1. Backend — `services/api-geo/src/main.rs`

- **Changement** : configuration CORS
  - Ajout d’un mode Desktop (détection via `ATLAS_DESKTOP`) qui autorise explicitement :
    - `http://localhost:1420`
    - `http://127.0.0.1:1420`
    - (compat dev UI standalone) `http://localhost:5173`, `http://127.0.0.1:5173`
  - Support de `CORS_ORIGINS` (CSV) comme override autoritaire.
  - `allow_credentials(true)` en Desktop (puisque l’origine n’est plus `Any`).

### 4.2. UI — correction des bases API (Tauri dev)

#### `ui/src/contexts/AuthContext.tsx`

- **Avant** : base API potentiellement dérivée de `window.location.origin + '/api'`.
- **Après** : `const API_BASE_URL = getApiBase()`.

Objectif :
- supprimer `404 /api/auth/login` en Tauri dev.

#### `ui/src/pages/RegisterStudentPage.tsx`

- **Avant** : base API locale, susceptible d’être vide/relative selon `VITE_API_GEO`.
- **Après** : `const API_BASE_URL = getApiBase()`.

#### `ui/src/pages/ColabQAPage.tsx`

- **Changement** : `API_BASE_URL = getApiBase()`
- **Important** : import remonté en haut du fichier (les imports en milieu de fichier cassent le build TS/ESM).

### 4.3. UI — grille 2km : réduction des refetchs inutiles

#### `ui/src/main.ts`

- **Changement** : ajout d’un cache in-memory `gridCache` (`2km`/`28km`) pour réutiliser la layer Leaflet + GeoJSON.
- **Pourquoi** :
  - Le passage `28km -> combined` ou `28km -> 2km` ne doit pas déclencher un rechargement réseau de la 2km si elle a déjà été chargée.

## 5) Commandes exécutées (audit trail)

### 5.1. Vérification seed dump présent

```powershell
# cwd: c:\PROJET_ATLAS_MASTER\atlas_reclone
Get-ChildItem .\data\db\backups
```

Observation :
- `data/db/backups/atlas_desktop_seed.dump` présent.

### 5.2. Lancement Tauri dev (correct)

```powershell
# cwd: c:\PROJET_ATLAS_MASTER\atlas_reclone\apps\atlas-pro\src-tauri
cargo tauri dev
```

### 5.3. Build backend (patch CORS) + copie dans le sidecar

```powershell
# build
# cwd: c:\PROJET_ATLAS_MASTER\atlas_reclone\services\api-geo
cargo build --release

# copy vers le binaire lancé par Tauri
Copy-Item .\target\release\api-geo.exe ..\..\apps\atlas-pro\src-tauri\bin\api-geo-x86_64-pc-windows-msvc.exe -Force
```

### 5.4. Validation CORS par preflight `OPTIONS`

```powershell
$h=@{Origin='http://localhost:1420';'Access-Control-Request-Method'='GET'}
Invoke-WebRequest -Method Options -Uri 'http://127.0.0.1:8000/db/schema' -Headers $h -UseBasicParsing
```

Critères de succès :
- présence de `Access-Control-Allow-Origin`
- présence de `Access-Control-Allow-Credentials`

### 5.5. Validation par logs runtime

- Logs `api-geo.log` (dans `%LOCALAPPDATA%\IntrepidCore\Atlas\logs`) montrent des `GET /db/schema` `200`.

## 6) Résultats / validation (ce qui est considéré “OK”)

- **Tauri dev** démarre via `cargo tauri dev`.
- **Postgres embarqué** démarre + PostGIS activé (`postgis_version()` OK).
- **CORS** : preflight OPTIONS `/db/schema` renvoie les headers attendus.
- **DB manager** : les endpoints `/db/schema` et `/db/table/*` retournent `200` (visible dans `api-geo.log`).
- **Auth** : le login ne doit plus appeler `http://localhost:1420/api/auth/login`.

## 7) Points d’attention / anti-régression

- En Desktop/Tauri, il faut toujours se rappeler :
  - *le backend exécuté est un binaire sidecar*
  - donc une modification dans `services/api-geo` doit être **propagée**.
- Éviter toute réintroduction de fallback relatif `/api`.

## 8) Références

- `apps/atlas-pro/src-tauri/tauri.conf.json` :
  - `beforeDevCommand` démarre l’UI Vite sur `127.0.0.1:1420`
  - `externalBin` / `resources`
- `services/api-geo/src/main.rs` : CORS
- `ui/src/api-base.ts` : `getApiBase()` + `window.__API_GEO__`
- `ui/src/contexts/AuthContext.tsx` : base auth
- `ui/src/main.ts` : cache grille 2km
