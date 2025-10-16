# Guide Utilisateur ATLAS_GEOTECHNIQUE

---

## 📋 Table des matières

1. [Introduction et Vue d'ensemble](#1-introduction-et-vue-densemble)
2. [Prérequis](#2-prérequis)
3. [Installation et Configuration](#3-installation-et-configuration)
4. [Démarrage du système](#4-démarrage-du-système)
5. [Utilisation de l'interface web](#5-utilisation-de-linterface-web)
6. [Endpoints API](#6-endpoints-api)
7. [Gestion des services](#7-gestion-des-services)
8. [Dépannage](#8-dépannage)
9. [Architecture technique](#9-architecture-technique)

---

## 1. Introduction et Vue d'ensemble

### Qu'est-ce qu'ATLAS_GEOTECHNIQUE ?

**ATLAS_GEOTECHNIQUE** est un système d'information géotechnique pour le Togo qui permet de :
- 📊 Stocker et gérer des données de sondages géotechniques
- 🗺️ Visualiser la couverture géographique sur une carte interactive
- 🧮 Calculer des interpolations spatiales (IDW) sur les essais SPT_N
- 📤 Exporter des données au format GeoJSON (EPSG:4326)

### Architecture du système

Le projet est organisé en **monorepo** avec 4 composants principaux :

#### 1. Base de données PostGIS
- **Image** : `postgis/postgis:16-3.4`
- **Port** : `127.0.0.1:5432`
- **SRID interne** : EPSG:25231 (UTM 31N pour le Togo)
- **SRID export** : EPSG:4326 (WGS84 lat/lon)

**Tables principales** :
- `mailles` : grille géographique du Togo (polygones)
- `sondages` : points de sondage géolocalisés
- `essais` : mesures géotechniques (SPT_N, qc, etc.)

#### 2. API Géo (Rust + Axum)
- **Port** : `127.0.0.1:8001`
- **Langage** : Rust (async avec Tokio)
- **Framework** : Axum + SQLx
- **Fonctionnalités** :
  - Endpoints REST pour interroger les mailles
  - Calcul IDW (Inverse Distance Weighting, p=2)
  - Export GeoJSON (Features et FeatureCollections)
  - CORS permissif pour développement local

#### 3. Interface utilisateur (Vite + TypeScript + Leaflet)
- **Port** : `127.0.0.1:8080`
- **Stack** : Vite + TypeScript + Leaflet.js
- **Fonctionnalités** :
  - Carte interactive avec fond OpenStreetMap
  - Affichage de toutes les mailles du Togo
  - Coloration des mailles contenant des sondages
  - Interactions : clic, zoom, affichage détails
  - Feedback visuel (spinner, badges OK/Error)

#### 4. ETL (Python + Typer)
- **Langage** : Python 3.11
- **CLI** : Typer + psycopg2
- **Commandes** :
  - `etl load-sample` : charge 5 mailles + 12 sondages + 36 essais
  - `etl migrate` : applique les migrations SQL

---

## 2. Prérequis

### Logiciels nécessaires

#### Windows
- **Docker Desktop** (version 4.x ou supérieure)
  - Télécharger : https://www.docker.com/products/docker-desktop
  - Inclut Docker Compose v2
- **Git for Windows**
  - Télécharger : https://git-scm.com/download/win
- **PowerShell** (inclus dans Windows 10/11)

#### Linux
- **Docker Engine** + **Docker Compose Plugin**
  ```bash
  # Ubuntu/Debian
  sudo apt-get update
  sudo apt-get install docker.io docker-compose-plugin
  ```
- **Git**
  ```bash
  sudo apt-get install git
  ```

#### macOS
- **Docker Desktop for Mac**
  - Télécharger : https://www.docker.com/products/docker-desktop
- **Git** (inclus avec Xcode Command Line Tools)
  ```bash
  xcode-select --install
  ```

### Vérification des installations

Ouvrez un terminal (PowerShell sur Windows) et exécutez :

```powershell
# Vérifier Docker
docker --version
# Attendu : Docker version 24.x ou supérieur

# Vérifier Docker Compose
docker compose version
# Attendu : Docker Compose version v2.x ou supérieur

# Vérifier Git
git --version
# Attendu : git version 2.x ou supérieur
```

### Configuration système minimale

- **RAM** : 4 GB minimum (8 GB recommandé)
- **Disque** : 5 GB d'espace libre
- **Réseau** : Connexion internet pour télécharger les images Docker

---

## 3. Installation et Configuration

### Étape 1 : Cloner le dépôt

```powershell
# Cloner depuis GitHub
git clone https://github.com/prodeka/ATLAS_GEOTECHNIQUE.git

# Naviguer dans le dossier
cd ATLAS_GEOTECHNIQUE/atlas
```

### Étape 2 : Configuration des variables d'environnement

Le projet utilise un fichier `.env` pour la configuration. Un exemple est fourni.

#### Créer le fichier .env

```powershell
# Copier l'exemple
cp .env.example .env
```

#### Contenu du fichier .env

Ouvrez `.env` avec un éditeur de texte et vérifiez/modifiez les valeurs :

```env
# === Base de données PostgreSQL/PostGIS ===
POSTGRES_USER=atlas
POSTGRES_PASSWORD=atlas_secret_2024
POSTGRES_DB=atlas_geo

# URL de connexion (utilisée par api-geo et etl)
DATABASE_URL=postgresql://atlas:atlas_secret_2024@db:5432/atlas_geo

# === Logs ===
RUST_LOG=info

# === URLs des API pour l'interface web (build-time) ===
VITE_API_GEO=http://127.0.0.1:8001
VITE_API_INFER=http://127.0.0.1:8002
VITE_API_OPTI=http://127.0.0.1:8003
```

> ⚠️ **Sécurité** : En production, changez `POSTGRES_PASSWORD` et ne versionnez PAS le fichier `.env` dans Git.

### Étape 3 : Construire les images Docker

Cette étape peut prendre 5-15 minutes selon votre connexion internet.

```powershell
# Construire tous les services principaux
docker compose build db api-geo ui etl
```

**Sortie attendue** :
```
[+] Building 245.3s (52/52) FINISHED
 => [api-geo internal] load build definition from Dockerfile
 => [ui internal] load build definition from Dockerfile
 ...
 => => naming to docker.io/library/atlas-api-geo
 => => naming to docker.io/library/atlas-ui
```

> 💡 **Note** : Les services `api-infer` et `api-opti` sont derrière des profils Docker Compose et ne seront pas construits par défaut.

---

## 4. Démarrage du système

### Vue d'ensemble du processus

Le démarrage se fait en 4 étapes :
1. Démarrer la base de données PostGIS
2. Charger les données d'exemple (seed)
3. Démarrer l'API Géo
4. Démarrer l'interface utilisateur

### Étape 1 : Démarrer la base de données

```powershell
docker compose up -d db
```

**Vérifier que la DB est prête** :
```powershell
docker compose ps
```

**Sortie attendue** :
```
NAME        IMAGE                    STATUS                   PORTS
atlas-db    postgis/postgis:16-3.4   Up 15 seconds (healthy)  127.0.0.1:5432->5432/tcp
```

Attendez que le statut soit `healthy` (environ 10-20 secondes).

### Étape 2 : Charger les données d'exemple

```powershell
docker compose run --rm etl etl load-sample
```

**Sortie attendue** :
```
Données d'exemple chargées (EPSG:25231).
```

**Données insérées** :
- **5 mailles** : TG-001 à TG-005 (région de Lomé)
- **12 sondages** : S1 à S12
- **36+ essais** : SPT_N et qc à différentes profondeurs

### Étape 3 : Démarrer l'API Géo

```powershell
docker compose up -d api-geo
```

**Vérifier la santé** :
```powershell
Invoke-RestMethod http://127.0.0.1:8001/healthz
```

**Réponse attendue** :
```json
{"status": "ok"}
```

### Étape 4 : Démarrer l'interface utilisateur

```powershell
docker compose up -d ui
```

**Accéder à l'interface** : http://127.0.0.1:8080

### Démarrage rapide (tout en une commande)

```powershell
# Démarrer tous les services
docker compose up -d db api-geo ui

# Attendre que la DB soit prête
Start-Sleep -Seconds 15

# Charger les données
docker compose run --rm etl etl load-sample
```

---

## 5. Utilisation de l'interface web

### Vue d'ensemble de l'interface

L'interface (http://127.0.0.1:8080) comprend :

#### Carte Leaflet (zone principale)
- Fond : OpenStreetMap
- Centre : Togo (8.6195°N, 0.8248°E)
- Zoom initial : 7

#### Panneau latéral
- **Champ "Code Maille"** : saisie/affichage du code
- **Boutons d'action** :
  - `GET /grid/{code}` : infos maille
  - `POST /grid/recompute/{code}` : calcul IDW
  - `GET /grid/{code}/shape` : polygone exact
  - `Zoom Togo` : vue d'ensemble
- **Zone de statut** : spinner, badges OK/Error
- **Zone d'info** : résumé de la maille
- **Sortie JSON** : réponse brute
- **Légende** : couleurs des mailles

### Fonctionnalité 1 : Visualiser la couverture

Au chargement, l'UI appelle `GET /coverage/mailles` et dessine toutes les mailles.

**Rendu** :
- **Mailles avec sondages** : rouge (#ef4444, opacité 0.45), bordure rouge foncé
- **Mailles sans sondages** : transparentes, bordure grise

### Fonctionnalité 2 : Sélectionner une maille

**Méthode 1** : Cliquez sur une maille colorée → le code est renseigné et `GET /grid/{code}` est appelé.

**Méthode 2** : Saisissez un code (ex: `TG-002`) et cliquez sur `GET /grid/{code}`.

**Informations affichées** :
- Code, BBox (EPSG:4326)
- Nombre de sondages/essais
- Répartition par type
- Valeur IDW (si calculée)

**Exemple JSON** :
```json
{
  "code": "TG-001",
  "bbox": [1.20000, 6.12000, 1.22000, 6.14000],
  "stats": {
    "samples": 3,
    "idw": {"type": "SPT_N", "p": 2, "value": 11.45}
  },
  "summary": {
    "n_sondages": 3,
    "n_essais": 9,
    "by_type": {"SPT_N": 6, "qc": 3}
  }
}
```

### Fonctionnalité 3 : Recalculer l'IDW

L'IDW (Inverse Distance Weighting) interpole une valeur au centroïde en pondérant les essais SPT_N par l'inverse de leur distance au carré.

**Étapes** :
1. Saisissez un code (ex: `TG-003`)
2. Cliquez sur `POST /grid/recompute/{code}`
3. L'API calcule l'IDW et met à jour `stats.idw`

**Conditions** :
- Minimum 3 échantillons (sinon erreur 422)
- Si un essai est au centroïde (distance < 1e-9), sa valeur est retournée directement

**Erreurs possibles** :
- **422** : `{"error": "insufficient samples"}`
- **404** : `{"error": "maille introuvable"}`

### Fonctionnalité 4 : Afficher le polygone

1. Saisissez un code (ex: `TG-004`)
2. Cliquez sur `GET /grid/{code}/shape`
3. Un polygone bleu est dessiné et la carte zoome dessus

**Réponse GeoJSON** :
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[1.24, 6.12], [1.26, 6.12], [1.26, 6.14], [1.24, 6.14], [1.24, 6.12]]]
  },
  "properties": {"code": "TG-004"}
}
```

### Fonctionnalité 5 : Zoom Togo

Cliquez sur `Zoom Togo` pour recentrer sur l'emprise de toutes les mailles.

### Feedback visuel

- **Spinner** : ⟳ Loading… (pendant les requêtes)
- **Badge vert "OK"** : succès (200)
- **Badge rouge "Error"** : échec (4xx/5xx)
- **Bannière jaune** : si `VITE_API_GEO` manquant

---

## 6. Endpoints API

### API Géo (port 8001)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/healthz` | Vérification de santé |
| GET | `/version` | Version de l'API |
| GET | `/grid/{code}` | Infos maille (bbox, stats, summary) |
| POST | `/grid/recompute/{code}` | Recalculer l'IDW |
| GET | `/grid/{code}/shape` | GeoJSON Feature (Polygon) |
| GET | `/coverage/mailles` | Toutes les mailles (FeatureCollection) |

### Exemples PowerShell

**Récupérer une maille** :
```powershell
Invoke-RestMethod http://127.0.0.1:8001/grid/TG-001 | ConvertTo-Json -Depth 6
```

**Recomputer l'IDW** :
```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8001/grid/recompute/TG-001 | ConvertTo-Json -Depth 6
```

**Shape GeoJSON** :
```powershell
Invoke-RestMethod http://127.0.0.1:8001/grid/TG-001/shape | ConvertTo-Json -Depth 6
```

**Couverture complète** :
```powershell
Invoke-RestMethod http://127.0.0.1:8001/coverage/mailles | ConvertTo-Json -Depth 6
```

---

## 7. Gestion des services

### Voir l'état des conteneurs
```powershell
docker compose ps
```

### Arrêter tous les services
```powershell
docker compose down
```

### Redémarrer un service
```powershell
docker compose restart api-geo
```

### Voir les logs
```powershell
# Logs en temps réel
docker compose logs -f api-geo

# Dernières 50 lignes
docker compose logs --tail=50 api-geo
```

### Arrêter et supprimer les volumes
```powershell
# ⚠️ Supprime aussi les données de la DB
docker compose down -v
```

### Script de redémarrage automatique

Un script PowerShell est fourni dans `scripts/restart-api-geo.ps1` :

```powershell
# Vérifier la santé et redémarrer si nécessaire
.\scripts\restart-api-geo.ps1
```

**Contenu** :
```powershell
try {
  $resp = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/healthz -TimeoutSec 5
  if ($resp.StatusCode -ne 200) {
    Write-Host "api-geo unhealthy, restarting..."
    docker compose restart api-geo
  } else {
    Write-Host "api-geo healthy"
  }
}
catch {
  Write-Host "api-geo unreachable, restarting..."
  docker compose restart api-geo
}
```

---

## 8. Dépannage

### Problème : La DB ne démarre pas

**Symptôme** : `docker compose ps` montre `atlas-db` avec statut `unhealthy` ou `restarting`.

**Solutions** :
1. Vérifier les logs :
   ```powershell
   docker compose logs db
   ```
2. Vérifier que le port 5432 n'est pas déjà utilisé :
   ```powershell
   netstat -ano | findstr :5432
   ```
3. Supprimer les volumes et redémarrer :
   ```powershell
   docker compose down -v
   docker compose up -d db
   ```

### Problème : L'API ne se connecte pas à la DB

**Symptôme** : Logs api-geo montrent `DB indisponible` ou `connection refused`.

**Solutions** :
1. Vérifier que la DB est healthy :
   ```powershell
   docker compose ps db
   ```
2. Vérifier `DATABASE_URL` dans `.env` :
   ```
   DATABASE_URL=postgresql://atlas:atlas_secret_2024@db:5432/atlas_geo
   ```
3. Redémarrer api-geo :
   ```powershell
   docker compose restart api-geo
   ```

### Problème : L'UI affiche "API base URL not configured"

**Symptôme** : Bannière jaune au chargement de http://127.0.0.1:8080.

**Solutions** :
1. Vérifier `.env` contient `VITE_API_GEO=http://127.0.0.1:8001`
2. Rebuilder l'UI (les variables Vite sont injectées au build) :
   ```powershell
   docker compose build ui
   docker compose up -d ui
   ```
3. Alternative : override runtime dans `ui/index.html` (décommenter) :
   ```html
   <script>
     window.__API_GEO__ = "http://127.0.0.1:8001";
   </script>
   ```

### Problème : Erreur 422 "insufficient samples"

**Symptôme** : Lors du recompute IDW.

**Cause** : Moins de 3 essais SPT_N dans la maille.

**Solutions** :
1. Vérifier le nombre d'essais :
   ```powershell
   Invoke-RestMethod http://127.0.0.1:8001/grid/TG-001
   ```
2. Charger plus de données via ETL ou SQL direct.

### Problème : docker compose build échoue

**Symptôme** : Erreur `service "ui" depends on undefined service`.

**Cause** : Dépendances sur services avec profils.

**Solution** : Vérifier `docker-compose.yml`, section `ui.depends_on` ne doit contenir que `api-geo`.

### Problème : Port déjà utilisé

**Symptôme** : `Error starting userland proxy: listen tcp 127.0.0.1:8001: bind: address already in use`.

**Solutions** :
1. Identifier le processus :
   ```powershell
   netstat -ano | findstr :8001
   ```
2. Tuer le processus ou changer le port dans `docker-compose.yml` :
   ```yaml
   ports:
     - "127.0.0.1:8011:8000"  # Utiliser 8011 au lieu de 8001
   ```

---

## 9. Architecture technique

### Schéma de l'architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Navigateur Web                        │
│                  http://127.0.0.1:8080                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         │ HTTP/JSON
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      UI (Nginx)                          │
│           Vite + TypeScript + Leaflet.js                 │
│                    Port 8080                             │
└────────────────────────┬────────────────────────────────┘
                         │
                         │ REST API
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  API Géo (Rust/Axum)                     │
│              Endpoints REST + IDW + GeoJSON              │
│                    Port 8001                             │
└────────────────────────┬────────────────────────────────┘
                         │
                         │ SQLx (async)
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Base de données PostGIS                     │
│           PostgreSQL 16 + PostGIS 3.4                    │
│                    Port 5432                             │
│                                                           │
│  Tables: mailles, sondages, essais                       │
│  SRID interne: EPSG:25231 (UTM 31N)                      │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │
                         │ psycopg2
                         │
┌─────────────────────────────────────────────────────────┐
│                   ETL (Python/Typer)                     │
│            Chargement données + migrations               │
│                  (run --rm etl)                          │
└─────────────────────────────────────────────────────────┘
```

### Stack technique détaillée

#### Base de données
- **PostgreSQL** : 16.x
- **PostGIS** : 3.4
- **Extensions** : postgis, postgis_topology
- **SRID** :
  - Interne : EPSG:25231 (UTM Zone 31N, WGS84)
  - Export : EPSG:4326 (WGS84 lat/lon)

#### API Géo
- **Langage** : Rust 1.86
- **Runtime** : Tokio (async)
- **Framework web** : Axum 0.7
- **Base de données** : SQLx 0.8 (async PostgreSQL driver)
- **CORS** : tower-http CorsLayer (permissif en dev)
- **Logs** : tracing + tracing-subscriber
- **Santé** : `/healthz` endpoint

**Dépendances clés** (`Cargo.toml`) :
```toml
axum = "0.7"
sqlx = { version = "0.8", features = ["postgres", "runtime-tokio", "uuid"] }
tokio = { version = "1", features = ["full"] }
tower-http = { version = "0.5", features = ["cors", "trace"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4", "serde"] }
```

#### Interface utilisateur
- **Build tool** : Vite 5.x
- **Langage** : TypeScript 5.x
- **Cartographie** : Leaflet 1.9.4
- **Runtime** : Nginx 1.27-alpine
- **Variables d'environnement** : injectées au build via `import.meta.env`

**Dépendances** (`package.json`) :
```json
{
  "dependencies": {
    "leaflet": "^1.9.4"
  },
  "devDependencies": {
    "typescript": "^5.6",
    "vite": "^5.4"
  }
}
```

#### ETL
- **Langage** : Python 3.11
- **CLI** : Typer 0.12
- **DB driver** : psycopg2-binary 2.9
- **Env** : python-dotenv 1.0

**Dépendances** (`pyproject.toml`) :
```toml
[tool.poetry.dependencies]
python = "^3.11"
typer = "^0.12"
psycopg2-binary = "^2.9"
python-dotenv = "^1.0"
```

### Modèle de données

#### Table `mailles`
```sql
CREATE TABLE mailles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    geom GEOMETRY(Polygon, 25231) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    stats JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_mailles_geom ON mailles USING GIST(geom);
CREATE INDEX idx_mailles_code ON mailles(code);
```

**Champ `stats`** (JSONB) :
```json
{
  "samples": 3,
  "idw": {
    "type": "SPT_N",
    "p": 2,
    "value": 12.34
  }
}
```

#### Table `sondages`
```sql
CREATE TABLE sondages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    geom GEOMETRY(Point, 25231) NOT NULL,
    date_sondage DATE,
    source VARCHAR(100),
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sondages_geom ON sondages USING GIST(geom);
```

#### Table `essais`
```sql
CREATE TABLE essais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sondage_id UUID REFERENCES sondages(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,  -- 'SPT_N', 'qc', etc.
    depth_m NUMERIC(10,2),
    value NUMERIC(15,6),
    unit VARCHAR(50),
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_essais_sondage ON essais(sondage_id);
CREATE INDEX idx_essais_type ON essais(type);
```

### Flux de données

#### 1. Chargement initial (seed)
```
ETL (Python)
  → INSERT mailles (WKT 4326 → ST_Transform(..., 25231))
  → INSERT sondages (POINT 4326 → ST_Transform(..., 25231))
  → INSERT essais (SPT_N, qc, depth, value)
```

#### 2. Requête GET /grid/{code}
```
UI → API Géo
  → SELECT id, stats, ST_Transform(ST_Envelope(geom), 4326) FROM mailles WHERE code=$1
  → COUNT sondages/essais via ST_Within
  → Retourne JSON { code, bbox, stats, summary }
```

#### 3. Calcul IDW
```
UI → POST /grid/recompute/{code} → API Géo
  → SELECT ST_X(s.geom), ST_Y(s.geom), e.value::double precision
     FROM essais e JOIN sondages s WHERE e.type='SPT_N' AND ST_Within(s.geom, maille)
  → Calcul IDW en Rust (p=2, epsilon=1e-9)
  → UPDATE mailles SET stats = stats || '{"idw": {...}}'::jsonb
  → Retourne JSON avec stats.idw.value
```

#### 4. Export GeoJSON
```
UI → GET /coverage/mailles → API Géo
  → SELECT code, ST_AsGeoJSON(ST_Transform(geom, 4326)), COUNT(sondages), COUNT(essais)
     FROM mailles LEFT JOIN sondages LEFT JOIN essais GROUP BY code
  → Parse JSON geometry
  → Retourne FeatureCollection { features: [...] }
```

### Sécurité et bonnes pratiques

#### En développement (actuel)
- CORS permissif (`allow_origin(Any)`)
- `.env` versionné (contient secrets)
- Ports exposés sur `127.0.0.1` (localhost uniquement)
- Pas d'authentification

#### En production (recommandations)
- **CORS** : restreindre à votre domaine
  ```rust
  .allow_origin("https://votre-domaine.com".parse::<HeaderValue>().unwrap())
  ```
- **Secrets** : utiliser Docker secrets ou variables d'environnement sécurisées
- **HTTPS** : reverse proxy (Nginx/Traefik) avec certificats SSL
- **Authentification** : JWT ou OAuth2 sur les endpoints sensibles
- **Rate limiting** : limiter les requêtes par IP
- **Firewall** : ne pas exposer les ports DB/API directement

---

## 10. Commandes de référence rapide

### Démarrage complet
```powershell
cd ATLAS_GEOTECHNIQUE/atlas
docker compose up -d db api-geo ui
Start-Sleep -Seconds 15
docker compose run --rm etl etl load-sample
```

### Tests API
```powershell
# Santé
Invoke-RestMethod http://127.0.0.1:8001/healthz

# Maille
Invoke-RestMethod http://127.0.0.1:8001/grid/TG-001 | ConvertTo-Json -Depth 6

# Recompute
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8001/grid/recompute/TG-001 | ConvertTo-Json -Depth 6

# Shape
Invoke-RestMethod http://127.0.0.1:8001/grid/TG-001/shape | ConvertTo-Json -Depth 6

# Coverage
Invoke-RestMethod http://127.0.0.1:8001/coverage/mailles | ConvertTo-Json -Depth 6
```

### Gestion Docker
```powershell
# État
docker compose ps

# Logs
docker compose logs -f api-geo

# Redémarrer
docker compose restart api-geo

# Arrêter
docker compose down

# Tout supprimer (⚠️ données incluses)
docker compose down -v
```

### Rebuild après modifications
```powershell
# API Géo (Rust)
docker compose build api-geo
docker compose up -d api-geo

# UI (TypeScript)
docker compose build ui
docker compose up -d ui

# ETL (Python)
docker compose build etl
```

---

## 11. Ressources et liens utiles

### Documentation officielle
- **Docker** : https://docs.docker.com/
- **PostgreSQL** : https://www.postgresql.org/docs/
- **PostGIS** : https://postgis.net/documentation/
- **Rust** : https://www.rust-lang.org/learn
- **Axum** : https://docs.rs/axum/
- **Leaflet** : https://leafletjs.com/reference.html
- **Vite** : https://vitejs.dev/guide/

### Dépôt GitHub
- **Projet** : https://github.com/prodeka/ATLAS_GEOTECHNIQUE

### Support
Pour toute question ou problème :
1. Consultez la section [Dépannage](#8-dépannage)
2. Vérifiez les logs : `docker compose logs`
3. Ouvrez une issue sur GitHub

---

**Version du guide** : 1.0  
**Dernière mise à jour** : Octobre 2025  
**Auteur** : TABE DJATO Serge (serge.tdjato@gmail.com)
