# Script de test pour l'import RAW v1.5.3
# ============================================

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " TEST IMPORT RAW v1.5.3 - Atlas Geotechnique" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Verifier que le fichier Excel existe
Write-Host "`n[1/5] Verification du fichier Excel..." -ForegroundColor Yellow
if (Test-Path "atlas_import_example.xlsx") {
    Write-Host "   [OK] Fichier Excel trouve" -ForegroundColor Green
} else {
    Write-Host "   [ERREUR] Fichier Excel manquant - Generation..." -ForegroundColor Red
    python generate_atlas_import.py
}

# 2. Verifier la connexion PostgreSQL
Write-Host "`n[2/5] Test connexion PostgreSQL..." -ForegroundColor Yellow
$env:PGPASSWORD = "atlas"
$testConn = psql -U atlas -d atlas_clean -c "SELECT version()" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Connexion OK" -ForegroundColor Green
} else {
    Write-Host "   [ERREUR] Connexion echouee" -ForegroundColor Red
    Write-Host "   Verifiez que PostgreSQL est demarre et que atlas_clean existe" -ForegroundColor Red
    exit 1
}

# 3. Verifier que les tables RAW existent
Write-Host "`n[3/5] Verification des tables RAW..." -ForegroundColor Yellow
$tables = @("raw_lab_agt", "raw_lab_ags", "raw_lab_atterberg")
$allTablesExist = $true

foreach ($table in $tables) {
    $check = psql -U atlas -d atlas_clean -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='$table')" 2>&1
    if ($check -match "t") {
        Write-Host "   [OK] Table $table existe" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Table $table manquante" -ForegroundColor Red
        $allTablesExist = $false
    }
}

if (-not $allTablesExist) {
    Write-Host "`n   Appliquer la migration SQL..." -ForegroundColor Yellow
    psql -U atlas -d atlas_clean -f db/migrations/2024-10-raw-archive.sql
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Migration appliquee" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Migration echouee" -ForegroundColor Red
        exit 1
    }
}

# 4. Dry-run import
Write-Host "`n[4/5] Import DRY-RUN..." -ForegroundColor Yellow
python scripts/02_import_excel.py `
    --file atlas_import_example.xlsx `
    --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
    --dry-run --import-raw yes

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n   [OK] Dry-run reussi" -ForegroundColor Green
} else {
    Write-Host "`n   [ERREUR] Dry-run echoue" -ForegroundColor Red
    exit 1
}

# 5. Proposer l'import reel
Write-Host "`n[5/5] Import reel..." -ForegroundColor Yellow
$response = Read-Host "Voulez-vous lancer l'import REEL ? (o/N)"
if ($response -eq "o" -or $response -eq "O") {
    python scripts/02_import_excel.py `
        --file atlas_import_example.xlsx `
        --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
        --import-raw yes
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n   [OK] Import reel reussi" -ForegroundColor Green
        
        # Verifications SQL
        Write-Host "`n   Compteurs de lignes:" -ForegroundColor Cyan
        $sqlQuery = "SELECT 'raw_lab_agt' AS table_name, COUNT(*) AS nb_lignes FROM raw_lab_agt UNION ALL SELECT 'raw_lab_ags', COUNT(*) FROM raw_lab_ags UNION ALL SELECT 'raw_lab_atterberg', COUNT(*) FROM raw_lab_atterberg"
        psql -U atlas -d atlas_clean -c $sqlQuery
    } else {
        Write-Host "`n   [ERREUR] Import reel echoue" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   Import reel annule" -ForegroundColor Yellow
}

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host " TEST TERMINE" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
