# Format des codes de mailles v0.7.0

## ✅ Problème résolu

### Erreur initiale
```
psycopg.errors.UniqueViolation: duplicate key value violates unique constraint "mailles_code_key"
DETAIL: Key (code)=(TG-1000) already exists.
```

### Cause racine
- **ROW_NUMBER() instable** : Le numérotage séquentiel `TG-0001`, `TG-0002`, etc. n'était pas déterministe
- **ST_Dump() génère plusieurs lignes** : Un MultiPolygon à `(row=10, col=5)` créait 3 lignes avec le même `(row, col)`
- **Collision entre exécutions** : Relancer `make-grid` générait les mêmes codes → violation de contrainte UNIQUE

---

## 🎯 Solution : Codes déterministes

### Nouveau format
```
TG-<row4>-<col4>-<part2>
```

**Exemples :**
- `TG-0479-0264-01` : Ligne 479, Colonne 264, Partie 1
- `TG-0480-0255-01` : Ligne 480, Colonne 255, Partie 1
- `TG-0871-0152-01` : Ligne 871, Colonne 152, Partie 1

### Avantages
1. **Déterministe** : Même cellule = même code, toujours
2. **Explicite** : Le code encode la position dans la grille
3. **Idempotent** : Rejouer `make-grid` sans `--truncate` ne cause plus d'erreur
4. **Debuggable** : On peut retrouver la position géographique depuis le code

---

## 🔧 Implémentation SQL

### Structure du SQL

```sql
WITH tg AS (
  -- Polygone du Togo transformé en SRID de travail (25231)
  SELECT ST_Transform(geom, %(to_srid)s) AS g
  FROM country_tg
  LIMIT 1
),
env AS (
  -- Envelope (bbox) du polygone
  SELECT ST_Envelope(g) AS bbox FROM tg
),
grid_raw AS (
  -- Grille carrée brute via ST_SquareGrid
  SELECT
    (ST_SquareGrid(%(side)s, (SELECT bbox FROM env))).geom AS cell,
    (ST_SquareGrid(%(side)s, (SELECT bbox FROM env))).i AS col,
    (ST_SquareGrid(%(side)s, (SELECT bbox FROM env))).j AS row
),
grid_clip AS (
  -- Intersection avec le polygone du Togo
  SELECT
    ST_Intersection(cell, (SELECT g FROM tg)) AS geom,
    col, row
  FROM grid_raw
  WHERE ST_Intersects(cell, (SELECT g FROM tg))
),
grid_poly AS (
  -- Extraction des polygones (gère GeometryCollection)
  SELECT ST_CollectionExtract(geom, 3) AS geom, col, row
  FROM grid_clip
  WHERE geom IS NOT NULL
),
grid_dump AS (
  -- Décomposition des MultiPolygon en Polygon
  SELECT
    (sd).geom AS geom,
    row, col,
    COALESCE((sd).path[1], 1) AS part  -- Index du sous-polygone
  FROM (
    SELECT ST_Dump(geom) AS sd, row, col
    FROM grid_poly
  ) d
),
grid_ok AS (
  -- Filtrage par aire minimale
  SELECT
    geom, row, col, part
  FROM grid_dump
  WHERE ST_Area(geom) > %(min_area)s
)
INSERT INTO mailles (id, geom, code, stats)
SELECT
  gen_random_uuid(),
  geom,
  FORMAT('TG-%s-%s-%s',
         LPAD(row::text, 4, '0'),
         LPAD(col::text, 4, '0'),
         LPAD(part::text, 2, '0')) AS code,
  '{"samples":0}'::jsonb
FROM grid_ok
ON CONFLICT (code) DO UPDATE
SET geom  = EXCLUDED.geom,
    stats = EXCLUDED.stats,
    updated_at = now()
RETURNING code;
```

### Points clés

1. **ST_CollectionExtract(geom, 3)** : Extrait les polygones des GeometryCollection
2. **ST_Dump(geom)** : Décompose les MultiPolygon en Polygon individuels
3. **path[1]** : Index du sous-polygone (1, 2, 3, etc.)
4. **FORMAT()** : Génère le code déterministe `TG-row-col-part`
5. **ON CONFLICT DO UPDATE** : Rend la commande idempotente

---

## 📊 Statistiques

### Génération standard (seed 42)

```powershell
docker compose run --rm etl etl make-grid --truncate
# ✓ 35499 mailles générées avec succès

docker compose run --rm etl etl load-sample-extended --truncate
# ✓ Seed multi-villes terminé : 22 sondages, 63 essais (seed=42)
```

**Résultats :**
- **Mailles** : 35 499 (couvrant tout le Togo)
- **Sondages** : 22 (répartis sur 4 villes)
- **Essais** : 63 (2-4 par sondage)
- **Codes** : Format `TG-0479-0264-01` à `TG-0871-0152-01`

### Répartition des codes

```sql
-- Nombre de mailles par ligne
SELECT 
  SUBSTRING(code, 4, 4) AS row,
  COUNT(*) AS nb_mailles
FROM mailles
GROUP BY row
ORDER BY row
LIMIT 5;

-- Nombre de parties par cellule
SELECT 
  SUBSTRING(code, 13, 2) AS part,
  COUNT(*) AS nb_cellules
FROM mailles
GROUP BY part
ORDER BY part;
```

**Attendu :**
- La plupart des cellules ont `part=01` (Polygon simple)
- Quelques cellules ont `part=02`, `part=03` (MultiPolygon en frontière)

