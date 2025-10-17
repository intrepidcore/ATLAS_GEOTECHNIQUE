#!/usr/bin/env pwsh
# Import des shapefiles ADM officiels du Togo et régénération de la grille

$ErrorActionPreference = "Stop"

Write-Host "`n=== Import des shapefiles ADM du Togo ===" -ForegroundColor Cyan

# Noms des fichiers shapefile
$ADM0_BASE = "tgo_admbnda_adm0_inseed_itos_20210107"
$ADM1_BASE = "tgo_admbnda_adm1_inseed_itos_20210107"
$ADM2_BASE = "tgo_admbnda_adm2_inseed_itos_20210107"
$ADM3_BASE = "tgo_admbnda_adm3_inseed_20210107"

$SHP_DIR = ".\data\shp\togo"

# Vérifier que les fichiers existent
Write-Host "`n1. Vérification des fichiers shapefile..." -ForegroundColor Yellow
$requiredFiles = @(
    "$SHP_DIR\$ADM0_BASE.shp",
    "$SHP_DIR\$ADM0_BASE.shx",
    "$SHP_DIR\$ADM0_BASE.dbf",
    "$SHP_DIR\$ADM0_BASE.prj"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "  ❌ Fichier manquant: $file" -ForegroundColor Red
        exit 1
    }
}
Write-Host "  ✓ Fichiers ADM0 trouvés" -ForegroundColor Green

# Créer le dossier temporaire dans le conteneur
Write-Host "`n2. Préparation du conteneur..." -ForegroundColor Yellow
docker compose exec -T db bash -c "mkdir -p /tmp/shp" | Out-Null
Write-Host "  ✓ Dossier /tmp/shp créé" -ForegroundColor Green

# Copier les fichiers ADM0 dans le conteneur
Write-Host "`n3. Copie des fichiers ADM0..." -ForegroundColor Yellow
$extensions = @("shp", "shx", "dbf", "prj", "cpg")
foreach ($ext in $extensions) {
    $srcFile = "$SHP_DIR\$ADM0_BASE.$ext"
    if (Test-Path $srcFile) {
        docker cp $srcFile "atlas-db:/tmp/shp/$ADM0_BASE.$ext" | Out-Null
        Write-Host "  ✓ Copié: $ADM0_BASE.$ext" -ForegroundColor Green
    }
}

# Importer ADM0 dans PostGIS
Write-Host "`n4. Import ADM0 dans PostGIS..." -ForegroundColor Yellow
$importCmd = "shp2pgsql -I -s 4326 /tmp/shp/$ADM0_BASE.shp public.adm0_raw | psql -U atlas -d atlas -q"
docker compose exec -T db bash -c $importCmd | Out-Null
Write-Host "  ✓ Table adm0_raw créée" -ForegroundColor Green

# Vérifier les colonnes de la table
Write-Host "`n5. Analyse de la structure ADM0..." -ForegroundColor Yellow
$columns = docker compose exec -T db psql -U atlas -d atlas -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='adm0_raw' ORDER BY ordinal_position;" | Out-String
Write-Host "  Colonnes disponibles:" -ForegroundColor Cyan
Write-Host $columns

# Construire country_tg
Write-Host "`n6. Construction de country_tg..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d atlas -c "DELETE FROM country_tg;" | Out-Null

# Essayer différents noms de colonnes possibles
$nameColumns = @("adm0_en", "adm0_fr", "name_0", "name", "country")
$inserted = $false

foreach ($col in $nameColumns) {
    try {
        $sql = @"
INSERT INTO country_tg(name, geom)
SELECT 'Togo', ST_Multi(ST_UnaryUnion(geom))
FROM adm0_raw
WHERE upper(coalesce($col, '')) LIKE '%TOGO%'
LIMIT 1;
"@
        $result = docker compose exec -T db psql -U atlas -d atlas -t -c $sql 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ country_tg créée (colonne: $col)" -ForegroundColor Green
            $inserted = $true
            break
        }
    } catch {
        continue
    }
}

if (-not $inserted) {
    Write-Host "  ⚠ Tentative sans filtre de nom..." -ForegroundColor Yellow
    $sql = @"
INSERT INTO country_tg(name, geom)
SELECT 'Togo', ST_Multi(ST_UnaryUnion(geom))
FROM adm0_raw;
"@
    docker compose exec -T db psql -U atlas -d atlas -c $sql | Out-Null
    Write-Host "  ✓ country_tg créée (toutes les géométries)" -ForegroundColor Green
}

# Vérification
Write-Host "`n7. Vérification de country_tg..." -ForegroundColor Yellow
$stats = docker compose exec -T db psql -U atlas -d atlas -t -c "SELECT ST_SRID(geom) AS srid, ROUND(ST_Area(geom::geography)/1e6) AS km2 FROM country_tg;" | Out-String
Write-Host "  SRID et surface:" -ForegroundColor Cyan
Write-Host $stats

