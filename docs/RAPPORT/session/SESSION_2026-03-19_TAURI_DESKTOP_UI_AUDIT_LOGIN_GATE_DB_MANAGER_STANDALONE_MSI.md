---
description: Session changelog raisonné — Audit mismatch UI Desktop Tauri (version hardcodée v3.5.4, absence login), ajout login gate Option B (login.html), rendu db-manager.html standalone (évite redirection installateur), amélioration messages d'erreur DB Manager, build Desktop (exe + msi)
date: 2026-03-19
weekday: jeudi
repo: atlas_reclone
ui: ui (Vite MPA)
desktop: apps/atlas-pro (Tauri v2)
branch: atlas_v2_clean
---

# Session — Changelog raisonné (ultra détaillé)

## 1) Objectif et politique de livraison

- **Objectif fonctionnel**
  - Desktop Tauri doit afficher la **même UI** que le build UI courant (plus de mismatch ni de version fantôme).
  - Le Desktop doit afficher une **page Login en premier** (Option B : vanilla UI + gate auth).
  - La navigation vers **Gestion BDD** ne doit **pas** déclencher l’installateur.
  - Les erreurs DB Manager ne doivent plus être “Erreur inconnue” : on veut un message actionnable.

- **Nouvelle politique validée**
  - **Toujours** produire et tester les artifacts Desktop :
    - `atlas-pro.exe`
    - `atlas-pro_*.msi`

## 2) Symptômes observés (avant fix)

### 2.1 Desktop : UI mismatch et version “fantôme”

- En Desktop build installé, l’UI affichait une version **`v3.5.4`** et ne présentait pas la page de login.
- En comparaison, `npm run dev` / Tauri dev montrait une UI différente (attendue).

### 2.2 Tauri dev : navigation “Gestion BDD” ouvre l’installateur

- En Tauri dev, la page Login s’affichait correctement.
- Mais en cliquant **Gestion BDD** (`/db-manager.html`), l’app redirigeait vers l’installateur (`/installer.html`).

### 2.3 DB Manager : message “Erreur inconnue”

- Dans DB Manager, certaines erreurs backend (ex 503) étaient affichées en UI comme “Erreur inconnue”, alors que le backend renvoyait des indications utiles (ex `DB_MANAGER_DISABLED`).

## 3) Analyse root-cause (audit)

### 3.1 Root-cause #1 : version `v3.5.4` hardcodée dans le HTML

- Le badge de version dans `ui/index.html` contenait :
  - `v3.5.4` **en dur** dans le DOM.
- Conséquence : `vite build` reproduisait mécaniquement ce `v3.5.4` dans `ui/dist/index.html`.
- Ce symptôme pouvait être interprété comme un cache Tauri/WebView2, alors que c’était **la source HTML**.

### 3.2 Root-cause #2 : `db-manager.html` n’était pas standalone

- `ui/db-manager.html` chargeait `src/main.tsx`, donc **bootait l’App React**.
- `App.tsx` a un guard Desktop “first run” :
  - `installer_is_installed` → si `false` : redirect `/installer.html`.
- Donc, en allant sur DB Manager, on déclenchait l’App React → et donc le redirect installateur.

### 3.3 Root-cause #3 : parsing error backend incomplet

- Le backend renvoyait parfois `{"error": "DB_MANAGER_DISABLED", "message": ...}`.
- Le parseur UI ne regardait que `code`/`error_code`, pas `error`.
- Résultat : la condition 503/DB_MANAGER_DISABLED ne matchait pas, donc message non actionnable.

## 4) Décisions retenues (anti-dette)

- **Option B** conservée : vanilla UI protégée par un **login gate** (page dédiée `login.html`).
- DB Manager : **une seule UI officielle (React)** (pas de duplication vanilla).
- Guard installateur : correction **context-aware** dans `App.tsx` (corrige la cause, pas contournement).
- Desktop : mitigation mismatch via purge SW en mode Tauri + supprimer les sources hardcodées trompeuses.
- Packaging : utiliser le target bundle **`msi`** (WiX toolchain) et appliquer la politique exe+msi.

## 5) Changements code (références précises)

### 5.1 UI — supprimer version hardcodée et afficher la version runtime

