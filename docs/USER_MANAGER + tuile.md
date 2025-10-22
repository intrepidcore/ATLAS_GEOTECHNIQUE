

# 1) Service de tuiles MBTiles (offline)

## a) Place ton fichier

- Mets un fichier MBTiles raster (ex. `togo.mbtiles`) ici :
    

```
atlas/data/tiles/togo.mbtiles
```

> Astuce : zooms 0–12 suffisent pour un fond léger.

## b) `docker-compose.yml`

Ajoute ce service (il expose `/tiles/<nom>/{z}/{x}/{y}.png`) :

```yaml
services:
  tiles:
    image: consbio/mbtileserver:latest
    container_name: atlas-tiles
    volumes:
      - ./data/tiles:/data:ro
    environment:
      - MBTILES_DIR=/data
    ports:
      - "8081:80"
    restart: unless-stopped
```

Démarre-le :

```powershell
docker compose up -d tiles
```

Teste depuis un client du LAN :

```
http://<IP_PC>:8081/services       # liste les jeux de tuiles présents
```

> Windows Firewall (une fois) :  
> `netsh advfirewall firewall add rule name="Atlas Tiles 8081" dir=in action=allow protocol=TCP localport=8081`

---

# 2) Couche ADM (GeoJSON) locale

Tu as 2 chemins simples :

## Option 1 — Exporter tes shapefiles en GeoJSON (recommandé, rapide)

- Convertis tes shapefiles ADM0/1/2/3 en GeoJSON (QGIS → “Exporter → Enregistrer les entités sous…” en EPSG:4326).
    
- Dépose les fichiers ici (servis statiquement par l’UI) :
    

```
atlas/ui/public/adm/adm0.geojson
atlas/ui/public/adm/adm1.geojson
atlas/ui/public/adm/adm2.geojson
atlas/ui/public/adm/adm3.geojson
```

## Option 2 — Conversion par Docker (si tu n’as pas QGIS sous la main)

Place tes shapefiles dans `atlas/data/shp` puis :

```powershell
docker run --rm -v "$PWD/data/shp:/in:ro" -v "$PWD/ui/public/adm:/out" osgeo/gdal \
  ogr2ogr -f GeoJSON /out/adm1.geojson /in/adm1.shp -t_srs EPSG:4326
```

(fais de même pour adm0/adm2/adm3)

---

# 3) UI Leaflet : basemap hybride avec auto-fallback

Dans `ui/src/main.ts`, ajoute ce bloc (ou adapte ton init).  
Il tente d’abord les tuiles locales (`:8081`), sinon bascule en **ADM-only**.  
Il expose un **sélecteur de couches** (MBTiles vs ADM) et garde ta grille + tes sondages au-dessus.

```ts
// --- BASemap Hybride (MBTiles offline + fallback ADM) ---
async function setupHybridBasemap(map: L.Map, overlays: Record<string, L.Layer> = {}) {
  const host = location.hostname; // fonctionne en LAN
  let mbtiles: L.TileLayer | null = null;

  // 1) Essayer le serveur de tuiles local
  try {
    const ping = await fetch(`http://${host}:8081/services`, { cache: "no-store" });
    if (ping.ok) {
      // Remplace "togo" par le nom listé dans /services si différent
      mbtiles = L.tileLayer(`http://${host}:8081/tiles/togo/{z}/{x}/{y}.png`, {
        maxZoom: 18,
        attribution: "Local MBTiles",
        updateWhenIdle: true,
      }).addTo(map);
    }
  } catch {
    // silence: on tombera sur le fallback ADM
  }

  // 2) Couche ADM (fond vectoriel léger)
  const admGroup = L.layerGroup();
  await addAdmLayers(admGroup);  // voir fonction ci-dessous
  admGroup.addTo(map);

  // 3) Contrôle des couches
  const baseLayers: Record<string, L.Layer> = mbtiles
    ? { "MBTiles (offline)": mbtiles, "ADM (polygones)": admGroup }
    : { "ADM (polygones)": admGroup };

  L.control.layers(baseLayers, overlays, { position: "topleft", collapsed: true }).addTo(map);

  // 4) Ordre d’affichage : fond en bas, grille/sondages au-dessus
  admGroup.getLayers().forEach(l => (l as any).setZIndex?.(1));
  if (mbtiles) (mbtiles as any).setZIndex?.(1);
  // Laisse tes couches "grille" / "sondages" ajouter après avec zIndex supérieur (ex: 10).
}

