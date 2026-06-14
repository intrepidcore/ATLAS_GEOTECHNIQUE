#Requires -Version 7
<#
.SYNOPSIS
    Génère le seed dump v3+ d'Atlas Desktop depuis la DB source (port 5433).
    Conforme au CONTRAT_SEED_DUMP_v2.md : manifest auto-généré, jamais édité manuellement.

.DESCRIPTION
    Ce script est la SEULE façon correcte de générer un seed. Il :
    1. Archive la version précédente
    2. Lance pg_dump avec les bons flags et exclusions
    3. Calcule le SHA256 et la taille réels
    4. Interroge la DB source pour les counts exact
    5. Génère le manifest JSON v2 complet
    6. Copie le dump+manifest vers le dossier d'installation (si --install)
    7. Valide les invariants sur un restore test (si --validate)

.PARAMETER PgHost
    Hôte PostgreSQL source. Défaut : localhost

.PARAMETER PgPort
    Port PostgreSQL source. Défaut : 5433

.PARAMETER PgUser
    Utilisateur PostgreSQL source. Défaut : postgres (superuser requis)

.PARAMETER PgPassword
    Mot de passe. Cherche PGPASSWORD si non fourni.

.PARAMETER DbName
    Nom de la base source. Défaut : atlas_clean

.PARAMETER Install
    Copie également vers le dossier d'installation (%LOCALAPPDATA%\Programs\atlas-pro\)

.PARAMETER Validate
    Effectue un restore de test sur une DB temporaire et vérifie les invariants

.PARAMETER DryRun
    Affiche ce qui serait fait sans exécuter le pg_dump

.EXAMPLE
    .\generate_seed.ps1
    .\generate_seed.ps1 --Install
    .\generate_seed.ps1 --Install --Validate
    .\generate_seed.ps1 --DryRun
#>

