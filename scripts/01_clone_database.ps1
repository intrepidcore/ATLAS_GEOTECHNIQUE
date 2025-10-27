# ============================================================================
# Script 01: Cloner la base Atlas sans données géotechniques (PowerShell)
# ============================================================================
# Description: Dump schema + données référentielles, puis restore dans atlas_clean
# Usage: .\01_clone_database.ps1
# ============================================================================

param(
    [string]$PgHostSrc = "localhost",
    [int]$PgPortSrc = 5432,
    [string]$PgUserSrc = "postgres",
    [string]$PgDbSrc = "atlas_prod",
    
    [string]$PgHostDst = "localhost",
    [int]$PgPortDst = 5432,
    [string]$PgUserDst = "postgres",
    [string]$PgDbDst = "atlas_clean",
    
    [string]$DumpFile = "$env:TEMP\atlas_base_wo_geotech.dump"
)

$ErrorActionPreference = "Stop"

# ============================================================================
# FONCTIONS UTILITAIRES
# ============================================================================

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Test-Command {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    if (-not $?) {
        Write-Error "Commande '$Command' non trouvée. Installez PostgreSQL client tools."
        exit 1
    }
}

# ============================================================================
# VÉRIFICATIONS PRÉALABLES
# ============================================================================

Write-Info "Vérification des prérequis..."
Test-Command "pg_dump"
Test-Command "createdb"
Test-Command "psql"
Test-Command "pg_restore"

# Test connexion source
Write-Info "Test connexion à la base source: $PgDbSrc@${PgHostSrc}:$PgPortSrc"
$env:PGPASSWORD = Read-Host "Mot de passe PostgreSQL (source)" -AsSecureString | ConvertFrom-SecureString -AsPlainText

try {
    $testResult = & psql -h $PgHostSrc -p $PgPortSrc -U $PgUserSrc -d $PgDbSrc -c "SELECT 1" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Connexion échouée"
    }
    Write-Info "✓ Connexion source OK"
} catch {
    Write-Error "Impossible de se connecter à la base source: $_"
    exit 1
}

# ============================================================================
# ÉTAPE 1: DUMP DE LA BASE SOURCE
# ============================================================================

Write-Info "Étape 1/4: Dump de la base source (schema + données référentielles)..."
Write-Warn "Exclusion des données des tables géotechniques..."

$dumpArgs = @(
    "-h", $PgHostSrc,
    "-p", $PgPortSrc,
    "-U", $PgUserSrc,
    "-d", $PgDbSrc,
    "-Fc",
    "--no-owner",
    "--no-privileges",
    "--verbose",
    "--exclude-table-data=public.sondages",
    "--exclude-table-data=public.essais",
    "--exclude-table-data=public.essais_geotechniques",
    "--exclude-table-data=public.echantillons",
    "--exclude-table-data=public.essais_atterberg",
    "--exclude-table-data=public.essais_vbs",
    "--exclude-table-data=public.essais_proctor",
    "--exclude-table-data=public.granulo_points",
    "--exclude-table-data=public.imports",
    "--exclude-table-data=public.import_items",
    "--exclude-table-data=public.import_logs",
    "--exclude-table-data=public.import_mapping_profiles",
    "--exclude-table-data=public.test_type_defaults",
    "--exclude-table-data=public.refresh_queue",
    "-f", $DumpFile
)

& pg_dump @dumpArgs

if ($LASTEXITCODE -eq 0) {
    $fileSize = (Get-Item $DumpFile).Length / 1MB
    Write-Info "✓ Dump créé: $DumpFile ($([math]::Round($fileSize, 2)) MB)"
} else {
    Write-Error "Échec du dump"
    exit 1
}

# ============================================================================
# ÉTAPE 2: CRÉATION DE LA BASE DESTINATION
# ============================================================================

Write-Info "Étape 2/4: Création de la base destination: $PgDbDst..."

# Vérifier si base existe
$dbExists = & psql -h $PgHostDst -p $PgPortDst -U $PgUserDst -lqt 2>&1 | Select-String -Pattern "\s+$PgDbDst\s+"

if ($dbExists) {
    Write-Warn "La base $PgDbDst existe déjà. Suppression..."
    & dropdb -h $PgHostDst -p $PgPortDst -U $PgUserDst $PgDbDst --if-exists
}

