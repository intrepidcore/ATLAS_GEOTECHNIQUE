$ErrorActionPreference = "Continue"

$BASE = "http://127.0.0.1:8000"

Write-Host "== Testing API ==" -ForegroundColor Cyan
Write-Host "BASE=$BASE" -ForegroundColor DarkGray

Write-Host "\n-- GET /health" -ForegroundColor Yellow
curl "$BASE/health"

Write-Host "\n-- GET /export/cells/adm?level=adm1&code=Centrale" -ForegroundColor Yellow
curl "$BASE/export/cells/adm?level=adm1&code=Centrale"

Write-Host "\n-- POST /thematic/export/qgis" -ForegroundColor Yellow
curl "$BASE/thematic/export/qgis" -Method POST -ContentType "application/json" -Body "{}"

Write-Host "\n-- GET /coverage/adm-boundaries?level=adm1" -ForegroundColor Yellow
curl "$BASE/coverage/adm-boundaries?level=adm1"

Write-Host "\n-- GET /exports/geopackage" -ForegroundColor Yellow
curl "$BASE/exports/geopackage"

Write-Host "\n-- GET /audit/export/csv" -ForegroundColor Yellow
curl "$BASE/audit/export/csv"

Write-Host "\n== Done ==" -ForegroundColor Green
