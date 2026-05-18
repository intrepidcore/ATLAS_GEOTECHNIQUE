$body = @{email='admin@atlas.local';password='Atlas2024!'} | ConvertTo-Json
$r = Invoke-RestMethod http://127.0.0.1:8000/api/auth/login -Method POST -ContentType 'application/json' -Body $body
$TOKEN = $r.access_token
Write-Host "Token OK"

# Test KED
$r1 = Invoke-RestMethod "http://127.0.0.1:8000/thematic/data?parameter=vbs_ked_h1" -Headers @{Authorization="Bearer $TOKEN"}
Write-Host "vbs_ked_h1: $($r1.count)"

# Test RK existant
$r2 = Invoke-RestMethod "http://127.0.0.1:8000/thematic/data?parameter=vbs_rk_h1" -Headers @{Authorization="Bearer $TOKEN"}
Write-Host "vbs_rk_h1: $($r2.count)"

# Test EG RK
try {
    $r3 = Invoke-RestMethod "http://127.0.0.1:8000/thematic/data?parameter=eg_rk_h1" -Headers @{Authorization="Bearer $TOKEN"}
    Write-Host "eg_rk_h1: $($r3.count)"
} catch {
    Write-Host "eg_rk_h1: HTTP $($_.Exception.Response.StatusCode.value__)"
}