# Session 2026-02-28 — Docker Compose: build complet + démarrage de tous les services (db/api-geo/ui/etl/qgis-worker) + correction du build `api-geo` (dataset embarqué `include_str!` et contexte Docker)

## Date / méta

- **Date** : 2026-02-28
- **Objectif utilisateur** : « *tout build et start avec Docker* » (Docker Compose) — build de toutes les images du projet, démarrage en mode détaché, puis vérification des conteneurs, healthchecks et logs.
- **Contexte technique** : repo `atlas` (Windows), orchestration via `docker compose`.
- **Statut fin de session** : **OK** — `docker compose build` complet OK, `docker compose up -d` OK, services clés **healthy**.

---

## Contexte (objectif de la session)

L’objectif immédiat était de valider que le projet **Atlas** peut :

- **builder toutes les images** définies dans `atlas/docker-compose.yml`
- **démarrer tous les services** avec `docker compose up -d`
- **passer les healthchecks** (au moins `db`, `api-geo`, `ui`)
- **donner une base de diagnostic** via `docker compose ps` et `docker compose logs`.

Cette session a aussi servi à détecter un problème “dev/packaging” sur `api-geo` : l’API inclut un dataset SQL embarqué au compile-time (`include_str!`), ce qui est très pratique côté Desktop/Tauri mais impose une contrainte sur le **contexte de build Docker**.

---

## État initial / symptômes constatés

### 1) Échec `docker compose build` sur `api-geo`

Le build global a échoué sur `api-geo` avec :

- `error: could not compile [api-geo[0m (bin "api-geo") due to 1 previous error`

La sortie de build Docker affichait beaucoup de warnings Rust (non bloquants) mais **une seule erreur bloquante** (au départ tronquée dans l’output compose).

### 2) Différence “local build OK” vs “build Docker KO”

Un `cargo build --release` en local (dans `atlas/services/api-geo`) passait, ce qui a confirmé que :

- le code Rust est globalement compilable sur la machine
- l’échec Docker était lié à l’environnement de build Docker / au contexte de build.

### 3) Blocage réseau temporaire Docker Hub (522)

À un moment, `docker compose build` a échoué en phase de pull d’images de base avec :

- `failed to fetch oauth token ... https://auth.docker.io/token: 522`

Ce point a été diagnostiqué comme potentiellement temporaire/externes. On a ensuite validé par des `docker pull` ciblés que l’accès Docker Hub était revenu.

---

## Diagnostic (approche et étapes)

### Étape A — Obtenir l’erreur Rust exacte dans Docker

On a isolé le build :

```powershell
# Depuis C:\PROJET_ATLAS_MASTER\atlas
docker compose build api-geo --progress=plain
```

But : éviter un build complet, et récupérer un log plus exploitable.

### Étape B — Vérifier le build local `cargo`

```powershell
# Depuis C:\PROJET_ATLAS_MASTER\atlas\services\api-geo
cargo build --release
```

Résultat : OK en local.

### Étape C — Reproduire le build dans un conteneur Rust (pour isoler l’environnement)

Le but ici était de reproduire l’environnement Linux du build Docker tout en utilisant le répertoire projet comme volume.

```powershell
# Depuis C:\PROJET_ATLAS_MASTER\atlas
docker run --rm -v ${PWD}/services/api-geo:/app -w /app -e SQLX_OFFLINE=true rust:1.86 cargo build --release
```

Résultat : échec reproductible en conteneur.

### Étape D — Capturer l’erreur exacte

En loguant la sortie, on a identifié l’erreur réelle :

- `couldn't read /app/../../dataset/dataset_v1.sql: No such file or directory (os error 2)`

Localisation :

- `atlas/services/api-geo/src/dataset_bootstrap.rs` (constante `DATASET_SQL`)

Code concerné (extrait conceptuel) :

- `include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../dataset/dataset_v1.sql"))`

**Cause racine** :

