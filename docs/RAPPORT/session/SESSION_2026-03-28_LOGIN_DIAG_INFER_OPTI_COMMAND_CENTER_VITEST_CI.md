---
description: "Session changelog raisonné — diagnostic login « Erreur de connexion », UX erreurs auth ; Command Center Infer/Opti (UI carte), icônes Lucide, Vitest, CI ; alignement avec session 2026-03-26 (Lama/IA-Kriging)"
date: 2026-03-28
weekday: samedi
repo: atlas_reclone
backend: services/api-geo (Rust/Axum)
db: PostgreSQL/PostGIS
ui: ui (Vite + React login + vanilla main carte)
---

# Session — Changelog raisonné (ultra détaillé)

## 1) Objectif et contexte

- **Objectif fonctionnel (immédiat)**
  - Comprendre et lever le blocage **connexion Atlas** (page React `login.html` / `LoginPage.tsx`) lorsque l’interface affiche **« Erreur de connexion »** alors que le corps de requête `{ email, password }` semble correct (`admin@atlas.local` / mot de passe attendu type `Atlas2024!`).
  - Poursuivre la roadmap **pilotage Infer/Opti** côté application carte (Command Center dédié), en cohérence avec les endpoints déjà documentés et utilisés (thématic panel, DB Manager).

- **Objectif documentaire**
  - Synthétiser la **session de travail actuelle** et le **dernier document de session structuré** (`SESSION_2026-03-26_…`) : compléter les informations implicites ou manquantes pour la continuité (environnement, preuves réseau, commandes de validation).

- **Contexte technique**
  - Authentification : `POST` vers `{authBase}/auth/login` où `authBase` dérive de `getApiBase()` (`ui/src/contexts/AuthContext.tsx`, `ui/src/config.ts`).
  - Backend : routes montées à la racine **et** sous `/api` (`services/api-geo/src/main.rs`) pour compatibilité proxy / clients.
  - En dev Vite : proxy `/api` → `VITE_API_TARGET` (souvent `http://127.0.0.1:8000`). Si **api-geo** n’écoute pas, le proxy renvoie souvent une **réponse non-JSON** → l’ancien client affichait un message générique trompeur.

### 1.1 Analyse : informations explicites, implicites, manquantes

- **Explicites (capture écran / énoncé utilisateur)**
  - Bandeau rouge **« Erreur de connexion »**.
  - Onglet Network : requête nommée **`login`** (segment final de `/auth/login`), payload JSON correct.
  - Intent : accéder à l’app pour valider le Command Center et le reste.

- **Implicites (déduites du code)**
  - Le libellé **« Erreur de connexion »** était en partie **codé en fallback** quand `response.json()` échouait (`AuthContext.apiLogin`) : situation typique **502 proxy / HTML / corps vide**, pas uniquement « mauvais mot de passe ».
  - Identifiants seed habituels : `admin@atlas.local` (réf. scripts MSI, backups SQL) ; le hash en base doit correspondre au mot de passe attendu (sinon le backend renverrait plutôt JSON `401/403` avec message métier).

- **Manquantes côté utilisateur au moment du bug (à collecter systématiquement)**
  - **Code HTTP** exact et **corps brut** de la réponse (avant correctif UX : souvent ignoré car parsing JSON échouait).
  - **État des services** : `api-geo` up ? `GET /healthz` OK ? DB joignable ?
  - **Mode de lancement UI** : `npm run dev` (proxy relatif `/api`) vs `VITE_API_BASE` pointant en direct sur `8000` (CORS `CORS_ORIGINS` / desktop).

## 2) Symptômes observés (départ)

- Message utilisateur générique **« Erreur de connexion »** sans distinction :
  - API injoignable (proxy, port, docker arrêté),
  - erreur serveur HTML,
  - ou échec d’authentification métier JSON.

## 3) Collecte des preuves (logs et signaux)

- **Frontend**
  - `ui/src/contexts/AuthContext.tsx` : `apiLogin` utilisait `response.json().catch(() => ({ error: 'Erreur de connexion' }))` sur `!response.ok` → **masquage** des erreurs proxy/texte.
  - URL effective : `` `${getAuthApiBase()}/auth/login` `` avec `getAuthApiBase()` = `getApiBase()` ou `${origin}/api` selon URL absolue (voir commentaires dans le fichier).

