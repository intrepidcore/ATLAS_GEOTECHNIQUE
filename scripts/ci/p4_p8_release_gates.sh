#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DB_URL_LOCAL="postgresql://atlas:atlas@127.0.0.1:5432/atlas_clean"

log() { printf "\n[CI-P4P8] %s\n" "$*"; }

wait_for_db() {
  for _ in {1..60}; do
    if docker compose exec -T db pg_isready -U atlas -d atlas_clean >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "DB not ready in time" >&2
  return 1
}

wait_for_api() {
  for _ in {1..90}; do
    if curl -fsS "http://127.0.0.1:8000/healthz" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "API not ready in time" >&2
  return 1
}

apply_migration() {
  local file="$1"
  local name
  name="$(basename "$file")"
  docker cp "$file" atlas-db:/tmp/"$name"
  docker compose exec -T db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f /tmp/"$name" >/dev/null
}

run_sql_scalar() {
  local sql="$1"
  docker compose exec -T db psql -U atlas -d atlas_clean -tAc "$sql" | tr -d '[:space:]'
}

assert_eq() {
  local got="$1"
  local expected="$2"
  local msg="$3"
  if [[ "$got" != "$expected" ]]; then
    echo "ASSERT FAILED: $msg (got=$got expected=$expected)" >&2
    exit 1
  fi
}

assert_nonzero() {
  local got="$1"
  local msg="$2"
  if [[ "$got" == "0" || -z "$got" ]]; then
    echo "ASSERT FAILED: $msg (got=$got)" >&2
    exit 1
  fi
}

log "Start services"
docker compose up -d db >/dev/null
wait_for_db

log "Apply migrations 169-173"
apply_migration "db/migrations/169_fix_trigger_ip_generated.sql"
apply_migration "db/migrations/170_seed_p4_p5_ked_granulo_ip_derived.sql"
apply_migration "db/migrations/171_p6_source_type_on_maille_geotech_infer.sql"
apply_migration "db/migrations/172_ai_plot_cache_and_variogram_endpoint_support.sql"
apply_migration "db/migrations/173_p8_ai_job_queue_non_blocking.sql"

log "Run P4/P5/P6 scripts"
python scripts/run_ked_granulo_horizons.py --database-url "$DB_URL_LOCAL" --min-train 6 >/dev/null
python scripts/derive_ip_ked_from_wl_wp.py --database-url "$DB_URL_LOCAL" >/dev/null
python scripts/derive_rga_from_ked_h2.py --database-url "$DB_URL_LOCAL" >/dev/null

log "Build/start api-geo"
docker compose up -d --no-deps --build api-geo >/dev/null
wait_for_api

log "P4 SQL gates"
for p in passant_2mm_ked_h1 passant_2mm_ked_h2 passant_2mm_ked_h3 passant_80um_ked_h1 passant_80um_ked_h2 passant_80um_ked_h3; do
  n="$(run_sql_scalar "SELECT COUNT(*) FROM atlas.ai_interpolation_values WHERE parameter_id='${p}' AND COALESCE(is_superseded,false)=false;")"
  assert_eq "$n" "29407" "coverage for ${p}"
done

neg="$(run_sql_scalar "SELECT COUNT(*) FROM atlas.ai_interpolation_values WHERE parameter_id LIKE 'ip_derived_h%' AND value < 0 AND COALESCE(is_superseded,false)=false;")"
assert_eq "$neg" "0" "ip_derived negative values"

cov_rga="$(run_sql_scalar "SELECT COUNT(*) FROM atlas.maille_geotech_infer WHERE source_type='derived_rga_from_ked';")"
assert_eq "$cov_rga" "29407" "P6 derived_rga_from_ked coverage"

log "API smoke (thematic)"
python - <<'PY'
import json, urllib.request
def read(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

j = read("http://127.0.0.1:8000/thematic/data?parameter=passant_2mm_ked_h1&include_geometry=false&grid=2km")
assert j["statistics"]["count"] == 29407 and j["statistics"]["null_count"] == 0

j = read("http://127.0.0.1:8000/thematic/data?parameter=ip_derived_h2&include_geometry=false")
assert j["statistics"]["count"] == 29407 and j["statistics"]["null_count"] == 0

j = read("http://127.0.0.1:8000/thematic/data?parameter=ag_safety_factor&include_geometry=false")
assert j["statistics"]["count"] == 29407 and j["statistics"]["null_count"] == 0
PY

log "P7 auth + variogram cache gate"
python - <<'PY'
import json, urllib.request

def post(url, payload, token=None):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

login = post("http://127.0.0.1:8000/auth/login", {"email":"admin@atlas.local","password":"Atlas2024!"})
token = login["access_token"]
r1 = post("http://127.0.0.1:8000/ai/plots/variogram", {"parameter_id":"eg_ked_h1","horizon":"H1"}, token=token)
r2 = post("http://127.0.0.1:8000/ai/plots/variogram", {"parameter_id":"eg_ked_h1","horizon":"H1"}, token=token)
assert str(r1.get("svg","")).startswith("<svg")
assert r2.get("cached") is True
PY

log "P8 queue dedup gate"
n="$(run_sql_scalar "BEGIN; INSERT INTO atlas.ai_job_queue(parameter_id,job_type,payload) VALUES ('vbs_avg','kriging_stratifie','{\"horizon\":\"H2\",\"ci_test\":true}'::jsonb) ON CONFLICT DO NOTHING; INSERT INTO atlas.ai_job_queue(parameter_id,job_type,payload) VALUES ('vbs_avg','kriging_stratifie','{\"horizon\":\"H2\",\"ci_test\":true}'::jsonb) ON CONFLICT DO NOTHING; SELECT COUNT(*) FROM atlas.ai_job_queue WHERE parameter_id='vbs_avg' AND job_type='kriging_stratifie' AND payload->>'ci_test'='true'; DELETE FROM atlas.ai_job_queue WHERE parameter_id='vbs_avg' AND job_type='kriging_stratifie' AND payload->>'ci_test'='true'; COMMIT;")"
assert_nonzero "$n" "queue dedup count"
assert_eq "$n" "1" "queue dedup must keep single active job"

log "All P4->P8 gates passed"