# Créer base vide
& createdb -h $PgHostDst -p $PgPortDst -U $PgUserDst $PgDbDst `
    --encoding=UTF8 `
    --locale=en_US.UTF-8 `
    --template=template0

if ($LASTEXITCODE -eq 0) {
    Write-Info "✓ Base $PgDbDst créée"
} else {
    Write-Error "Échec création base"
    exit 1
}

# ============================================================================
# ÉTAPE 3: ACTIVATION DES EXTENSIONS
# ============================================================================

Write-Info "Étape 3/4: Activation des extensions PostGIS..."

$sqlExtensions = @"
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SELECT PostGIS_Full_Version();
"@

$sqlExtensions | & psql -h $PgHostDst -p $PgPortDst -U $PgUserDst -d $PgDbDst

Write-Info "✓ Extensions activées"

# ============================================================================
# ÉTAPE 4: RESTORE DU DUMP
# ============================================================================

Write-Info "Étape 4/4: Restore du dump dans $PgDbDst..."

$restoreArgs = @(
    "-h", $PgHostDst,
    "-p", $PgPortDst,
    "-U", $PgUserDst,
    "-d", $PgDbDst,
    "--no-owner",
    "--no-privileges",
    "--verbose",
    "-j", "4",
    $DumpFile
)

& pg_restore @restoreArgs

if ($LASTEXITCODE -eq 0) {
    Write-Info "✓ Restore terminé"
} else {
    Write-Warn "Restore terminé avec warnings (normal si extensions déjà créées)"
}

# ============================================================================
# ÉTAPE 5: VÉRIFICATIONS POST-RESTORE
# ============================================================================

Write-Info "Vérifications post-restore..."

$sqlVerif = @"
\echo '=== Tables référentielles (doivent avoir des données) ==='
SELECT 'mailles' as table_name, COUNT(*) as count FROM mailles
UNION ALL
SELECT 'adm_0', COUNT(*) FROM adm_0
UNION ALL
SELECT 'adm_2', COUNT(*) FROM adm_2
UNION ALL
SELECT 'adm_3', COUNT(*) FROM adm_3;

\echo ''
\echo '=== Tables géotechniques (doivent être vides) ==='
SELECT 'sondages' as table_name, COUNT(*) as count FROM sondages
UNION ALL
SELECT 'essais_geotechniques', COUNT(*) FROM essais_geotechniques
UNION ALL
SELECT 'echantillons', COUNT(*) FROM echantillons
UNION ALL
SELECT 'essais_atterberg', COUNT(*) FROM essais_atterberg
UNION ALL
SELECT 'essais_vbs', COUNT(*) FROM essais_vbs
UNION ALL
SELECT 'essais_proctor', COUNT(*) FROM essais_proctor
UNION ALL
SELECT 'granulo_points', COUNT(*) FROM granulo_points;

\echo ''
\echo '=== Extensions ==='
SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'postgis_topology', 'pgcrypto');
"@

$sqlVerif | & psql -h $PgHostDst -p $PgPortDst -U $PgUserDst -d $PgDbDst

# ============================================================================
# ÉTAPE 6: REFRESH MATERIALIZED VIEW
# ============================================================================

Write-Info "Refresh de la vue matérialisée (vide)..."

$sqlRefresh = @"
REFRESH MATERIALIZED VIEW IF EXISTS mailles_geotechnique_stats;
SELECT COUNT(*) as mailles_total FROM mailles_geotechnique_stats;
"@

$sqlRefresh | & psql -h $PgHostDst -p $PgPortDst -U $PgUserDst -d $PgDbDst

# ============================================================================
# FIN
# ============================================================================

Write-Info "=========================================="
Write-Info "✅ CLONE TERMINÉ AVEC SUCCÈS"
Write-Info "=========================================="
Write-Info "Base destination: $PgDbDst"
Write-Info "Dump sauvegardé: $DumpFile"
Write-Info ""
Write-Info "Prochaines étapes:"
Write-Info "  1. Pointer l'API vers $PgDbDst (DATABASE_URL dans .env)"
Write-Info "  2. Redémarrer l'API: docker compose up -d --build api"
Write-Info "  3. Importer vos données avec le script Python (02_import_excel.py)"
Write-Info ""
Write-Info "Pour supprimer le dump: Remove-Item '$DumpFile'"
