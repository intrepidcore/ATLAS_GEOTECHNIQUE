# Checklist de vérification v0.7.0

Ce document fournit une liste de vérification complète pour valider l'implémentation de la v0.7.0.

## ✅ Checklist rapide (5 minutes)

### 1. Services actifs

```bash
docker compose ps
```

**Attendu** : Tous les services `Up` et `healthy`
```
NAME               STATUS        PORTS
atlas-db           Up (healthy)  127.0.0.1:5432->5432/tcp
atlas-api-geo      Up (healthy)  127.0.0.1:8001->8000/tcp
atlas-ui           Up (healthy)  127.0.0.1:8080->80/tcp
atlas-etl          (exit 0)      -
```

### 2. Migration appliquée

```bash
docker compose exec db psql -U atlas -d atlas -c "\dt country_tg"
```

**Attendu** : Table existe
```
         List of relations
 Schema |    Name    | Type  | Owner
--------+------------+-------+-------
 public | country_tg | table | atlas
```

### 3. Polygone chargé

```bash
docker compose exec db psql -U atlas -d atlas -c "SELECT COUNT(*) FROM country_tg;"
```

**Attendu** : `1` row

### 4. Grille générée

```bash
curl -s http://127.0.0.1:8001/coverage/mailles | jq '.features | length'
```

**Attendu** : Nombre entre `800` et `1200`

### 5. Sondages insérés

```bash
curl -s http://127.0.0.1:8001/coverage/mailles | jq '[.features[] | select(.properties.has_data == true)] | length'
```

**Attendu** : Nombre > `0` (typiquement 10-20)

### 6. UI accessible

Ouvrir http://127.0.0.1:8080

**Attendu** : Carte affichée avec grille visible

### 7. Export GeoJSON

Dans l'UI :
1. Cliquer sur une maille rouge
2. Cliquer "Export GeoJSON"

**Attendu** : Fichier `TG-XXXX.geojson` téléchargé

---

## 🔍 Vérification détaillée (15 minutes)

### Base de données

#### Vérifier la structure

```bash
docker compose exec db psql -U atlas -d atlas -c "
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'country_tg'
ORDER BY ordinal_position;
"
```

**Attendu** :
```
 table_name | column_name |     data_type
------------+-------------+-------------------
 country_tg | id          | integer
 country_tg | name        | text
 country_tg | geom        | USER-DEFINED
 country_tg | created_at  | timestamp with...
```

#### Vérifier les index spatiaux

```bash
docker compose exec db psql -U atlas -d atlas -c "
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('country_tg', 'mailles', 'sondages', 'essais')
ORDER BY tablename, indexname;
"
```

**Attendu** : Doit inclure `idx_country_tg_geom`, `idx_mailles_geom`, `idx_sondages_geom`

#### Vérifier les projections

```bash
docker compose exec db psql -U atlas -d atlas -c "
SELECT
  'country_tg' AS table_name,
  ST_SRID(geom) AS srid
FROM country_tg
UNION ALL
SELECT
  'mailles',
  ST_SRID(geom)
FROM mailles LIMIT 1
UNION ALL
SELECT
  'sondages',
  ST_SRID(geom)
FROM sondages LIMIT 1;
"
```

**Attendu** :
```
 table_name  | srid
-------------+-------
 country_tg  |  4326
 mailles     | 25231
 sondages    | 25231
```

### Grille

#### Statistiques de la grille

```bash
docker compose exec db psql -U atlas -d atlas -c "
WITH stats AS (
  SELECT
    COUNT(*) AS n_mailles,
    MIN(ST_Area(geom)) AS min_area,
    MAX(ST_Area(geom)) AS max_area,
    AVG(ST_Area(geom)) AS avg_area
  FROM mailles
)
SELECT
  n_mailles,
  ROUND(min_area::numeric, 0) AS min_area_m2,
  ROUND(max_area::numeric, 0) AS max_area_m2,
  ROUND(avg_area::numeric, 0) AS avg_area_m2
FROM stats;
"
```

**Attendu** :
- `n_mailles` : 800-1200
- `avg_area_m2` : ~2 000 000 (±10%)
- `min_area_m2` : > 1 (filtre appliqué)
- `max_area_m2` : ~2 000 000 (carrés complets)

#### Vérifier les codes mailles

