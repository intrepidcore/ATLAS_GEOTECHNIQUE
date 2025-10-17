# Guide des commandes ETL v0.7.0

## ✅ Corrections appliquées

### Problème résolu
- **Erreur Typer/Click** : "Secondary flag is not valid for non-boolean flag"
- **Cause** : Options non-booléennes déclarées avec syntaxe `--x/--no-x`
- **Solution** : 
  - Pin versions stables : `typer==0.9.0`, `click==8.1.7`
  - Correction signatures : booléens avec `--x/--no-x`, autres avec `-x, --xxx`

### Changements
- ✅ Versions Typer/Click verrouillées dans `pyproject.toml`
- ✅ Toutes les signatures d'options corrigées
- ✅ Commandes renommées avec tirets : `load-country`, `make-grid`, `load-sample-extended`
- ✅ Paramètres ajoutés : `--truncate`, `--to-srid`, `--min-area-m2`, `--n-min`, `--n-max`
- ✅ Aucun hardcode : tout est paramétrable via CLI

---

## 📋 Commandes disponibles

### 1. `load-country` - Charger le polygone du Togo

Charge le contour géographique du Togo depuis un fichier GeoJSON dans la table `country_tg`.

```powershell
docker compose run --rm etl etl load-country [OPTIONS]
```

**Options :**
- `-g, --geojson PATH` : Chemin du fichier GeoJSON (défaut: `/data/togo.geojson`)
- `--truncate / --no-truncate` : Vider la table avant import (défaut: `--no-truncate`)

**Exemples :**
```powershell
# Charger avec purge
docker compose run --rm etl etl load-country -g /data/togo.geojson --truncate

# Charger sans purge (ajoute si pas déjà présent)
docker compose run --rm etl etl load-country --no-truncate
```

**Prérequis :**
- Fichier `data/togo.geojson` présent (EPSG:4326)
- Table `country_tg` créée (migration `007_grid_v0.7.0.sql`)

---

### 2. `make-grid` - Générer la grille nationale

Génère une grille de mailles carrées couvrant tout le Togo via `ST_SquareGrid` et clip au polygone.

```powershell
docker compose run --rm etl etl make-grid [OPTIONS]
```

**Options :**
- `--cell-area-m2 FLOAT` : Aire cible par maille en m² (défaut: `2000000` = 2 km²)
- `--to-srid INTEGER` : SRID de travail en mètres (défaut: `25231` pour Togo UTM 31N)
- `--min-area-m2 FLOAT` : Seuil minimal pour filtrer les reliquats (défaut: `1.0` m²)
- `--truncate / --no-truncate` : Vider la table `mailles` avant génération (défaut: `--no-truncate`)

**Exemples :**
```powershell
# Grille standard ~2 km² avec purge
docker compose run --rm etl etl make-grid --cell-area-m2 2000000 --to-srid 25231 --truncate

# Grille plus fine ~1 km² sans purge
docker compose run --rm etl etl make-grid --cell-area-m2 1000000 --no-truncate

# Grille grossière ~5 km²
docker compose run --rm etl etl make-grid --cell-area-m2 5000000 --truncate
```

**Prérequis :**
- Polygone du Togo chargé dans `country_tg` (via `load-country`)

**Résultat :**
- Mailles insérées dans la table `mailles` avec codes `TG-0001`, `TG-0002`, etc.
- Géométries en EPSG:25231 (UTM 31N)
- Champ `stats` initialisé à `{"samples": 0}`

---

### 3. `load-sample-extended` - Charger les données multi-villes

Génère des sondages et essais fictifs répartis dans 4 villes du Togo (Lomé, Sokodé, Kara, Dapaong) avec distributions réalistes.

```powershell
docker compose run --rm etl etl load-sample-extended [OPTIONS]
```

**Options :**
- `-s, --seed INTEGER` : Graine aléatoire pour reproductibilité (défaut: `42`)
- `--n-min INTEGER` : Nombre minimum de sondages à générer (défaut: `19`)
- `--n-max INTEGER` : Nombre maximum de sondages à générer (défaut: `31`)
- `--truncate / --no-truncate` : Vider les tables `sondages`/`essais` avant génération (défaut: `--no-truncate`)

