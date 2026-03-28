# Atlas Géotechnique – Règles & Bonnes Pratiques

**Version : 0.1 – 07/01/2026**

---

## 0. Objectif du document

Ce document définit les règles de travail pour le projet **Atlas Géotechnique** (PostGIS + Rust/axum + UI Vite/Leaflet).
But : garder un projet **stable, maintenable et reproductible**, même quand la complexité augmente (migrations, grilles 2 km / 28 km, scripts DSM, etc.).

Les règles sont numérotées pour être faciles à citer / étendre.

---

## 1. Philosophie générale

**[GEN-01] Vérifier la réalité avant de coder**

* Avant d’ajouter ou modifier quelque chose, toujours :

  * Inspecter la base (`\dt`, `\d`, `\dm`, `SELECT … LIMIT 5`).
  * Vérifier les images Docker, paquets installés, etc.
* Exemple : tester `which raster2pgsql` dans le conteneur avant d’ajouter un Dockerfile DB.

**[GEN-02] Ajouter plutôt que casser l’existant**

* Privilégier la création de **vues / vues matérialisées / tables dérivées** plutôt que modifier brutalement une table de base utilisée partout.
* Les tables “cœur” (`atlas.sondages`, `atlas.mailles`, `atlas.maille_28km`, etc.) sont considérées comme stables.

**[GEN-03] Une fonctionnalité = un test minimal**

* Après chaque gros changement, exécuter **au moins un test manuel simple** :

  * Nouvelle colonne / vue : `SELECT col1, col2 … LIMIT 10`.
  * Nouvel endpoint API : petit `curl`/Postman.
  * Nouveau script : test sur un petit échantillon (1 DSM, quelques mailles…).

**[GEN-04] Préférer la simplification**

* Avant d’ajouter une nouvelle couche (script, service, Dockerfile), vérifier si :

  * Ce n’est pas déjà fourni par une dépendance existante.
  * On ne peut pas réutiliser une vue ou un endpoint existant.

**[GEN-05] Toujours confirmer “quel runtime exécute quoi” (source vs binaire embarqué)**

* Quand un bug est observé en Desktop/Tauri, toujours identifier si l’API utilisée est :

  * un service Docker (`docker compose`)
  * un binaire sidecar embarqué par Tauri (`src-tauri/bin/*`)
  * un binaire lancé manuellement
* Règle de base : **un patch dans le code source ne corrige rien tant que le binaire réellement exécuté n’a pas été reconstruit et remplacé**.
* Symptôme typique : “j’ai corrigé CORS / une route / un header, mais l’erreur reste identique” → on exécute probablement un autre binaire que celui patché.

---

## 8. Desktop/Tauri (bootstrap, sidecars, UI dev)

Cette section formalise des habitudes “anti dette technique” spécifiques au **Desktop (Tauri)**.

**[DESKTOP-01] Desktop dev : démarrer Tauri via Cargo (pas NPM) si pas de package.json**

* Si le projet Tauri n’a pas de `package.json` dans `src-tauri`, utiliser :

  * `cargo tauri dev` depuis `apps/<app>/src-tauri`
* Ne pas forcer un `npm --prefix ... run tauri dev` si la structure ne le supporte pas.

**[DESKTOP-02] CORS : valider par un vrai preflight, pas uniquement par l’UI**

* Quand l’UI affiche “blocked by CORS policy”, toujours reproduire avec une requête `OPTIONS` (preflight) et un header `Origin`.
* Objectif : vérifier la présence de :

  * `Access-Control-Allow-Origin`
  * `Access-Control-Allow-Credentials` (si cookies/credentials)
  * `Access-Control-Allow-Methods` / `Access-Control-Allow-Headers`
* En parallèle, vérifier les logs backend (ex: `api-geo.log`) pour confirmer les `200` sur les routes (`/db/schema`, etc.).

**[DESKTOP-03] UI : bannir les fallbacks relatifs “/api” en Desktop**

* En Desktop dev, l’UI tourne souvent sur `http://localhost:1420` (ou `127.0.0.1`), et l’API sur un autre port (`8000` typiquement).
* Toute construction d’URL de type :

  * `window.location.origin + '/api'`
  * `'/api'` par défaut

  peut provoquer des `404` en pointant sur le serveur Vite.
* Décision recommandée : centraliser la base API dans un module unique (ex: `getApiBase()`), supportant un override runtime (`window.__API_GEO__`) injecté par Tauri.

**[DESKTOP-04] Patch backend Desktop : rebuild + copy explicite dans le dossier sidecar**

* Après un patch backend impactant le Desktop (CORS, routes, auth…), toujours :

  * `cargo build --release` dans `services/api-geo`
  * copier le binaire vers `apps/<app>/src-tauri/bin/<api-geo>.exe`
  * relancer `cargo tauri dev`