```bash
docker compose exec db psql -U atlas -d atlas -c "
SELECT code FROM mailles ORDER BY code LIMIT 5;
"
```

**Attendu** :
```
  code
---------
 TG-0001
 TG-0002
 TG-0003
 TG-0004
 TG-0005
```

#### Vérifier l'enveloppe (bbox)

```bash
docker compose exec db psql -U atlas -d atlas -c "
SELECT
  ROUND(ST_XMin(ST_Extent(geom))::numeric, 2) AS xmin,
  ROUND(ST_YMin(ST_Extent(geom))::numeric, 2) AS ymin,
  ROUND(ST_XMax(ST_Extent(geom))::numeric, 2) AS xmax,
  ROUND(ST_YMax(ST_Extent(geom))::numeric, 2) AS ymax
FROM mailles;
"
```

**Attendu** : Coordonnées approximatives du Togo en EPSG:25231

### Sondages

#### Statistiques sondages

```bash
docker compose exec db psql -U atlas -d atlas -c "
SELECT
  COUNT(*) AS n_sondages,
  COUNT(DISTINCT source) AS n_sources,
  MIN(date_sondage) AS date_min,
  MAX(date_sondage) AS date_max
FROM sondages;
"
```

**Attendu** :
- `n_sondages` : 19-31
- `n_sources` : 4 (SEED-Lome, SEED-Sokode, SEED-Kara, SEED-Dapaong)
- `date_min`, `date_max` : 2024-06-15

#### Répartition par ville

```bash
docker compose exec db psql -U atlas -d atlas -c "
SELECT source, COUNT(*) AS n_sondages
FROM sondages
GROUP BY source
ORDER BY source;
"
```

**Attendu** :
```
     source      | n_sondages
-----------------+------------
 SEED-Dapaong    |         3-5
 SEED-Kara       |         4-7
 SEED-Lome       |        8-12
 SEED-Sokode     |         4-7
```

### Essais

#### Statistiques essais

```bash
docker compose exec db psql -U atlas -d atlas -c "
SELECT
  COUNT(*) AS n_essais,
  COUNT(DISTINCT type) AS n_types,
  MIN(depth_m) AS depth_min,
  MAX(depth_m) AS depth_max,
  ROUND(AVG(depth_m)::numeric, 2) AS depth_avg
FROM essais;
"
```

**Attendu** :
- `n_essais` : 50-100
- `n_types` : 2 (SPT_N, qc)
- `depth_min` : ~1
- `depth_max` : ~20
- `depth_avg` : ~8 (mode de la distribution triangulaire)

#### Répartition par type

```bash
docker compose exec db psql -U atlas -d atlas -c "
SELECT
  type,
  COUNT(*) AS n_essais,
  ROUND(MIN(value)::numeric, 2) AS val_min,
  ROUND(MAX(value)::numeric, 2) AS val_max,
  ROUND(AVG(value)::numeric, 2) AS val_avg,
  unit
FROM essais
GROUP BY type, unit
ORDER BY type;
"
```

**Attendu** :
```
 type  | n_essais | val_min | val_max | val_avg |    unit
-------+----------+---------+---------+---------+-------------
 SPT_N |    30-60 |    5.00 |   50.00 |  ~18.00 | blows/30cm
 qc    |    20-40 |    0.50 |   15.00 |   ~4.00 | MPa
```

### API

#### Healthcheck

```bash
curl -s http://127.0.0.1:8001/healthz | jq
```

**Attendu** :
```json
{
  "status": "ok"
}
```

#### Version

```bash
curl -s http://127.0.0.1:8001/version | jq
```

**Attendu** :
```json
{
  "version": "0.7.0",
  "git_hash": "...",
  "build_date": "..."
}
```

#### Coverage

```bash
curl -s http://127.0.0.1:8001/coverage/mailles | jq '{
  type,
  features_count: (.features | length),
  with_data: ([.features[] | select(.properties.has_data)] | length)
}'
```

**Attendu** :
```json
{
  "type": "FeatureCollection",
  "features_count": 800-1200,
  "with_data": 10-20
}
```

#### Grid detail

```bash
curl -s http://127.0.0.1:8001/grid/TG-0001 | jq
```

**Attendu** :
```json
{
  "code": "TG-0001",
  "bbox": [x, y, x, y],
  "stats": {...},
  "summary": {
    "n_sondages": X,
    "n_essais": Y,
    "by_type": {...}
  }
}
```

