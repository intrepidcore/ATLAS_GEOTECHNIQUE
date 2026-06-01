---
description: Session changelog raisonné — Desktop Atlas startup (écran bleu + indicateurs jaunes), root-cause installer mode (installed.marker), bootstrap robuste Postgres+API, diffusion événements startup, pg_restore log+timeout, heartbeat splash, packaging contract (verify-bundle + CI)
date: 2026-03-25
weekday: mercredi
repo: atlas_reclone
desktop: apps/atlas-pro (Tauri v2)
ui: ui (Vite MPA + React + installer)
branch: atlas_v2_clean
---

# Session — Changelog raisonné (ultra détaillé)

## 1) Objectif et contexte

- **Objectif fonctionnel**
  - Éliminer le scénario Desktop où l’application démarre sur un **écran bleu** et où **API + grille restent en jaune** (backend non initialisé/démarré).
  - Supprimer le “faux freeze” (splash bloqué) pendant l’initialisation DB/seed.
  - Rendre l’initialisation DB/seed **robuste, traçable, time-bounded** et actionnable (logs dédiés + messages d’erreur orientés support).
  - Garantir le respect du **contrat packaging** MSI (seed + manifest + runtime PostgreSQL + sidecar `api-geo`).

- **Contexte technique**
  - Desktop Atlas = Tauri + Postgres embarqué + sidecar `api-geo.exe`.
  - Le frontend affiche des indicateurs de santé; si le backend n’est pas démarré, l’UX ressemble à un “écran bleu” (app vivante mais système non initialisé).
  - Les opérations longues = `ensure_database_initialized()` (init + PostGIS + restore seed via `pg_restore`).

## 2) Symptômes observés (départ)

- Après installation MSI terminée, au lancement :
  - **splash** affiché longtemps (impression de freeze).
  - ensuite **écran bleu** (UI principale) mais **API + grille restent en jaune** (non initialisés).
- Besoin explicite : **lire les logs**, diagnostiquer la cause racine, et livrer un fix **sans dette technique**.

## 3) Collecte des preuves (logs et signaux)

- **Logs Desktop** (runtime):
  - `%LOCALAPPDATA%\IntrepidCore\Atlas\logs\tauri.log.*`
  - `%LOCALAPPDATA%\IntrepidCore\Atlas\logs\tauri-fatal.log`
  - `%LOCALAPPDATA%\IntrepidCore\Atlas\logs\postgres-*.log`
  - `%LOCALAPPDATA%\IntrepidCore\Atlas\logs\api-geo.log` (ou équivalent)

- Observations clés sur les logs:
  - `tauri.log` indiquait un démarrage en **"Installer mode"** et un **skip** du bootstrap Postgres/API lorsque le marqueur `installed.marker` manquait.
  - Les logs `postgres-*.log` montraient que PostgreSQL pouvait démarrer (port 54329) mais était ensuite stoppé (fast shutdown) → symptôme compatible avec un flux startup interrompu/branché sur un mauvais mode.

## 4) Root-cause (cause racine)

### Root-cause #1 — Heuristique “installer mode” trop agressive

- La logique de startup considérait que si `installed.marker` est absent, on est en mode installateur → ce mode **n’amorce pas** Postgres et **ne démarre pas** le sidecar.
- Scénarios réels où `installed.marker` peut manquer alors que l’app doit démarrer :
  - suppression partielle du dossier data
  - profil itinérant / corruption
  - wizard interrompu mais l’utilisateur relance l’app
- Conséquence : l’UI principale apparaît mais **le backend n’a jamais été lancé** → indicateurs de santé en jaune.

### Root-cause #2 — Manque de “liveness” pendant un restore seed long

- `ensure_database_initialized()` peut prendre plusieurs minutes.
- Sans updates UI réguliers, le splash donne l’impression d’un freeze.

### Root-cause #3 — Restore seed non instrumenté

- `pg_restore` était historiquement un point aveugle :
  - peu/absence de logs stdout/stderr détaillés
  - aucun timeout → risque de blocage indéfini
- En cas d’échec, le diagnostic n’était pas actionnable.

## 5) Décisions retenues (anti-dette technique)

- **Décision A — Bootstrap robuste par défaut**
  - On ne “skip” le bootstrap Postgres/API **que si** l’utilisateur/CI force explicitement `ATLAS_FORCE_INSTALLER`.
  - Sinon, même si `installed.marker` manque : **on bootstrape** et on loggue un warning.

- **Décision B — Startup progress events fiables (early startup)**
  - Les événements `startup:progress` / `startup:error` doivent être reçus même si la fenêtre splash n’est pas prête.
  - On broadcast à toutes les windows existantes (best-effort) + fallback sur la fenêtre `splash`.

- **Décision C — Restore seed robuste et traçable**
  - Rediriger stdout/stderr de `pg_restore` vers un log dédié `pg-restore-<ts>-<pid>.log`.
  - Appliquer un timeout configurable `ATLAS_PG_RESTORE_TIMEOUT_SECS` (défaut 15 min).
  - En timeout : kill du process + message actionnable pointant vers le log.

- **Décision D — Heartbeat d’avancement pendant DB init**
  - Tant que `ensure_database_initialized()` tourne, émettre un heartbeat toutes les 2s pour éviter l’impression de freeze.

- **Décision E — Contrat packaging MSI “enforced”**
  - Le mapping `bundle.resources` doit être vérifié (sources + destinations) via `scripts/verify-bundle.ps1`.
  - Ajout d’un job CI qui :
    - build UI
    - cargo test Tauri
    - vérifie les inputs bundle
    - smoke-test restore seed sur un cluster PG fresh
    - build MSI et inspect MSI si tag / branche cible

## 6) Changements implémentés (par fichiers)