**Exemples :**
```powershell
# Seed standard reproductible avec purge
docker compose run --rm etl etl load-sample-extended --seed 42 --n-min 19 --n-max 31 --truncate

# Seed différent (plus de données)
docker compose run --rm etl etl load-sample-extended --seed 123 --n-min 30 --n-max 50 --truncate

# Ajouter des données sans purge
docker compose run --rm etl etl load-sample-extended --seed 999 --no-truncate
```

**Caractéristiques du seed :**
- **Lomé** : 8-12 sondages, rayon 3-6 km, SPT_N bias -2, qc bias -0.5
- **Sokodé** : 4-7 sondages, rayon 2-4 km, SPT_N bias 0, qc bias 0.0
- **Kara** : 4-7 sondages, rayon 2-4 km, SPT_N bias +2, qc bias +0.5
- **Dapaong** : 3-5 sondages, rayon 2-4 km, SPT_N bias +1, qc bias +0.2

**Distributions :**
- **SPT_N** : Gaussienne µ=18, σ=7, biaisée par ville
- **qc** : Gaussienne µ=4.0, σ=2.0, biaisée par ville
- **Profondeur** : Triangulaire (1-20m, mode=8m)
- **Types** : 60% SPT_N, 40% qc
- **Essais par sondage** : 2-4

**Résultat :**
- Sondages insérés dans `sondages` (géométries EPSG:25231)
- Essais insérés dans `essais` (liés aux sondages)
- Métadonnées : `{"city": "Lome", "index": 0}` dans `sondages.meta`

---

### 4. `load-sample` - Seed minimal (legacy)

Charge 5 mailles + 12 sondages + 36 essais autour de Lomé (version initiale, conservée pour compatibilité).

```powershell
docker compose run --rm etl etl load-sample
```

**Note :** Cette commande est obsolète. Utilisez `load-sample-extended` pour la v0.7.0.

---

### 5. `migrate` - Appliquer les migrations SQL

Exécute le script `init.sql` pour créer les tables de base.

```powershell
docker compose run --rm etl etl migrate
```

**Note :** Les migrations PostGIS sont généralement appliquées automatiquement au démarrage de la DB via `docker-entrypoint-initdb.d/`.

---

## 🚀 Workflow complet v0.7.0

### Méthode 1 : Script automatisé (recommandé)

```powershell
# Exécuter le script de setup complet
.\scripts\setup-v0.7.0.ps1
```

Ce script exécute automatiquement :
1. Rebuild ETL
2. Vérification des services
3. Application migration `007_grid_v0.7.0.sql`
4. Chargement polygone Togo
5. Génération grille nationale
6. Chargement données multi-villes
7. Vérification finale

### Méthode 2 : Commandes manuelles

```powershell
# 1. Rebuild ETL
docker compose build etl

# 2. Démarrer les services
docker compose up -d db api-geo

# 3. Attendre que la DB soit healthy
Start-Sleep -Seconds 15

# 4. Appliquer la migration
docker compose exec -T db psql -U atlas -d atlas_geo -f /docker-entrypoint-initdb.d/007_grid_v0.7.0.sql

# 5. Charger le polygone du Togo
docker compose run --rm etl etl load-country -g /data/togo.geojson --truncate

# 6. Générer la grille nationale (~2 km²)
docker compose run --rm etl etl make-grid --cell-area-m2 2000000 --to-srid 25231 --truncate

# 7. Charger les données multi-villes
docker compose run --rm etl etl load-sample-extended --seed 42 --n-min 19 --n-max 31 --truncate

# 8. Vérifier la couverture
Invoke-RestMethod http://127.0.0.1:8001/coverage/mailles | ConvertTo-Json -Depth 4

# 9. Démarrer l'UI
docker compose up -d ui

# 10. Ouvrir http://127.0.0.1:8080
```

---

