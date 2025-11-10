# Script de backup automatisé pour Atlas DB (Windows PowerShell)
# Usage: .\backup_db.ps1 [-Encrypt] [-Upload]

param(
    [switch]$Encrypt,
    [switch]$Upload
)

$ErrorActionPreference = "Stop"

# Configuration
$BACKUP_DIR = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { ".\backups" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "atlas" }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "atlas_clean" }
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
$RETENTION_DAYS = if ($env:RETENTION_DAYS) { [int]$env:RETENTION_DAYS } else { 14 }
$S3_BUCKET = $env:S3_BUCKET

# Créer répertoire de backup
New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null

# Timestamp
$TS = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$COMMIT = try { (git rev-parse --short HEAD 2>$null) } catch { "unknown" }
$FILE = Join-Path $BACKUP_DIR "atlas_${TS}_${COMMIT}.sql.gz"

Write-Host "🔄 Création du backup: $FILE" -ForegroundColor Cyan

# Dump database
$env:PGPASSWORD = $env:PGPASSWORD
try {
    & pg_dump -U $DB_USER -d $DB_NAME -h $DB_HOST -p $DB_PORT | gzip > $FILE
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed"
    }
} catch {
    Write-Host "❌ Erreur lors du dump: $_" -ForegroundColor Red
    exit 1
}

# Checksum
$hash = Get-FileHash -Path $FILE -Algorithm SHA256
"$($hash.Hash)  $(Split-Path $FILE -Leaf)" | Out-File -FilePath "$FILE.sha256" -Encoding ASCII

$size = (Get-Item $FILE).Length / 1MB
Write-Host "✅ Backup créé: $([math]::Round($size, 2)) MB" -ForegroundColor Green

# Encryption (optionnel)
if ($Encrypt) {
    Write-Host "🔐 Chiffrement du backup..." -ForegroundColor Cyan
    if (Get-Command gpg -ErrorAction SilentlyContinue) {
        $passphrase = if ($env:GPG_PASSPHRASE) { $env:GPG_PASSPHRASE } else { "atlas-backup-key" }
        $passphraseFile = [System.IO.Path]::GetTempFileName()
        $passphrase | Out-File -FilePath $passphraseFile -Encoding ASCII -NoNewline
        
        & gpg --symmetric --cipher-algo AES256 --batch --yes --passphrase-file $passphraseFile --output "$FILE.gpg" $FILE
        Remove-Item $passphraseFile -Force
        Remove-Item $FILE -Force
        $FILE = "$FILE.gpg"
        Write-Host "✅ Backup chiffré" -ForegroundColor Green
    } else {
        Write-Host "⚠️  GPG non disponible, backup non chiffré" -ForegroundColor Yellow
    }
}

# Upload S3 (optionnel)
if ($Upload -and $S3_BUCKET) {
    Write-Host "☁️  Upload vers S3..." -ForegroundColor Cyan
    if (Get-Command aws -ErrorAction SilentlyContinue) {
        $basename = Split-Path $FILE -Leaf
        & aws s3 cp $FILE "s3://$S3_BUCKET/atlas/$basename"
        & aws s3 cp "$FILE.sha256" "s3://$S3_BUCKET/atlas/$basename.sha256"
        Write-Host "✅ Backup uploadé vers S3" -ForegroundColor Green
    } else {
        Write-Host "⚠️  AWS CLI non disponible" -ForegroundColor Yellow
    }
}

# Rotation (garder seulement les N derniers jours)
Write-Host "🧹 Nettoyage des anciens backups (> $RETENTION_DAYS jours)..." -ForegroundColor Cyan
$cutoffDate = (Get-Date).AddDays(-$RETENTION_DAYS)
Get-ChildItem -Path $BACKUP_DIR -Filter "atlas_*.sql.gz*" | 
    Where-Object { $_.LastWriteTime -lt $cutoffDate } | 
    Remove-Item -Force

Write-Host "✅ Backup terminé avec succès" -ForegroundColor Green
Write-Host "📁 Fichier: $FILE" -ForegroundColor Cyan