# Import ADM1 (régions)
Write-Host "`n8. Import ADM1 (régions)..." -ForegroundColor Yellow
foreach ($ext in $extensions) {
    $srcFile = "$SHP_DIR\$ADM1_BASE.$ext"
    if (Test-Path $srcFile) {
        docker cp $srcFile "atlas-db:/tmp/shp/$ADM1_BASE.$ext" | Out-Null
    }
}
$importCmd = "shp2pgsql -I -s 4326 /tmp/shp/$ADM1_BASE.shp public.adm1 | psql -U atlas -d atlas -q"
docker compose exec -T db bash -c $importCmd | Out-Null
Write-Host "  ✓ Table adm1 créée" -ForegroundColor Green

# Import ADM2 (préfectures)
Write-Host "`n9. Import ADM2 (préfectures)..." -ForegroundColor Yellow
foreach ($ext in $extensions) {
    $srcFile = "$SHP_DIR\$ADM2_BASE.$ext"
    if (Test-Path $srcFile) {
        docker cp $srcFile "atlas-db:/tmp/shp/$ADM2_BASE.$ext" | Out-Null
    }
}
$importCmd = "shp2pgsql -I -s 4326 /tmp/shp/$ADM2_BASE.shp public.adm2 | psql -U atlas -d atlas -q"
docker compose exec -T db bash -c $importCmd | Out-Null
Write-Host "  ✓ Table adm2 créée" -ForegroundColor Green

# Import ADM3 (communes)
Write-Host "`n10. Import ADM3 (communes)..." -ForegroundColor Yellow
foreach ($ext in $extensions) {
    $srcFile = "$SHP_DIR\$ADM3_BASE.$ext"
    if (Test-Path $srcFile) {
        docker cp $srcFile "atlas-db:/tmp/shp/$ADM3_BASE.$ext" | Out-Null
    }
}
$importCmd = "shp2pgsql -I -s 4326 /tmp/shp/$ADM3_BASE.shp public.adm3 | psql -U atlas -d atlas -q"
docker compose exec -T db bash -c $importCmd | Out-Null
Write-Host "  ✓ Table adm3 créée" -ForegroundColor Green

# Statistiques ADM
Write-Host "`n11. Statistiques des tables ADM..." -ForegroundColor Yellow
$stats = docker compose exec -T db psql -U atlas -d atlas -t -c @"
SELECT 
  'ADM1 (Régions)' AS niveau,
  COUNT(*) AS nb_entites
FROM adm1
UNION ALL
SELECT 
  'ADM2 (Préfectures)',
  COUNT(*)
FROM adm2
UNION ALL
SELECT 
  'ADM3 (Communes)',
  COUNT(*)
FROM adm3;
"@ | Out-String
Write-Host $stats

# Régénérer la grille
Write-Host "`n12. Régénération de la grille avec les nouvelles frontières..." -ForegroundColor Yellow
docker compose run --rm etl etl make-grid --truncate

# Ajouter les colonnes ADM aux mailles
Write-Host "`n13. Ajout des colonnes ADM aux mailles..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d atlas -c @"
ALTER TABLE mailles
  ADD COLUMN IF NOT EXISTS adm1_code text,
  ADD COLUMN IF NOT EXISTS adm1_name text,
  ADD COLUMN IF NOT EXISTS adm2_code text,
  ADD COLUMN IF NOT EXISTS adm2_name text,
  ADD COLUMN IF NOT EXISTS adm3_code text,
  ADD COLUMN IF NOT EXISTS adm3_name text;
"@ | Out-Null
Write-Host "  ✓ Colonnes ADM ajoutées" -ForegroundColor Green

# Créer un index spatial sur mailles si pas déjà fait
Write-Host "`n14. Création des index spatiaux..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d atlas -c @"
CREATE INDEX IF NOT EXISTS idx_mailles_geom ON mailles USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_adm1_geom ON adm1 USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_adm2_geom ON adm2 USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_adm3_geom ON adm3 USING GIST (geom);
"@ | Out-Null
Write-Host "  ✓ Index créés" -ForegroundColor Green

# Taguer les mailles avec ADM1
Write-Host "`n15. Tagging des mailles avec ADM1 (régions)..." -ForegroundColor Yellow
$adm1Cols = docker compose exec -T db psql -U atlas -d atlas -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='adm1' AND column_name LIKE '%adm1%' ORDER BY ordinal_position LIMIT 5;" | Out-String
Write-Host "  Colonnes ADM1 disponibles: $adm1Cols" -ForegroundColor Cyan

# Essayer différentes combinaisons de colonnes
$adm1Updated = $false
$adm1Combinations = @(
    @{code="adm1_pcode"; name="adm1_en"},
    @{code="adm1_pcode"; name="adm1_fr"},
    @{code="adm1_code"; name="adm1_name"},
    @{code="pcode"; name="name"}
)