async function addAdmLayers(targetGroup: L.LayerGroup) {
  // Charge ADM0→ADM3 si présents, du plus large au plus fin
  const files = [
    { path: "/adm/adm0.geojson", style: { color: "#666", weight: 1, fill: true, fillOpacity: 0.03 } },
    { path: "/adm/adm1.geojson", style: { color: "#777", weight: 0.8, fill: true, fillOpacity: 0.02 } },
    { path: "/adm/adm2.geojson", style: { color: "#888", weight: 0.6, fill: false } },
    { path: "/adm/adm3.geojson", style: { color: "#999", weight: 0.4, dashArray: "3,3", fill: false } },
  ];

  for (const f of files) {
    try {
      const r = await fetch(f.path, { cache: "no-store" });
      if (!r.ok) continue;
      const fc = await r.json();
      const layer = L.geoJSON(fc, {
        style: () => f.style as any,
        interactive: false,              // le fond ne doit pas gêner les clics sur ta grille
        pane: "overlayPane"
      });
      targetGroup.addLayer(layer);
    } catch {
      // fichier manquant ? on ignore
    }
  }
}
```

Appelle ensuite `setupHybridBasemap(map, { "Grille": grilleLayer, "Sondages": sondagesLayer })` **avant** d’ajouter tes overlays (ou passe-les via le paramètre `overlays`).

> Important : garde la **grille** et les **sondages** ajoutés **après** le fond pour conserver la cliquabilité des mailles.

---

# 4) Ordre de démarrage & vérification

```powershell
# 1) Démarrer DB + API + UI + Tiles
docker compose up -d db api-geo ui tiles

# 2) Vérif
#  - Fond MBTiles : http://<IP_PC>:8081/services  (doit lister "togo")
#  - UI : http://<IP_PC>:8080/
#  - API : http://<IP_PC>:8001/healthz  (status ok)
```

Dans l’UI :

- Si `tiles` répond → base “MBTiles (offline)” sélectionnée.
    
- Sinon → fallback automatique “ADM (polygones)”.
    
- Tu peux switcher via le contrôle en haut à gauche.
    

---

# 5) Petits plus (optionnels)

- **Simplification ADM** : pour accélérer le rendu des GeoJSON, simplifie-les (QGIS “Simplifier la géométrie” ou `mapshaper -simplify 10%`).
    
- **Labels** : si tu veux des labels (noms de communes) en offline, prépare un MBTiles “streets light” ou ajoute une couche de points de toponymes en GeoJSON (non interactif).
    
- **LAN** : pense à servir l’UI et l’API sur l’IP de la machine (tu utilises déjà `location.hostname` côté UI — parfait).
    
- **CORS** : `mbtileserver` expose les tuiles sans soucis pour Leaflet en LAN.
    

---

## TL;DR

- **B** : on sert `togo.mbtiles` via `mbtileserver` sur `:8081`
    
- **C** : on affiche **ADM GeoJSON** comme fond graphique (et fallback)
    
- L’UI choisit **automatiquement** MBTiles si dispo, sinon **ADM-only**.
    
- Tout fonctionne **offline** sur ton LAN, pour tes 10 clients. ✅
    

Si tu veux, je peux aussi te donner un script pour **générer** une version ADM ultra-légère (simplifiée) + un fond MBTiles “light” pour que la carte soit ultra fluide.
# v1.5.0 (LAN) — Auth locale + User Manager + Analyses
## 1) Topologie & accès

* **Serveur**: 1 PC au labo (PostGIS, API, UI en Docker).
* **Clients (10 testeurs)**: navigateurs sur le **même LAN** → `http://<IP_SERVEUR>:8080`.
* **Aucun git clone** côté testeurs.
* **Auth** par **session cookie** (HTTP-only, SameSite=Lax).

---

## 2) User Manager (dans l’UI, côté navigateur)

### 2.1 Rôles & responsabilités (RBAC simple)