Cette discipline évite des itérations “fantômes” où l’on teste une version différente de celle patchée.

---

## 9. Déploiement / Packaging (MSI, ressources, seed)

Cette section formalise le **contrat de packaging** et les garde-fous CI pour éviter les erreurs de bundle (seed manquant, runtime PG incomplet, chemins ambigus).

**[DEPLOY-01] Contrat de packaging documenté et versionné**

* Le layout canonique des ressources MSI (structure sous `resource_dir()`) doit être documenté dans `docs/CONTRAT_PACKAGING.md`.
* Toute modification de `bundle.resources` (Tauri) doit mettre à jour ce contrat.

**[DEPLOY-02] Smoke test MSI dans le CI (pas seulement local)**

* Le CI doit construire un MSI (pour les branches/tags de release) et vérifier son contenu via `scripts/verify-bundle.ps1 -MsiPath`.
* Le job doit échouer si le MSI ne contient pas :
  * `pg/bin/pg_ctl.exe`
  * `atlas_desktop_seed.dump` + manifest

**[DEPLOY-03] Un seul point de résolution des ressources runtime (fail-fast)**

* Le Desktop doit résoudre `pg_bin_dir` et `seed_dump` via un **resolver unique** exécuté **au startup** (ex: `AtlasResources::resolve()`), puis stocker le résultat en `State`.
* Les commandes Tauri (ex: `installer_preflight`) ne doivent **jamais** rescanner récursivement les ressources ni tenter de “deviner” les chemins.
* En cas d'échec de résolution, la fonction doit **fail-fast with context** (log du `resource_dir` + message actionnable).

## 2. Base de données & migrations (PostGIS)

### 2.1. Conception & SRID

**[DB-01] SRID unifié**

* Interne : **EPSG:25231** pour toutes les géométries de travail (mailles, sondages, profils…).
* Export / diffusion : **EPSG:4326** (WGS84) pour les sorties publiques (GeoJSON, Leaflet, etc.).
* Les vues “_wgs84” ou champs `geom_4326` sont les points de contact avec l’extérieur.

**[DB-03] Registry des grilles (contrat permanent)**

* Toute grille utilisée pour des imports, des rattachements (missions→mailles), ou du remapping (legacy/provisoire) doit être enregistrée dans un registre explicite avec :

  * `srid`
  * `unit` (`m`, `deg`, etc.)
  * `step` (pas)
  * `origin_x`, `origin_y` (si applicable)
  * `algo` (ex: `iso_code`, `square_grid`, `adm3_centroid_contains`, etc.)
  * `params` (JSON: tolérance snap, précision geohash, etc.)
  * `source_ref` (fichier/commit/export/table source)

* Objectif : éviter les situations où un code (ex: `TG-00xx-...`) existe dans un document mais sans géométrie/paramètres, rendant tout remapping non vérifiable.

* Implémentation recommandée :

  * `atlas.grid_metadata` : metadata minimale de version de grille (déjà utilisée)
  * `atlas.grid_registry` : registre étendu “anti-dette” (contrat permanent), pour toutes grilles et méthodes de rattachement

**[DB-02] Types de géométrie cohérents**

* Les colonnes `geom` des tables principales gardent un type **fixe**.
* Ne pas changer `geometry(Polygon,25231)` → `geometry(MultiPolygon,25231)` sur une table déjà utilisée dans des vues.
* Si besoin de MultiPolygon : créer une vue/matview dérivée qui accepte ce type.

### 2.2. Migrations

**[DB-10] Inspecter avant d’écrire une migration**

Avant d’écrire une migration SQL, toujours :

* Lister tables / vues concernées :
  `\dt atlas.*nom*`, `\dv atlas.*nom*`, `\dm atlas.*`.
* Vérifier les colonnes, SRID, contraintes, FK :
  `\d atlas.table`, `\d+ atlas.table`.
* Noter les noms exacts (`maille_28km` et pas `mailles_28km`, `adm0_raw`, etc.).
* Toujours lire .env et faire un dumps pour chaque migration numérotée

**[DB-11] Migration = script autonome et idempotent**

* Pas de dépendances cachées (chemin local, fichier externe).
* Utiliser des constructs robustes :

  * `CREATE INDEX IF NOT EXISTS …`.
  * `DO $$ BEGIN … EXCEPTION WHEN … THEN RAISE NOTICE …; END $$;`.

**[DB-12] Ne pas casser les tables cœur avec ALTER sauvage**

* Pour des opérations lourdes (clip géométrique, changement de type, etc.) sur une table centrale :

  * Préférer : `CREATE MATERIALIZED VIEW atlas.mv_nom_clipped AS …`.
  * Utiliser cette matview côté API/UI au lieu de modifier la table d’origine.

**[DB-13] Désactiver proprement une migration problématique**