- **Backend**
  - Route réelle : `/auth/login` sur les deux montages (`/` et `/api`) → URL client attendue : `/api/auth/login` lorsque `apiBase` vaut `/api`.

- **Référence session précédente (2026-03-26)**
  - Beaucoup d’emphasis sur **alignement binaire api-geo**, `healthz`, rebuild Docker — même famille de problèmes « symptôme UI ≠ cause réelle » si service down ou drift.

## 4) Root-cause (cause racine)

### Root-cause #1 — Réponse d’erreur non-JSON mal interprétée (symptôme principal documenté)

- Quand le proxy Vite ou un reverse proxy renvoie une page texte/HTML (ex. **502 Bad Gateway** si la cible `api-geo` est arrêtée), le parse JSON échouait et le UI affichait **« Erreur de connexion »** sans indicer **l’indisponibilité de l’API**.

### Root-cause #2 — Environnement (hypothèse opérationnelle forte si HTTP ≠ 200 JSON)

- `api-geo` non démarré, mauvais `VITE_API_TARGET`, ou DB indisponible → échec avant ou pendant `login`.

### Root-cause #3 — Identifiants / seed (hypothèse secondaire si HTTP 401 JSON)

- Utilisateur absent en base, mot de passe non aligné sur le seed, ou compte verrouillé — le backend renvoie alors en général un JSON structuré (`AuthErrorResponse`) lisible après correctif #1.

## 5) Décisions retenues (anti-dette technique)

- **Décision A — Erreurs auth exploitables en diagnostic**
  - Lire `response.text()`, tenter `JSON.parse`, sinon afficher **HTTP status + extrait du corps** + rappel de vérifier `healthz` et le proxy `/api`.
  - **Justification** : réduire le temps de debug (support interne + développeurs) sans changer le contrat API.

- **Décision B — Maintenir une seule source de vérité `getApiBase` / `atlasConfig`**
  - Pas de hardcode d’URL dans le nouveau module Infer/Opti ; réutiliser le même pattern Bearer que le panneau thématique.
  - **Justification** : conformité aux règles projet (CFG-01) et cohérence Tauri / web.

- **Décision C — Command Center dans l’UI carte (vanilla)**
  - Surface distincte du tab React DB Manager ; bouton sidebar **Infer / Opti**.
  - **Justification** : les actions métier ciblent l’opérateur carte ; le wireframe utilisateur décrivait un poste de commande adjacent au flux terrain.

## 6) Changements implémentés (par fichiers)

### 6.1 Login — messages d’erreur réseau/serveur

- **Fichier** : `ui/src/contexts/AuthContext.tsx`
- **Changements** : sur `!response.ok`, utilisation de `response.text()`, parsing JSON optionnel, message de repli avec **statut HTTP** et extrait texte ; évite le libellé unique « Erreur de connexion » quand la cause est proxy/HTML.

### 6.2 Command Center Infer/Opti (UI carte)

- **Fichiers** : `ui/src/infer-opti/command-center.ts`, `command-center.css`, `command-center-utils.ts`
- **Changements** :
  - Layout wireframe (zones d’actions, terminal monospace, tableau jobs, menu ⋮ : logs, CSV, rejeu).
  - Appels : `POST /ai/recompute/sources`, `POST /ai/kriging/recompute`, `POST /ai/infer/train-supervised`, `POST /ai/jobs/run-once`, `GET /ai/jobs/recent`.
  - États chargement / désactivation des boutons ; polling jobs ; commentaire **cURL** reproductible en tête de module.

### 6.3 Icônes inline (style Lucide)

- **Fichier** : `ui/src/icons/lucide-inline.ts`
- **Changements** : icônes supplémentaires (`cpu`, `database`, `playCircle`, `loader2`, `moreVertical`, `fileText`, `download`, `checkCircle`, `xCircle`, `clock`) ; `svgWrap` supporte une classe CSS extra ; `refreshCw` accepte options pour spinner.

### 6.4 Intégration shell UI

- **Fichiers** : `ui/index.html` (bouton sidebar + Google Font Fira Code), `ui/src/main.ts` (`initInferOptiCommandCenter` avec `can('colab.missions.read')`).

### 6.5 Tests unitaires + CI

