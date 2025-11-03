# ============================================================================
# DIAGNOSTIC AUTOMATIQUE UI - Pourquoi rien ne s'affiche
# ============================================================================

$ErrorActionPreference = "Continue"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " DIAGNOSTIC AUTOMATIQUE UI - Atlas Geotechnique v1.5.3" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# Configuration
$dbUser = "atlas"
$dbName = "atlas_clean"
$env:PGPASSWORD = "atlas"

$logFile = "diagnostic_log_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

function Write-Log {
    param($message, $color = "White")
    Write-Host $message -ForegroundColor $color
    $message | Out-File -FilePath $logFile -Append
}

Write-Log "`n[INFO] Log sauvegarde dans: $logFile" "Yellow"

# ============================================================================
# ETAPE 0: SANITY CHECK
# ============================================================================

Write-Log "`n==================================================================" "Cyan"
Write-Log "[ETAPE 0] SANITY CHECK - Import reel fait ?" "Cyan"
Write-Log "==================================================================" "Cyan"

$psqlPath = (Get-Command psql -ErrorAction SilentlyContinue).Source

if (-not $psqlPath) {
    Write-Log "[WARNING] psql introuvable dans PATH" "Yellow"
    Write-Log "Essai avec chemin par defaut..." "Yellow"
    $psqlPath = "C:\Program Files\PostgreSQL\14\bin\psql.exe"
    
    if (-not (Test-Path $psqlPath)) {
        Write-Log "[ERREUR] PostgreSQL introuvable" "Red"
        Write-Log "Solutions:" "Yellow"
        Write-Log "  1. Installer PostgreSQL" "White"
        Write-Log "  2. Ajouter PostgreSQL au PATH" "White"
        Write-Log "  3. Utiliser Docker: docker compose exec db psql ..." "White"
        exit 1
    }
}

Write-Log "`nTest connexion PostgreSQL..." "Yellow"

$testQuery = "SELECT count(*) FROM sondages;"
$result = & $psqlPath -U $dbUser -d $dbName -t -c $testQuery 2>&1

if ($LASTEXITCODE -eq 0) {
    $nbSondages = $result.Trim()
    Write-Log "[OK] Connexion reussie" "Green"
    Write-Log "Sondages: $nbSondages" "Cyan"
    
    if ($nbSondages -eq "0") {
        Write-Log "`n[ERREUR] Aucun sondage importe !" "Red"
        Write-Log "Action requise: Import REEL (SANS --dry-run)" "Yellow"
        Write-Log "Commande:" "White"
        Write-Log "  python scripts\02_import_excel.py --file atlas_import_example.xlsx --dsn postgresql://atlas:atlas@localhost:5432/atlas_clean --import-raw yes" "Gray"
        
        Write-Log "`nVoulez-vous lancer l'import maintenant ? (o/N)" "Yellow"
        $response = Read-Host
        
        if ($response -eq "o" -or $response -eq "O") {
            Write-Log "`nLancement import..." "Yellow"
            python scripts\02_import_excel.py --file atlas_import_example.xlsx --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" --import-raw yes
            
            if ($LASTEXITCODE -eq 0) {
                Write-Log "[OK] Import reussi" "Green"
            } else {
                Write-Log "[ERREUR] Echec import" "Red"
                exit 1
            }
        } else {
            Write-Log "Import annule - Executez-le manuellement" "Yellow"
            exit 1
        }
    }
    
    # Compteurs detailles
    Write-Log "`nCompteurs detailles:" "Cyan"
    $tables = @('echantillons', 'essais_atterberg', 'essais_vbs', 'raw_lab_agt', 'raw_lab_ags', 'raw_lab_atterberg')
    
    foreach ($table in $tables) {
        $count = (& $psqlPath -U $dbUser -d $dbName -t -c "SELECT count(*) FROM $table;" 2>&1).Trim()
        Write-Log "  - $table : $count" "White"
    }
    
} else {
    Write-Log "[ERREUR] Impossible de se connecter a PostgreSQL" "Red"
    Write-Log "Erreur: $result" "Red"
    Write-Log "`nSolutions:" "Yellow"
    Write-Log "  1. Demarrer PostgreSQL" "White"
    Write-Log "  2. Verifier credentials (user: atlas, password: atlas)" "White"
    Write-Log "  3. Verifier que la base atlas_clean existe" "White"
    exit 1
}

# ============================================================================
# ETAPE 1: VUES
# ============================================================================

Write-Log "`n==================================================================" "Cyan"
Write-Log "[ETAPE 1] VUES - Existence et compteurs" "Cyan"
Write-Log "==================================================================" "Cyan"

$checkVues = @"
SELECT table_name, 
       CASE table_type WHEN 'VIEW' THEN 'Vue' WHEN 'MATERIALIZED VIEW' THEN 'Materialisee' END AS type
