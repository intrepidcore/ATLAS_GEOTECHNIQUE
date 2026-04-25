# Exécute KED Eg (H1/H2/H3) dans le conteneur api-geo (même effet que run_ked_eg_docker.sh).
# Prérequis : docker compose up -d db api-geo
$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "..\.."))
docker compose exec -T api-geo sh -c 'PYTHONUNBUFFERED=1 python3 /opt/atlas/scripts/run_ked_eg_horizons.py --database-url "$DATABASE_URL"'
