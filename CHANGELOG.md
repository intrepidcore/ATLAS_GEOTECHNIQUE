# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [1.1.0] - 2025-10-17

### Ajouté
- **[DB]** Migration `004_add_survey_management.sql` avec colonnes étendues pour `sondages`
- **[DB]** Colonnes: `code`, `depth_m_min/max`, `maille_code`, `adm1/2/3_name`, `comment`, `created_at`, `updated_at`, `deleted_at`
- **[DB]** ENUM `test_type` avec 30+ types d'essais géotechniques (SPT_N, qc, fs, Rf, pL, pf, EM, Cu_VST, K_PLT, D10, D50, Cu_grain, Cc, wL, wP, IP, gamma_d_max, w_opt, c_prime, phi_prime, Cu_triax, Cc_compress, Cs, Cv, water_table, layer_thickness, USCS, GTR)
- **[DB]** Soft delete avec colonne `deleted_at` pour sondages et essais
- **[DB]** Trigger `generate_sondage_code()` pour auto-génération du code (format: S-YYYYMMDD-NNN)
- **[DB]** Trigger `tag_sondage_spatial()` pour auto-tag maille/ADM1/2/3 lors de l'insertion
- **[DB]** Trigger `update_updated_at()` pour traçabilité des modifications
- **[DB]** Table `audit_log` pour historique des opérations CRUD
- **[DB]** Contraintes de validation (depth_m_min <= max, depth_m >= 0)
- **[DB]** View `v_sondages_active` pour filtrer les sondages non supprimés
- **[API]** Endpoint `GET /grid/locate?lon=&lat=` pour localiser une maille par coordonnées
- **[API]** Endpoint `POST /surveys` pour créer un sondage avec auto-tag spatial
- **[API]** Endpoint `GET /surveys?bbox=` pour lister les sondages (bbox optionnel)
- **[API]** Endpoint `DELETE /surveys/:id` pour soft delete d'un sondage
- **[API]** Endpoint `POST /tests` pour créer un essai avec validation des profondeurs
- **[API]** Endpoint `GET /surveys/:id/tests` pour lister les essais d'un sondage
- **[API]** Endpoint `DELETE /tests/:id` pour soft delete d'un essai
- **[API]** Validation automatique: profondeur min <= max, point dans maille, essai dans bounds sondage
- **[API]** Transformation SRID automatique (4326 -> 25231)
- **[API]** Audit log automatique pour toutes les opérations CRUD
- **[UI]** Section "Sondages" dans la sidebar avec boutons "Nouveau sondage" et "Liste des sondages"
- **[UI]** Drawer latéral animé pour création/édition de sondages
- **[UI]** Formulaire de saisie avec champs: longitude, latitude, profondeur min/max, commentaire
- **[UI]** Interaction carte: clic sur la carte pour pré-remplir les coordonnées
- **[UI]** Liste des sondages avec recherche en temps réel
- **[UI]** Cartes cliquables pour zoom sur sondage
- **[UI]** Marqueurs sur la carte pour visualiser les sondages créés
- **[UI]** Notifications toast pour feedback utilisateur
- **[UI]** Rechargement automatique de la grille après création de sondage
- **[Scripts]** Script PowerShell `test-survey-api.ps1` pour tests E2E complets
- **[Scripts]** Script PowerShell `check-api-compile.ps1` pour validation compilation

### Modifié
- **[API]** Configuration pool PostgreSQL avec timeouts généreux pour Docker (acquire: 60s, idle: 600s, max_lifetime: 1800s)
- **[API]** Fonction `pg_pool_with_retry()` avec 5 tentatives et backoff exponentiel (2s → 32s)
- **[API]** Logs de démarrage améliorés avec émojis et messages clairs
- **[API]** Module `surveys.rs` sans macros SQLx (offline mode compatible)
- **[Cargo]** Dépendances ajoutées: `time` avec features serde/formatting, `num-traits`

### Corrigé
- **[API]** Crash au démarrage causé par timeout de connexion DB
- **[API]** Logique de retry cassée (double tentative immédiate)
- **[API]** Warnings de compilation dans `routes.rs`

### Technique
- **[DB]** Triggers PL/pgSQL pour automatisation (code, spatial tag, timestamps)
- **[DB]** Contraintes CHECK pour validation des données
- **[API]** Retry avec backoff exponentiel pour connexion DB
- **[API]** Queries SQL sans macros pour éviter dépendance à sqlx-data.json
- **[UI]** CSS moderne avec variables CSS et animations fluides
- **[UI]** TypeScript avec gestion d'état local pour le drawer

## [0.7.0] - 2025-01-XX

