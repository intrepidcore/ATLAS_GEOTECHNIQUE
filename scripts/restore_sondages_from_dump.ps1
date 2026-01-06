# Script pour restaurer les sondages et echantillons depuis un dump
# Extrait uniquement les tables atlas.sondages et atlas.echantillons

param(
    [string]$DumpFile = "..\backups\final_avec_28km_20260106_180124.sql",
    [string]$OutputFile = "..\backups\sondages_echantillons_extract.sql"
)

$CONTAINER_NAME = "atlas-db"
$DB_NAME = "atlas_clean"
$DB_USER = "atlas"

Write-Host "=== Restauration sondages et echantillons ===" -ForegroundColor Cyan

# Verifier que le dump existe
$fullDumpPath = Join-Path $PSScriptRoot $DumpFile
if (-not (Test-Path $fullDumpPath)) {
    Write-Host "Erreur: Dump introuvable: $fullDumpPath" -ForegroundColor Red
    exit 1
}

Write-Host "Dump source: $fullDumpPath" -ForegroundColor Gray
$dumpSize = (Get-Item $fullDumpPath).Length / 1MB
Write-Host "Taille: $([math]::Round($dumpSize, 2)) MB" -ForegroundColor Gray

# Extraire les sections sondages et echantillons
Write-Host "`nExtraction des tables sondages et echantillons..." -ForegroundColor Gray

$outputPath = Join-Path $PSScriptRoot $OutputFile
$extracting = $false
$currentTable = ""
$lineCount = 0

Get-Content $fullDumpPath | ForEach-Object {
    $line = $_
    
    # Detecter debut section sondages
    if ($line -match "COPY atlas\.sondages") {
        $extracting = $true
        $currentTable = "sondages"
        Write-Host "  Extraction table sondages..." -ForegroundColor Yellow
    }
    # Detecter debut section echantillons
    elseif ($line -match "COPY atlas\.echantillons") {
        $extracting = $true
        $currentTable = "echantillons"
        Write-Host "  Extraction table echantillons..." -ForegroundColor Yellow
    }
    # Detecter fin de section
    elseif ($line -match "^\\.$" -and $extracting) {
        $line | Out-File -FilePath $outputPath -Append -Encoding UTF8
        $extracting = $false
        Write-Host "  Table $currentTable extraite ($lineCount lignes)" -ForegroundColor Green
        $lineCount = 0
        return
    }
    
    # Ecrire la ligne si on est dans une section a extraire
    if ($extracting) {
        $line | Out-File -FilePath $outputPath -Append -Encoding UTF8
        $lineCount++
    }
}

if (-not (Test-Path $outputPath)) {
    Write-Host "Erreur: Aucune donnee extraite" -ForegroundColor Red
    exit 1
}

$extractSize = (Get-Item $outputPath).Length / 1MB
Write-Host "`nFichier extrait: $outputPath" -ForegroundColor Green
Write-Host "Taille: $([math]::Round($extractSize, 2)) MB" -ForegroundColor Gray

# Importer dans atlas_clean
Write-Host "`nImport dans atlas_clean..." -ForegroundColor Gray
Write-Host "  (Cela peut prendre quelques minutes)" -ForegroundColor Yellow

Get-Content $outputPath | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nImport reussi !" -ForegroundColor Green
} else {
    Write-Host "`nErreur lors de l'import" -ForegroundColor Red
    exit 1
}

# Verification
Write-Host "`n=== Verification ===" -ForegroundColor Cyan
docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as nb_sondages FROM atlas.sondages; SELECT COUNT(*) as nb_echantillons FROM atlas.echantillons;"

Write-Host "`nRestauration terminee !" -ForegroundColor Green
Write-Host "Prochaine etape: Redemarrer l'API avec 'docker-compose restart api-geo'" -ForegroundColor Yellow
