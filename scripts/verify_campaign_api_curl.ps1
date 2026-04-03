# Exemples curl reproductibles — santé + api-opti interne (pas de JWT).
# Prérequis : ATLAS_INTERNAL_SERVICE_TOKEN dans l'environnement (identique api-geo / api-opti).
# Ports docker-compose habituels : api-geo 8000, api-opti 8003.

$ErrorActionPreference = 'Stop'
$GEO = if ($env:API_GEO_BASE) { $env:API_GEO_BASE.TrimEnd('/') } else { 'http://127.0.0.1:8000' }
$OPTI = if ($env:ATLAS_API_OPTI_URL) { $env:ATLAS_API_OPTI_URL.TrimEnd('/') } else { 'http://127.0.0.1:8003' }
$TOK = $env:ATLAS_INTERNAL_SERVICE_TOKEN
if (-not $TOK) { Write-Warning 'ATLAS_INTERNAL_SERVICE_TOKEN absent — 403 attendu sur /internal/*' }

Write-Host '--- GET healthz api-geo ---'
curl.exe -sS -o NUL -w "%{http_code}" "$GEO/healthz"
Write-Host ''

Write-Host '--- GET healthz api-opti ---'
curl.exe -sS -o NUL -w "%{http_code}" "$OPTI/healthz"
Write-Host ''

$body = '{"zone":"DEPRESSION_LAMA_TG","budget":6,"objectif":"gonflement","mode":"exploration","depression_hard_constraint":true,"relax_depression_pool":false}'
Write-Host '--- POST internal campaign/simple ---'
curl.exe -sS -X POST "$OPTI/internal/opti/campaign/simple" -H "Content-Type: application/json" -H "X-Internal-Token: $TOK" -d $body
Write-Host ''

Write-Host '--- POST internal campaign (GA) ---'
curl.exe -sS -X POST "$OPTI/internal/opti/campaign" -H "Content-Type: application/json" -H "X-Internal-Token: $TOK" -d $body
Write-Host ''

Write-Host 'OK'
