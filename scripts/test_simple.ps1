# Test simple de l'import RAW v1.5.3
Write-Host "=== TEST IMPORT RAW v1.5.3 ===" -ForegroundColor Cyan

# Parametres
$excelFile = "atlas_import_example.xlsx"
$dsn = "postgresql://atlas:atlas@localhost:5432/atlas_clean"

# Test 1: Fichier Excel existe
Write-Host "`n[1] Verification fichier Excel..." -ForegroundColor Yellow
if (Test-Path $excelFile) {
    Write-Host "    OK - Fichier trouve" -ForegroundColor Green
} else {
    Write-Host "    ERREUR - Fichier manquant" -ForegroundColor Red
    Write-Host "    Generation du fichier..." -ForegroundColor Yellow
    python generate_atlas_import.py
}

# Test 2: Dry-run (sans base de donnees)
Write-Host "`n[2] Test dry-run (validation fichier Excel)..." -ForegroundColor Yellow
$cmd = "python scripts\02_import_excel.py --file $excelFile --dsn `"$dsn`" --dry-run --import-raw yes"
Write-Host "    Commande: $cmd" -ForegroundColor Gray

try {
    $output = Invoke-Expression $cmd 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host "    OK - Dry-run reussi" -ForegroundColor Green
        Write-Host "`n--- RAPPORT ---" -ForegroundColor Cyan
        $output | Select-String -Pattern "raw_lab|RAPPORT|Table|Lues|Créées" | ForEach-Object { Write-Host $_ }
    } else {
        Write-Host "    ERREUR - Dry-run echoue (code: $exitCode)" -ForegroundColor Red
        Write-Host "`n--- ERREURS ---" -ForegroundColor Red
        $output | Select-String -Pattern "ERROR|ERREUR|Traceback|Exception" | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    }
} catch {
    Write-Host "    EXCEPTION: $_" -ForegroundColor Red
}

Write-Host "`n=== FIN DU TEST ===" -ForegroundColor Cyan