- en build Docker/CI, le **contexte Docker** de `api-geo` était `./services/api-geo`.
- donc `../../dataset/` **n’existait pas** dans le contexte build envoyé à Docker.

---

## Décisions et choix d’architecture (ce qui a été décidé + pourquoi)

### Décision 1 — Conserver `include_str!` (dataset embarqué) et rendre le build Docker compatible

- **Choix** : ne pas supprimer `include_str!` (car c’est un mécanisme robuste pour livrer un dataset “offline” et cohérent avec le produit Desktop), mais adapter Docker.
- **Pourquoi** :
  - garantit que la version dataset est couplée au binaire `api-geo`
  - évite des dépendances runtime (mount volume, téléchargement, etc.)
  - améliore la reproductibilité (build = dataset exact)

### Décision 2 — Déplacer le `build.context` de `api-geo` au root du repo

- **Choix** : dans `atlas/docker-compose.yml`, builder `api-geo` depuis `context: .` et préciser `dockerfile: ./services/api-geo/Dockerfile`.
- **Pourquoi** :
  - permet d’inclure `dataset/` dans le contexte de build
  - évite des hacks (copie manuelle post-build)
  - s’aligne sur le fait que `api-geo` dépend de fichiers hors dossier `services/api-geo`

**Attention** : ce choix augmente la taille du contexte envoyé à Docker (constaté pendant le build : transfert de plusieurs GB). C’est acceptable en dev mais peut être optimisé plus tard (cf. section “Améliorations”).

### Décision 3 — Adapter le Dockerfile `services/api-geo/Dockerfile` pour fonctionner avec un contexte root

- **Problème** : le Dockerfile initial attendait `COPY Cargo.toml ./` à la racine du contexte. Avec `context: .` (root repo), `Cargo.toml` de `api-geo` est en fait `services/api-geo/Cargo.toml`.
- **Choix** : rendre explicites les `COPY` :
  - `COPY services/api-geo/Cargo.toml ./`
  - `COPY services/api-geo/Cargo.lock ./`
  - copier `dataset` vers `/app/dataset`
  - copier le code de `api-geo` vers `/app/services/api-geo`

- **Pourquoi** :
  - compatibilité directe avec `include_str!(.../../../dataset/...)`
  - maintien du cache Docker (pré-build des deps)

---

## Changements effectués (par fichiers)

### 1) `atlas/docker-compose.yml`

**Modification** : changer la définition du build pour `api-geo`.

Avant :

- `build: ./services/api-geo`

Après :

- `build.context: .`
- `build.dockerfile: ./services/api-geo/Dockerfile`

Fichier :

- `atlas/docker-compose.yml`

### 2) `atlas/services/api-geo/Dockerfile`

**Modification** : rendre le Dockerfile compatible avec le contexte root.

Points clés :

- changement de `WORKDIR` et `COPY` explicites pour `Cargo.toml`/`Cargo.lock`
- copie explicite de :
  - `dataset/` (root repo) -> `/app/dataset`
  - `services/api-geo/` -> `/app/services/api-geo/`
- le binaire final est copié depuis :
  - `/app/services/api-geo/target/release/api-geo`

Fichier :

- `atlas/services/api-geo/Dockerfile`

---

## Commandes exécutées (journal opératoire)

> Les commandes ci-dessous sont celles utilisées pour diagnostiquer, corriger, puis valider le build et le démarrage.

### Diagnostic build

```powershell
# Build ciblé pour isoler l’erreur
# cwd: C:\PROJET_ATLAS_MASTER\atlas
docker compose build api-geo --progress=plain

# Build local pour comparer
# cwd: C:\PROJET_ATLAS_MASTER\atlas\services\api-geo
cargo build --release

# Repro Linux (dans un conteneur rust) pour sortir l’erreur réelle
# cwd: C:\PROJET_ATLAS_MASTER\atlas
docker run --rm -v ${PWD}/services/api-geo:/app -w /app -e SQLX_OFFLINE=true rust:1.86 cargo build --release
```