### Ajouté
- **[DB]** Table `country_tg` pour stocker le polygone du Togo (EPSG:4326)
- **[DB]** Migration `007_grid_v0.7.0.sql` pour la nouvelle structure de grille
- **[ETL]** Commande `load-country` pour charger le polygone du Togo depuis GeoJSON
- **[ETL]** Commande `make-grid` pour générer une grille nationale avec mailles carrées de ~2 km² (côté ≈ 1414.21 m)
- **[ETL]** Commande `load-sample-extended` pour générer des données fictives multi-villes avec distributions réalistes
- **[ETL]** Support des distributions gaussiennes pour SPT_N et qc avec corrélation légère
- **[ETL]** Support des profondeurs réalistes avec distribution triangulaire (mode = 8 m)
- **[ETL]** Biais géographiques par ville (ex: sols plus mous à Lomé)
- **[API]** Endpoint `GET /coverage/mailles` retournant une FeatureCollection (4326) avec métadonnées complètes
- **[API]** Propriété `has_data` dans les features de `/coverage/mailles`
- **[API]** Comptages `n_sondages` et `n_essais` par maille dans `/coverage/mailles`
- **[UI]** Bouton "Export GeoJSON" pour télécharger la géométrie d'une maille
- **[UI]** Fonction `exportGeoJSON()` avec téléchargement automatique du fichier
- **[Data]** Fichier `data/togo.geojson` avec le polygone simplifié du Togo
- **[Doc]** Section "Nouveautés v0.7.0" dans le README
- **[Doc]** Documentation complète des commandes ETL dans le README
- **[Doc]** Documentation de l'interface utilisateur dans le README
- **[Doc]** Ce fichier CHANGELOG.md

### Modifié
- **[DB]** La grille couvre maintenant tout le territoire du Togo (800-1200 mailles selon précision)
- **[DB]** Les mailles sont générées avec une aire cible fixe (~2 km²) au lieu d'un nombre prédéfini
- **[DB]** Les mailles sont clippées au polygone du Togo (pas de débordement sur pays voisins)
- **[ETL]** Génération de grille déplacée de SQL vers ETL Python avec PostGIS `ST_SquareGrid`
- **[ETL]** Seed fictif étendu à 4 villes (Lomé, Sokodé, Kara, Dapaong) au lieu d'une seule
- **[ETL]** Nombre de sondages variable par ville (3-12 selon taille)
- **[ETL]** Rayon de distribution variable par ville (2-6 km)
- **[UI]** Coloration conditionnelle : mailles avec données en rouge semi-transparent, mailles vides en gris transparent
- **[UI]** Amélioration du style visuel des mailles sur la carte
- **[Docker]** Volume `/data` monté en lecture seule dans le conteneur ETL

### Technique
- **[Grille]** Utilisation de `ST_SquareGrid` (PostGIS ≥ 3.1) pour générer les cellules
- **[Grille]** Intersection avec `ST_Intersection` et filtrage avec `ST_Intersects`
- **[Grille]** Filtrage des reliquats avec seuil d'aire minimale (> 1 m²)
- **[ETL]** Graine aléatoire configurable pour reproductibilité (`--seed 42`)
- **[ETL]** Conversion GeoJSON → WKT pour Polygon et MultiPolygon
- **[API]** Requête SQL optimisée avec LEFT JOIN pour `/coverage/mailles`
- **[API]** Calcul de `has_data` côté SQL (`COUNT(DISTINCT s.id) > 0`)

## [0.6.0] - 2025-01-XX (précédente version)

### Ajouté
- **[API]** Endpoint `GET /grid/{code}/shape` retournant la géométrie GeoJSON (4326)
- **[API]** Endpoint `POST /grid/recompute/{code}` pour calcul IDW
- **[UI]** Affichage de la grille avec interaction au clic
- **[UI]** Bouton "GET /grid/{code}/shape" pour visualiser la géométrie
- **[UI]** Bouton "Zoom Togo" pour recentrer sur la grille
- **[UI]** Indicateur de statut visuel (OK/Loading/Error)

### Modifié
- **[DB]** Projection EPSG:25231 (Lomé / UTM zone 31N) pour stockage des géométries
- **[API]** Transformation automatique vers EPSG:4326 pour les réponses
- **[ETL]** Commande `load-sample` avec 5 mailles, 12 sondages, ~30 essais

## [0.5.0] - 2025-01-XX (version initiale)

### Ajouté
- **[Infra]** Structure monorepo avec Docker Compose
- **[DB]** PostGIS 16-3.4 avec tables `sondages`, `essais`, `mailles`
- **[API]** Service api-geo (Rust/Axum) avec endpoints de base
- **[API]** Service api-infer (Rust/Axum, profile optionnel)
- **[API]** Service api-opti (Rust/Axum, profile optionnel)
- **[UI]** Interface Vite + TypeScript + Leaflet
- **[ETL]** CLI Python (Typer) avec commande `migrate` et `load-sample`
- **[Doc]** README de base avec instructions de démarrage
