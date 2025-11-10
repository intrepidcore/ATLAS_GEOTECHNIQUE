#!/bin/bash
# Script de backup automatisé pour Atlas DB
# Usage: ./backup_db.sh [--encrypt] [--upload]

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_USER="${DB_USER:-atlas}"
DB_NAME="${DB_NAME:-atlas_clean}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
S3_BUCKET="${S3_BUCKET:-}"

# Options
ENCRYPT=false
UPLOAD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --encrypt) ENCRYPT=true; shift ;;
        --upload) UPLOAD=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Créer répertoire de backup
mkdir -p "$BACKUP_DIR"

# Timestamp
TS=$(date -u +"%Y%m%dT%H%M%SZ")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
FILE="$BACKUP_DIR/atlas_${TS}_${COMMIT}.sql.gz"

echo "🔄 Création du backup: $FILE"

# Dump database
if ! pg_dump -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" | gzip > "$FILE"; then
    echo "❌ Erreur lors du dump"
    exit 1
fi

# Checksum
sha256sum "$FILE" > "${FILE}.sha256"
echo "✅ Backup créé: $(du -h "$FILE" | cut -f1)"

# Encryption (optionnel)
if [ "$ENCRYPT" = true ]; then
    echo "🔐 Chiffrement du backup..."
    if command -v gpg &> /dev/null; then
        gpg --symmetric --cipher-algo AES256 --batch --yes --passphrase-file <(echo "${GPG_PASSPHRASE:-atlas-backup-key}") --output "${FILE}.gpg" "$FILE"
        rm "$FILE"
        FILE="${FILE}.gpg"
        echo "✅ Backup chiffré"
    else
        echo "⚠️  GPG non disponible, backup non chiffré"
    fi
fi

# Upload S3 (optionnel)
if [ "$UPLOAD" = true ] && [ -n "$S3_BUCKET" ]; then
    echo "☁️  Upload vers S3..."
    if command -v aws &> /dev/null; then
        aws s3 cp "$FILE" "s3://${S3_BUCKET}/atlas/$(basename "$FILE")"
        aws s3 cp "${FILE}.sha256" "s3://${S3_BUCKET}/atlas/$(basename "${FILE}.sha256")"
        echo "✅ Backup uploadé vers S3"
    else
        echo "⚠️  AWS CLI non disponible"
    fi
fi

# Rotation (garder seulement les N derniers jours)
echo "🧹 Nettoyage des anciens backups (> ${RETENTION_DAYS} jours)..."
find "$BACKUP_DIR" -type f -name "atlas_*.sql.gz*" -mtime +${RETENTION_DAYS} -delete

echo "✅ Backup terminé avec succès"
echo "📁 Fichier: $FILE"