- **Fichiers** : `ui/src/infer-opti/command-center-utils.spec.ts`, `ui/package.json` (`test:unit`, `vitest`), `ui/vite.config.ts` (`test`), `.github/workflows/ci.yml` (étape `npm run test:unit`).

## 7) Commandes exécutées / audit trail

### 7.1 Validation locale UI (session de développement)

```powershell
cd atlas_reclone\ui
npm install
npm run test:unit
npm run build
```

- **Résultat observé** : Vitest **11 tests** OK sur `command-center-utils.spec.ts` ; **Vite build** OK (warnings chunk size habituels).

### 7.2 Diagnostic connexion recommandé (post-correctif ou en parallèle)

```powershell
# Santé API (adapter host/port)
curl -sS -o NUL -w "%{http_code}" "http://127.0.0.1:8000/healthz"

# Login (réponse attendue JSON avec tokens si OK)
curl -sS -X POST "http://127.0.0.1:8000/api/auth/login" ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@atlas.local\",\"password\":\"Atlas2024!\"}"
```

- **Interprétation**
  - **Connexion refusée / timeout** : service non démarré ou mauvais port → aligner `VITE_API_TARGET`, docker compose, ou lancer `api-geo` localement.
  - **200 + JSON** mais UI échoue encore : vérifier que le navigateur utilise bien le même base URL (proxy `/api` vs `VITE_API_BASE` absolu + CORS).

### 7.3 Smoke Infer/Opti (JWT requis)

Voir en-tête de `ui/src/infer-opti/command-center.ts` : `GET /ai/jobs/recent`, `POST` recompute / kriging / train-supervised / `run-once`.

## 8) Debug / itérations et points d’attention

- **Itération 1 — Comprendre « Erreur de connexion »**
  - **Réflexion** : le message était ambigu ; il amalgamait échec réseau/proxy et échec métier.
  - **Action** : lecture `text()` + message détaillé côté `AuthContext`.

- **Itération 2 — Cartographie authBase**
  - **Réflexion** : avec base relative `/api`, la requête part vers le **même origin** que la page login (Vite) puis proxy ; sans API, l’erreur est **infrastructure**, pas « login ».

- **Point d’attention sécurité / support**
  - N’exposer en production que des extraits d’erreur courts ; ici le slice est limité et destiné au diagnostic dev/staging.

## 9) Résultats obtenus

- **UX auth** : l’utilisateur voit **pourquoi** la connexion échoue quand la réponse n’est pas JSON (cas fréquent API down).
- **Command Center** : livré dans l’UI carte, branché sur les endpoints IA/jobs existants, avec tests unitaires sur les utilitaires et **CI** qui exécute `npm run test:unit`.
- **Traçabilité** : commandes `curl` et scripts npm documentées pour reproduction.

## 10) Impacts, arbitrages et informations manquantes à clôturer

- **Impacts**
  - Réduction du temps de diagnostic login (moins de fausses pistes « credentials »).
  - Surface de pilotage IA visible pour utilisateurs ayant `colab.missions.read`.

- **Arbitrages**
  - Deux surfaces Infer/Opti (React DB Manager vs Command Center carte) coexistent ; duplication fonctionnelle assumée en attendant une éventuelle factorisation UI.

- **Manquants pour clôture définitive (depuis 2026-03-26 + jour J)**
  - **Preuve runtime** sur la machine utilisateur : code HTTP exact de la requête `login` au moment du bug (si non capturé avant correctif).
  - **État exact des conteneurs / VITE_*** au moment du screenshot.
  - **e2e Playwright** dédié « login + ouverture Command Center » (non requis pour clôturer ce changelog mais utile ensuite).

## 11) Statut

- **Fait (session du jour)**
  - Analyse cause racine du libellé « Erreur de connexion » et **correctif** `AuthContext` (erreurs non-JSON).
  - **Command Center Infer/Opti** intégré (module, styles, sidebar, main), **Vitest**, **CI** `test:unit`, **build** vérifié.
  - **Changelog session** rédigé au format établi (canevas aligné sur `SESSION_2026-03-26_…`).

- **À faire / suivi opérationnel**
  - Sur la machine concernée : démarrer **api-geo** + DB, revérifier `healthz` et relancer la connexion ; si échec persistant avec JSON explicite, traiter comme **credentials / RBAC / compte verrouillé** (logs `atlas` auth côté API).
