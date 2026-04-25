#!/usr/bin/env bash
# Checklist démo ~10 tests (roadmap). Exécuter depuis la racine atlas_reclone.
# Usage: ./scripts/ci/smoke_test_10.sh
# Optionnel: ATLAS_API=http://host:port  REQUIRE_DOCKER=1 (échoue si docker indisponible)

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
API="${ATLAS_API:-http://127.0.0.1:8000}"
FAIL=0

run() {
  local name="$1"
  shift
  echo "== $name =="
  if "$@"; then
    echo "OK"
  else
    echo "FAIL: $name"
    FAIL=$((FAIL + 1))
  fi
}

# 1 API health (JSON {"status":"ok"} ou texte ok)
run "1 healthz" bash -c "curl -sf '${API}/healthz' | python3 -c \"import sys; t=sys.stdin.read(); assert 'ok' in t.lower()\""

# 2–4, 9 DB (docker)
db_check() {
  if ! docker compose -f "${ROOT}/docker-compose.yml" ps -q db 2>/dev/null | grep -q .; then
    if [[ "${REQUIRE_DOCKER:-}" == "1" ]]; then
      echo "db container not running"
      return 1
    fi
    echo "SKIP (db container absent, set REQUIRE_DOCKER=1 pour forcer)"
    return 0
  fi
  DC=(docker compose -f "${ROOT}/docker-compose.yml" exec -T db psql -U atlas -d atlas_clean -t -A -c)
  echo "eg_ked_h2 count:" && "${DC[@]}" "SELECT COUNT(*) FROM atlas.ai_interpolation_values WHERE parameter_id='eg_ked_h2' AND value IS NOT NULL;"
  NEG="$("${DC[@]}" "SELECT COUNT(*) FROM atlas.ai_interpolation_values WHERE parameter_id='ip_derived_h2' AND value < 0;" | tr -d '[:space:]')"
  [[ "$NEG" == "0" ]] || return 1
  "${DC[@]}" "SELECT rga_class, COUNT(*) FROM atlas.maille_geotech_infer WHERE source_type='derived_rga_from_ked' GROUP BY rga_class ORDER BY rga_class;" || true
  DUP="$("${DC[@]}" "SELECT COUNT(*) FROM (SELECT parameter_id, job_type FROM atlas.ai_job_queue WHERE status IN ('queued','running') GROUP BY parameter_id, job_type HAVING COUNT(*) > 1) t;" | tr -d '[:space:]')"
  [[ "$DUP" == "0" ]] || return 1
  return 0
}

run "2-4-9 docker DB checks" db_check

# 5–7 thematic API
run "5 vbs_ked_h2" bash -c "curl -sf '${API}/api/thematic/data?parameter=vbs_ked_h2&include_geometry=false&grid=2km' | python3 -c \"import sys,json; j=json.load(sys.stdin); s=j['statistics']; assert s['count']==29407 and s['null_count']==0\""

run "6 ADM Maritime" bash -c "curl -sf '${API}/api/thematic/data?parameter=vbs_ked_h2&adm1=Maritime&include_geometry=false' | python3 -c \"import sys,json; j=json.load(sys.stdin); assert j.get('type')=='FeatureCollection' and 'error' not in j\""

run "7 data_density" bash -c "curl -sf '${API}/api/thematic/data?parameter=data_density&include_geometry=false&grid=2km' | python3 -c \"import sys,json; j=json.load(sys.stdin); assert j['statistics']['count']==29407\""

# 8 variogram (auth)
run "8 variogram svg" bash -c "
TOKEN=\$(curl -sf -X POST '${API}/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"admin@atlas.local\",\"password\":\"Atlas2024!\"}' | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"access_token\",\"\"))')
[[ -n \"\$TOKEN\" ]] || exit 1
curl -sf -X POST '${API}/ai/plots/variogram' -H \"Authorization: Bearer \$TOKEN\" -H 'Content-Type: application/json' -d '{\"parameter_id\":\"eg_avg\",\"horizon\":\"H1\"}' | python3 -c 'import sys,json; j=json.load(sys.stdin); assert j.get(\"svg\",\"\")[:5]==\"<svg>\"'
"

# 10 UI build
run "10 npm build" bash -c "cd '${ROOT}/ui' && npm run build"

if [[ "$FAIL" -gt 0 ]]; then
  echo "--- $FAIL groupe(s) en échec ---"
  exit 1
fi
echo "=== smoke_test_10: tout vert ==="
exit 0
