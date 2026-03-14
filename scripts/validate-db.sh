#!/bin/bash
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-atlas}"
DB_NAME="${DB_NAME:-atlas_clean}"

DOCKER_DB_CONTAINER="${DOCKER_DB_CONTAINER:-atlas-db}"

if command -v psql >/dev/null 2>&1; then
  invoke_psql() {
    PGPASSWORD="${PGPASSWORD:-}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -c "$1"
  }
else
  if ! command -v docker >/dev/null 2>&1; then
    echo "ERREUR: psql introuvable et docker introuvable (installer PostgreSQL tools ou Docker)" >&2
    exit 1
  fi
  invoke_psql() {
    docker exec -i "${DOCKER_DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -c "$1"
  }
fi

invoke_psql "SELECT 1;" >/dev/null

invoke_psql "SELECT to_regclass('atlas.v_maille_status') IS NOT NULL AS has_v_maille_status;"
invoke_psql "SELECT to_regclass('atlas.v_colab_mission_attributions') IS NOT NULL AS has_v_colab_mission_attributions;"

invoke_psql "SELECT COUNT(*) AS n_mailles FROM atlas.mailles;"
invoke_psql "SELECT COUNT(*) AS n_missions FROM atlas.colab_missions WHERE deleted_at IS NULL;"

echo "OK: DB basic checks"
