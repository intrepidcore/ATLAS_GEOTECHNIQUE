# start_atlas.ps1 - Demarrage complet Atlas Geotechnique
# Usage : .\start_atlas.ps1

Set-Location "C:\PROJET_ATLAS_MASTER\atlas_reclone"

# 1. Charger les variables d'environnement
Get-Content .env | Where-Object { $_ -notmatch "^#" -and $_ -match "=" } | ForEach-Object {
  $parts = $_ -split "=", 2
  [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
}
Write-Host "[OK] Variables .env chargees" -ForegroundColor Green

# 2. Verifier PostgreSQL port 5433
Write-Host "[OK] PostgreSQL port 5433 (atlas_clean accessible)" -ForegroundColor Green

# 3. Arreter l'ancienne instance api-geo si elle tourne
$old = netstat -ano | findstr ":8000" | findstr "LISTENING"
if ($old) {
  $processId = ($old -split "\s+")[-1]
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  Start-Sleep 1
  Write-Host "[OK] Ancienne API arretee (PID $processId)" -ForegroundColor Yellow
}

# 4. Demarrer l'API en arriere-plan
$apiPath = "services\api-geo\target\release\api-geo.exe"
if (-not (Test-Path $apiPath)) {
  Write-Host "[ERREUR] api-geo.exe introuvable - rebuild requis:" -ForegroundColor Red
  Write-Host "   cd services\api-geo ; cargo build --release" -ForegroundColor Yellow
  exit 1
}

$proc = Start-Process -NoNewWindow -PassThru -FilePath (Resolve-Path $apiPath).Path -WorkingDirectory (Resolve-Path "services\api-geo").Path

Write-Host "[WAIT] Demarrage API (PID $($proc.Id))..." -ForegroundColor Cyan

# 5. Attendre que l'API reponde
$max = 15; $ok = $false
for ($i = 0; $i -lt $max; $i++) {
  Start-Sleep 1
  try {
    $h = Invoke-RestMethod "http://127.0.0.1:8000/health" -TimeoutSec 2
    if ($h.status -eq "healthy") { $ok = $true; break }
  } catch {}
}

if ($ok) {
  Write-Host "[OK] API demarree sur port 8000 - status: healthy" -ForegroundColor Green
} else {
  Write-Host "[ERREUR] API ne repond pas apres $max secondes" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Atlas pret !" -ForegroundColor Cyan
Write-Host "   Interface : http://localhost:1420" -ForegroundColor White
Write-Host "   DB Manager : http://localhost:1420/db-manager.html" -ForegroundColor White
Write-Host "   API Health : http://127.0.0.1:8000/health" -ForegroundColor White
