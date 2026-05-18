# Atlas Smoke Tests v3.5
# Intrepid Core Engineering Standards

param([string]$ApiUrl = "http://127.0.0.1:8000")

$loginResp = Invoke-RestMethod -Uri "$ApiUrl/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@atlas.local","password":"Atlas2024!"}'
$TOKEN = $loginResp.access_token
$H = @{Authorization = "Bearer $TOKEN"}

$pass = 0
$fail = 0

function Test-Endpoint {
  param($name, $result, $condition, $detail)
  if ($condition) {
    Write-Host "  [PASS] $detail" -ForegroundColor Green
    $script:pass++
  } else {
    Write-Host "  [FAIL] $detail" -ForegroundColor Red
    $script:fail++
  }
}

Write-Host "`n=== ATLAS SMOKE TESTS v3.5 ===" -ForegroundColor Cyan

# T1 — EDA N=29407 source=interpolated_values
Write-Host "`n[T1] EDA eg_ked_h1 N=29407"
try {
  $r = Invoke-RestMethod "$ApiUrl/api/stats/descriptive?parameter=eg_ked_h1" -Headers $H
  Test-Endpoint "T1_EDA" $r ($r.n -eq 29407 -and $r.source -eq "interpolated_values") "n=$($r.n) source=$($r.source)"
} catch { Test-Endpoint "T1_EDA" $null $false "EXCEPTION: $_" }

# T2 — WL clamp min>=10
Write-Host "`n[T2] WL clamp min>=10"
try {
  $r = Invoke-RestMethod "$ApiUrl/api/stats/descriptive?parameter=wl_ked_h1" -Headers $H
  Test-Endpoint "T2_WL" $r ([double]$r.min -ge 10.0) "min=$($r.min)"
} catch { Test-Endpoint "T2_WL" $null $false "EXCEPTION: $_" }

# T3 — IP clamp max<=60
Write-Host "`n[T3] IP clamp max<=60"
try {
  $r = Invoke-RestMethod "$ApiUrl/api/stats/descriptive?parameter=ip_ked_h2" -Headers $H
  Test-Endpoint "T3_IP" $r ([double]$r.max -le 60.0) "max=$($r.max)"
} catch { Test-Endpoint "T3_IP" $null $false "EXCEPTION: $_" }

# T4 — ML Registry
Write-Host "`n[T4] ML Registry"
try {
  $r = Invoke-RestMethod "$ApiUrl/api/stats/ml-registry" -Headers $H
  $ok = $r.count -ge 1 -and $r.items[0].rmse_cv -gt 0
  Test-Endpoint "T4_ML" $r $ok "count=$($r.count) rmse=$($r.items[0].rmse_cv)"
} catch { Test-Endpoint "T4_ML" $null $false "EXCEPTION: $_" }

# T5 — LOO RMSE eg_ked_h1 via summary
Write-Host "`n[T5] LOO RMSE eg_ked_h1 via summary"
try {
  $r = Invoke-RestMethod "$ApiUrl/ai/variograms/summary" -Headers $H
  $eg = $r.items | Where-Object { $_.parameter_id -eq "eg_ked_h1" }
  $ok = $null -ne $eg -and [double]$eg.loo_rmse -gt 1.0
  Test-Endpoint "T5_LOO" $eg $ok "eg_ked_h1 loo_rmse=$($eg.loo_rmse)"
} catch { Test-Endpoint "T5_LOO" $null $false "EXCEPTION: $_" }

# T6 — vbs_ked_h3 thematic count=29407
Write-Host "`n[T6] vbs_ked_h3 thematic data"
try {
  $r = Invoke-RestMethod "$ApiUrl/api/thematic/data?parameter=vbs_ked_h3" -Headers $H
  $ok = $r.statistics.count -eq 29407
  Test-Endpoint "T6_H3" $r $ok "count=$($r.statistics.count) mean=$($r.statistics.mean)"
} catch { Test-Endpoint "T6_H3" $null $false "EXCEPTION: $_" }

# T7 — variogram-compare SVG>5000
Write-Host "`n[T7] variogram-compare eg_ked"
try {
  $body = '{"parameter_base":"eg_ked","horizons":["h1","h2","h3"]}'
  $r = Invoke-RestMethod "$ApiUrl/ai/plots/variogram-compare" -Method POST -ContentType "application/json" -Headers $H -Body $body
  $ok = $r.svg.Length -gt 5000
  Test-Endpoint "T7_VARIO" $r $ok "svg.length=$($r.svg.Length)"
} catch { Test-Endpoint "T7_VARIO" $null $false "EXCEPTION: $_" }

# T8 — coverage-map eg_ked_h1=100%
Write-Host "`n[T8] coverage-map eg_ked_h1"
try {
  $r = Invoke-RestMethod "$ApiUrl/api/stats/coverage-map?parameter=eg_ked_h1" -Headers $H
  $ok = [double]$r.coverage_pct -eq 100.0
  Test-Endpoint "T8_COV_MAP" $r $ok "coverage_pct=$($r.coverage_pct)"
} catch { Test-Endpoint "T8_COV_MAP" $null $false "EXCEPTION: $_" }

# T9 — DB sanity via API
Write-Host "`n[T9] DB sanity via API"
try {
  $r = Invoke-RestMethod "$ApiUrl/api/stats/coverage" -Headers $H
  $params = ($r.items | Measure-Object).Count
  $ok = $params -ge 32
  Test-Endpoint "T9_DB" $r $ok "params_distincts=$params"
} catch { Test-Endpoint "T9_DB" $null $false "EXCEPTION: $_" }

Write-Host "`n==============================="
Write-Host "SCORE : $pass/9" -ForegroundColor $(if($pass -eq 9){"Green"}else{"Yellow"})
Write-Host "==============================="