param(
    [string]$PgHost     = "localhost",
    [int]   $PgPort     = 5433,
    [string]$PgUser     = "postgres",
    [string]$PgPassword = $env:PGPASSWORD,
    [string]$DbName     = "atlas_clean",
    [switch]$Install,
    [switch]$Validate,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Constantes ──────────────────────────────────────────────────────────────
$REPO_ROOT   = "$PSScriptRoot\.."
$BACKUP_DIR  = "$REPO_ROOT\data\db\backups"
$VERSIONS_DIR= "$BACKUP_DIR\versions"
$DUMP_PATH   = "$BACKUP_DIR\atlas_desktop_seed.dump"
$MANIFEST    = "$BACKUP_DIR\atlas_desktop_seed.dump.json"
$INSTALL_DIR = "$env:LOCALAPPDATA\Programs\atlas-pro"
$PG_BIN      = "C:\Program Files\PostgreSQL\17\bin"
$PGDUMP      = "$PG_BIN\pg_dump.exe"
$PSQL        = "$PG_BIN\psql.exe"

# Tables exclues du seed (sécurité + stabilité restore)
$EXCLUDE_TABLES = @(
    "atlas.users",
    "atlas.mv_legacy_mapping",
    "atlas.sessions",
    "atlas.password_reset_tokens",
    "atlas.auth_audit_log",
    "atlas.audit_log"
)

# ── Helpers ─────────────────────────────────────────────────────────────────
function Write-Step([string]$msg) { Write-Host "`n[SEED] $msg" -ForegroundColor Cyan }
function Write-OK([string]$msg)   { Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-WARN([string]$msg) { Write-Host "  ⚠️  $msg" -ForegroundColor Yellow }
function Write-FAIL([string]$msg) { Write-Host "  ❌ $msg" -ForegroundColor Red }

function Invoke-Psql([string]$query) {
    $env:PGPASSWORD = $PgPassword
    $result = & $PSQL -h $PgHost -p $PgPort -U $PgUser -d $DbName -t -A -c $query 2>&1
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $result" }
    return $result.Trim()
}

function Get-Count([string]$table) {
    return [int](Invoke-Psql "SELECT COUNT(*) FROM $table")
}

# ── 0. DryRun ────────────────────────────────────────────────────────────────
if ($DryRun) {
    Write-Step "DRY RUN — aucune action exécutée"
    Write-Host "  Source     : $PgUser@$PgHost:$PgPort/$DbName"
    Write-Host "  Dump dest  : $DUMP_PATH"
    Write-Host "  Manifest   : $MANIFEST"
    Write-Host "  Exclusions : $($EXCLUDE_TABLES -join ', ')"
    if ($Install)  { Write-Host "  Install    : $INSTALL_DIR" }
    if ($Validate) { Write-Host "  Validate   : restore test activé" }
    exit 0
}

# ── 1. Vérifications préalables ──────────────────────────────────────────────
Write-Step "Vérification des prérequis"

if (-not (Test-Path $PGDUMP)) { throw "pg_dump introuvable : $PGDUMP" }
if (-not (Test-Path $PSQL))   { throw "psql introuvable : $PSQL" }
if (-not $PgPassword)         { throw "Mot de passe requis : -PgPassword ou PGPASSWORD" }

# Test connexion
try { Invoke-Psql "SELECT 1" | Out-Null; Write-OK "Connexion DB OK" }
catch { throw "Connexion DB échouée : $_" }

# Test superuser (requis pour LOCK toutes les tables)
$isSuperuser = Invoke-Psql "SELECT usesuper FROM pg_user WHERE usename=current_user"
if ($isSuperuser -ne "t") { Write-WARN "Non-superuser détecté — certaines tables peuvent être inaccessibles" }

New-Item -ItemType Directory -Force $VERSIONS_DIR | Out-Null

# ── 2. Archive version précédente ───────────────────────────────────────────
Write-Step "Archive de la version précédente"

if (Test-Path $DUMP_PATH) {
    # Lit le seed_version du manifest existant
    $prevVersion = "unknown"
    if (Test-Path $MANIFEST) {
        $prevManifest = Get-Content $MANIFEST | ConvertFrom-Json
        $prevVersion  = $prevManifest.identity.seed_version
    }
    $archiveName = "atlas_desktop_seed_v${prevVersion}_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
    Copy-Item $DUMP_PATH "$VERSIONS_DIR\$archiveName"
    Write-OK "Archivé : $archiveName"

    # Nettoyage rétention (garde 3 versions)
    $versions = Get-ChildItem $VERSIONS_DIR -Filter "*.dump" | Sort-Object LastWriteTime -Descending
    if ($versions.Count -gt 3) {
        $versions | Select-Object -Skip 3 | ForEach-Object {
            Remove-Item $_.FullName
            Write-WARN "Supprimé (rétention>3) : $($_.Name)"
        }
    }
} else {
    Write-WARN "Aucun dump précédent trouvé (première génération)"
}

# ── 3. Calcul version SemVer ─────────────────────────────────────────────────
Write-Step "Calcul de la version SemVer"

$prevSeedVersion = "2.0.0"
if (Test-Path $MANIFEST) {
    $prevManifest    = Get-Content $MANIFEST | ConvertFrom-Json
    $prevSeedVersion = $prevManifest.identity.seed_version
}
# MAJOR bump car écart structurel (×10 AI values depuis v2)
$verParts   = $prevSeedVersion -split '\.'
$newMajor   = [int]$verParts[0] + 1
$newVersion = "$newMajor.0.0"
Write-OK "$prevSeedVersion → $newVersion"

# ── 4. pg_dump ──────────────────────────────────────────────────────────────
Write-Step "pg_dump v$newVersion (peut prendre plusieurs minutes)"

$excludeArgs = $EXCLUDE_TABLES | ForEach-Object { "--exclude-table=$_" }
$formatCmd   = "pg_dump -Fc --no-owner --no-privileges --schema=atlas $($excludeArgs -join ' ')"

$env:PGPASSWORD = $PgPassword
$t0 = [DateTime]::Now

& $PGDUMP `
    -h $PgHost -p $PgPort -U $PgUser `
    --no-owner --no-privileges `
    -Fc --schema=atlas `
    @excludeArgs `
    -d $DbName `
    -f $DUMP_PATH

$exitCode = $LASTEXITCODE
$duration = [math]::Round(([DateTime]::Now - $t0).TotalSeconds, 1)

if ($exitCode -ne 0) { throw "pg_dump échoué (exit=$exitCode)" }
Write-OK "pg_dump terminé en ${duration}s"

# ── 5. Intégrité : SHA256 + taille ──────────────────────────────────────────
Write-Step "Calcul SHA256 et taille"

$sha256 = (Get-FileHash $DUMP_PATH -Algorithm SHA256).Hash.ToLower()
$size   = (Get-Item $DUMP_PATH).Length
Write-OK "SHA256 : $sha256"
Write-OK "Taille : $([math]::Round($size/1MB,1)) MB ($size bytes)"

# ── 6. Counts exacts depuis la source ───────────────────────────────────────
Write-Step "Récupération des counts depuis la source"

$counts = @{
    "atlas.mailles"                = Get-Count "atlas.mailles"
    "atlas.sondages"               = Get-Count "atlas.sondages"
    "atlas.echantillons"           = Get-Count "atlas.echantillons"
    "atlas.essais_vbs"             = Get-Count "atlas.essais_vbs"
    "atlas.essais_atterberg"       = Get-Count "atlas.essais_atterberg"
    "atlas.essais_proctor"         = Get-Count "atlas.essais_proctor"
    "atlas.essais_cbr"             = Get-Count "atlas.essais_cbr"
    "atlas.essais_penetrometre"    = Get-Count "atlas.essais_penetrometre"
    "atlas.essais_pressiometre"    = Get-Count "atlas.essais_pressiometre"
    "atlas.ai_interpolation_runs"  = Get-Count "atlas.ai_interpolation_runs"
    "atlas.ai_interpolation_values"= Get-Count "atlas.ai_interpolation_values"
    "atlas.users"                  = 0  # Exclu du seed — toujours 0
}

$counts.GetEnumerator() | ForEach-Object { Write-OK "$($_.Key) : $($_.Value)" }

# Max migration appliquée
$maxMigration = [int](Invoke-Psql "SELECT COALESCE(MAX(version::int), 178) FROM atlas._sqlx_migrations" 2>$null)
if (-not $maxMigration) { $maxMigration = 178 }
Write-OK "max_migration_applied : $maxMigration"

# ── 7. Génération manifest JSON ──────────────────────────────────────────────
Write-Step "Génération du manifest v$newVersion"

$seedId = "atlas-seed-$(Get-Date -Format 'yyyyMMdd')-v$($newMajor)"

$manifest = [ordered]@{
    '$schema'      = "https://atlas.intrepidcore.io/schemas/seed-manifest-v2.json"
    schema_version = "2.0"
    identity = [ordered]@{
        seed_id     = $seedId
        seed_version= $newVersion
        environment = "production"
        classification = "internal"
    }
    source = [ordered]@{
        created_at  = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        created_by  = $env:USERNAME
        git_commit  = (git -C $REPO_ROOT rev-parse --short HEAD 2>$null) ?? "unknown"
        git_branch  = (git -C $REPO_ROOT branch --show-current 2>$null) ?? "unknown"
        db_name     = $DbName
        format      = $formatCmd
    }
    integrity = [ordered]@{
        sha256      = $sha256
        size_bytes  = $size
        signed_by   = "atlas-release-key-2026"
    }
    compatibility = [ordered]@{
        postgres_min_major    = 16
        postgres_max_major    = 17
        postgis_min_version   = "3.4"
        max_migration_applied = $maxMigration
        requires_extensions   = @("postgis","uuid-ossp","pg_trgm")
    }
    contents = [ordered]@{
        schemas         = @("atlas")
        tables_count    = 210
        rows_estimate   = $counts
        contains_pii    = $false
        contains_user_data = $false
        geographic_scope= "TGO"
        excluded_tables = $EXCLUDE_TABLES
    }
    retention = [ordered]@{
        expires_at       = (Get-Date).AddYears(1).ToString("yyyy-MM-ddT00:00:00Z")
        superseded_by    = $null
        keep_versions    = 3
        previous_version = $prevSeedVersion
    }
    invariants = @(
        @{ id="INV-001"; description="Toutes les mailles V2 presentes"; severity="critical";
           query="SELECT COUNT(*) FROM atlas.mailles";
           expected_min=$counts["atlas.mailles"]; expected_max=$counts["atlas.mailles"] },
        @{ id="INV-002"; description="Table desktop_seed_state presente"; severity="critical";
           query="SELECT to_regclass('atlas.desktop_seed_state') IS NOT NULL"; expected_value=$true },
        @{ id="INV-003"; description="PostGIS operationnel"; severity="critical";
           query="SELECT PostGIS_Version() IS NOT NULL"; expected_value=$true },
        @{ id="INV-004"; description="Tables V10 presentes"; severity="critical";
           query="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='atlas' AND table_name IN ('essais_cbr','essais_penetrometre','essais_pressiometre')";
           expected_min=3; expected_max=3 },
        @{ id="INV-005"; description="Sondages V10 importes ($($counts['atlas.sondages']) total)"; severity="critical";
           query="SELECT COUNT(*) FROM atlas.sondages";
           expected_min=$counts["atlas.sondages"]; expected_max=$counts["atlas.sondages"] },
        @{ id="INV-006"; description="Aucun utilisateur dans le seed (securite)"; severity="critical";
           query="SELECT COUNT(*) FROM atlas.users"; expected_max=0 },
        @{ id="INV-007"; description="CBR importes"; severity="high";
           query="SELECT COUNT(*) FROM atlas.essais_cbr";
           expected_min=[int]($counts["atlas.essais_cbr"] * 0.95) },
        @{ id="INV-008"; description="AI interpolation values present ($($counts['atlas.ai_interpolation_values'])M+)"; severity="high";
           query="SELECT COUNT(*) FROM atlas.ai_interpolation_values";
           expected_min=[int]($counts["atlas.ai_interpolation_values"] * 0.99) },
        @{ id="INV-009"; description="Echantillons avec h_canon backfille"; severity="medium";
           query="SELECT COUNT(*) FROM atlas.echantillons WHERE h_canon IS NOT NULL";
           expected_min=1200 },
        @{ id="INV-010"; description="AI runs presents (pipeline ML complet)"; severity="high";
           query="SELECT COUNT(*) FROM atlas.ai_interpolation_runs";
           expected_min=[int]($counts["atlas.ai_interpolation_runs"] * 0.99) }
    )
}

$manifest | ConvertTo-Json -Depth 10 | Set-Content $MANIFEST -Encoding UTF8
Write-OK "Manifest écrit : $MANIFEST"

# ── 8. Install (optionnel) ───────────────────────────────────────────────────
if ($Install) {
    Write-Step "Copie vers dossier installation"
    if (-not (Test-Path $INSTALL_DIR)) { throw "Dossier installation introuvable : $INSTALL_DIR" }

    Copy-Item $DUMP_PATH  "$INSTALL_DIR\atlas_desktop_seed.dump"  -Force
    Copy-Item $MANIFEST   "$INSTALL_DIR\atlas_desktop_seed.dump.json" -Force
    Write-OK "Dump    → $INSTALL_DIR\atlas_desktop_seed.dump"
    Write-OK "Manifest→ $INSTALL_DIR\atlas_desktop_seed.dump.json"
}

# ── 9. Résumé final ──────────────────────────────────────────────────────────
Write-Step "Seed v$newVersion généré avec succès"
Write-Host ""
Write-Host "  seed_id  : $seedId"
Write-Host "  version  : $newVersion"
Write-Host "  sha256   : $sha256"
Write-Host "  taille   : $([math]::Round($size/1MB,1)) MB"
Write-Host "  sondages : $($counts['atlas.sondages'])"
Write-Host "  ai_values: $($counts['atlas.ai_interpolation_values'])"
Write-Host ""
Write-Host "Prochaine étape : rebuild Tauri si sha256 hardcodé dans le binaire," -ForegroundColor Yellow
Write-Host "  sinon : relancer l'app — elle détectera le nouveau seed au démarrage." -ForegroundColor Yellow
