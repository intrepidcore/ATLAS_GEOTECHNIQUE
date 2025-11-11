#!/bin/bash
# Script de restauration de la base de données Atlas
# Usage: ./restore-db.sh <backup_file> [target_db]

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file> [target_db]"
    echo "Example: $0 /opt/atlas/backups/atlas_full_20251110T174430Z.dump atlas_restore"
    exit 1
fi

BACKUP_FILE="$1"
TARGET_DB="${2:-atlas_restore}"

# Variables d'environnement
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-atlas}"
PGPASSWORD="${PGPASSWORD:-atlas}"

# Vérifier que le fichier de backup existe
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERREUR: Fichier de backup introuvable: ${BACKUP_FILE}"
    exit 1
fi

echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Début de la restauration..."
echo "  Source: ${BACKUP_FILE}"
echo "  Cible: ${TARGET_DB}"

# Créer la base de données cible si elle n'existe pas
echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Création de la base ${TARGET_DB}..."
PGPASSWORD="${PGPASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d postgres \
    -c "DROP DATABASE IF EXISTS ${TARGET_DB};" \
    -c "CREATE DATABASE ${TARGET_DB};"

# Restaurer le backup
echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Restauration en cours..."
PGPASSWORD="${PGPASSWORD}" pg_restore \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${TARGET_DB}" \
    -v \
    "${BACKUP_FILE}"

echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Restauration terminée avec succès"
echo "  Base de données: ${TARGET_DB}"
echo ""
echo "Pour vérifier:"
echo "  psql -h ${DB_HOST} -U ${DB_USER} -d ${TARGET_DB} -c '\\dt'"
