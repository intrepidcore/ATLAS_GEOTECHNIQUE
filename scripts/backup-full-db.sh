#!/bin/bash
# Script de backup complet de la base de données Atlas
# Usage: ./backup-full-db.sh [backup_dir]

set -e

# Configuration
BACKUP_DIR="${1:-/opt/atlas/backups}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
BACKUP_FILE="${BACKUP_DIR}/atlas_full_${TIMESTAMP}.dump"
CHECKSUM_FILE="${BACKUP_DIR}/CHECKSUMS.txt"

# Variables d'environnement (ou depuis .env)
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-atlas}"
DB_NAME="${DB_NAME:-atlas_clean}"
PGPASSWORD="${PGPASSWORD:-atlas}"

# Créer le répertoire de backup si nécessaire
mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Début du backup de ${DB_NAME}..."

# Dump complet avec format custom compressé
PGPASSWORD="${PGPASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -F c \
    -b \
    -v \
    -f "${BACKUP_FILE}"

# Vérifier que le backup existe et n'est pas vide
if [ ! -s "${BACKUP_FILE}" ]; then
    echo "ERREUR: Le fichier de backup est vide ou n'existe pas"
    exit 1
fi

# Calculer le checksum SHA256
echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Calcul du checksum..."
CHECKSUM=$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')
echo "${CHECKSUM}  ${BACKUP_FILE}" >> "${CHECKSUM_FILE}"

# Afficher les statistiques
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Backup terminé avec succès"
echo "  Fichier: ${BACKUP_FILE}"
echo "  Taille: ${BACKUP_SIZE}"
echo "  SHA256: ${CHECKSUM}"

# Nettoyer les backups de plus de 30 jours (optionnel)
if [ "${CLEANUP_OLD_BACKUPS:-true}" = "true" ]; then
    echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Nettoyage des backups > 30 jours..."
    find "${BACKUP_DIR}" -name "atlas_full_*.dump" -type f -mtime +30 -delete
fi

echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Backup complet terminé"