### 6.1 Desktop startup — diffusion fiable des événements de progression

- **Fichier** : `apps/atlas-pro/src-tauri/src/lib.rs`
- **Changements** :
  - Ajout des helpers `emit_startup_progress_handle` / `emit_startup_error_handle` (pour les threads).
  - `emit_startup_progress` / `emit_startup_error` :
    - broadcast sur `app.webview_windows()` pour fiabiliser la réception même si splash pas prête.
    - fallback sur la fenêtre `splash`.

### 6.2 Desktop startup — mode installateur : skip uniquement si forcé

- **Fichier** : `apps/atlas-pro/src-tauri/src/lib.rs`
- **Changements** :
  - Si `ATLAS_FORCE_INSTALLER=true` (et hors smoke-test) :
    - redirige `main` vers `/installer.html`
    - ferme le splash
    - **ne bootstrape pas** Postgres/API.
  - Si `installed.marker` manque mais pas de force :
    - warning log
    - **bootstrap normal**.

### 6.3 Desktop startup — Heartbeat pendant l’initialisation DB/seed

- **Fichier** : `apps/atlas-pro/src-tauri/src/lib.rs`
- **Changement** :
  - Thread heartbeat (2s) pendant `postgres::ensure_database_initialized(&pg)`.
  - Message : `Initialisation base / seed en cours… (<Ns>)`.

### 6.4 Restore seed — logs dédiés + timeout

- **Fichier** : `apps/atlas-pro/src-tauri/src/postgres.rs`
- **Changements** :
  - `restore_seed_dump()` :
    - en `.sql` : continue via `psql -v ON_ERROR_STOP=1 -f`.
    - sinon : `pg_restore` avec stdout/stderr vers `pg-restore-*.log`.
    - polling via `try_wait()` + timeout `ATLAS_PG_RESTORE_TIMEOUT_SECS`.
    - messages d’erreur actionnables (pointe vers le log).

### 6.5 Installer UI — erreurs fatales rendues actionnables

- **Fichier** : `ui/src/installer/InstallerApp.tsx`
- **Changements** :
  - Traduction des erreurs `fatal` en messages UI user-friendly (PostGIS / seed / packaging / postgres).
  - Conservation du détail technique dans un `<details>`.

### 6.6 Packaging contract — ressources MSI + vérifications

- **Fichier** : `apps/atlas-pro/src-tauri/tauri.conf.json`
- **Changements** :
  - `bundle.targets = ["msi"]`.
  - `bundle.resources` en mode mapping (destinations canonisées) :
    - `atlas_desktop_seed.dump`
    - `atlas_desktop_seed.dump.json`
    - `api-geo-x86_64-pc-windows-msvc.exe`
    - `pg` → `pg`

- **Fichier** : `scripts/verify-bundle.ps1`
- **Changements** :
  - Vérifie présence seed + manifest + sidecar + runtime pg.
  - Vérifie **destination** conforme au contrat (seed / manifest / pg).
  - Option `-MsiPath` : inspection MSI via `msiexec /a` (administrative install) et checks des artefacts.

- **Fichier** : `.github/workflows/quality-gates.yml`
- **Changements** :
  - Job `build-test-verify` (Windows) : build UI, cargo test, verify-bundle inputs, smoke seed restore (mailles=29407).
  - Job `bundle-contract` (tags + branche cible) : build MSI + verify dans MSI + upload artefact.

- **Doc** : `docs/CONTRAT_PACKAGING.md`
  - Mise en cohérence avec le mapping resources (contract, invariants, commandes de vérif).

## 7) Commandes exécutées / audit trail

### 7.1 Vérifications repo (session actuelle)

- `git status --porcelain=v1`
- `git diff --stat`
- `git diff`
- `git log -1 --oneline --decorate`

### 7.2 Packaging / build (session de travail)

- Vérification des inputs bundle :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-bundle.ps1 -RepoRoot .
```

- Build MSI (Tauri):

```powershell
cargo tauri build
```

- Vérification contractuelle d’un MSI buildé :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-bundle.ps1 -RepoRoot . -MsiPath <chemin.msi>
```

*(Note: le CI reproduit ces étapes via `quality-gates.yml`.)*

## 8) Debug / itérations et points d’attention

- **Compat Tauri** : `emit_all` indisponible dans cette version → choix : itérer sur `webview_windows()` et émettre événement par fenêtre.
- **Robustesse UX** : heartbeat obligatoire pendant `ensure_database_initialized()` pour éviter un splash “muet”.
- **Robustesse seed** : log dédié + timeout pour éliminer les hangs et permettre un diagnostic support.

## 9) Résultats attendus (recette de validation)

- Au lancement Desktop :
  - Si `installed.marker` manque et `ATLAS_FORCE_INSTALLER` non défini :
    - l’app doit **démarrer Postgres**, initialiser DB/seed et démarrer le sidecar.
    - la grille et l’API doivent passer au vert.
  - Si `ATLAS_FORCE_INSTALLER=true` :
    - l’app ouvre `/installer.html` et ne démarre pas les services.
  - Pendant init longue : splash reçoit des updates toutes les ~2s.

- En cas d’échec seed :
  - message actionnable + pointer vers `pg-restore-*.log`.

## 10) Informations manquantes / à confirmer pour clôture

- **Validation runtime finale** : lancer l’app avec le MSI buildé et confirmer :
  - passage au vert API/grille
  - présence des logs `pg-restore-*.log` en cas de restore
  - absence de stuck splash

## 11) Statut

- Implémentations : **faites** (startup robust, heartbeat, pg_restore logs+timeout, verify bundle, CI)
- Reste : **recette terrain** sur machine cible (installation + run + collecte logs si anomalie)
