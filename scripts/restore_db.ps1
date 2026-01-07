# Script de restore pour Atlas DB (Windows PowerShell)
# Usage: .\restore_db.ps1 -BackupFile <path> [-Decrypt]

# Charger la configuration centralisée
. "$PSScriptRoot\config.ps1"

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [switch]$Decrypt
)

$ErrorActionPreference = "Stop"

# Configuration (avec override par variables d'environnement)
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { $Global:ATLAS_DB_USER }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { $Global:ATLAS_DB_NAME }
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { $Global:ATLAS_DB_HOST }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { $Global:ATLAS_DB_PORT }

if (-not (Test-Path $BackupFile)) {
    Write-AtlasLog "Fichier non trouvé: $BackupFile" -Level 'Error'
    exit 1
}

Write-AtlasLog "Restore de: $BackupFile" -Level 'Info'

$tempFile = $BackupFile

# Decrypt si nécessaire
if ($Decrypt -or $BackupFile.EndsWith(".gpg")) {
    Write-AtlasLog "Déchiffrement du backup..." -Level 'Info'
    if (Get-Command gpg -ErrorAction SilentlyContinue) {
        $passphrase = if ($env:GPG_PASSPHRASE) { $env:GPG_PASSPHRASE } else { "atlas-backup-key" }
        $passphraseFile = [System.IO.Path]::GetTempFileName()
        $passphrase | Out-File -FilePath $passphraseFile -Encoding ASCII -NoNewline
        
        $tempFile = [System.IO.Path]::GetTempFileName() + ".sql.gz"
        & gpg --decrypt --batch --yes --passphrase-file $passphraseFile --output $tempFile $BackupFile
        Remove-Item $passphraseFile -Force
        Write-AtlasLog "Backup déchiffré" -Level 'Success'
    } else {
        Write-AtlasLog "GPG non disponible" -Level 'Error'
        exit 1
    }
}

# Vérifier checksum si disponible
$checksumFile = "$BackupFile.sha256"
if (Test-Path $checksumFile) {
    Write-AtlasLog "Vérification du checksum..." -Level 'Info'
    $expectedHash = (Get-Content $checksumFile).Split()[0]
    $actualHash = (Get-FileHash -Path $tempFile -Algorithm SHA256).Hash
    if ($expectedHash -eq $actualHash) {
        Write-AtlasLog "Checksum valide" -Level 'Success'
    } else {
        Write-AtlasLog "Checksum invalide!" -Level 'Error'
        exit 1
    }
}

# Confirmation
Write-AtlasLog "ATTENTION: Cette opération va ÉCRASER la base de données $DB_NAME" -Level 'Warning'
$confirm = Read-Host "Continuer? (yes/no)"
if ($confirm -ne "yes") {
    Write-AtlasLog "Restore annulé" -Level 'Warning'
    exit 0
}

# Restore
Write-AtlasLog "Restoration en cours..." -Level 'Info'
$env:PGPASSWORD = $env:PGPASSWORD

try {
    # Décompresser et restaurer
    & gunzip -c $tempFile | psql -U $DB_USER -d $DB_NAME -h $DB_HOST -p $DB_PORT
    if ($LASTEXITCODE -ne 0) {
        throw "psql restore failed"
    }
    Write-AtlasLog "Restore terminé avec succès" -Level 'Success'
} catch {
    Write-AtlasLog "Erreur lors du restore: $_" -Level 'Error'
    exit 1
} finally {
    # Nettoyer fichier temporaire si déchiffré
    if ($tempFile -ne $BackupFile -and (Test-Path $tempFile)) {
        Remove-Item $tempFile -Force
    }
}
