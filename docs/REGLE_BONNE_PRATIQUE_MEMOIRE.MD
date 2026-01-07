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

---

## 2. Base de données & migrations (PostGIS)

### 2.1. Conception & SRID

**[DB-01] SRID unifié**

* Interne : **EPSG:25231** pour toutes les géométries de travail (mailles, sondages, profils…).
* Export / diffusion : **EPSG:4326** (WGS84) pour les sorties publiques (GeoJSON, Leaflet, etc.).
* Les vues “_wgs84” ou champs `geom_4326` sont les points de contact avec l’extérieur.

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

---

## 3. Scripts ETL & DSM (PowerShell, GDAL)

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

  * Notée dans `TODO.md` ou `atlas_guidelines.md`.
  * Résumée dans le message de commit.

**[DOC-02] Fichiers “charte” incrémentables**

* Ce document (`atlas_guidelines.md`) est ton **référentiel de bonnes pratiques**.
* Toute nouvelle règle importante doit être ajoutée ici avec un identifiant ([DB-22], [UI-06], etc.).

---

Si tu veux, au prochain message je peux :

* te proposer directement un **template de fichier Markdown** prêt à coller avec une table des matières,
* ou détailler une section particulière (par exemple “Règles spécifiques pour les mailles 28 km” ou “Charte des couleurs UI Atlas”).