FROM information_schema.tables
WHERE table_name IN ('v_sondages_spread', 'v_mailles_geotech', 'mv_mailles_geotech', 'mailles_geotechnique_stats')
ORDER BY table_name;
"@

$vues = & $psqlPath -U $dbUser -d $dbName -c $checkVues 2>&1

Write-Log "`nVues existantes:" "Yellow"
Write-Log $vues "White"

$vueManquante = $false
if ($vues -notmatch "mv_mailles_geotech") {
    Write-Log "`n[WARNING] Vue mv_mailles_geotech manquante !" "Yellow"
    $vueManquante = $true
}

if ($vueManquante) {
    Write-Log "`nVoulez-vous creer les vues maintenant ? (o/N)" "Yellow"
    $response = Read-Host
    
    if ($response -eq "o" -or $response -eq "O") {
        Write-Log "`nCreation vues..." "Yellow"
        & $psqlPath -U $dbUser -d $dbName -f fix_ui_vues_complete.sql
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "[OK] Vues creees" "Green"
            
            Write-Log "`nRefresh vue materialisee..." "Yellow"
            & $psqlPath -U $dbUser -d $dbName -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;" 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Log "[OK] Vue rafraichie" "Green"
            } else {
                Write-Log "[WARNING] Erreur refresh (peut-etre index manquant)" "Yellow"
            }
        } else {
            Write-Log "[ERREUR] Echec creation vues" "Red"
        }
    }
}

# Compteurs vues
if (-not $vueManquante) {
    Write-Log "`nCompteurs vues:" "Yellow"
    $countVue = (& $psqlPath -U $dbUser -d $dbName -t -c "SELECT count(*) FROM mv_mailles_geotech;" 2>&1).Trim()
    Write-Log "  mv_mailles_geotech: $countVue mailles avec stats" "Cyan"
    
    if ($countVue -eq "0") {
        Write-Log "[WARNING] Vue vide - Verifier etape 0 (donnees importees ?)" "Yellow"
    }
}

# ============================================================================
# ETAPE 2: GEOMETRIE ET ADM3
# ============================================================================

Write-Log "`n==================================================================" "Cyan"
Write-Log "[ETAPE 2] GEOMETRIE ET ADM3" "Cyan"
Write-Log "==================================================================" "Cyan"

$checkGeom = @"
SELECT 
  code,
  (geom IS NOT NULL) AS has_geom,
  adm3_code,
  CASE 
    WHEN geom IS NOT NULL THEN 'GPS'
    WHEN adm3_code IS NOT NULL THEN 'ADM3_SPREAD'
    ELSE 'INVISIBLE'
  END AS statut
FROM sondages
ORDER BY code;
"@

$geomResult = & $psqlPath -U $dbUser -d $dbName -c $checkGeom 2>&1
Write-Log "`n$geomResult" "White"

if ($geomResult -match "INVISIBLE") {
    Write-Log "`n[WARNING] Certains sondages sont INVISIBLES (ni GPS ni ADM3)" "Yellow"
    Write-Log "Action: Ajouter adm3_code dans le fichier Excel ou geocoder" "Yellow"
}

# ============================================================================
# ETAPE 3: EXEMPLE DE DONNEES
# ============================================================================

Write-Log "`n==================================================================" "Cyan"
Write-Log "[ETAPE 3] EXEMPLE DE DONNEES" "Cyan"
Write-Log "==================================================================" "Cyan"

$exampleData = @"
SELECT 
  maille_id,
  ROUND(w_avg::numeric, 2) AS w_avg,
  ROUND(ip_avg::numeric, 2) AS ip_avg,
  ROUND(vbs_avg::numeric, 2) AS vbs_avg,
  n AS nb_ech,
  has_spread
FROM mv_mailles_geotech
WHERE w_avg IS NOT NULL OR ip_avg IS NOT NULL OR vbs_avg IS NOT NULL
LIMIT 5;
"@

$example = & $psqlPath -U $dbUser -d $dbName -c $exampleData 2>&1
Write-Log "`n$example" "White"

# ============================================================================
# RESUME
# ============================================================================

Write-Log "`n==================================================================" "Cyan"
Write-Log "RESUME DIAGNOSTIC" "Cyan"
Write-Log "==================================================================" "Cyan"

Write-Log "`nLog complet sauvegarde dans: $logFile" "Yellow"

Write-Log "`nPROCHAINES ETAPES:" "Cyan"
Write-Log "1. Verifier que le serveur backend est demarre" "White"
Write-Log "2. Tester l'API:" "White"
Write-Log "   curl http://localhost:8080/api/mailles/stats?limit=3" "Gray"
Write-Log "3. Rebuild API:" "White"
Write-Log "   docker compose up -d --build api-geo" "Gray"
Write-Log "4. Hard refresh navigateur (Ctrl+Shift+R)" "White"

Write-Log "`n==================================================================" "Cyan"