* Si une migration est abandonnée, mais déjà numérotée (ex: 096) :

  * Garder un fichier valide avec un contenu neutre :

    ```sql
    BEGIN;
    RAISE NOTICE 'Migration 096 désactivée (placeholder, voir doc).';
    COMMIT;
    ```
* Éviter de supprimer ou renommer le fichier hors séquence (sinon trou 095 → 097).

### 2.3. Performance & index

**[DB-20] Index pour les filtres fréquemment utilisés**

* Créer des index pour :

  * `atlas.sondages(maille_code)` → recherche par maille.
  * `atlas.sondages(id_m28)` → liens avec mailles 28 km.
  * Colonnes booléennes filtrées souvent (`has_data`, `is_geocoded`) avec condition `WHERE colonne = TRUE`.

**[DB-21] Tester les agrégations clés**

* Pour les vues de couverture (`mv_mailles_geotech`, stats 28 km, etc.) vérifier que :

  * Les compteurs sont cohérents : `n_sondages = n_sondages_exact + n_sondages_random`.
  * Les `FILTER` fonctionnent (exact vs random).
  * Les `JOIN` n’explosent pas le nombre de lignes (éviter les doublons non groupés).

**[DB-22] Migration**

- Avant de lancer une migration (ou série de migration) faire un dump .dump et .sql. le .sql dans /backup et l'autre dans la base de donner elle même

**[DB-23] ST_Intersection et dérive numérique (frontières partagées)**

* Problème : `ST_Intersection` peut introduire des micro-décalages entre frontières voisines (dérive flottante).
  * Exemple : maille A → `1.12345678901` vs maille B → `1.12345678902`.
  * Même avec `toFixed(6)` côté UI, l'arrondi peut diverger → double tracé à l'écran.
