#!/bin/bash
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-atlas}"
DB_NAME="${DB_NAME:-atlas_clean}"

DOCKER_DB_SERVICE="${DOCKER_DB_SERVICE:-db}"

PSQL_BIN=""
if command -v psql >/dev/null 2>&1; then
  PSQL_BIN="psql"
fi

psql_exec() {
  local sql="$1"
  if [[ -n "${PSQL_BIN}" ]]; then
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -tAc "${sql}"
  else
    docker compose exec -T "${DOCKER_DB_SERVICE}" psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -tAc "${sql}"
  fi
}

fail=0

check_scalar() {
  local name="$1"
  local sql="$2"
  local predicate="$3"

  local value
  if ! value="$(psql_exec "${sql}" | tr -d '[:space:]')"; then
    echo "❌ ${name} (sql error)"
    fail=1
    return 0
  fi

  if eval "${predicate}"; then
    echo "✅ ${name}: ${value}"
  else
    echo "❌ ${name}: ${value}"
    fail=1
  fi
}

check_scalar "BM active_missions (>=1)" \
  "SELECT COUNT(*) FROM atlas.colab_mission_assignments WHERE unassigned_at IS NULL;" \
  '[[ "${value}" =~ ^[0-9]+$ ]] && (( value >= 1 ))'

check_scalar "BM active_mailles (>=1)" \
  "SELECT COUNT(*) FROM atlas.v_maille_status WHERE status = 'active';" \
  '[[ "${value}" =~ ^[0-9]+$ ]] && (( value >= 1 ))'

check_scalar "BM missions_without_maille (=0)" \
  "SELECT COUNT(*) FROM atlas.colab_missions WHERE deleted_at IS NULL AND maille_id IS NULL;" \
  '[[ "${value}" =~ ^[0-9]+$ ]] && (( value == 0 ))'

if [[ "${fail}" -ne 0 ]]; then
  exit 1
fi

echo "OK: métier checks"