## 🔍 Vérifications

### Vérifier le parsing des commandes

```powershell
# Aide générale
docker compose run --rm etl etl --help

# Aide par commande
docker compose run --rm etl etl load-country --help
docker compose run --rm etl etl make-grid --help
docker compose run --rm etl etl load-sample-extended --help
```

**Attendu :** Aucune erreur "Secondary flag is not valid"

### Vérifier les données chargées

```powershell
# Nombre de mailles
docker compose exec db psql -U atlas -d atlas_geo -c "SELECT COUNT(*) FROM mailles;"

# Nombre de sondages
docker compose exec db psql -U atlas -d atlas_geo -c "SELECT COUNT(*) FROM sondages;"

# Nombre d'essais
docker compose exec db psql -U atlas -d atlas_geo -c "SELECT COUNT(*) FROM essais;"

# Répartition par ville
docker compose exec db psql -U atlas -d atlas_geo -c "SELECT meta->>'city' AS ville, COUNT(*) FROM sondages GROUP BY ville;"
```

### Vérifier l'API

```powershell
# Santé
Invoke-RestMethod http://127.0.0.1:8001/healthz

# Coverage (nombre de mailles)
$cov = Invoke-RestMethod http://127.0.0.1:8001/coverage/mailles
$cov.features.Count

# Maille spécifique
Invoke-RestMethod http://127.0.0.1:8001/grid/TG-0001 | ConvertTo-Json -Depth 6
```

---

## 🐛 Dépannage

### Erreur "Secondary flag is not valid"

**Cause :** Versions Typer/Click incompatibles ou signatures incorrectes.

**Solution :**
```powershell
# Vérifier les versions dans le conteneur
docker compose run --rm etl pip list | Select-String -Pattern "typer|click"

# Attendu :
# typer    0.9.0
# click    8.1.7

# Si différent, rebuild
docker compose build etl --no-cache
```

### Erreur "Aucun polygone trouvé dans country_tg"

**Cause :** `load-country` pas exécuté ou migration non appliquée.

**Solution :**
```powershell
# Vérifier la table
docker compose exec db psql -U atlas -d atlas_geo -c "\d country_tg"

# Si table n'existe pas, appliquer migration
docker compose exec -T db psql -U atlas -d atlas_geo -f /docker-entrypoint-initdb.d/007_grid_v0.7.0.sql

# Charger le polygone
docker compose run --rm etl etl load-country --truncate
```

### Grille vide ou incomplète

**Cause :** Polygone Togo invalide ou paramètres incorrects.

**Solution :**
```powershell
# Vérifier le polygone
docker compose exec db psql -U atlas -d atlas_geo -c "SELECT name, ST_IsValid(geom), ST_Area(geom) FROM country_tg;"

# Régénérer avec logs
docker compose run --rm etl etl make-grid --cell-area-m2 2000000 --truncate
```

### Pas de sondages dans certaines mailles

**Cause :** Distribution aléatoire, certaines mailles peuvent être vides.

**Solution :** Normal. Seules les mailles avec `has_data=true` sont colorées dans l'UI.

---

## 📊 Statistiques attendues (seed standard)

Avec `--seed 42 --n-min 19 --n-max 31` :

- **Mailles** : ~800-1000 (dépend de la résolution de la grille)
- **Sondages** : 19-31 (répartis sur 4 villes)
- **Essais** : 38-124 (2-4 par sondage)
- **Mailles avec données** : ~10-20 (celles contenant au moins 1 sondage)

---

## 🔗 Liens utiles

- **Cahier des charges** : `docs/cahier_des_charges_atlas_geotechnique_v_0_x_→_v_1.md`
- **Guide utilisateur** : `docs/GUIDE_UTILISATEUR.md`
- **Quickstart v0.7.0** : `QUICKSTART_v0.7.0.md`
- **Troubleshooting** : `TROUBLESHOOTING_v0.7.0.md`

---

**Version** : 0.7.0  
**Date** : 2025-10-17  
**Auteur** : TABE DJATO Serge
