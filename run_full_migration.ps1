# ============================================================================
# Script PowerShell : Migration complète de tous les types
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "🔧 Migration complète des types de colonnes..." -ForegroundColor Cyan
Write-Host ""

# Liste des migrations à exécuter dans l'ordre
$migrations = @(
    @{File="fix_adm3_types.sql"; Description="Table adm3 (gid)"},
    @{File="fix_all_types_comprehensive.sql"; Description="Tables echantillons, essais, mailles"}
)

foreach ($migration in $migrations) {
    $file = "migrations\$($migration.File)"
    $desc = $migration.Description
    
    Write-Host "📄 Migration: $desc" -ForegroundColor Yellow
    Write-Host "   Fichier: $file" -ForegroundColor Gray
    
    if (-not (Test-Path $file)) {
        Write-Host "   ⚠️  Fichier non trouvé, skip" -ForegroundColor Yellow
        continue
    }
    
    # Copier et exécuter
    docker cp $file atlas-db:/tmp/migration.sql
    $result = docker exec -i atlas-db psql -U atlas -d atlas_clean -f /tmp/migration.sql 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ OK" -ForegroundColor Green
    } else {
        Write-Host "   ❌ ERREUR" -ForegroundColor Red
        Write-Host $result
        exit 1
    }
    
    Write-Host ""
}

Write-Host "🎉 Toutes les migrations terminées!" -ForegroundColor Green
Write-Host ""
Write-Host "Redémarrage de l'API..." -ForegroundColor Cyan
docker-compose restart api-geo

Write-Host ""
Write-Host "✅ Prêt pour les tests!" -ForegroundColor Green