foreach ($combo in $adm1Combinations) {
    try {
        $sql = @"
UPDATE mailles m
SET adm1_code = a.$($combo.code),
    adm1_name = a.$($combo.name)
FROM adm1 a
WHERE ST_Intersects(ST_Centroid(m.geom), a.geom);
"@
        docker compose exec -T db psql -U atlas -d atlas -c $sql 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $count = docker compose exec -T db psql -U atlas -d atlas -t -c "SELECT COUNT(*) FROM mailles WHERE adm1_code IS NOT NULL;" | Out-String
            Write-Host "  ✓ ADM1 tagué: $($count.Trim()) mailles" -ForegroundColor Green
            $adm1Updated = $true
            break
        }
    } catch {
        continue
    }
}

if (-not $adm1Updated) {
    Write-Host "  ⚠ Impossible de taguer ADM1 automatiquement" -ForegroundColor Yellow
}

# Taguer les mailles avec ADM2
Write-Host "`n16. Tagging des mailles avec ADM2 (préfectures)..." -ForegroundColor Yellow
$adm2Combinations = @(
    @{code="adm2_pcode"; name="adm2_en"},
    @{code="adm2_pcode"; name="adm2_fr"},
    @{code="adm2_code"; name="adm2_name"},
    @{code="pcode"; name="name"}
)

foreach ($combo in $adm2Combinations) {
    try {
        $sql = @"
UPDATE mailles m
SET adm2_code = a.$($combo.code),
    adm2_name = a.$($combo.name)
FROM adm2 a
WHERE ST_Intersects(ST_Centroid(m.geom), a.geom);
"@
        docker compose exec -T db psql -U atlas -d atlas -c $sql 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $count = docker compose exec -T db psql -U atlas -d atlas -t -c "SELECT COUNT(*) FROM mailles WHERE adm2_code IS NOT NULL;" | Out-String
            Write-Host "  ✓ ADM2 tagué: $($count.Trim()) mailles" -ForegroundColor Green
            break
        }
    } catch {
        continue
    }
}

# Taguer les mailles avec ADM3
Write-Host "`n17. Tagging des mailles avec ADM3 (communes)..." -ForegroundColor Yellow
$adm3Combinations = @(
    @{code="adm3_pcode"; name="adm3_en"},
    @{code="adm3_pcode"; name="adm3_fr"},
    @{code="adm3_code"; name="adm3_name"},
    @{code="pcode"; name="name"}
)

foreach ($combo in $adm3Combinations) {
    try {
        $sql = @"
UPDATE mailles m
SET adm3_code = a.$($combo.code),
    adm3_name = a.$($combo.name)
FROM adm3 a
WHERE ST_Intersects(ST_Centroid(m.geom), a.geom);
"@
        docker compose exec -T db psql -U atlas -d atlas -c $sql 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $count = docker compose exec -T db psql -U atlas -d atlas -t -c "SELECT COUNT(*) FROM mailles WHERE adm3_code IS NOT NULL;" | Out-String
            Write-Host "  ✓ ADM3 tagué: $($count.Trim()) mailles" -ForegroundColor Green
            break
        }
    } catch {
        continue
    }
}

# Statistiques finales
Write-Host "`n18. Statistiques finales..." -ForegroundColor Yellow
$finalStats = docker compose exec -T db psql -U atlas -d atlas -t -c @"
SELECT 
  COUNT(*) AS total_mailles,
  COUNT(adm1_code) AS avec_adm1,
  COUNT(adm2_code) AS avec_adm2,
  COUNT(adm3_code) AS avec_adm3
FROM mailles;
"@ | Out-String
Write-Host $finalStats

# Exemples de mailles taguées
Write-Host "`n19. Exemples de mailles taguées..." -ForegroundColor Yellow
$examples = docker compose exec -T db psql -U atlas -d atlas -c @"
SELECT 
  code,
  adm1_name AS region,
  adm2_name AS prefecture,
  adm3_name AS commune
FROM mailles
WHERE adm1_code IS NOT NULL
ORDER BY code
LIMIT 5;
"@ | Out-String
Write-Host $examples

# Nettoyer
Write-Host "`n20. Nettoyage..." -ForegroundColor Yellow
docker compose exec -T db bash -c "rm -rf /tmp/shp" | Out-Null
Write-Host "  ✓ Fichiers temporaires supprimés" -ForegroundColor Green

Write-Host "`n=== Import terminé avec succès! ===" -ForegroundColor Green
Write-Host "`nProchaines étapes:" -ForegroundColor Cyan
Write-Host "  1. Recharger les données de test: docker compose run --rm etl etl load-sample-extended --truncate" -ForegroundColor White
Write-Host "  2. Rafraîchir l'UI: http://127.0.0.1:8080 (F5)" -ForegroundColor White
Write-Host "  3. Vérifier la couverture: (Invoke-RestMethod http://127.0.0.1:8001/coverage/mailles).features.Count" -ForegroundColor White
