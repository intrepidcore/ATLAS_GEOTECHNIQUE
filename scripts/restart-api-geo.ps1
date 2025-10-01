try {
  $resp = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/healthz -TimeoutSec 5
  if ($resp.StatusCode -ne 200) {
    Write-Host "api-geo unhealthy, restarting..."
    docker compose restart api-geo
  } else {
    Write-Host "api-geo healthy"
  }
}
catch {
  Write-Host "api-geo unreachable, restarting..."
  docker compose restart api-geo
}