| Rôle      | Lire cartes | Ajouter/éditer sondages | Import Bulk | Analyses | Gestion utilisateurs | Admin outils (cache/backup) |
| --------- | ----------- | ----------------------- | ----------- | -------- | -------------------- | --------------------------- |
| Viewer    | ✅           | ❌                       | ❌           | ✅        | ❌                    | ❌                           |
| DataEntry | ✅           | ✅                       | ❌           | ✅        | ❌                    | ❌                           |
| Analyst   | ✅           | ✅                       | ✅           | ✅        | ❌                    | ❌                           |
| Admin     | ✅           | ✅                       | ✅           | ✅        | ✅                    | ✅                           |

> Tu peux renommer “DataEntry/Analyst” selon tes habitudes (ex. “Editeur”, “Chef de projet”).

### 2.2 Schéma DB (migrations)

```sql
-- 013_users.sql
CREATE TYPE user_role AS ENUM ('viewer','dataentry','analyst','admin');

CREATE TABLE users_local (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username     TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,         -- bcrypt/argon2
  full_name    TEXT,
  email        TEXT,
  role         user_role NOT NULL DEFAULT 'viewer',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sessions_local (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users_local(id) ON DELETE CASCADE,
  session_key TEXT UNIQUE NOT NULL,   -- aléatoire
  ip          INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_users_local_username ON users_local(username);
CREATE INDEX idx_sessions_local_user ON sessions_local(user_id);
```

### 2.3 Endpoints API (Axum)

```
POST   /auth/login            { username, password } → Set-Cookie(session)
POST   /auth/logout           → unset cookie
GET    /auth/me               → { username, role, full_name, ... }

# Admin only
GET    /admin/users           → liste paginée
POST   /admin/users           → créer (username, password, role, active,...)
PUT    /admin/users/:id       → maj role / infos / reset pass opt.
DELETE /admin/users/:id       → désactiver/supprimer (au choix)

# Utilitaires Admin
POST   /admin/coverage/refresh
POST   /admin/backup
POST   /admin/restore         (manuel + garde-fous)
```

**Sécurité**

* Hash **bcrypt** (ou **argon2** si tu préfères).
* Sessions **HTTP-only**, **SameSite=Lax**, durée 8–24h configurable.
* **Rate-limit** sur `/auth/login` (ex. 5 tentatives / 10 min).
* **CSRF**: pour les requêtes mutantes via UI, **token CSRF** en header (ou SameSite=Lax + double submit).

### 2.4 UI “User Manager” (Admin-only)

* **Menu**: “Administration → Utilisateurs”.
* **Table**: username, nom, email, rôle (badge), actif, date création.
* **Actions**:

  * “+ Créer utilisateur” (modal: username, nom, mail, rôle, mot de passe).
  * “Modifier” (changer rôle / activer-désactiver / reset mot de passe).
  * “Réinitialiser mot de passe” (génère un temp password).
* **Garde-fous**:

  * Un **admin ne peut pas se rétrograder** si c’est le dernier admin actif.
  * Confirmation double pour suppression/désactivation.

---

## 3) Analyses sans SPT_N / qc (remplacées)

On garde l’infra analytics, mais on change les variables analysées par défaut :

### 3.1 Nouvelles métriques d’analyse

* **Granulométrie**: % passant (par profondeur) → histogrammes, classes par seuils (ex: <30/30–70/>70).
* **Atterberg**: `WL, WP, IP` → histogrammes + classes d’IP (faible/moyen/élevé).
* **Bleu de Méthylène (VBS)**: valeurs + classes (faible/moyen/fort).
* **Proctor (gdmax, wopt)**: distributions pour contrôle compactage.
* **Potentiel de gonflement (eg)**: classes (faible/fort).

### 3.2 API Analytics

```
GET  /analytics/histogram?type=Granulometrie|Atterberg_WL|Atterberg_WP|Atterberg_IP|VBS|Proctor_gdmax|Proctor_wopt|Gonflement_eg
     &bbox=...
     &bins=...
     [&depth_min=&depth_max=]  # optionnel

GET  /analytics/outliers?type=...&bbox=...&method=zscore|iqr&z=3
POST /analytics/idw-batch      # (si tu gardes l’IDW): types = [Granulometrie, VBS, ...]
```

### 3.3 UI Analyse (BBox)

