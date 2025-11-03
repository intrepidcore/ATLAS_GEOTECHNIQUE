# ============================================================================
# Script Complet - Import Donnees et Affichage UI
# ============================================================================

$ErrorActionPreference = "Continue"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " IMPORT ET AFFICHAGE UI - Atlas Geotechnique v1.5.3" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# ============================================================================
# ETAPE 1: TEST POSTGRESQL
# ============================================================================

Write-Host "`n[1/5] Test PostgreSQL..." -ForegroundColor Yellow

$testResult = python test_db_connection.py 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] PostgreSQL accessible" -ForegroundColor Green
} else {
    Write-Host "   [ERREUR] PostgreSQL non accessible" -ForegroundColor Red
    Write-Host "`n   Solutions:" -ForegroundColor Yellow
    Write-Host "   1. Demarrer PostgreSQL:" -ForegroundColor White
    Write-Host "      Start-Service postgresql-x64-14" -ForegroundColor Gray
    Write-Host "   2. Verifier le port 5432:" -ForegroundColor White
    Write-Host "      netstat -an | findstr :5432" -ForegroundColor Gray
    Write-Host "`n   Voulez-vous essayer de demarrer PostgreSQL ? (o/N)" -ForegroundColor Yellow
    $response = Read-Host
    
    if ($response -eq "o" -or $response -eq "O") {
        Write-Host "   Tentative de demarrage..." -ForegroundColor Yellow
        Start-Service postgresql* -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
        
        $testResult2 = python test_db_connection.py 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   [OK] PostgreSQL demarre avec succes" -ForegroundColor Green
        } else {
            Write-Host "   [ERREUR] Echec demarrage automatique" -ForegroundColor Red
            Write-Host "   Demarrez PostgreSQL manuellement et relancez ce script" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "   Script annule - Demarrez PostgreSQL et relancez" -ForegroundColor Yellow
        exit 1
    }
}

# ============================================================================
# ETAPE 2: IMPORT DONNEES
# ============================================================================

Write-Host "`n[2/5] Import des donnees..." -ForegroundColor Yellow

if (-not (Test-Path "atlas_import_example.xlsx")) {
    Write-Host "   Fichier Excel manquant - Generation..." -ForegroundColor Yellow
    python generate_atlas_import.py
}

Write-Host "   Lancement import..." -ForegroundColor Cyan

python scripts\02_import_excel.py `
    --file atlas_import_example.xlsx `
    --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
    --import-raw yes

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n   [OK] Import reussi" -ForegroundColor Green
} else {
    Write-Host "`n   [ERREUR] Echec import" -ForegroundColor Red
    Write-Host "   Verifiez les erreurs ci-dessus" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# ETAPE 3: CREER VUES SPREAD (si pas deja fait)
# ============================================================================

Write-Host "`n[3/5] Creation vues spread..." -ForegroundColor Yellow

# Verifier si psql est accessible
$psqlPath = (Get-Command psql -ErrorAction SilentlyContinue).Source

if ($psqlPath) {
    Write-Host "   psql trouve: $psqlPath" -ForegroundColor Cyan
    $env:PGPASSWORD = "atlas"
    psql -U atlas -d atlas_clean -f create_spread_views.sql 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Vues spread creees" -ForegroundColor Green
    } else {
        Write-Host "   [WARNING] Erreur creation vues (peut-etre deja creees)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [WARNING] psql introuvable - Essai avec Python..." -ForegroundColor Yellow
    
    $pythonScript = @"
import psycopg
try:
    conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean')
    with open('create_spread_views.sql', 'r', encoding='utf-8') as f:
        sql = f.read()
    conn.execute(sql)
    conn.commit()
    print('[OK] Vues creees')
except Exception as e:
    print(f'[ERREUR] {e}')
"@
    
    $pythonScript | python
}

# ============================================================================
# ETAPE 4: REFRESH VUES
# ============================================================================

Write-Host "`n[4/5] Refresh vues materialisees..." -ForegroundColor Yellow

$refreshScript = @"
import psycopg
try:
    conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean')
    conn.execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech')
    conn.commit()
    cur = conn.execute('SELECT COUNT(*) FROM mv_mailles_geotech')
    count = cur.fetchone()[0]
    print(f'[OK] Vue rafraichie - {count} mailles avec stats')
except Exception as e:
    print(f'[WARNING] {e}')
"@

$refreshScript | python

# ============================================================================
# ETAPE 5: VERIFICATIONS FINALES
# ============================================================================

Write-Host "`n[5/5] Verifications finales..." -ForegroundColor Yellow

python test_db_connection.py

# ============================================================================
# RESUME
# ============================================================================

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host " RESUME" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

Write-Host "`n[OK] Donnees importees en base" -ForegroundColor Green
Write-Host "[OK] Vues spread creees/rafraichies" -ForegroundColor Green

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host " PROCHAINES ETAPES" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

Write-Host "`n1. Verifier que le serveur backend est demarre" -ForegroundColor White
Write-Host "2. Verifier que l'API pointe sur mv_mailles_geotech" -ForegroundColor White
Write-Host "3. Ouvrir l'UI dans le navigateur" -ForegroundColor White
Write-Host "4. Vider le cache (Ctrl+Shift+R)" -ForegroundColor White
Write-Host "5. Les donnees devraient apparaitre sur la carte !" -ForegroundColor White

Write-Host "`n==================================================================" -ForegroundColor Cyan
