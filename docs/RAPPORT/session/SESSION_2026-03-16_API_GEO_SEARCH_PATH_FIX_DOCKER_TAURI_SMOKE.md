---
description: Session changelog raisonné — Fix erreurs 500 API (relation "essais" not found) via search_path atlas,public, déploiement Docker api-geo, smoke tests curl (/grid/*/neighbors + /surveys?maille=*), démarrage Tauri dev
date: 2026-03-16
weekday: lundi
repo: atlas_reclone
service: services/api-geo
ui: ui (Vite) + apps/atlas-pro (Tauri)
stack: docker-compose (db postgis + api-geo + ui)
database: atlas_clean
branch: atlas_v2_clean
commit: 8452ac0
---

# Session — Changelog raisonné (très verbeux)

## 1) Date / méta

- **Date** : 2026-03-16 (**lundi**)
- **Contexte d’exécution** : Windows (PowerShell), repo `c:\PROJET_ATLAS_MASTER\atlas_reclone`
- **Branche** : `atlas_v2_clean`
- **Services impliqués** :
  - Backend : `services/api-geo` (Axum + SQLx + Postgres)
  - UI : `ui` (Vite)
  - Desktop : `apps/atlas-pro/src-tauri` (Tauri v2)
- **Objectif de la session** :
  - corriger les erreurs **500** observées en UI sur :
    - `GET /grid/*/neighbors`
    - `GET /surveys?maille=*`
  - s’assurer que les environnements **Docker** et **Tauri dev** démarrent sans régression
  - valider par smoke tests réseau (`curl`) que les endpoints répondent **200**
  - produire un commit + push propre et atomique

---

## 2) Contexte / symptômes qui ont déclenché le travail

### 2.1. Symptôme principal : erreurs 500 sur endpoints UI “maille”

Dans l’interface, certaines actions sur la carte/fiche maille déclenchaient :

- `GET /api/grid/<mailleCode>/neighbors` → **500**
- `GET /api/surveys?maille=<mailleCode>` → **500**

Le pattern était fortement corrélé à des requêtes SQL qui référencent des tables sans qualifier le schéma (ex : `essais`, `sondages`, `echantillons`).

### 2.2. Hypothèse de root cause

Le dataset “propre” est stocké dans le schéma **`atlas`** (ex : `atlas.essais`), alors que les requêtes SQL dans `api-geo` utilisent parfois des références non qualifiées (ex : `FROM essais`).

Dans Postgres, si on n’a pas configuré `search_path`, une table non qualifiée est recherchée dans le schéma par défaut (souvent `public`).

=> Si le `search_path` ne contient pas `atlas`, Postgres renvoie :

- `relation "essais" does not exist`

Ce qui remonte en 500.

---

## 3) Décisions & principes retenus (anti-dette)

### 3.1. Décision : fixer le `search_path` au niveau pool SQLx (et pas “au cas par cas”)

**Choix** : configurer le `search_path` au moment de la création des connexions SQLx, via un hook `after_connect`.

Pourquoi c’est le bon niveau :

- garantit que **toutes** les requêtes (présentes et futures) ont le même contexte DB
- évite de patcher des dizaines de requêtes SQL une par une (risque élevé de dette technique / oubli)
- évite des différences de comportement Docker vs Desktop si la DB a des defaults différents

### 3.2. Décision : appliquer le `search_path` à **tous les pools** (runtime + admin)

L’API a 2 pools possibles :

- pool runtime : `DATABASE_URL`
- pool admin (DB Manager) : `DATABASE_URL_ADMIN` (optionnel via `ENABLE_DB_MANAGER`)

**Choix** : le `search_path` doit être appliqué aux deux, pour éviter une divergence (ex : DB Manager qui lit des tables non qualifiées).

---

## 4) Changements code (changelog raisonné)

### 4.1. `services/api-geo/src/config.rs` — ajout d’un pool factorisé + `SET search_path`

**Fichier** : `services/api-geo/src/config.rs`

Changements :

- extraction d’une fonction :
  - `pg_pool_from_url(url: &str) -> anyhow::Result<PgPool>`
- `pg_pool()` devient un wrapper :
  - lit `DATABASE_URL` puis appelle `pg_pool_from_url(&url)`
- ajout d’un hook `after_connect` dans `PgPoolOptions` :
  - exécute `SET search_path TO atlas, public` à chaque connexion

Pourquoi :

- `after_connect` garantit que même lors d’un “recycle” de connexions (pool), le contexte est correct.

Référence code :

- `PgPoolOptions::after_connect(|conn, _meta| { ... })`
- `sqlx::query("SET search_path TO atlas, public").execute(conn).await?;`

### 4.2. `services/api-geo/src/main.rs` — pool admin aligné

**Fichier** : `services/api-geo/src/main.rs`

Changement :

- remplacement de :
  - `sqlx::PgPool::connect(&url)`
- par :
  - `config::pg_pool_from_url(&url).await?`

Pourquoi :

- éviter que le pool admin ait un comportement différent du pool runtime (même base, mêmes schémas, mêmes tables).

---

## 5) Déploiement & commandes exécutées (audit trail)

### 5.1. Build backend (validation compilation)

Commande exécutée :

```powershell
cargo build --release
```

Répertoire : `services/api-geo`

Résultat : build OK (warnings non bloquants).

### 5.2. Déploiement Docker — rebuild + restart `api-geo`

Commande exécutée :

```powershell
docker compose up -d --build api-geo
```

Répertoire : racine repo `atlas_reclone`.

Résultat :

- image `atlas-api-geo` rebuild
- conteneur `atlas-api-geo` redémarré
- healthcheck Docker OK (`/healthz`)

### 5.3. Démarrage Desktop (Tauri dev)

Commande exécutée :

```powershell
cargo tauri dev
```

Répertoire : `apps/atlas-pro`

Notes :

- la conf Tauri (`apps/atlas-pro/src-tauri/tauri.conf.json`) lance automatiquement le frontend Vite via :
  - `npm --prefix ../../ui run dev -- --host 127.0.0.1 --port 1420`
- URL dev : `http://localhost:1420`

Résultat :

- Vite ready
- `atlas-pro.exe` lancé

### 5.4. Validation backend (health)

Commande exécutée :

```powershell
curl -fsS -D - http://127.0.0.1:8000/healthz -o NUL
```

Résultat : **HTTP 200**

### 5.5. Smoke tests réseau (endpoints ciblés)

#### 5.5.1. Important : piège PowerShell sur `curl` + querystring

Incident : la commande suivante a échoué dans PowerShell :

```powershell
curl -fsS http://127.0.0.1:8000/api/coverage/mailles?grid=2km&limit=1
```

Cause :

- en PowerShell, `curl` est un alias vers `Invoke-WebRequest` / `Invoke-RestMethod`.
- le `&limit=1` est interprété comme séparateur de commande, ce qui déclenche :
  - `limit=1: The term 'limit=1' is not recognized...`

Décision : utiliser :

- soit `curl.exe` explicitement
- soit `Invoke-RestMethod` avec URL entre quotes

#### 5.5.2. Récupération d’une maille valide (format attendu)

Commande exécutée :

```powershell
$r = Invoke-RestMethod 'http://127.0.0.1:8000/api/coverage/mailles?grid=2km&limit=1'
$r | ConvertTo-Json -Depth 6
```

Maille exemple obtenue (dans `features[*].properties.code`) :

- `TG-0550-0224-01`

=> ce format est cohérent avec la normalisation UI (ex : `TG-0857-0162-01`).

#### 5.5.3. Test `/grid/<code>/neighbors`

Commande exécutée :

```powershell
curl.exe -sS -o NUL -w "neighbors_http=%{http_code}\n" "http://127.0.0.1:8000/api/grid/TG-0550-0224-01/neighbors"
```

Résultat :

- `neighbors_http=200`

#### 5.5.4. Test `/surveys?maille=<code>`

Commande exécutée :

```powershell
curl.exe -sS -o NUL -w "surveys_http=%{http_code}\n" "http://127.0.0.1:8000/api/surveys?maille=TG-0550-0224-01"
```

Résultat :

- `surveys_http=200`

#### 5.5.5. Vérification logs container `api-geo`

Commande exécutée :

```powershell
docker logs --tail 80 atlas-api-geo
```

Constats :

- les endpoints ciblés répondent **200** (traces `tower_http`)
- un autre bruit de fond existe sur `/api/stats/global` :
  - `column m.adm1_name does not exist`
  - ce point est **distinct** du fix `search_path` (non bloquant pour neighbors/surveys)

---

## 6) Références code & UI (où étaient les appels)

### 6.1. UI — appels réseau concernés

Fichier : `ui/src/main.ts`

- neighbors :
  - `fetch(`${API_GEO}/grid/${mailleCode}/neighbors`)`
- surveys by maille :
  - `fetch(`${API_GEO}/surveys?maille=${mailleCode}`)`

Ces appels sont donc directement impactés par les 500 DB.

### 6.2. Backend — fichiers touchés

- `services/api-geo/src/config.rs` (pool SQLx + search_path)
- `services/api-geo/src/main.rs` (admin_pool utilise la même factory)

---

## 7) Git — commit/push (traçabilité)

### 7.1. Diff

- `services/api-geo/src/config.rs`
- `services/api-geo/src/main.rs`

### 7.2. Commit

- **Commit** : `8452ac0`
- **Message** : `fix(api-geo): set search_path to atlas,public`

### 7.3. Push

Commande exécutée :

```powershell
git push
```

Branche : `atlas_v2_clean`

---

## 8) Conclusion / statut fin de session

Fait (objectif atteint) :

- correction structurelle du root cause (search_path `atlas,public` au niveau pool)
- déploiement Docker rebuildé et relancé
- Tauri dev lancé (frontend + app)
- smoke tests `curl` sur `/grid/*/neighbors` et `/surveys?maille=*` : **200/200**
- commit + push réalisés

Reste à faire (hors scope de cette session) :

- investiguer la régression `/api/stats/global` (`m.adm1_name` absent) si elle affecte l’UI
- traiter les sujets persistants :
  - compactage `docker_data.vhdx`
  - erreurs 503 DB Manager en contexte Docker si `ENABLE_DB_MANAGER=false`

Fin de session.
