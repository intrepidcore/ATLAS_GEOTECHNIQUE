# Script de vérification API Atlas
$ErrorActionPreference = 'Stop'

# Health check
Write-Output "=== HEALTH CHECK ==="
$h = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 5
Write-Output "Status: $($h.status)"
Write-Output "DB connected: $($h.database.connected)"

# Token
Write-Output "`n=== TOKEN ==="
$body = @{ email = "admin@atlas.local"; password = "Atlas2024!" } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/auth/login" -Method POST -ContentType "application/json" -Body $body
$TOKEN = $resp.access_token
if ($TOKEN) {
    Write-Output "TOKEN OK: $($TOKEN.Substring(0,[Math]::Min(40,$TOKEN.Length)))..."
    # Sauvegarder le token pour usage ultérieur
    $TOKEN | Out-File "C:\PROJET_ATLAS_MASTER\atlas_reclone\token.txt" -Encoding utf8
} else {
    Write-Output "TOKEN FAIL"
}

# Stats de base
Write-Output "`n=== STATS BASE ==="
$headers = @{ Authorization = "Bearer $TOKEN" }
$stats = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/stats/summary" -Headers $headers -TimeoutSec 10
Write-Output ($stats | ConvertTo-Json -Depth 5)