- **Fichier**: `ui/index.html`
  - Remplacement du texte `v3.5.4` hardcodé par un conteneur vide.

- **Fichier**: `ui/src/main.ts`
  - Affecte le badge `#appVersion` à partir de `APP_VERSION`.

### 5.2 UI — login gate (Option B)

- **Nouveaux fichiers**
  - `ui/login.html` : entrypoint React Login
  - `ui/src/login-main.tsx` : monte `LoginPage`, redirige vers `returnTo` après succès

- **Fichier**: `ui/src/main.ts`
  - Ajout d’un guard auth : si pas authentifié, redirect `/login.html?returnTo=/index.html`.

### 5.3 UI — DB Manager (UI React unique) + fix guard installateur

- **Fichier**: `ui/db-manager.html`
  - Charge `src/main.tsx` (UI React DB Manager, onglets) — **UI unique**.

- **Fichier**: `ui/src/App.tsx`
  - Guard installateur rendu **context-aware** : ne redirige pas depuis `/db-manager.html` (ni `/login.html`).

- **Fichier**: `ui/vite.config.ts`
  - Ajout `db-manager.html` comme entry MPA dans `build.rollupOptions.input`.

### 5.4 UI — messages d’erreur DB Manager plus actionnables

- **Fichier**: `ui/src/db-manager/api-simple.ts`
  - Le code d’erreur peut être dans `data.error` (en plus de `code`/`error_code`).
  - Le message est désormais plus robuste (fallbacks propres, pas “inconnu”).

### 5.5 UI — cohérence version dans DB Manager

- **Fichier**: `ui/src/db-manager/components-vanilla/DbManagerModalComponent.ts`
  - Remplacement version hardcodée par `APP_VERSION`.

### 5.6 Desktop — MSI/WiX

- **Fichier**: `apps/atlas-pro/src-tauri/tauri.conf.json`
  - `bundle.targets` passe à `['msi']`.

## 6) Commandes exécutées (audit trail)

### 6.1 Build UI

```powershell
npm --prefix ui run build
```

### 6.2 Tauri dev (comparaison dev vs desktop)

```powershell
cargo tauri dev
```

### 6.3 Tauri build (politique exe + msi)

```powershell
cargo tauri build
```

Artifacts (exemple) :
- `apps/atlas-pro/src-tauri/target/release/atlas-pro.exe`
- `apps/atlas-pro/src-tauri/target/release/bundle/msi/atlas-pro_1.0.1_x64_en-US.msi`

## 6.4 Commit + push

```powershell
git status --porcelain
git add -A
git commit -m "Fix desktop UI gate for DB Manager + build MSI"
git push
```

- Commit: `d8d28f0`
- Branche: `atlas_v2_clean`

## 6.5 Artefacts produits (réels)

- `apps/atlas-pro/src-tauri/target/release/atlas-pro.exe`
- `apps/atlas-pro/src-tauri/target/release/bundle/msi/atlas-pro_1.0.1_x64_en-US.msi`

## 7) Vérifications attendues (checklist)

- Login :
  - ouvrir Desktop → on arrive sur `/login.html` si pas de token.
  - après login → retour vers `/index.html`.

- Version :
  - le badge version affiche `APP_VERSION` (ex `v2.6.0`) et **pas** une valeur hardcodée.

- DB Manager :
  - menu “Gestion BDD” ouvre `/db-manager.html`.
  - ne déclenche pas l’installateur.
  - si backend renvoie `DB_MANAGER_DISABLED`, message UI explicite “DB Manager désactivé…” au lieu de “Erreur inconnue”.

## 8) Points ouverts / prochains risques

- SW/PWA : le build génère encore `sw.js`. En Desktop, on unregister les SW à l’exécution (prévention cache). Si on veut aller plus loin, on peut conditionner la génération SW par mode de build.
- DB Manager backend : si `ENABLE_DB_MANAGER=false` en environnement Desktop, l’UI doit afficher le message d’activation.

## 9) Dossier non tracké à traiter

- `docs/session/image/SESSION_2026-03-16_API_GEO_SEARCH_PATH_FIX_DOCKER_TAURI_SMOKE/`
- Décision à prendre :
  - Soit on commit ces images (si elles font partie de la doc),
  - Soit on les supprime (si c’est du local temporaire).

