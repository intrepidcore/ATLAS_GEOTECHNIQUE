# ============================================================================
# Wrapper PowerShell pour le générateur Python de 25k sondages
# ============================================================================

Write-Host "`n🎲 Générateur de 25 000 sondages géotechniques" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

# Vérifier si Python est installé
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "❌ Python n'est pas installé ou pas dans le PATH" -ForegroundColor Red
    Write-Host "💡 Installez Python 3.8+ depuis https://www.python.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Python détecté: $($pythonCmd.Version)" -ForegroundColor Green

# Vérifier/installer psycopg2
Write-Host "`n📦 Vérification des dépendances Python..." -ForegroundColor Yellow
$pipList = pip list 2>$null | Select-String "psycopg2"
if (-not $pipList) {
    Write-Host "  📥 Installation de psycopg2..." -ForegroundColor Cyan
    pip install psycopg2-binary --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Erreur lors de l'installation de psycopg2" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✅ psycopg2 installé" -ForegroundColor Green
} else {
    Write-Host "  ✅ psycopg2 déjà installé" -ForegroundColor Green
}

# Lancer le script Python
Write-Host "`n🚀 Lancement du générateur..." -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

python .\scripts\generate-bulk-surveys.py

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Génération terminée avec succès!" -ForegroundColor Green
    Write-Host "💡 Rechargez la page web pour voir les nouvelles données" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Erreur lors de la génération" -ForegroundColor Red
    exit 1
}

Write-Host "=" * 80 -ForegroundColor Gray