* Outil **“Sélection rectangle”** → onglet **Analyse**:

  * Histogrammes sur variable choisie.
  * Outliers (halo/icone).
  * **(Option)** batch “interpolation/gridding” si utile (IDW ou krigeage plus tard).
* **Palette** adaptée (ex. classes d’IP, classes VBS).

---

## 4) Performance & Scalabilité (LAN)

* **Vue matérialisée** `mv_coverage_mailles` (avec `n_sondages`, présence par variables ci-dessus).
* **Refresh** post-import / post-insert via endpoint admin (et CRON local si besoin).
* `/coverage/mailles` filtré par **bbox + zoom**, **simplification** aux faibles zooms, **pagination**.
* Indices GIST sur `mailles.geom`, `sondages.geom`; BTree sur `essais(type, depth_m)`.

---

## 5) Déploiement LAN (serveur labo)

1. **IP fixe** au PC serveur (ex: `192.168.50.10`).
2. **.env UI**: `VITE_API_GEO=http://192.168.50.10:8001`.
3. **Migrations** (auth + analytics):

   ```powershell
   docker compose up -d db
   docker compose exec db psql -U atlas -d atlas -f /docker-entrypoint-initdb.d/013_users.sql
   docker compose exec db psql -U atlas -d atlas -f /docker-entrypoint-initdb.d/014_analytics.sql
   docker compose exec db psql -U atlas -d atlas -f /docker-entrypoint-initdb.d/015_coverage_cache.sql
   ```
4. **Build & run**:

   ```powershell
   docker compose build
   docker compose up -d
   ```
5. **Créer ton compte admin** (UI → User Manager → Créer).
6. **Créer les 9 autres comptes** dans le navigateur.

---

## 6) Critères de recette

* Login/logout **OK** (sessions cookie).
* **User Manager**: création, changement de rôle, désactivation, reset password.
* **Viewer**: pas d’édition possible; **DataEntry/Analyst**: autorisations respectées.
* `/coverage` fluide avec tes données; histogrammes **< 500 ms** sur bbox.
* **Backup/restore** (option admin) testés au labo.

---

## 7) Ce que je te fournis (prêt à intégrer)

* **SQL**: `013_users.sql`, `014_analytics.sql`, `015_coverage_cache.sql`.
* **Endpoints Rust (Axum)**: squelettes pour `/auth/*`, `/admin/users*`, `/analytics/*`.
* **Composants UI**:

  * `UserManager` (liste, créer, éditer, reset, désactiver).
  * `LoginPage` + `AuthGuard`.
  * `AnalysePanel` (BBox + histogrammes/outliers).
* **Snippets sécurité**: bcrypt/argon2, cookies sécurisés, rate-limit login.

---

# 1) Fonctionnalités clés (vision produit)

## 1.1 Comptes & rôles (RBAC+)

* Rôles de base: **Viewer**, **DataEntry**, **Analyst**, **Admin**.
* **Permissions granulaires** (cases à cocher) au-delà du rôle:
  *import_bulk, edit_survey, delete_survey, view_private, manage_users, refresh_cache, backup_restore*…
* **Portée géographique (scoping)** optionnelle: restreindre un compte à **ADM1/ADM2/ADM3** spécifiques (ex: un DataEntry “Maritime seulement”).
* **Équipes/Groupes** (facultatif mais prêt): créer un groupe “Laboratoire A” → assigner permissions communes.

## 1.2 Cycle de vie & gouvernance

* **Création** (par Admin) → statut *Invité* (doit définir son mot de passe à la 1ère connexion).
* **Suspension** / **Réactivation** (préserve l’historique).
* **Reset mot de passe** (lien local, expire en X min).
* **Expiration de session** configurable (par rôle).
* **Impersonation “Voir comme…”** (Admin) avec bannière d’avertissement + audit.
* **Journal d’audit complet**: qui a créé/édité/activé/désactivé; connexions; changements de rôle; imports.

## 1.3 Qualité & conformité

* **Politiques mot de passe** (force, durée de validité, historique N derniers).
* **Double validation** pour opérations sensibles (ex: suppression de sondages).
* **Conflits d’édition**: verrouillage doux (soft lock) au niveau sondage (prévenir écrasement).
* **Traçabilité** dans les données: chaque sondage/essai porte `created_by`, `updated_by`.

## 1.4 Productivité

