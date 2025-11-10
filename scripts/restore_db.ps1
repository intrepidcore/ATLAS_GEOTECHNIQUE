# Script de restore pour Atlas DB (Windows PowerShell)
# Usage: .\restore_db.ps1 -BackupFile <path> [-Decrypt]

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [switch]$Decrypt
)

$ErrorActionPreference = "Stop"

# Configuration
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "atlas" }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "atlas_clean" }
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }

if (-not (Test-Path $BackupFile)) {
    Write-Host "❌ Fichier non trouvé: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "🔄 Restore de: $BackupFile" -ForegroundColor Cyan

$tempFile = $BackupFile

# Decrypt si nécessaire
if ($Decrypt -or $BackupFile.EndsWith(".gpg")) {
    Write-Host "🔓 Déchiffrement du backup..." -ForegroundColor Cyan
    if (Get-Command gpg -ErrorAction SilentlyContinue) {
        $passphrase = if ($env:GPG_PASSPHRASE) { $env:GPG_PASSPHRASE } else { "atlas-backup-key" }
        $passphraseFile = [System.IO.Path]::GetTempFileName()
        $passphrase | Out-File -FilePath $passphraseFile -Encoding ASCII -NoNewline
        
        $tempFile = [System.IO.Path]::GetTempFileName() + ".sql.gz"
        & gpg --decrypt --batch --yes --passphrase-file $passphraseFile --output $tempFile $BackupFile
        Remove-Item $passphraseFile -Force
        Write-Host "✅ Backup déchiffré" -ForegroundColor Green
    } else {
        Write-Host "❌ GPG non disponible" -ForegroundColor Red
        exit 1
    }
}

# Vérifier checksum si disponible
$checksumFile = "$BackupFile.sha256"
if (Test-Path $checksumFile) {
    Write-Host "🔍 Vérification du checksum..." -ForegroundColor Cyan
    $expectedHash = (Get-Content $checksumFile).Split()[0]
    $actualHash = (Get-FileHash -Path $tempFile -Algorithm SHA256).Hash
    if ($expectedHash -eq $actualHash) {
        Write-Host "✅ Checksum valide" -ForegroundColor Green
    } else {
        Write-Host "❌ Checksum invalide!" -ForegroundColor Red
        exit 1
    }
}

# Confirmation
Write-Host "⚠️  ATTENTION: Cette opération va ÉCRASER la base de données $DB_NAME" -ForegroundColor Yellow
$confirm = Read-Host "Continuer? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "❌ Restore annulé" -ForegroundColor Red
    exit 0
}

# Restore
Write-Host "🔄 Restoration en cours..." -ForegroundColor Cyan
$env:PGPASSWORD = $env:PGPASSWORD

try {
    # Décompresser et restaurer
    & gunzip -c $tempFile | psql -U $DB_USER -d $DB_NAME -h $DB_HOST -p $DB_PORT
    if ($LASTEXITCODE -ne 0) {
        throw "psql restore failed"
    }
    Write-Host "✅ Restore terminé avec succès" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors du restore: $_" -ForegroundColor Red
    exit 1
} finally {
    # Nettoyer fichier temporaire si déchiffré
    if ($tempFile -ne $BackupFile -and (Test-Path $tempFile)) {
        Remove-Item $tempFile -Force
    }
}
