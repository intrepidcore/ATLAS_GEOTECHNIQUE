#!/usr/bin/env bash
# Exécute l'interpolation KED Eg (H1/H2/H3) dans le conteneur api-geo (PyKrige + DB).
# Prérequis : docker compose up -d db api-geo (scripts montés sur /opt/atlas/scripts).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
if ! docker compose ps -q api-geo 2>/dev/null | grep -q .; then
  echo "api-geo container not running. Start stack: docker compose up -d db api-geo" >&2
  exit 1
fi
docker compose exec -T api-geo sh -c 'PYTHONUNBUFFERED=1 python3 /opt/atlas/scripts/run_ked_eg_horizons.py --database-url "$DATABASE_URL"'
