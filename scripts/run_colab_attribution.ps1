# Script PowerShell pour l'attribution automatique des mailles Colab
# Usage: .\scripts\run_colab_attribution.ps1 [-DryRun] [-Input <path>]

param(
    [switch]$DryRun = $false,
    [string]$Input = "data\colab\etudiants_colab.xlsx",
    [string]$Sheet = "etudiants_preferences",
    [int]$MaxStudentsPerMaille = 1
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Attribution Automatique Mailles Colab" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que le fichier existe
if (-not (Test-Path $Input)) {
    Write-Host "❌ Fichier non trouvé: $Input" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solutions:" -ForegroundColor Yellow
    Write-Host "  1. Créer le template:" -ForegroundColor Yellow
    Write-Host "     poetry run python scripts\create_excel_template.py" -ForegroundColor Gray
    Write-Host "  2. Remplir les données et sauvegarder sous:" -ForegroundColor Yellow
    Write-Host "     $Input" -ForegroundColor Gray
    exit 1
}

# Afficher les paramètres
Write-Host "Paramètres:" -ForegroundColor Green
Write-Host "  Fichier: $Input" -ForegroundColor Gray
Write-Host "  Feuille: $Sheet" -ForegroundColor Gray
Write-Host "  Mode: $(if ($DryRun) { 'SIMULATION (dry-run)' } else { 'PRODUCTION' })" -ForegroundColor $(if ($DryRun) { 'Yellow' } else { 'Red' })
Write-Host "  Max étudiants/maille: $MaxStudentsPerMaille" -ForegroundColor Gray
Write-Host ""

# Confirmation si mode production
if (-not $DryRun) {
    Write-Host "⚠️  MODE PRODUCTION - Les données seront écrites en base!" -ForegroundColor Red
    $confirmation = Read-Host "Continuer? (oui/non)"
    if ($confirmation -ne "oui") {
        Write-Host "❌ Annulé par l'utilisateur" -ForegroundColor Yellow
        exit 0
    }
    Write-Host ""
}

# Exécuter le script Python
Write-Host "🚀 Lancement du script..." -ForegroundColor Cyan
Write-Host ""

$dryRunArg = if ($DryRun) { "true" } else { "false" }

poetry run python scripts\colab_assign_mailles_from_excel.py `
    --input $Input `
    --sheet $Sheet `
    --dry-run $dryRunArg `
    --max-students-per-maille $MaxStudentsPerMaille

$exitCode = $LASTEXITCODE

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($exitCode -eq 0) {
    Write-Host "✅ Terminé avec succès!" -ForegroundColor Green
    
    if ($DryRun) {
        Write-Host ""
        Write-Host "Prochaine étape:" -ForegroundColor Yellow
        Write-Host "  Relancer sans -DryRun pour appliquer les changements" -ForegroundColor Gray
        Write-Host "  .\scripts\run_colab_attribution.ps1 -Input $Input" -ForegroundColor Gray
    } else {
        Write-Host ""
        Write-Host "Vérifier les résultats:" -ForegroundColor Yellow
        Write-Host "  psql `$env:DATABASE_URL -c 'SELECT * FROM atlas.v_colab_maille_assignment_details;'" -ForegroundColor Gray
    }
} else {
    Write-Host "❌ Erreur lors de l'exécution" -ForegroundColor Red
    Write-Host ""
    Write-Host "Vérifier:" -ForegroundColor Yellow
    Write-Host "  - Le format du fichier Excel" -ForegroundColor Gray
    Write-Host "  - Les codes ADM dans les préférences" -ForegroundColor Gray
    Write-Host "  - La connexion à la base de données" -ForegroundColor Gray
}

Write-Host "========================================" -ForegroundColor Cyan

exit $exitCode
