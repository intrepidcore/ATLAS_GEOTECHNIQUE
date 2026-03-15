# Atlas Géotechnique (Monorepo local)

**Version actuelle : 1.0.0**

Ce dépôt fournit une ossature de monorepo pour un atlas géotechnique local uniquement, avec PostGIS, APIs Rust (axum), UI Vite + TS + Leaflet, et un ETL Python.

## Nouveautés v1.0.0 🚀

* **Import Bulk Complet** : Système d'import massif de sondages géotechniques (CSV/XLSX/JSON)
  - Support multi-formats : CSV (auto-détection séparateur), XLSX (via calamine), JSON
  - Parser intelligent avec détection d'encodage (UTF-8, Latin-1, Windows-1252)
  - Validation complète des données (coordonnées, champs requis, types)
  - Transformation long ↔ large format automatique
  - Détection et gestion des doublons (fingerprinting SHA-256)
  
* **Géolocalisation Avancée** : 5 modes de géolocalisation
  - Exact : Coordonnées précises fournies
  - Centroid : Centre géométrique d'une zone ADM
  - Random : Point aléatoire dans une zone avec jitter configurable
  - Unknown : Sondage sans coordonnées (géocodage ultérieur)
  - Maille : Rattachement à une maille spécifique
  
* **Job Queue Asynchrone** : Traitement en arrière-plan
  - File d'attente avec workers parallèles (tokio)
  - Suivi temps réel de la progression (0-100%)
  - Statistiques détaillées (lignes traitées, erreurs, warnings)
  - Annulation de jobs en cours
  - Historique des imports avec rapports détaillés
  
* **Profils de Mapping** : Réutilisation des configurations
  - CRUD complet (GET/POST/PUT/DELETE)
  - Sauvegarde mapping colonnes + géolocalisation
  - Partage entre utilisateurs (profils publics)
  - Compteur d'utilisation et dernière utilisation
  
* **Streaming Gros Fichiers** : Traitement par chunks
  - Chunks de 1000 lignes (configurable)
  - Batch inserts de 100 enregistrements
  - Estimation mémoire automatique
  - Support fichiers > 100 MB
  
* **API REST Complète** : 13 endpoints
  - `/surveys/bulk-import/dry-run` : Validation sans insertion
  - `/surveys/bulk-import/async` : Import asynchrone
  - `/surveys/bulk-import/status/:id` : Suivi progression
  - `/surveys/bulk-import/cancel/:id` : Annulation
  - `/surveys/bulk-import/report/:id` : Rapport détaillé
  - `/surveys/bulk-import/templates/:type` : Téléchargement templates
  - `/surveys/bulk-import/profiles` : CRUD profils mapping

## Nouveautés v0.7.0

* **Grille nationale Togo** : Génération automatique d'une grille couvrant tout le Togo avec des mailles carrées de ~2 km²
* **Seed multi-villes** : Données fictives réalistes réparties dans plusieurs villes
* **Export GeoJSON** : Bouton dans l'UI pour télécharger la géométrie d'une maille
* **Endpoint `/coverage/mailles`** : FeatureCollection 4326 avec métadonnées
* **Coloration conditionnelle** : Seules les mailles contenant des données sont colorées

## Prérequis
- Docker + Docker Compose
- Rust (local facultatif). Les images Docker utilisent Rust 1.86 pour la compilation.
- Node.js 18+
- Python 3.11+

## Projections et données
- La base de données stocke les géométries en **EPSG:25231** (Lomé / UTM zone 31N), en mètres
- Les APIs renvoient les emprises (bbox) et GeoJSON en **EPSG:4326** pour l'UI
- Les données d'exemple (mailles/sondages) sont saisies en 4326 puis transformées en 25231 côté ETL
- La grille nationale est générée en 25231 avec des mailles carrées d'aire ~2 000 000 m² (côté ~1414.21 m)

## Démarrage rapide

### 1. Configuration initiale
Assurez-vous que le fichier `.env` existe à la racine du projet. Vous pouvez copier `.env.example` vers `.env` puis ajuster si besoin.

### 2. Démarrage des services
```bash
docker compose up -d
```

### 3. Vérification de la santé
- DB: `127.0.0.1:5432` (local seulement)
- API GEO: http://127.0.0.1:8001/healthz
- API INFER: http://127.0.0.1:8002/healthz (profile `infer` requis)
- API OPTI: http://127.0.0.1:8003/healthz (profile `opti` requis)
- UI: http://127.0.0.1:8080/

### 4. Génération de la grille nationale (v0.7.0)

#### Option A : Workflow complet (recommandé)
```bash
# 1. Appliquer la migration pour créer la table country_tg
docker compose exec db psql -U atlas -d atlas -f /docker-entrypoint-initdb.d/007_grid_v0.7.0.sql

# 2. Charger le polygone du Togo
docker compose run --rm etl etl load-country

# 3. Générer la grille nationale (~2 km² par maille)
docker compose run --rm etl etl make-grid

# 4. Charger les données de sondages multi-villes
docker compose run --rm etl etl load-sample-extended
```

