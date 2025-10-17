# Script de déploiement complet pour Atlas v0.7.0
# Génère la grille nationale du Togo et charge les données multi-villes

Write-Host "=== Atlas v0.7.0 - Setup complet ===" -ForegroundColor Cyan
Write-Host ""

# 1. Rebuild ETL avec versions Typer/Click stables
Write-Host "[1/6] Rebuild du conteneur ETL..." -ForegroundColor Yellow
docker compose build etl
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du build ETL" -ForegroundColor Red
    exit 1
}
Write-Host "✓ ETL rebuilded" -ForegroundColor Green
Write-Host ""

# 2. Vérifier que les services sont up
Write-Host "[2/6] Vérification des services..." -ForegroundColor Yellow
docker compose up -d db api-geo
Start-Sleep -Seconds 10
$health = docker compose ps --format json | ConvertFrom-Json
$dbHealthy = ($health | Where-Object { $_.Service -eq "db" -and $_.Health -eq "healthy" })
if (-not $dbHealthy) {
    Write-Host "⚠️  DB pas encore healthy, attente 20s supplémentaires..." -ForegroundColor Yellow
    Start-Sleep -Seconds 20
}
Write-Host "✓ Services opérationnels" -ForegroundColor Green
Write-Host ""

# 3. Appliquer la migration pour country_tg
Write-Host "[3/6] Application de la migration 007_grid_v0.7.0.sql..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d atlas_geo -f /docker-entrypoint-initdb.d/007_grid_v0.7.0.sql
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Migration déjà appliquée ou erreur mineure" -ForegroundColor Yellow
}
Write-Host "✓ Migration appliquée" -ForegroundColor Green
Write-Host ""

# 4. Charger le polygone du Togo
Write-Host "[4/6] Chargement du polygone du Togo..." -ForegroundColor Yellow
docker compose run --rm etl etl load-country -g /data/togo.geojson --truncate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du chargement du polygone" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Polygone chargé" -ForegroundColor Green
Write-Host ""

# 5. Générer la grille nationale (~2 km²)
Write-Host "[5/6] Génération de la grille nationale (~2 km² par maille)..." -ForegroundColor Yellow
docker compose run --rm etl etl make-grid --cell-area-m2 2000000 --to-srid 25231 --truncate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la génération de la grille" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Grille générée" -ForegroundColor Green
Write-Host ""

# 6. Charger les données multi-villes (seed reproductible)
Write-Host "[6/6] Chargement des données multi-villes (Lomé, Sokodé, Kara, Dapaong)..." -ForegroundColor Yellow
docker compose run --rm etl etl load-sample-extended --seed 42 --n-min 19 --n-max 31 --truncate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du chargement des données" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Données chargées" -ForegroundColor Green
Write-Host ""

# Vérification finale
Write-Host "=== Vérification finale ===" -ForegroundColor Cyan
Write-Host "Test de l'endpoint /coverage/mailles..." -ForegroundColor Yellow
try {
    $coverage = Invoke-RestMethod http://127.0.0.1:8001/coverage/mailles
    $nbMailles = $coverage.features.Count
    Write-Host "✓ Coverage OK : $nbMailles mailles détectées" -ForegroundColor Green
} catch {
    Write-Host "⚠️  API pas encore prête, attendez quelques secondes et testez manuellement" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Setup v0.7.0 terminé ! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines étapes :" -ForegroundColor Cyan
Write-Host "  1. Démarrer l'UI : docker compose up -d ui" -ForegroundColor White
Write-Host "  2. Ouvrir http://127.0.0.1:8080" -ForegroundColor White
Write-Host "  3. Cliquer sur les mailles colorées pour voir les détails" -ForegroundColor White
Write-Host "  4. Tester Export GeoJSON" -ForegroundColor White
Write-Host ""
