# Script de backup automatisé pour Atlas DB (Windows PowerShell)
# Usage: .\backup_db.ps1 [-Encrypt] [-Upload]

# Charger la configuration centralisée
. "$PSScriptRoot\config.ps1"

param(
    [switch]$Encrypt,
    [switch]$Upload
)

$ErrorActionPreference = "Stop"

# Configuration (avec override par variables d'environnement)
$BACKUP_DIR = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { $Global:ATLAS_BACKUP_PATH }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { $Global:ATLAS_DB_USER }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { $Global:ATLAS_DB_NAME }
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { $Global:ATLAS_DB_HOST }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { $Global:ATLAS_DB_PORT }
$RETENTION_DAYS = if ($env:RETENTION_DAYS) { [int]$env:RETENTION_DAYS } else { 14 }
$S3_BUCKET = $env:S3_BUCKET

# Créer répertoire de backup
New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null

# Timestamp
$TS = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$COMMIT = try { (git rev-parse --short HEAD 2>$null) } catch { "unknown" }
$FILE = Join-Path $BACKUP_DIR "atlas_${TS}_${COMMIT}.sql.gz"

Write-AtlasLog "Création du backup: $FILE" -Level 'Info'

# Dump database
$env:PGPASSWORD = $env:PGPASSWORD
try {
    & pg_dump -U $DB_USER -d $DB_NAME -h $DB_HOST -p $DB_PORT | gzip > $FILE
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed"
    }
} catch {
    Write-AtlasLog "Erreur lors du dump: $_" -Level 'Error'
    exit 1
}

# Checksum
$hash = Get-FileHash -Path $FILE -Algorithm SHA256
"$($hash.Hash)  $(Split-Path $FILE -Leaf)" | Out-File -FilePath "$FILE.sha256" -Encoding ASCII

$size = (Get-Item $FILE).Length / 1MB
Write-AtlasLog "Backup créé: $([math]::Round($size, 2)) MB" -Level 'Success'

# Encryption (optionnel)
if ($Encrypt) {
    Write-AtlasLog "Chiffrement du backup..." -Level 'Info'
    if (Get-Command gpg -ErrorAction SilentlyContinue) {
        $passphrase = if ($env:GPG_PASSPHRASE) { $env:GPG_PASSPHRASE } else { "atlas-backup-key" }
        $passphraseFile = [System.IO.Path]::GetTempFileName()
        $passphrase | Out-File -FilePath $passphraseFile -Encoding ASCII -NoNewline
        
        & gpg --symmetric --cipher-algo AES256 --batch --yes --passphrase-file $passphraseFile --output "$FILE.gpg" $FILE
        Remove-Item $passphraseFile -Force
        Remove-Item $FILE -Force
        $FILE = "$FILE.gpg"
        Write-AtlasLog "Backup chiffré" -Level 'Success'
    } else {
        Write-AtlasLog "GPG non disponible, backup non chiffré" -Level 'Warning'
    }
}

# Upload S3 (optionnel)
if ($Upload -and $S3_BUCKET) {
    Write-AtlasLog "Upload vers S3..." -Level 'Info'
    if (Get-Command aws -ErrorAction SilentlyContinue) {
        $basename = Split-Path $FILE -Leaf
        & aws s3 cp $FILE "s3://$S3_BUCKET/atlas/$basename"
        & aws s3 cp "$FILE.sha256" "s3://$S3_BUCKET/atlas/$basename.sha256"
        Write-AtlasLog "Backup uploadé vers S3" -Level 'Success'
    } else {
        Write-AtlasLog "AWS CLI non disponible" -Level 'Warning'
    }
}

# Rotation (garder seulement les N derniers jours)
Write-AtlasLog "Nettoyage des anciens backups (> $RETENTION_DAYS jours)..." -Level 'Info'
$cutoffDate = (Get-Date).AddDays(-$RETENTION_DAYS)
Get-ChildItem -Path $BACKUP_DIR -Filter "atlas_*.sql.gz*" | 
    Where-Object { $_.LastWriteTime -lt $cutoffDate } | 
    Remove-Item -Force

Write-AtlasLog "Backup terminé avec succès" -Level 'Success'
Write-AtlasLog "Fichier: $FILE" -Level 'Info'