#### Option B : Données de démonstration simple (ancien workflow)
```bash
docker compose run --rm etl etl load-sample
```
(répétez pour réensemencer, l'ETL tronque sondages/essais et upsert les mailles)

## Workflow de build incrémental (Docker)
- **Cycle quotidien**: utilisez `docker compose up -d`. Cela ne reconstruit pas tant que les sources n’ont pas changé.
- **Quand vous changez le code d’un service**:
  ```bash
  docker compose build api-geo && docker compose up -d api-geo
  # ou remplacez api-geo par api-infer / api-opti / ui selon le service modifié
  ```
- **Évitez** `--build` sauf en cas de chantier majeur; cela force un rebuild de toutes les images.
- Les Dockerfiles Rust utilisent des caches BuildKit (`/usr/local/cargo/registry` et `/app/target`) pour accélérer les recompilations.
- L’UI utilise `npm ci` déterministe et est mise en cache; `node_modules` est exclu via `.dockerignore`.

## Migrations
Les migrations SQL se trouvent dans `migrations/`. Le conteneur `db` exécute `init.sql` au démarrage.

Pour rejouer manuellement la migration principale:
```bash
make db-migrate
```

## Données de démonstration (seed)
Pour (ré)insérer des données de démonstration:
```bash
make seed
```
Cela invoque la CLI `etl` pour insérer quelques `sondages`, `essais` et `mailles` stubs.

## Développement

### API endpoints

#### Endpoints communs (toutes les APIs)
- `GET /healthz` → `{status:"ok"}`
- `GET /version` → hash git + date de build
- `POST /echo` → renvoi du JSON

#### api-geo (port 8001)
- `GET /coverage/mailles` → FeatureCollection (4326) de toutes les mailles avec métadonnées (`code`, `has_data`, `n_sondages`, `n_essais`)
- `GET /grid/{code}` → Détails d'une maille : `bbox` (4326), `stats` et `summary` (comptages sondages/essais par type)
- `GET /grid/{code}/shape` → GeoJSON Feature (4326) de la géométrie de la maille
- `POST /grid/recompute/{code}` → Calcule un IDW (p=2) de `SPT_N` au centroïde de la maille (en 25231), met à jour `mailles.stats` et retourne la même structure que `GET /grid/{code}`

#### api-infer (port 8002)
- `POST /predict` (renvoie 501 si `MODEL_PATH` absent)

#### api-opti (port 8003)
- `POST /pareto`

## Qualité
- Formatage et lint:
```bash
make fmt
make lint
```

## Commandes ETL

L'ETL propose plusieurs commandes via `docker compose run --rm etl etl <commande>` :

### `migrate`
Exécute le script de migration `init.sql` dans la base de données.

```bash
docker compose run --rm etl etl migrate
```

### `load-country` (v0.7.0)
Charge le polygone du Togo depuis un fichier GeoJSON dans la table `country_tg`.

```bash
docker compose run --rm etl etl load-country
# Par défaut lit /data/togo.geojson
# Option : --geojson-path /chemin/custom.geojson
```

### `make-grid` (v0.7.0)
Génère une grille nationale avec des mailles carrées d'aire cible spécifiée (défaut: 2 km²).

```bash
docker compose run --rm etl etl make-grid
# Options :
#   --cell-m2 2000000    # Aire cible par maille en m²
#   --clear-existing     # Nettoyer les mailles existantes (défaut: true)
```

**Notes** :
- Nécessite que le polygone du Togo soit déjà chargé (via `load-country`)
- Calcule automatiquement le côté du carré : côté = √aire (ex: √2000000 ≈ 1414.21 m)
- Clippe chaque cellule au polygone du Togo (pas de débordement)
- Génère des codes `TG-0001`, `TG-0002`, etc.

### `load-sample`
Charge des données de démonstration simples : 5 mailles, 12 sondages, ~30 essais autour de Lomé.

```bash
docker compose run --rm etl etl load-sample
```

### `load-sample-extended` (v0.7.0)
Génère des sondages et essais fictifs répartis dans plusieurs villes (Lomé, Sokodé, Kara, Dapaong) avec des distributions logiques.

```bash
docker compose run --rm etl etl load-sample-extended
# Option : --seed 42  # Graine aléatoire pour reproductibilité
```

**Caractéristiques** :
- Répartition multi-villes avec rayons et densités variables
- Valeurs SPT_N (5-50) et qc (0.5-15 MPa) avec distributions gaussiennes
- Corrélation légère entre SPT_N et qc
- Profondeurs réalistes (1-20 m, distribution triangulaire centrée sur 8 m)
- Biais géographiques (ex: sols plus mous à Lomé littoral)

## Tests rapides
Après démarrage et seed, testez:
```bash
# Obtenir la liste des mailles avec métadonnées
curl http://127.0.0.1:8001/coverage/mailles | jq

# Détails d'une maille spécifique
curl http://127.0.0.1:8001/grid/TG-0001 | jq

# Récupérer la géométrie d'une maille
curl http://127.0.0.1:8001/grid/TG-0001/shape | jq

# Recalculer l'IDW pour une maille
curl -X POST http://127.0.0.1:8001/grid/recompute/TG-0001 | jq
```

## Interface utilisateur (UI)

L'UI (http://127.0.0.1:8080) offre :
- **Carte interactive** avec Leaflet affichant la grille nationale du Togo
- **Coloration conditionnelle** : mailles avec données en rouge semi-transparent, mailles vides en gris transparent
- **Clic sur une maille** : renseigne automatiquement le code et affiche les détails
- **Boutons** :
  - `GET /grid/{code}` : Affiche les statistiques et bbox de la maille
  - `POST /recompute/{code}` : Recalcule l'IDW pour la maille
  - `GET /shape` : Affiche la géométrie de la maille sur la carte
  - `Export GeoJSON` : Télécharge la géométrie au format GeoJSON
  - `Zoom Togo` : Recentre la carte sur l'étendue de la grille

## Notes
- Tous les ports publiés sont bindés à `127.0.0.1` uniquement
- `ui` est servie par Nginx sur le port 80 du conteneur (publié sur 127.0.0.1:8080)
- `etl` s'exécute à la demande via `docker compose run --rm etl etl ...`
- La grille nationale peut contenir 800-1200 mailles selon la précision du polygone source