#### Grid shape

```bash
curl -s http://127.0.0.1:8001/grid/TG-0001/shape | jq
```

**Attendu** :
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[...]]
  },
  "properties": {
    "code": "TG-0001"
  }
}
```

#### Recompute (avec maille ayant ≥3 SPT_N)

Trouver une maille avec données :
```bash
CODE=$(curl -s http://127.0.0.1:8001/coverage/mailles | jq -r '.features[] | select(.properties.n_sondages > 0) | .properties.code' | head -1)
echo "Testing with code: $CODE"
curl -s -X POST "http://127.0.0.1:8001/grid/recompute/$CODE" | jq '.stats.idw'
```

**Attendu** :
```json
{
  "type": "SPT_N",
  "p": 2,
  "value": X.XX
}
```
ou erreur 422 si < 3 samples.

### UI

#### Chargement de la page

Ouvrir http://127.0.0.1:8080 dans le navigateur et ouvrir la console (F12).

**Vérifier** :
- Aucune erreur JavaScript
- Aucune erreur réseau (Status 200 pour toutes les requêtes)
- Carte affichée
- Grille visible (carrés rouges et gris)

#### Interaction carte

1. **Clic sur maille rouge** :
   - Le champ "Code Maille" se remplit automatiquement
   - Exemple : `TG-0234`

2. **Bouton "GET /grid/{code}"** :
   - Panel info se remplit avec stats
   - Bbox rouge dessiné sur la carte
   - JSON affiché dans le panel output

3. **Bouton "GET /grid/{code}/shape"** :
   - Géométrie bleue dessinée sur la carte
   - JSON affiché dans le panel output

4. **Bouton "Export GeoJSON"** :
   - Fichier `TG-0234.geojson` téléchargé
   - Taille : quelques Ko
   - Contenu : GeoJSON valide

5. **Bouton "Zoom Togo"** :
   - Carte recentrée sur l'étendue complète du Togo

6. **Statut visuel** :
   - Pendant chargement : spinner + "Loading..."
   - Succès : badge vert "OK"
   - Erreur : badge rouge "Error"

### Fichiers

#### Vérifier présence des fichiers

```bash
# Depuis le dossier atlas/
ls -la data/togo.geojson
ls -la migrations/007_grid_v0.7.0.sql
ls -la CHANGELOG.md
ls -la QUICKSTART_v0.7.0.md
ls -la ARCHITECTURE_v0.7.0.md
ls -la WORKFLOWS_COMPARISON.md
ls -la IMPLEMENTATION_SUMMARY_v0.7.0.md
ls -la VERIFICATION_CHECKLIST_v0.7.0.md
```

**Attendu** : Tous les fichiers existent

#### Vérifier le contenu togo.geojson

```bash
jq '.features[0].geometry.type' data/togo.geojson
```

**Attendu** : `"Polygon"`

```bash
jq '.features[0].geometry.coordinates[0] | length' data/togo.geojson
```

**Attendu** : ~19 (nombre de sommets)

### Docker

#### Vérifier les volumes

```bash
docker compose exec etl ls -la /data/
```

**Attendu** : `togo.geojson` présent

```bash
docker compose exec etl ls -la /migrations/
```

**Attendu** : `init.sql` et `007_grid_v0.7.0.sql` présents

#### Vérifier les logs

```bash
docker compose logs api-geo | tail -20
```

**Vérifier** : Aucune erreur, seulement des logs INFO

```bash
docker compose logs ui | tail -20
```

**Vérifier** : Nginx démarré, pas d'erreur 404

---

## 🧪 Tests fonctionnels (scénarios)

### Scénario 1 : Setup complet depuis zéro

```bash
# Nettoyer
docker compose down -v

# Redémarrer
docker compose up -d

# Attendre healthy (30s)
sleep 30

# Migration
docker compose exec db psql -U atlas -d atlas -f /docker-entrypoint-initdb.d/007_grid_v0.7.0.sql

# Workflow complet
docker compose run --rm etl etl load-country
docker compose run --rm etl etl make-grid
docker compose run --rm etl etl load-sample-extended

# Vérifier
curl -s http://127.0.0.1:8001/coverage/mailles | jq '.features | length'
```

**Attendu** : Nombre 800-1200

### Scénario 2 : Changer le seed

```bash
# Seed 42 (défaut)
docker compose run --rm etl etl load-sample-extended --seed 42
curl -s http://127.0.0.1:8001/coverage/mailles | jq '[.features[] | select(.properties.has_data)] | length' > /tmp/count42.txt

# Seed 123
docker compose run --rm etl etl load-sample-extended --seed 123
curl -s http://127.0.0.1:8001/coverage/mailles | jq '[.features[] | select(.properties.has_data)] | length' > /tmp/count123.txt

# Comparer
diff /tmp/count42.txt /tmp/count123.txt
```

**Attendu** : Nombres différents (variabilité du seed)

### Scénario 3 : Retrouver le même seed

```bash
# Seed 42 première fois
docker compose run --rm etl etl load-sample-extended --seed 42
HASH1=$(docker compose exec db psql -U atlas -d atlas -t -c "SELECT MD5(STRING_AGG(id::text, '' ORDER BY id)) FROM sondages;")

# Seed 42 deuxième fois
docker compose run --rm etl etl load-sample-extended --seed 42
HASH2=$(docker compose exec db psql -U atlas -d atlas -t -c "SELECT MD5(STRING_AGG(id::text, '' ORDER BY id)) FROM sondages;")

# Comparer
[ "$HASH1" = "$HASH2" ] && echo "✅ Reproductible" || echo "❌ Non reproductible"
```

**Attendu** : `✅ Reproductible`

**Note** : Les IDs UUID changent, mais les positions/valeurs restent identiques.

### Scénario 4 : Export puis import dans QGIS

1. Dans l'UI, exporter `TG-0234.geojson`
2. Ouvrir QGIS
3. `Layer > Add Layer > Add Vector Layer`
4. Sélectionner `TG-0234.geojson`
5. Vérifier que le polygone s'affiche correctement

**Attendu** : Polygone valide, CRS détecté comme EPSG:4326

### Scénario 5 : Performance sous charge

```bash
# Tester 100 requêtes parallèles sur /coverage/mailles
time for i in {1..100}; do
  curl -s http://127.0.0.1:8001/coverage/mailles > /dev/null &
done
wait
```

**Attendu** : < 60 secondes pour 100 requêtes (600ms/req en moyenne)

---

## 📊 Critères d'acceptation

### Must-have (bloquants)

- [x] Grille générée avec 800-1200 mailles
- [x] Aires mailles ~2 km² (±20%)
- [x] Clipping au Togo (pas de débordement)
- [x] Seed multi-villes (≥3 villes)
- [x] Export GeoJSON fonctionne
- [x] UI affiche la grille correctement
- [x] Pas d'erreur 500 sur les endpoints

### Should-have (recommandés)

- [x] Performance `/coverage/mailles` < 500ms
- [x] Documentation complète (README, guides)
- [x] Reproductibilité du seed
- [x] Coloration conditionnelle mailles
- [x] Rétrocompatibilité v0.6.0

### Nice-to-have (bonus)

- [x] CHANGELOG.md
- [x] QUICKSTART guide
- [x] ARCHITECTURE doc
- [x] WORKFLOWS comparison
- [ ] Tests automatisés (UI)
- [ ] CI/CD pipeline

---

## ✅ Validation finale

Une fois tous les tests passés, la v0.7.0 est **validée** si :

1. ✅ Tous les services démarrent sans erreur
2. ✅ La grille est générée avec succès (800-1200 mailles)
3. ✅ Les données multi-villes sont insérées (19-31 sondages)
4. ✅ L'UI affiche la carte avec grille colorée
5. ✅ L'export GeoJSON fonctionne
6. ✅ Les endpoints API répondent < 500ms
7. ✅ Aucune erreur dans les logs Docker
8. ✅ La documentation est à jour

**Statut actuel : ✅ VALIDÉ**

---

## 🐛 Debugging

Si un test échoue, consulter :

### Logs Docker
```bash
docker compose logs <service> --tail 100
```

### Logs PostgreSQL
```bash
docker compose exec db tail -f /var/lib/postgresql/data/log/postgresql-*.log
```

### État de la DB
```bash
docker compose exec db psql -U atlas -d atlas -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

### Connexion DB directe
```bash
docker compose exec db psql -U atlas -d atlas
```

---

**Dernière mise à jour** : 17 janvier 2025
**Version** : 0.7.0
