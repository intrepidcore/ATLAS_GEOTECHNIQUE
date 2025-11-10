# ============================================================================
# Script PowerShell : Exécution de la migration fix_sondages_types.sql
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "🔧 Début de la migration des types de colonnes sondages..." -ForegroundColor Cyan

# Variables de connexion PostgreSQL
$env:PGUSER = "postgres"
$env:PGDATABASE = "atlas"
$env:PGPASSWORD = "postgres"

# Chemin vers le fichier SQL
$migrationFile = "migrations\fix_sondages_types.sql"

# Vérifier que le fichier existe
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Erreur: Le fichier $migrationFile n'existe pas!" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Fichier de migration trouvé: $migrationFile" -ForegroundColor Green

# Exécuter la migration
try {
    Write-Host "⏳ Exécution de la migration..." -ForegroundColor Yellow
    
    # Utiliser docker exec pour exécuter psql dans le conteneur
    docker exec -i atlas-db psql -U postgres -d atlas -f /migrations/fix_sondages_types.sql
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration exécutée avec succès!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de l'exécution de la migration (code: $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "❌ Exception: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🧪 Test des APIs..." -ForegroundColor Cyan

# Attendre que le serveur soit prêt
Start-Sleep -Seconds 2

# Tester l'API /sondages/stats
try {
    Write-Host "📊 Test de /sondages/stats..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "http://localhost:8000/sondages/stats" -Method Get
    Write-Host "✅ /sondages/stats OK" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "⚠️  /sondages/stats non accessible (serveur peut-être arrêté)" -ForegroundColor Yellow
}

# Tester l'API /sondages?limit=5
try {
    Write-Host ""
    Write-Host "📋 Test de /sondages?limit=5..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "http://localhost:8000/sondages?limit=5" -Method Get
    Write-Host "✅ /sondages?limit=5 OK - $($response.Count) sondages retournés" -ForegroundColor Green
    
    if ($response.Count -gt 0) {
        Write-Host "Premier sondage:" -ForegroundColor Cyan
        $response[0] | ConvertTo-Json
    }
} catch {
    Write-Host "⚠️  /sondages?limit=5 non accessible (serveur peut-être arrêté)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Migration terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Cyan
Write-Host "  1. Démarrer le serveur: docker-compose up -d" -ForegroundColor White
Write-Host "  2. Vérifier les logs: docker-compose logs -f api" -ForegroundColor White
Write-Host "  3. Tester l'UI: http://localhost:5173" -ForegroundColor White
