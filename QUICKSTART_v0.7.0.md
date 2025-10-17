# Guide de démarrage rapide v0.7.0

Ce guide vous permet de démarrer rapidement avec la version 0.7.0 et sa nouvelle grille nationale du Togo.

## Prérequis

- Docker et Docker Compose installés
- Fichier `.env` configuré (copier `.env.example` si nécessaire)

## Démarrage en 5 minutes

### 1. Démarrer les services

```bash
cd atlas
docker compose up -d
```

Attendez que tous les services soient "healthy" (environ 30-60 secondes).

### 2. Rebuild le conteneur ETL (IMPORTANT !)

```bash
docker compose build etl
```

**Pourquoi ?** Le code Python a été modifié pour ajouter les nouvelles commandes (`load-country`, `make-grid`, `load-sample-extended`). Sans rebuild, elles ne seront pas disponibles.

**Sortie attendue** : Build réussi avec message `Successfully built...`

### 3. Appliquer la nouvelle migration

```bash
docker compose exec db psql -U atlas -d atlas -f /docker-entrypoint-initdb.d/007_grid_v0.7.0.sql
```

**Sortie attendue** : `CREATE TABLE`, `CREATE INDEX`

### 4. Charger le polygone du Togo

```bash
docker compose run --rm etl etl load-country
```

**Sortie attendue** : `✓ Polygone du Togo chargé depuis /data/togo.geojson`

### 5. Générer la grille nationale

```bash
docker compose run --rm etl etl make-grid
```

**Sortie attendue** :
```
Génération grille : aire cible = 2,000,000 m² → côté ≈ 1414.21 m
✓ Mailles existantes supprimées
Génération de la grille (peut prendre quelques secondes)...
✓ XXX mailles générées avec succès
```

Le nombre de mailles dépend de la précision du polygone (attendu: 800-1200).

### 6. Charger les données fictives multi-villes

```bash
docker compose run --rm etl etl load-sample-extended
```

**Sortie attendue** :
```
✓ Données de sondage/essais nettoyées
Génération de X sondages pour Lome...
Génération de X sondages pour Sokode...
Génération de X sondages pour Kara...
Génération de X sondages pour Dapaong...
✓ Seed multi-villes terminé : XX sondages, XXX essais (seed=42)
```

### 7. Ouvrir l'interface

Ouvrez http://127.0.0.1:8080 dans votre navigateur.

**Vous devriez voir** :
- Une carte du Togo avec la grille affichée
- Les mailles avec données en **rouge semi-transparent**
- Les mailles vides en **gris transparent**

### 8. Tester l'interface

1. **Cliquez sur une maille colorée** → Le code se remplit automatiquement (ex: `TG-0234`)
2. **Cliquez sur "GET /grid/{code}"** → Affiche les statistiques de la maille
3. **Cliquez sur "Export GeoJSON"** → Télécharge la géométrie au format GeoJSON
4. **Cliquez sur "POST /recompute/{code}"** → Recalcule l'IDW (si ≥3 essais SPT_N)

## Vérification rapide via curl

```bash
# Nombre total de mailles
curl -s http://127.0.0.1:8001/coverage/mailles | jq '.features | length'

# Liste des mailles avec données
curl -s http://127.0.0.1:8001/coverage/mailles | jq '.features[] | select(.properties.has_data == true) | .properties.code'

# Détails d'une maille spécifique
curl -s http://127.0.0.1:8001/grid/TG-0001 | jq

# Géométrie d'une maille
curl -s http://127.0.0.1:8001/grid/TG-0001/shape | jq
```

## Personnalisation

### Changer l'aire des mailles

Pour générer des mailles de 5 km² au lieu de 2 km² :

```bash
docker compose run --rm etl etl make-grid --cell-m2 5000000
```

### Changer la graine aléatoire du seed

Pour générer des données différentes mais reproductibles :

```bash
docker compose run --rm etl etl load-sample-extended --seed 123
```

### Utiliser votre propre polygone

Remplacez `data/togo.geojson` par votre propre fichier, puis :

```bash
docker compose run --rm etl etl load-country --geojson-path /data/votre-fichier.geojson
docker compose run --rm etl etl make-grid
```

## Dépannage

### Erreur "No such command 'load-country'"

Vous avez oublié l'étape 2 (rebuild). Exécutez :
```bash
docker compose build etl
```

### Erreur "Aucun polygone trouvé dans country_tg"

Vous avez oublié l'étape 4. Exécutez :
```bash
docker compose run --rm etl etl load-country
```

### Erreur "table country_tg does not exist"

Vous avez oublié l'étape 3. Exécutez :
```bash
docker compose exec db psql -U atlas -d atlas -f /docker-entrypoint-initdb.d/007_grid_v0.7.0.sql
```

### La grille ne s'affiche pas dans l'UI

Vérifiez que vous avez bien :
1. Généré la grille (`make-grid`)
2. Rechargé la page (Ctrl+F5)
3. Ouvert la console développeur (F12) pour voir les erreurs

### API non accessible

Vérifiez le statut des services :
```bash
docker compose ps
```

Tous les services doivent être "Up" et "healthy".

## Pour aller plus loin

- Consultez le [README.md](README.md) pour la documentation complète
- Consultez le [CHANGELOG.md](CHANGELOG.md) pour l'historique des versions
- Les endpoints API sont documentés dans le README, section "API endpoints"

## Nettoyage complet

Pour repartir de zéro :

```bash
# Arrêter tous les services
docker compose down

# Supprimer les volumes (données DB)
docker volume rm atlas_db_data  # ou le nom du volume affiché par docker compose down

# Redémarrer
docker compose up -d

# Puis reprendre à l'étape 2
```

## Métriques attendues

Avec la configuration par défaut :

| Métrique | Valeur attendue |
|----------|----------------|
| Nombre de mailles | 800-1200 |
| Nombre de sondages | 19-31 |
| Nombre d'essais | 50-100 |
| Mailles avec données | 10-20 |
| Temps génération grille | 5-15 secondes |
| Temps réponse `/coverage/mailles` | < 500 ms |

Enjoy ! 🎉
