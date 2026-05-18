$body = @{email='admin@atlas.local';password='Atlas2024!'} | ConvertTo-Json
$r = Invoke-RestMethod http://127.0.0.1:8000/api/auth/login -Method POST -ContentType 'application/json' -Body $body
$TOKEN = $r.access_token

# Test vbs_rk_h1
$resp = Invoke-RestMethod "http://127.0.0.1:8000/thematic/data?parameter=vbs_rk_h1" -Headers @{Authorization="Bearer $TOKEN"}
Write-Host "vbs_rk_h1: count=$($resp.features.Count)"
if ($resp.features.Count -gt 0) {
    Write-Host "  First value: $($resp.features[0].properties.value)"
}

# Test eg_rk_h1
$resp2 = Invoke-RestMethod "http://127.0.0.1:8000/thematic/data?parameter=eg_rk_h1" -Headers @{Authorization="Bearer $TOKEN"}
Write-Host "eg_rk_h1: count=$($resp2.features.Count)"
if ($resp2.features.Count -gt 0) {
    Write-Host "  First value: $($resp2.features[0].properties.value)"
}