* **Création en masse** (CSV) d’utilisateurs (nom, email, rôle, portée ADM).
* **Tags/notes utilisateur** (ex: “Stagiaire”, “Chef chantier”).
* **Tableau de bord Admin**: comptes actifs, derniers accès, tentatives échouées, zones les plus éditées.
* **Aide intégrée** (tooltips + mini-tutoriels), bouton **“Tester ce compte”** (ouvre une fenêtre simulée en read-only des permissions).

---

# 2) UX — Écrans & micro-interactions

## 2.1 Page “Utilisateurs”

* **Header KPI**: *Utilisateurs actifs* • *Sessions ouvertes* • *Tentatives échouées 24h*.
* **Outils de recherche**: par *nom/username/email*, par *rôle*, par *statut*, par *portée ADM*.
* **Table** (colonnes): avatar/initiales, nom complet, username, email, rôle (badge), **Portée** (ADM chips), statut, dernier accès, actions.
* **Actions ligne**: *Voir*, *Modifier*, *Impersoner*, *Suspendre/Activer*, *Réinitialiser MDP*.
* **Actions groupées** (sélection multiple): *Changer rôle*, *Assigner portée*, *Suspendre*.

## 2.2 Fiche “Utilisateur”

**Onglets**:

1. **Profil**: nom, email, téléphone (optionnel), rôle, statut, notes/tags.
2. **Permissions avancées**: checkboxes individuelles + héritage du rôle (afficher ce qui est hérité vs. surchargé).
3. **Portée géographique**: sélecteurs hiérarchiques (ADM1 → ADM2 → ADM3), chips supprimables.
4. **Sessions actives**: liste des navigateurs/IP, bouton “Déconnecter tout”.
5. **Audit & activités**: timeline (connexion, modifs, imports, suppressions).
6. **Dangers** (encadré rouge): *Rétrograder Admin*, *Suspendre*, *Supprimer* (double confirmation).

## 2.3 Création / édition utilisateur (modal)

* **Étape 1**: Identité (nom, username, email), rôle.
* **Étape 2**: Portée ADM (optionnelle), *Sélection rapide*: “Toute la région Maritime”, ou “Choisir communes…”.
* **Étape 3**: Permissions extra (cases).
* **Étape 4**: Résumé & bouton **Créer** (+ option “Envoyer lien d’activation”).

**Micro-UX**:

* Badges colorés par rôle.
* Infobulles “Ce droit permet…”.
* Alerte si on retire le **dernier Admin**.

## 2.4 Impersonation (Voir comme…)

* Bouton sur la fiche utilisateur.
* BANNIÈRE persistante en haut: “Vous voyez l’application **comme *DataEntry (Kossi)*** — [Revenir en Admin]”.
* Tout est **loggé** (début/fin, pages consultées).

## 2.5 Page “Politiques & Sécurité” (Admin)

* Paramètres globaux: durée session, verrouillage après N tentatives, force mot de passe minimale, durée de vie mot de passe, autoriser impersonation (oui/non).
* Paramètres d’audit: conserver N jours (rotation).
* Export audit CSV/JSON.

---

# 3) Modèle d’autorisations (proposé)

## 3.1 Rôles (défaut)

* **Viewer**: lecture uniquement + analytics.
* **DataEntry**: + création/édition sondages/essais dans sa **portée**.
* **Analyst**: + import bulk, analytics avancé, exports.
* **Admin**: tout, + gestion utilisateurs, cache, backup.

## 3.2 Permissions granulaires (exemples)

* `surveys.create`, `surveys.edit`, `surveys.delete`
* `surveys.import_bulk`, `surveys.export`
* `analytics.view`, `analytics.advanced`
* `admin.users.read`, `admin.users.write`, `admin.users.impersonate`
* `admin.maintenance.refresh_cache`, `admin.maintenance.backup_restore`

> Les rôles mappent un **profil** de permissions; tu peux **surcharger** par utilisateur.

## 3.3 Scoping ADM

Chaque requête mutante côté API vérifie:
`has_permission(user, perm) && is_in_scope(user, target_adm)`
→ Évite qu’un DataEntry “Maritime” modifie “Kara”.

---

# 4) Sécurité (pragmatique, LAN)

