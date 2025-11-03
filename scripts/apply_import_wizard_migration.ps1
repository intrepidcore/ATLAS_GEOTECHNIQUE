# Script pour appliquer la migration Import Wizard v2.3.0

$env:PGPASSWORD = "postgres"
$dbHost = "localhost"
$dbUser = "postgres"
$dbName = "atlas_geo"
$migrationFile = "db\migrations\010_import_wizard_v2.sql"

Write-Host "🔄 Application de la migration Import Wizard v2.3.0..." -ForegroundColor Cyan

# Lire le fichier SQL
$sqlContent = Get-Content $migrationFile -Raw

# Exécuter via psql
$sqlContent | psql -h $dbHost -U $dbUser -d $dbName

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
    exit 1
}
