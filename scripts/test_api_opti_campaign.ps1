# Tests reproductibles api-opti campagne (PowerShell).
# Prérequis : api-opti sur API_OPTI_PORT, DATABASE_URL, ATLAS_INTERNAL_SERVICE_TOKEN identique à api-geo.
#
#   $env:DATABASE_URL = 'postgres://...'
#   $env:ATLAS_INTERNAL_SERVICE_TOKEN = 'secret'
#   $env:API_OPTI_PORT = '8011'
#   .\scripts\test_api_opti_campaign.ps1

$ErrorActionPreference = 'Stop'
# docker-compose mappe api-opti sur l'hôte : 8003 -> 8000 conteneur
$port = if ($env:API_OPTI_PORT) { $env:API_OPTI_PORT } else { '8003' }
$base = "http://127.0.0.1:$port"
$tok = $env:ATLAS_INTERNAL_SERVICE_TOKEN
if (-not $tok) { throw 'ATLAS_INTERNAL_SERVICE_TOKEN manquant' }

$headers = @{ 'X-Internal-Token' = $tok; 'Content-Type' = 'application/json' }

$body = @{
  zone      = 'DEPRESSION_LAMA_TG'
  budget    = 8
  objectif  = 'gonflement'
  mode      = 'exploration'
  depression_hard_constraint = $true
  relax_depression_pool      = $false
} | ConvertTo-Json

Write-Host '--- POST /internal/opti/campaign/simple ---'
$r1 = Invoke-RestMethod -Uri "$base/internal/opti/campaign/simple" -Method Post -Headers $headers -Body $body
$r1 | ConvertTo-Json -Depth 6

Write-Host '--- POST /internal/opti/campaign (AG) ---'
$r2 = Invoke-RestMethod -Uri "$base/internal/opti/campaign" -Method Post -Headers $headers -Body $body
$r2 | ConvertTo-Json -Depth 6

Write-Host 'OK'
