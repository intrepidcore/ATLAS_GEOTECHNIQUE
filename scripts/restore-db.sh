#!/bin/bash
# Script de restauration de la base de données Atlas
# Usage: ./restore-db.sh <backup_file> [target_db]

set -euo pipefail

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file> [target_db]"
    echo "Example: $0 /opt/atlas/backups/atlas_full_20251110T174430Z.dump atlas_restore"
    exit 1
fi

BACKUP_FILE="$1"
TARGET_DB="${2:-atlas_restore}"
FORCE="${FORCE_RESTORE_DROP_DB:-0}"

# Variables d'environnement
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-atlas}"
PGPASSWORD="${PGPASSWORD:-atlas}"

DOCKER_DB_CONTAINER="${DOCKER_DB_CONTAINER:-atlas-db}"

if command -v psql >/dev/null 2>&1 && command -v pg_restore >/dev/null 2>&1; then
    invoke_psql_tac() {
        PGPASSWORD="${PGPASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "$1" -tAc "$2"
    }
    invoke_psql_cmd() {
        PGPASSWORD="${PGPASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "$1" -v ON_ERROR_STOP=1 -c "$2"
    }
    invoke_pg_restore() {
        PGPASSWORD="${PGPASSWORD}" pg_restore -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "$1" -v "${BACKUP_FILE}"
    }
else
    if ! command -v docker >/dev/null 2>&1; then
        echo "ERREUR: psql/pg_restore introuvables et docker introuvable (installer PostgreSQL tools ou Docker)" >&2
        exit 1
    fi

    if ! docker exec -i "${DOCKER_DB_CONTAINER}" bash -lc "test -f '$BACKUP_FILE'" >/dev/null 2>&1; then
        echo "ERREUR: mode docker exec activé mais le fichier backup n'est pas visible dans le conteneur ${DOCKER_DB_CONTAINER}: ${BACKUP_FILE}" >&2
        echo "- Copier le fichier dans le conteneur (docker cp) ou utiliser un chemin monté (volume)." >&2
        exit 1
    fi

    invoke_psql_tac() {
        docker exec -i "${DOCKER_DB_CONTAINER}" psql -U "${DB_USER}" -d "$1" -tAc "$2"
    }
    invoke_psql_cmd() {
        docker exec -i "${DOCKER_DB_CONTAINER}" psql -U "${DB_USER}" -d "$1" -v ON_ERROR_STOP=1 -c "$2"
    }
    invoke_pg_restore() {
        docker exec -i "${DOCKER_DB_CONTAINER}" pg_restore -U "${DB_USER}" -d "$1" -v "${BACKUP_FILE}"
    }
fi

# Vérifier que le fichier de backup existe
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERREUR: Fichier de backup introuvable: ${BACKUP_FILE}"
    exit 1
fi

# Vérifier SHA256 si manifest adjacent présent
MANIFEST_FILE="${BACKUP_FILE}.json"
if [ -f "${MANIFEST_FILE}" ]; then
    echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Vérification manifest: ${MANIFEST_FILE}"
    python3 - <<'PY'
import hashlib, json, os, sys
backup_file = sys.argv[1]
manifest_file = sys.argv[2]
with open(manifest_file, 'r', encoding='utf-8') as f:
    m = json.load(f)
size = os.path.getsize(backup_file)
if int(m.get('size_bytes', -1)) != int(size):
    raise SystemExit(f"SIZE_MISMATCH: expected={m.get('size_bytes')} actual={size}")
h = hashlib.sha256()
with open(backup_file, 'rb') as f:
    for chunk in iter(lambda: f.read(1024*1024), b''):
        h.update(chunk)
sha = h.hexdigest()
if sha != m.get('sha256'):
    raise SystemExit(f"SHA256_MISMATCH: expected={m.get('sha256')} actual={sha}")
print('OK: sha256/size')
PY
"${BACKUP_FILE}" "${MANIFEST_FILE}"
else
    echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] ⚠️  Manifest absent (${MANIFEST_FILE}), restore sans vérification hash"
fi

echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Début de la restauration..."
echo "  Source: ${BACKUP_FILE}"
echo "  Cible: ${TARGET_DB}"

# Créer la base de données cible
echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Préparation de la base ${TARGET_DB}..."

# Guardrail: refuser de drop si la DB cible existe et FORCE!=1
EXISTS=$(invoke_psql_tac postgres "SELECT 1 FROM pg_database WHERE datname='${TARGET_DB}'" || true)
if [ "${EXISTS}" = "1" ] && [ "${FORCE}" != "1" ]; then
    echo "ERREUR: La base ${TARGET_DB} existe déjà. Pour forcer: FORCE_RESTORE_DROP_DB=1" >&2
    exit 1
fi

echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Création de la base ${TARGET_DB} (drop+create)..."
invoke_psql_cmd postgres "DROP DATABASE IF EXISTS ${TARGET_DB};"
invoke_psql_cmd postgres "CREATE DATABASE ${TARGET_DB};" >/dev/null

# Restaurer le backup
echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Restauration en cours..."
invoke_pg_restore "${TARGET_DB}"

echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Restauration terminée avec succès"
echo "  Base de données: ${TARGET_DB}"
echo ""
echo "Pour vérifier:"
echo "  psql -h ${DB_HOST} -U ${DB_USER} -d ${TARGET_DB} -c '\\dt'"