* **Sessions cookie** HTTP-only, SameSite=Lax, TTL 8–24h.
* **Hash mot de passe**: argon2id (ou bcrypt cost élevé) + pepper (env).
* **Rate-limit** login: p.ex. 5 essais / 10min / IP.
* **CSRF**: token sur requêtes mutantes (ou double submit).
* **Journaux d’audit** signés (hash chaîne) si tu veux empêcher altérations.
* **Sauvegarde**: /admin/backup (dump chiffré) & /admin/restore (admin only + confirmation triple).
* **Impersonation**: trace, bannière, désactivable dans “Politiques”.

---

# 5) Backend & API (squelette minimal)

## 5.1 Base (tables)

* `users_local(id, username, password_hash, full_name, email, role, is_active, scope_adm jsonb, permissions jsonb, created_at, updated_at)`
* `sessions_local(id, user_id, session_key, ip, user_agent, created_at, expires_at)`
* `audit_log(id, actor_id, action, target_type, target_id, meta jsonb, ts)`

## 5.2 Endpoints (extraits)

```
POST /auth/login          → 200 + Set-Cookie
POST /auth/logout         → 204
GET  /auth/me             → { user, role, permissions, scope }

# Admin Users
GET    /admin/users?search=&role=&active=&adm=...
POST   /admin/users            { username, password?, role, scope, perms }
PUT    /admin/users/:id        { ... }
DELETE /admin/users/:id        (disable or delete)

# Security & Policies
GET/PUT /admin/policies        (session_ttl, lockout, pwd_policy, impersonation_enabled)

# Sessions
GET    /admin/users/:id/sessions
POST   /admin/users/:id/sessions/revoke_all

# Impersonation
POST   /admin/users/:id/impersonate
POST   /admin/impersonation/stop

# Audit
GET /admin/audit?actor=&action=&from=&to=&page=
```

> Middleware: `auth`, `rbac`, `scope_guard`, `audit(action, target)`.

---

# 6) Checklist d’implémentation (par étapes)

### Étape A — Schéma & API

* [ ] Migration DB `users_local`, `sessions_local`, `audit_log`.
* [ ] Utilitaires sécurité (hash pwd, sessions, rate-limit).
* [ ] Middlewares (auth, rbac, scope, audit).
* [ ] Endpoints `/auth/*`, `/admin/users*`, `/admin/policies`, `/admin/audit`.

### Étape B — UI (pro)

* [ ] Page Login + état d’erreur (tentatives restantes).
* [ ] **User Manager**: Liste + filtres + pagination + actions en masse.
* [ ] Fiche utilisateur (onglets) + modals “Créer” / “Reset MDP”.
* [ ] Impersonation UX (bannière, sortie simple).
* [ ] Page Politiques & Sécurité.
* [ ] Aide intégrée (tooltips, mini-guides).

### Étape C — Intégration données

* [ ] `created_by/updated_by` sur sondages/essais.
* [ ] Journaliser import bulk avec `actor_id`.
* [ ] Respect du scoping ADM dans tous les endpoints mutateurs.

### Étape D — Recette LAN

* [ ] 10 comptes créés (1–2 Admin, 3 Analyst, 3 DataEntry, 2 Viewer).
* [ ] Tests: login, changement rôle, portée ADM, permissions sur carte/CRUD.
* [ ] Audit: vérifier traces de 3 actions critiques (delete, import, impersonation).
* [ ] Backup/restore sur une machine vierge.

---

## Bonus UX (si tu veux “wow”)

* **Onboarding par rôle**: 3 bulles qui montrent les actions possibles la 1re fois.
* **Mode “Formation”**: sandbox qui ne touche pas la vraie BDD (drapeau global).
* **Accessibilité**: contrastes AA, navigation clavier, lecteurs d’écran.
* **Thème clair/sombre** synchronisé avec le reste de l’app.

---

Si tu veux, je peux te fournir :

* Les **migrations SQL** prêtes à coller,
* Les **handlers Axum** (signatures + pseudo-code),
* Et le **markup HTML/TS** du User Manager (modals, tableaux, bannières) aligné avec ton stack (Vite + Tailwind + Leaflet).

Dis-moi si tu préfères une implémentation **“minimal viable”** (2–3 jours dev) ou **“full features”** (itératif en 2 sprints).
