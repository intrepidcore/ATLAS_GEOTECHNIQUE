# ============================================================================
# Script de Fix UI - Faire apparaitre les donnees dans la carte
# ============================================================================
# Usage: powershell -ExecutionPolicy Bypass -File fix_ui_display.ps1
# ============================================================================

$ErrorActionPreference = "Continue"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " FIX UI DISPLAY - Atlas Geotechnique v1.5.3" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# Parametres
$dbUser = "atlas"
$dbName = "atlas_clean"
$env:PGPASSWORD = "atlas"

# ============================================================================
# ETAPE 1: DIAGNOSTIC
# ============================================================================

Write-Host "`n[1/5] Diagnostic de la base de donnees..." -ForegroundColor Yellow

$diagResult = psql -U $dbUser -d $dbName -t -c "SELECT COUNT(*) FROM sondages" 2>&1

if ($LASTEXITCODE -eq 0) {
    $nbSondages = $diagResult.Trim()
    Write-Host "   [OK] $nbSondages sondages trouves" -ForegroundColor Green
    
    if ($nbSondages -eq "0") {
        Write-Host "   [ERREUR] Aucun sondage importe !" -ForegroundColor Red
        Write-Host "   Executez d'abord: python scripts\02_import_excel.py ..." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "   [ERREUR] Impossible de se connecter a PostgreSQL" -ForegroundColor Red
    Write-Host "   Verifiez que PostgreSQL est demarre" -ForegroundColor Yellow
    exit 1
}

# Verifier geom
$nbGeom = (psql -U $dbUser -d $dbName -t -c "SELECT COUNT(*) FROM sondages WHERE geom IS NOT NULL" 2>&1).Trim()
$nbAdm3 = (psql -U $dbUser -d $dbName -t -c "SELECT COUNT(*) FROM sondages WHERE geom IS NULL AND adm3_code IS NOT NULL" 2>&1).Trim()

Write-Host "   - Sondages avec GPS (geom): $nbGeom" -ForegroundColor Cyan
Write-Host "   - Sondages ADM3 uniquement: $nbAdm3" -ForegroundColor Cyan

if ($nbGeom -eq "0" -and $nbAdm3 -eq "0") {
    Write-Host "   [WARNING] Aucune localisation (ni GPS ni ADM3) !" -ForegroundColor Yellow
    Write-Host "   Les donnees seront INVISIBLES sur la carte" -ForegroundColor Yellow
}

# ============================================================================
# ETAPE 2: CREER VUES SPREAD
# ============================================================================

Write-Host "`n[2/5] Creation des vues spread..." -ForegroundColor Yellow

$vueExists = (psql -U $dbUser -d $dbName -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='mv_mailles_geotech'" 2>&1).Trim()

if ($vueExists -eq "0") {
    Write-Host "   Vue mv_mailles_geotech n'existe pas - Creation..." -ForegroundColor Yellow
    psql -U $dbUser -d $dbName -f create_spread_views.sql
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Vues spread creees avec succes" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Echec creation vues spread" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   [OK] Vue mv_mailles_geotech existe deja" -ForegroundColor Green
}

# ============================================================================
# ETAPE 3: REFRESH VUES MATERIALISEES
# ============================================================================

Write-Host "`n[3/5] Refresh des vues materialisees..." -ForegroundColor Yellow

psql -U $dbUser -d $dbName -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech" 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    $nbMailles = (psql -U $dbUser -d $dbName -t -c "SELECT COUNT(*) FROM mv_mailles_geotech" 2>&1).Trim()
    Write-Host "   [OK] Vue rafraichie - $nbMailles mailles avec stats" -ForegroundColor Green
} else {
    Write-Host "   [ERREUR] Echec refresh vue" -ForegroundColor Red
    exit 1
}

# ============================================================================
# ETAPE 4: VERIFICATIONS
# ============================================================================

Write-Host "`n[4/5] Verifications finales..." -ForegroundColor Yellow

# Compteurs
$stats = psql -U $dbUser -d $dbName -t -c @"
SELECT 
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE has_spread) AS spread,
    COUNT(*) FILTER (WHERE NOT has_spread) AS geocode
FROM mv_mailles_geotech
"@ 2>&1

Write-Host "   Stats mailles:" -ForegroundColor Cyan
Write-Host "   $stats" -ForegroundColor Gray

# Exemple de donnees
Write-Host "`n   Exemple de donnees (3 premieres mailles):" -ForegroundColor Cyan
psql -U $dbUser -d $dbName -c "SELECT maille_id, ROUND(w_avg::numeric,2) AS w_avg, ROUND(ip_avg::numeric,2) AS ip_avg, n, has_spread FROM mv_mailles_geotech LIMIT 3"

# ============================================================================
# ETAPE 5: RECOMMANDATIONS
# ============================================================================

Write-Host "`n[5/5] Recommandations pour l'API et le Frontend..." -ForegroundColor Yellow

Write-Host "`n   API:" -ForegroundColor Cyan
Write-Host "   1. Verifier que l'endpoint carte pointe sur mv_mailles_geotech" -ForegroundColor White
Write-Host "   2. Exemple SQL:" -ForegroundColor White
Write-Host "      SELECT m.geom, s.* FROM mailles m" -ForegroundColor Gray
Write-Host "      LEFT JOIN mv_mailles_geotech s ON s.maille_id = m.id" -ForegroundColor Gray

Write-Host "`n   Frontend:" -ForegroundColor Cyan
Write-Host "   1. Vider le cache navigateur (Ctrl+Shift+R)" -ForegroundColor White
Write-Host "   2. Verifier que la couche lit: w_avg, ip_avg, vbs_avg" -ForegroundColor White
Write-Host "   3. Rebuild si necessaire: npm run build" -ForegroundColor White

Write-Host "`n   Tests API rapides:" -ForegroundColor Cyan
Write-Host "   curl http://localhost:8080/api/mailles/stats | jq '.features | length'" -ForegroundColor Gray

# ============================================================================
# RESUME
# ============================================================================

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host " RESUME" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

Write-Host "`n[OK] Sondages importes: $nbSondages" -ForegroundColor Green
Write-Host "[OK] Vues spread creees/rafraichies" -ForegroundColor Green
Write-Host "[OK] Mailles avec stats: $nbMailles" -ForegroundColor Green

if ($nbAdm3 -gt "0") {
    Write-Host "`n[INFO] $nbAdm3 sondages utilisent la strategie ADM3 spread" -ForegroundColor Cyan
    Write-Host "       (diffusion sur toutes les mailles de leur commune)" -ForegroundColor Cyan
}

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host " PROCHAINES ETAPES" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "1. Verifier API pointe sur mv_mailles_geotech" -ForegroundColor White
Write-Host "2. Vider cache frontend (Ctrl+Shift+R)" -ForegroundColor White
Write-Host "3. Tester la carte dans le navigateur" -ForegroundColor White
Write-Host "4. Apres chaque nouvel import, executer:" -ForegroundColor White
Write-Host "   psql -U atlas -d atlas_clean -f refresh_views.sql" -ForegroundColor Gray
Write-Host "`n==================================================================" -ForegroundColor Cyan