---

## 🔄 Idempotence

### Test d'idempotence

```powershell
# 1ère exécution
docker compose run --rm etl etl make-grid --truncate
# ✓ 35499 mailles générées avec succès

# 2ème exécution (sans --truncate)
docker compose run --rm etl etl make-grid
# ✓ 35499 mailles générées avec succès (UPSERT)

# Vérification
docker compose exec db psql -U atlas -d atlas -c "SELECT COUNT(*) FROM mailles;"
#  count  
# --------
#  35499
# (1 row)
```

**Résultat :** Aucune erreur de duplication, les mêmes codes sont mis à jour via `ON CONFLICT DO UPDATE`.

---

## 🧪 Tests de vérification

### Vérifier les codes

```powershell
# Premiers codes
docker compose exec db psql -U atlas -d atlas -c "SELECT code FROM mailles ORDER BY code LIMIT 10;"

# Derniers codes
docker compose exec db psql -U atlas -d atlas -c "SELECT code FROM mailles ORDER BY code DESC LIMIT 10;"

# Codes avec plusieurs parties
docker compose exec db psql -U atlas -d atlas -c "SELECT code FROM mailles WHERE code LIKE '%-02' OR code LIKE '%-03' ORDER BY code LIMIT 10;"
```

### Vérifier une maille via API

```powershell
# Récupérer les infos d'une maille
Invoke-RestMethod http://127.0.0.1:8001/grid/TG-0479-0264-01 | ConvertTo-Json -Depth 6

# Récupérer le GeoJSON d'une maille
Invoke-RestMethod http://127.0.0.1:8001/grid/TG-0479-0264-01/shape | ConvertTo-Json -Depth 6
```

### Vérifier la couverture

```powershell
# Nombre total de mailles
$cov = Invoke-RestMethod http://127.0.0.1:8001/coverage/mailles
$cov.features.Count

# Mailles avec données
$cov.features | Where-Object { $_.properties.has_data -eq $true } | Measure-Object | Select-Object -ExpandProperty Count

# Exemple de maille avec données
$cov.features | Where-Object { $_.properties.has_data -eq $true } | Select-Object -First 1 | ConvertTo-Json -Depth 4
```

---

## 🐛 Dépannage

### Erreur "duplicate key value"

**Cause :** Ancienne version du SQL (ROW_NUMBER instable).

**Solution :**
```powershell
# Vérifier la version du code
docker compose run --rm etl etl --help
# Doit afficher "make-grid" (avec tiret)

# Rebuild avec la dernière version
git pull
docker compose build etl --no-cache

# Régénérer avec purge
docker compose run --rm etl etl make-grid --truncate
```

### Codes au mauvais format

**Symptôme :** Codes comme `TG-0001`, `TG-0002` au lieu de `TG-0479-0264-01`.

**Cause :** Ancienne version du SQL.

**Solution :**
```powershell
# Vérifier le format des codes
docker compose exec db psql -U atlas -d atlas -c "SELECT code FROM mailles LIMIT 5;"

# Si format incorrect, purger et régénérer
docker compose exec db psql -U atlas -d atlas -c "TRUNCATE TABLE mailles RESTART IDENTITY CASCADE;"
docker compose run --rm etl etl make-grid
```

### Nombre de mailles incorrect

**Symptôme :** Nombre de mailles très différent de 35 499.

**Cause :** Paramètres `--cell-area-m2` ou `--min-area-m2` modifiés.

**Solution :**
```powershell
# Vérifier les paramètres par défaut
docker compose run --rm etl etl make-grid --help

# Régénérer avec paramètres standard
docker compose run --rm etl etl make-grid --cell-area-m2 2000000 --min-area-m2 1.0 --truncate
```

---

## 📚 Références

### Documents liés
- **Guide ETL** : `docs/ETL_COMMANDS_v0.7.0.md`
- **Quickstart** : `QUICKSTART_v0.7.0.md`
- **Troubleshooting** : `TROUBLESHOOTING_v0.7.0.md`
- **Cahier des charges** : `docs/cahier_des_charges_atlas_geotechnique_v_0_x_→_v_1.md`

### Commits importants
- `7cb8ef4` : Codes déterministes basés sur (row,col,part) + UPSERT idempotent
- `c5f9b25` : Retirer cast geometry avec paramètre SRID
- `574568d` : Simplifier make-grid avec UNION ALL
- `5509728` : Utiliser LATERAL JOIN pour ST_Dump
- `748e259` : Gestion GeometryCollection dans make-grid

---

## 🎓 Leçons apprises

### Pourquoi ROW_NUMBER() a échoué

1. **ST_Dump() crée plusieurs lignes** pour une cellule en frontière (MultiPolygon)
2. **ORDER BY (row, col)** ne discrimine pas le sous-polygone
3. **L'ordre peut varier** selon les plans d'exécution, optimisations, etc.
4. **ROW_NUMBER() global** peut recoller sur une valeur déjà insérée

### Pourquoi (row, col, part) fonctionne

1. **Espace d'adressage fixe** : Chaque cellule a une position unique dans la grille
2. **part discrimine les sous-polygones** : Chaque partie d'un MultiPolygon a un index unique
3. **Déterminisme garanti** : Même entrée → même sortie, toujours
4. **Idempotence naturelle** : ON CONFLICT DO UPDATE permet de rejouer sans erreur

---

**Version** : 0.7.0  
**Date** : 2025-10-17  
**Auteur** : TABE DJATO Serge