* Conséquence : les déduplications frontend échouent, les limites partagées sont dessinées deux fois.
* Solution : utiliser `ST_SnapToGrid` **juste après** l'intersection dans les vues cartographiques.
  * `ST_SnapToGrid(ST_Intersection(...), tol)` garantit que les sommets proches convergent vers la même grille.
  * Tolérance recommandée : **0.00001 (~1 m)** en WGS84 (ou l'équivalent en mètres en SRID projeté).
  * Éviter `0.001` (trop grossier) et `0.000001` (parfois trop fin si la source est bruitée).

---

## 3. Scripts ETL & DSM (PowerShell, GDAL)

**[ETL-00] Commandes: lancer directement (pas de wrapper PowerShell)**

* Préférer l’exécution directe des commandes dans le terminal.
* Éviter les wrappers du type : `powershell -NoProfile -Command "..."`.
* Si besoin de PowerShell : lancer directement la commande PowerShell (pipeline inclus) dans un terminal PowerShell.

**[ETL-01] Un script canonique par usage**

* Éviter les familles `import_dsm_cop30.ps1`, `import_dsm_cop30_v2.ps1`, `*_final.ps1`.
* Un seul script “canonique” par tâche, avec historique géré **par git**, pas par `*.old`.

**[ETL-02] `config.ps1` obligatoire**

* Tous les scripts dans `scripts/` commencent par :

  ```powershell
  . "$PSScriptRoot\config.ps1"
  ```
* `config.ps1` contient :

  * Noms de conteneurs Docker.
  * SRID par défaut.
  * Chemins racine des données (DSM, exports, etc.).
  * Fonctions utilitaires (log, vérification container…).

**[ETL-03] Gestion d’erreurs systématique**

* Chaque commande critique (`gdalwarp`, `raster2pgsql`, `psql`, etc.) est appelée via une fonction helper :

  ```powershell
  function Invoke-AtlasCommand {
      param([string]$Command)

      Write-Host ">> $Command" -ForegroundColor Cyan
      iex $Command
      if ($LASTEXITCODE -ne 0) {
          throw "Commande échouée: $Command (exitcode=$LASTEXITCODE)"
      }
  }
  ```

* Interdiction de continuer silencieusement si `$LASTEXITCODE -ne 0`.

**[ETL-04] NoData DSM clair et cohérent**

* Toujours spécifier NoData dans GDAL :

  * `-srcnodata -9999 -dstnodata -9999` avec `gdalwarp`.
  * Option `-N -9999` avec `raster2pgsql` si pertinent.
* Documenter la valeur NoData utilisée pour les DSM dans `config.ps1` et/ou README.

---

## 4. Backend Rust (`api-geo`)

**[API-01] Endpoints documentés et testables**

* Chaque nouveau endpoint :

  * Est décrit dans un petit commentaire ou doc (chemin, params, exemples).
  * Est testé avec `curl` ou Postman:

    * Cas “OK” (200).
    * Cas “not found” (404).
    * Cas “param manquant ou invalide” (400).

**[API-02] Paramètres explicites plutôt que magiques**

* Exemple : `GET /maille/{code}?grid=2km|28km`

  * Toujours valider `grid` côté backend.
  * Si absent : décider d’un comportement par défaut clair (ex: `2km`) et le documenter.

**[API-03] Erreurs structurées**

* Toujours renvoyer un JSON d’erreur du type :

  ```json
  { "error": "Maille introuvable", "error_code": "MAILLE_NOT_FOUND" }
  ```
* Éviter les messages bruts (`Route non trouvée`) sans code.

**[API-04] Réutiliser les vues**

* L’API ne doit pas réécrire la logique d’agrégation SQL dans Rust.
* Utiliser les vues et matviews (`mv_mailles_geotech`, statistiques 28 km, etc.) comme sources de vérité.

**[API-05] Toute action sur les données d'un autre utilisateur = RBAC + audit trail**

* Toute route/API qui modifie l'état métier d'un autre utilisateur (ex: réassigner/désassigner une mission d'opérateur) doit obligatoirement :

  - **vérifier la permission côté serveur** (RBAC en base, pas seulement UI)
  - **tracer l'action** dans `atlas.auth_audit_log` avec un `details` JSON structuré

* Exemple (réattribution missions/mailles) :

  - Permission requise : `colab.missions.unassign` / `colab.missions.reassign`
  - Event : `mission_unassign` / `mission_reassign`
  - Détails : `{ mission_id, old_mission_id, new_mission_id, new_maille_id, student_id, ... }`

---

## 5. Frontend / UI (Leaflet + Vite)

**[UI-01] Séparation logique des panneaux**

* Panneau principal (carte) : interaction spatiale.
* Panneau gauche : détails maille/sondage, stats.
* Panneau droit : filtres, choix de grille, couches de contexte, exports.

**[UI-02] Comportement cohérent entre grilles 2 km et 28 km**

* Règles couleur maille (2 km **et** 28 km) :

  * `has_data = false` → gris.
  * `n_sondages_exact > n_sondages_random` → vert.
  * `n_sondages_random >= n_sondages_exact` et `has_data = true` → bleu.
* Légende toujours synchronisée avec ces règles.

**[UI-03] Clic maille → pipeline complet**

* Clic sur une maille (2 km ou 28 km) doit :

  1. Mettre la maille en surbrillance.
  2. Remplir le panneau gauche avec ses stats.
  3. Offrir un bouton **“Gérer”** qui :

     * Ouvre la page liste des sondages,
     * Filtre les sondages de cette maille,
     * Centrer la carte de la page sondages sur la maille.

**[UI-04] Recherche par code maille**

* La page “Liste des sondages” doit permettre :

  * Recherche par **nom de sondage**.
  * Recherche par **code maille**.
* Si recherche par code maille :

  * Filtrer les sondages correspondants.
  * Sur la mini-carte de droite : zoom sur la maille, surbrillance (jaune) pendant ~5 s.
  * Ajouter un bouton “Voir sur carte principale” qui renvoie à la page d’accueil centrée sur cette maille.

**[UI-05] Couches de contexte stylées comme QGIS**

* Géologie, pédologie, risque de gonflement :

  * Appliquer des styles catégoriels stables (palette similaire QGIS).
  * Légende claire (Risque Faible/Moyen/Élevé, unités géologiques, types de sols…).
* Éviter un rendu “tout gris” non lisible.

---

### 5.1. UI Architecture & Design System (Token-first)

**[UI-06] Design system token-first (source de vérité unique)**

* La palette UI doit être définie dans **un seul fichier de tokens** (ex: `ui/src/design-tokens.css`).
* Règle : **never use raw colors in components**.
  * Interdit dans les composants : `#374151`, `rgb(...)`, `bg-white`, `text-gray-700`, etc.
  * Autorisé : `hsl(var(--foreground))`, `hsl(var(--card))`, et les variables exposées par le design system.
* Le design system doit contenir : surfaces, texte, muted, border, primary, destructive, focus/ring, etc.

**[UI-07] Ne pas multiplier les overrides CSS (anti `!important`)**

* Les `!important` sont un signal d'architecture fragile.
* Objectif : **tendre vers 0** sur les overrides globaux.
* Si un bug visuel est dû à une couleur hardcodée : **corriger le composant** (fix forward), pas un override global.

**[UI-08] Un paradigme de rendu par page**

* Règle : **une page = un seul paradigme** (React **ou** vanilla).
* Si une page est hybride (legacy), isoler la frontière :
  * Interfaces TypeScript explicites.
  * Contrat d'événements documenté (event bus).
  * Éviter les partages d'état implicites par variables globales.

**[UI-09] Modals centralisés (un seul composant source)**

* Tous les modals doivent partager :
  * Overlay/backdrop
  * Container
  * Header/Close
  * Focus management
  * Styles (surface, border, typography)
* Éviter d'avoir des modals dispersés avec chacun ses propres styles inline/CSS injecté.
* Objectif : un composant `Modal` (ou wrapper Radix) qui concentre les styles.

**[UI-10] `color-scheme` obligatoire pour les contrôles natifs**

* Pour garantir la cohérence des `<select>` / date pickers natifs selon le thème :
  * `:root { color-scheme: light; }`
  * `.dark { color-scheme: dark; }`

**[UI-11] Fix forward, not sideways**

* Quand un composant est incorrect :
  * Corriger le composant pour utiliser les tokens.
  * Ne pas ajouter un override qui "contre-balance" l'erreur.

**[UI-12] Tests de régression visuelle (Playwright screenshots)**

* Toute refonte UI non triviale doit ajouter/mettre à jour au moins 1 screenshot test.
* Minimum recommandé :
  * Page de login (light + dark)
  * Un modal clé (create/transfer mission)
  * Panneau thématique (boutons exports)
* Objectif : détecter immédiatement les régressions de contraste/couleur/layout.

---

## 6. Docker & infrastructure

**[INFRA-01] Réutiliser les images officielles si suffisantes**

* Ne pas créer de Dockerfile DB tant que l’image `postgis/postgis` fournit :

  * raster2pgsql,
  * GDAL,
  * PostGIS.

**[INFRA-02] Conteneurs nommés et constants**

* Nommer les services clairement (`atlas-db`, `api-geo`, `ui`, etc.).
* Centraliser ces noms dans `config.ps1` pour les scripts.

**[INFRA-03] Backups hors repo**

* Les dumps `.dump` ne doivent jamais être versionnés dans git.
* Règle :

  * Dossier `backups/` dans `.gitignore`.
  * Sauvegardes nommées avec timestamp et description.

---

## 7. Git & gestion des fichiers

**[GIT-01] Pas de fichiers “.old” suivis par git**

* Les fichiers de type `*.ps1.old`, `*.bak`, etc. ne doivent pas rester versionnés.
* Git contient déjà l’historique.

**[GIT-02] Fichiers lourds interdits**

* Pas de dumps DB, pas de gros TIFF DSM bruts dans le repo.
* Si besoin, utiliser :

  * `.gitignore` pour les exclure,
  * ou une solution externe (dossier data, stockage cloud).

**[GIT-03] Commits structurés**

* Un commit = un ensemble cohérent (ex : “fix(backend): index maille_code + tests”).
* Toujours mentionner :

  * ce qui a été fait,
  * pourquoi (en une ou deux phrases),
  * éventuellement les refs (todo, ticket).

---

## 8. Tests & validation

**[TEST-01] Test manuel minimal obligatoire**

Après chaque développement non trivial, vérifier :

* **DB** : requête simple sur la table/vue modifiée.
* **API** : 1 requête OK, 1 erreur.
* **UI** : 1 scénario complet (ex : cliquer une maille 28 km, voir bouton Gérer, vérifier liste sondages filtrée).

**[TEST-02] Scénarios critiques identifiés**

Scénarios à tester régulièrement (à formaliser plus tard) :

* Sélection d’une maille 2 km avec sondages → stats cohérentes.
* Sélection d’une maille 28 km → affichage des profils + bouton Gérer.
* Export thématique (risque de gonflement, géologie, pédologie) → légende correcte + marges correctes.

---

## 9. Documentation & TODO

**[DOC-01] Documenter les décisions techniques importantes**

* Toute décision majeure (migration désactivée, changement de SRID, choix d’index…) doit être :

  * Notée dans `TODO.md` 
  * Résumée dans le message de commit.

**[DOC-02] Fichiers “charte” incrémentables**

* Ce document (`atlas_guidelines.md`) est ton **référentiel de bonnes pratiques**.
* Toute nouvelle règle importante doit être ajoutée ici avec un identifiant ([DB-22], [UI-06], etc.).

---

## 10. Workflows & Non-régression

**[WORK-01] Ne jamais casser un workflow fonctionnel sans tests**

* Avant de modifier un workflow existant (ex: clic maille → détails → sondages):
  * Documenter le flux actuel (événements, paramètres URL, filtres).
  * Tester le workflow **avant** modification.
  * Après modification: re-tester **exactement** le même scénario.
* Si un workflow casse, c'est une régression critique à corriger immédiatement.

**[WORK-02] Contrats stables entre composants**

* Les contrats entre carte et gestionnaire de sondages doivent rester stables:
  * Paramètres URL: `?grid=2km&maille=TG-...` ou `?m28=30`.
  * Événements custom: garder les mêmes noms et structures.
  * Champs de données: `grid_code`, `maille_code`, `id_m28` cohérents.
* Ne pas inventer de nouveaux paramètres si les anciens fonctionnent.

**[WORK-03] Tests de non-régression sur workflows critiques**

Workflows à tester systématiquement après chaque refonte:

1. **Clic maille 2km → Détail → Liste sondages filtrée**
2. **Recherche par code maille → Résultats + zoom carte**
3. **Changement niveau grille 2km ↔ 28km → Mise à jour carte + stats**
4. **Export thématique → Respect niveau grille + légende correcte**
5. **Activation couches contexte → Tooltips enrichis**

**[WORK-04] Source de vérité unique pour l'état global**

* Le niveau de grille (2km/28km) doit avoir **une seule source de vérité**:
  * Typiquement: state global dans le panneau droit.
  * Tous les autres composants (carte, exports, panneaux) **lisent** cette valeur.
  * Pas de sélecteurs multiples désynchronisés.

---

## 11. Méthodologie de développement

**[METH-01] Découper les refontes en petites étapes indépendantes**

* Plutôt que de tout changer en une fois:
  * **Étape 1**: Backend seul (migrations, vues, API) avec tests.
  * **Étape 2**: Frontend minimal (affichage basique) avec validation.
  * **Étape 3**: Interactions avancées (clics, filtres) avec tests workflows.
  * **Étape 4**: Polish UI (tooltips, légendes, styles) avec validation visuelle.

**[METH-02] Feature flags pour grosses modifications**

* Pour des changements majeurs (nouveau style couleurs, nouvelle grille):
  * Utiliser un flag temporaire: `window.ATLAS_FLAGS.useNewGridColors = true`.
  * Permet de tester en parallèle sans casser l'existant.
  * Retirer le flag une fois la migration validée.

**[METH-03] Validation incrémentale**

Après chaque étape:

1. **Compiler** (frontend + backend si modifié).
2. **Tester manuellement** le scénario principal.
3. **Vérifier** qu'aucune régression n'est apparue.
4. **Commiter** si tout fonctionne.
5. Passer à l'étape suivante.

**[METH-04] Rollback rapide en cas de blocage**

* Si après 2-3 tentatives une approche ne fonctionne pas:
  * Noter le SHA du commit stable.
  * Créer une branche de correction: `fix/probleme-specifique`.
  * Si échec: revenir au commit stable et replanifier.
* Ne pas s'enfoncer dans une impasse pendant des heures.

---

## 12. Cohérence des données

**[DATA-01] Alignement champs API ↔ Style UI**

* Les propriétés GeoJSON retournées par l'API doivent correspondre **exactement** aux champs utilisés par le style:
  * Si le style utilise `n_sondages_exact`, l'API doit le fournir.
  * Si le style utilise `has_exact_location`, l'API doit le fournir.
* Avant de changer l'un, vérifier l'autre.

**[DATA-02] Codes mailles cohérents et stables**

* **2km**: Format technique `TG-XXXX-YYYY-ZZ` (ex: `TG-0755-0191-01`).
* **28km**: Format lisible à définir (ex: `TG-PROFIL-01-28` ou `TG-28KM-001`).
* Ne pas utiliser des IDs numériques bruts (ex: `30`) comme codes publics.
* Les codes doivent être:
  * **Uniques** (clé primaire ou unique constraint).
  * **Stables** (ne changent pas entre versions).
  * **Lisibles** (compréhensibles par un humain).

**[DATA-03] Champs de liaison sondages ↔ mailles**

* Champs canoniques pour lier sondages aux mailles:
  * `grid_code` (ou `maille_code`): code maille 2km.
  * `id_m28`: ID maille 28km (entier).
  * `code_m28`: code maille 28km (texte lisible, à ajouter).
* Toujours indexer ces champs pour les recherches.

---

## 13. UI/UX - Règles d'ergonomie

**[UX-01] Tooltips conditionnels selon couches actives**

* Le tooltip d'une maille doit afficher:
  * **Toujours**: Code, région, nombre de sondages.
  * **Si géologie active**: Unité géologique dominante.
  * **Si pédologie active**: Type de sol dominant.
  * **Si gonflement actif**: Risque + Eg moyen.
* Ne pas surcharger le tooltip avec des infos non pertinentes.

**[UX-02] Opacité et lisibilité des couches**

* Grilles 2km/28km:
  * Opacité suffisante pour être visible (~0.5-0.7).
  * Contour distinct (weight 1-2, couleur contrastée).
* Couches contexte:
  * Opacité réduite (~0.3-0.5) pour ne pas masquer les grilles.
  * Styles catégoriels clairs (pas de dégradés flous).

**[UX-03] Légendes synchronisées avec l'affichage**

* La légende doit **toujours** correspondre à ce qui est affiché:
  * Si le style utilise vert/bleu/gris, la légende doit montrer ces 3 couleurs.
  * Si une couche est désactivée, sa légende doit être masquée ou grisée.
* Légendes dépliables pour économiser l'espace écran.

**[UX-04] Feedback visuel immédiat**

* Toute action utilisateur doit avoir un feedback:
  * Clic maille → surbrillance immédiate.
  * Changement niveau grille → loader + toast "Grille 28km chargée".
  * Recherche → indicateur de chargement + nombre de résultats.
  * Erreur → message clair + suggestion d'action.

---

## 14. Performance & Optimisation

**[PERF-01] Chargement paresseux des couches lourdes**

* DSM, couches contexte haute résolution:
  * Ne charger que la bbox visible.
  * Utiliser des tuiles vectorielles ou raster optimisées.
  * Limiter le nombre de features affichées (simplification géométrique).

**[PERF-02] Agrégations côté backend**

* Ne jamais faire d'agrégations lourdes côté frontend:
  * Comptages, moyennes, stats → vues matérialisées ou API.
  * Frontend = affichage uniquement.

**[PERF-03] Debounce sur recherche et filtres**

* Recherche texte, filtres dynamiques:
  * Debounce 300-500ms pour éviter requêtes excessives.
  * Indicateur de chargement pendant la requête.

---

## 15. Sécurité & Validation

**[SEC-01] Validation paramètres API**

* Tous les paramètres d'URL doivent être validés:
  * `grid`: enum strict `2km|28km`.
  * `code`: format regex `TG-\d{4}-\d{4}-\d{2}`.
  * `bbox`: 4 nombres valides.
* Rejeter avec 400 Bad Request si invalide.

**[SEC-02] Injection SQL impossible**

* Utiliser **uniquement** des requêtes paramétrées:
  * `sqlx::query!("SELECT ... WHERE code = $1", code)`.
  * Jamais de concaténation de strings.

**[SEC-03] Limites de résultats**

* Toutes les requêtes liste doivent avoir une limite:
  * Par défaut: 500 résultats max.
  * Paramètre `limit` optionnel (max 1000).
  * Pagination si besoin de plus.

---

## 16. Gestion des contraintes et suppressions en cascade

**[CASCADE-01] La Règle d'Or (Le Principe de "Composition")**

> **N'utilise `ON DELETE CASCADE` que si l'enfant n'a aucun sens d'exister sans son parent.**

C'est la différence entre une relation de **Composition** (partie d'un tout) et une relation d'**Association** (lien entre deux entités).

### ✅ FEU VERT : Utilise CASCADE ici
Quand l'enfant est une **partie physique** du parent.
*   **Exemple :** Une `Facture` et ses `Lignes_Facture`.
    *   *Logique :* Une ligne de facture "3 stylos" qui se balade toute seule sans facture associée n'a aucun sens. Si on supprime la facture, les lignes **doivent** disparaître.
*   **Exemple :** Un `Sondage` et ses `Mesures_Brutes`.

### ⛔ FEU ROUGE : Interdit ici (Utilise RESTRICT)
Quand l'enfant est une entité qui a sa **propre vie**, mais qui est juste "liée" au parent.
*   **Exemple :** Un `Département` et ses `Employés`.
    *   *Logique :* Si on supprime le département "Marketing" par erreur, on ne veut SURTOUT PAS licencier (supprimer) tous les employés du marketing ! La base doit bloquer (`RESTRICT`) et dire : "Videz le département d'abord".
*   **Exemple :** Un `Pays` et des `Villes`.

---

**[CASCADE-02] Les Alternatives Efficaces (Le "Soft Delete")**

Au lieu de supprimer physiquement (ce qui est irréversible), la norme en entreprise est le **Soft Delete** (Suppression Logique).

### L'Alternative N°1 : `deleted_at` 
Ajoute une colonne `deleted_at (timestamp nullable)` dans tes tables.
*   **Action :** Au lieu de faire `DELETE FROM users WHERE id=1`, tu fais `UPDATE users SET deleted_at = NOW() WHERE id=1`.
*   **Avantage :**
    1.  Tu ne perds jamais de données (audit, restauration possible).
    2.  Tu n'as pas besoin de CASCADE. Les enfants restent liés, mais on sait que le parent est "archivé".
    3.  Tes requêtes deviennent : `SELECT * FROM users WHERE deleted_at IS NULL`.

### L'Alternative N°2 : `ON DELETE SET NULL` 
Si la suppression du parent est autorisée, mais que tu veux garder l'enfant.
*   **Exemple :** Un `Commercial` gère des `Clients`.
*   **Action :** Si le commercial part (est supprimé), on ne supprime pas les clients ! On met la colonne `client.commercial_id` à `NULL` (ou on réassigne à un compte "Commercial par défaut").

---

**[CASCADE-03] Points de Vigilance (Checklist avant d'utiliser CASCADE)**

Si tu décides quand même d'utiliser `CASCADE`, vérifie ces 3 points :

1.  **La profondeur de la chaîne :**
    *   Attention à l'effet papillon : A supprime B, qui supprime C, qui supprime D...
    *   **Règle :** Évite les cascades sur plus de **2 niveaux** de profondeur.

2.  **Les Triggers (`ON DELETE`) :**
    *   Si la table enfant a un Trigger qui se lance à la suppression (ex: envoyer un mail, écrire un fichier), une suppression massive du parent peut déclencher 10 000 envois de mails ou planter le serveur.

3.  **Le verrouillage (Locking) :**
    *   Rappelle-toi que supprimer un parent avec CASCADE verrouille toutes les tables enfants. Sur une base très fréquentée, cela peut causer un "Déni de Service" temporaire.

### 🧱 Résumé pour ta Doc Technique

| Cas d'usage | Action recommandée | Pourquoi ? |
| :--- | :--- | :--- |
| **Maintenance / Script Migration** | `TRUNCATE ... CASCADE` | On veut faire place nette rapidement. C'est ponctuel. |
| **Parent & Composants (Facture/Lignes)** | `ON DELETE CASCADE` | Cohérence des données. L'orphelin n'a pas de sens. |
| **Entités liées (User/Comments)** | `ON DELETE RESTRICT` | Sécurité. Évite la perte massive accidentelle. |
| **Historique / Audit** | **SOFT DELETE** (`deleted_at`) | La meilleure pratique. On ne supprime rien, on archive. |

---

**[DB-24] ON_ERROR_STOP=1 pour les scripts d'application**

Pour tout script d'application sur la base de données (migrations, imports, ETL), utiliser systématiquement `ON_ERROR_STOP=1`.
*   **Action :** `psql -v ON_ERROR_STOP=1 -f script.sql`
*   **Comportement :** À la moindre erreur (rouge), arrête tout immédiatement.
*   **Pourquoi :** Évite les exécutions partielles qui laissent la base dans un état incohérent.

---

## 17. Configuration d'environnement (Anti-Hardcode)

**[CFG-01] — La configuration ne vit jamais dans le code source**

Jamais de port, d'URL, ou de credential hardcodé dans :
*   `index.html`
*   `main.ts` / `main.tsx`
*   Un composant React

La configuration vit uniquement dans :
*   `.env.local` (développement, non commité)
*   `window.__ATLAS_CONFIG__` injecté par Tauri (desktop au runtime)
*   Variables d'environnement CI (ex: GitHub Secrets)

*Enforcement : Le script CI `ci.yml` rejette automatiquement tout merge incluant les chaînes "127.0.0.1:80..." ou "window.__API_GEO__ = ...".*

**[CFG-02] — Une seule source de vérité pour la config API**

Le fichier `ui/src/config.ts` (ou équivalent) est le **seul endroit** qui connaît l'URL de l'API. Tout autre fichier (client, websockets, fetch) importe depuis `config.ts`. Il n'y a jamais deux endroits qui reconstruisent ou override l'URL de l'API indépendamment.

**[CFG-03] — L'indicateur de santé est toujours visible**

L'application affiche en permanence l'état de la connexion API/DB (ex: dans la barre de header via `ApiHealthIndicator`).
*   Quand l'API est hors ligne, l'utilisateur voit un message explicite.
*   Ne jamais laisser une carte muette se charger sans explication sur l'échec réseau.

---

## 18. Qualité et Audit des Données (Géotechnique)

**[DATA-01] — Tout audit de données produit un plan d'action, pas juste un constat**

Un rapport qui dit "85% de VBS manquants" sans dire "importer bleu.xlsx via le script X avec la jointure Y" n'est pas actionnable.
Format obligatoire pour tout rapport d'audit de données :
1. Constat (quantifié, par région, par type)
2. Sources disponibles pour combler les manques
3. Script d'import avec clé de jointure documentée
4. Validations physiques (plages admissibles par type d'essai)
5. Estimation du taux de couverture attendu après import

**[DATA-02] — Les données géotechniques ont des plages physiques connues**

Toute valeur importée est rejetée si elle est hors plage :
*   VBS : 0-20 g/100g
*   WL  : 20-120 %
*   WP  : 10-60 %
*   IP  : 0-80 % et |IP - (WL-WP)| ≤ 5%
*   γd max : 14-22 kN/m³
*   w_opt  : 5-30 %

Ces validations sont dans `scripts/import_missing_geotech_data.py`. Aucun import ne bypasse ces validations.

**[DATA-03] — Le taux de complétude des données est un KPI visible dans l'app**

Le panneau maille (ou sondage) doit afficher le score de qualité (0-100) et la liste des essais manquants (ex: via le composant `DataQualityBadge`). Un ingénieur ne doit jamais avoir à interroger la DB pour savoir quelles données structurantes sont disponibles ou manquantes.
