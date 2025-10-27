# Test Import RAW v1.5.3 - Version Simplifiee
# ===========================================

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " TEST IMPORT RAW v1.5.3 - Atlas Geotechnique" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Etape 1: Verifier fichier Excel
Write-Host "[1/4] Verification fichier Excel..." -ForegroundColor Yellow
if (Test-Path "atlas_import_example.xlsx") {
    Write-Host "      [OK] Fichier trouve" -ForegroundColor Green
} else {
    Write-Host "      [INFO] Generation du fichier..." -ForegroundColor Yellow
    python generate_atlas_import.py
    if ($LASTEXITCODE -eq 0) {
        Write-Host "      [OK] Fichier genere" -ForegroundColor Green
    } else {
        Write-Host "      [ERREUR] Echec generation" -ForegroundColor Red
        exit 1
    }
}

# Etape 2: Installer dependances Python si necessaire
Write-Host ""
Write-Host "[2/4] Verification dependances Python..." -ForegroundColor Yellow
python -c "import pandas, psycopg, openpyxl" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "      [INFO] Installation des dependances..." -ForegroundColor Yellow
    pip install pandas openpyxl psycopg[binary]
    if ($LASTEXITCODE -eq 0) {
        Write-Host "      [OK] Dependances installees" -ForegroundColor Green
    } else {
        Write-Host "      [ERREUR] Echec installation" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "      [OK] Dependances presentes" -ForegroundColor Green
}

# Etape 3: Test dry-run (sans base de donnees)
Write-Host ""
Write-Host "[3/4] Test dry-run (validation fichier Excel)..." -ForegroundColor Yellow
Write-Host "      Commande: python scripts\02_import_excel.py --file atlas_import_example.xlsx --dsn postgresql://atlas:atlas@localhost:5432/atlas_clean --dry-run --import-raw yes" -ForegroundColor Gray

$dsnTest = "postgresql://atlas:atlas@localhost:5432/atlas_clean"
& python scripts\02_import_excel.py --file atlas_import_example.xlsx --dsn $dsnTest --dry-run --import-raw yes

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "      [OK] Dry-run reussi !" -ForegroundColor Green
    Write-Host "      Le fichier Excel est valide et pret pour l'import" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "      [ERREUR] Dry-run echoue" -ForegroundColor Red
    Write-Host "      Verifiez les erreurs ci-dessus" -ForegroundColor Red
    exit 1
}

# Etape 4: Proposer import reel
Write-Host ""
Write-Host "[4/4] Import reel dans la base de donnees..." -ForegroundColor Yellow
Write-Host "      ATTENTION: Ceci va modifier la base atlas_clean" -ForegroundColor Yellow
Write-Host ""
$response = Read-Host "      Voulez-vous continuer avec l'import REEL ? (O/n)"

if ($response -eq "" -or $response -eq "O" -or $response -eq "o") {
    Write-Host ""
    Write-Host "      Lancement de l'import reel..." -ForegroundColor Cyan
    
    & python scripts\02_import_excel.py --file atlas_import_example.xlsx --dsn $dsnTest --import-raw yes
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "      [OK] Import reel termine avec succes !" -ForegroundColor Green
        Write-Host ""
        Write-Host "      Verification des donnees importees:" -ForegroundColor Cyan
        Write-Host "      - Consultez le rapport d'import ci-dessus" -ForegroundColor Gray
        Write-Host "      - Verifiez les tables RAW dans PostgreSQL" -ForegroundColor Gray
    } else {
        Write-Host ""
        Write-Host "      [ERREUR] Import reel echoue" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "      [INFO] Import reel annule par l'utilisateur" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " TEST TERMINE" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