### Résolution blocage Docker Hub (522)

```powershell
# Pull ciblés pour vérifier la disponibilité Docker Hub
# cwd: C:\PROJET_ATLAS_MASTER\atlas
docker pull docker/dockerfile:1
docker pull python:3.11-slim
docker pull qgis/qgis:release-3_34
```

### Build complet

```powershell
# Build de toutes les images
# cwd: C:\PROJET_ATLAS_MASTER\atlas
docker compose build --progress=plain
```

### Démarrage complet

```powershell
# Démarrage détaché
# cwd: C:\PROJET_ATLAS_MASTER\atlas
docker compose up -d
```

### Vérification état et logs

```powershell
# Status conteneurs
# cwd: C:\PROJET_ATLAS_MASTER\atlas
docker compose ps

# Logs clés
# cwd: C:\PROJET_ATLAS_MASTER\atlas
docker compose logs --no-color --tail=200 db
docker compose logs --no-color --tail=200 api-geo
docker compose logs --no-color --tail=200 ui
docker compose logs --no-color --tail=200 qgis-worker
```

---

## Résultats observés (validation)

### 1) `docker compose build` complet

- **Résultat** : OK, toutes les images buildées :
  - `atlas-api-geo`
  - `atlas-ui`
  - `atlas-etl`
  - `atlas-qgis-worker`

### 2) `docker compose up -d`

- **Résultat** : OK.
- **État** :
  - `atlas-db` : **healthy**
  - `atlas-api-geo` : **healthy**
  - `atlas-ui` : **healthy**
  - `atlas-qgis-worker` : up

### 3) Logs significatifs

#### DB

- `database system is ready to accept connections`

#### API

- `✅ DB connectée avec succès`
- `listening on 0.0.0.0:8000`
- healthcheck : `GET /healthz` -> `200`

#### UI

- Nginx up et sert `/` en `200`

#### QGIS worker

- `✅ Connexion DB OK`
- message sanity check : `atlas.export_jobs=export_jobs`

---

## Points d’attention / améliorations possibles

### 1) Taille du contexte Docker `api-geo`

En passant `api-geo.build.context` à `.` (root repo), on envoie potentiellement beaucoup de fichiers à Docker.

Amélioration possible :

- durcir `.dockerignore` au root pour exclure des dossiers volumineux (ex : artefacts, exports, data volumineuse non nécessaire au build)
- ou créer un Dockerfile alternatif qui “vendore” uniquement `dataset/` et `services/api-geo/` via un contexte plus fin (BuildKit `--build-context`), mais ce serait une complexité supplémentaire.

### 2) Cohérence “dataset embarqué” vs Docker (mode dev)

Ici on a volontairement aligné Docker sur le modèle Desktop : dataset présent au build.

Cela rend les builds plus reproductibles, mais impose de maintenir :

- `atlas/dataset/dataset_v1.sql` présent et accessible
- le chemin relatif utilisé par `include_str!`

Fichier de référence :

- `atlas/services/api-geo/src/dataset_bootstrap.rs`

---

## Références (code / infra / docs)

- Docker Compose :
  - `atlas/docker-compose.yml`
- Dockerfile `api-geo` :
  - `atlas/services/api-geo/Dockerfile`
- Dataset bootstrap `api-geo` :
  - `atlas/services/api-geo/src/dataset_bootstrap.rs`
- Dataset SQL (embarqué au build) :
  - `atlas/dataset/dataset_v1.sql`
- Règles projet (référence générale) :
  - `atlas/docs/REGLE_BONNE_PRATIQUE_MEMOIRE.MD`

---

## Conclusion

Objectif atteint : **build complet et démarrage complet Docker Compose** validés.

Le point clé de la session est la correction du build `api-geo` : le dataset embarqué via `include_str!` impose d’inclure `dataset/` dans le contexte Docker. La solution retenue (context root + Dockerfile adapté) rend le build **déterministe** et cohérent avec l’orientation “offline/desktop”.

Fin de session.
