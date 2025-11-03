Write-Host "Test API /coverage/mailles..." -ForegroundColor Cyan

Start-Sleep -Seconds 3

$response = Invoke-WebRequest -Uri "http://localhost:8000/coverage/mailles?bbox=0,5,2,8" -UseBasicParsing
$json = $response.Content | ConvertFrom-Json

$totalFeatures = $json.features.Count
$featuresWithData = ($json.features | Where-Object { $_.properties.has_data -eq $true }).Count
$featuresWithoutData = ($json.features | Where-Object { $_.properties.has_data -eq $false }).Count

Write-Host "`n=== RÉSULTATS ===" -ForegroundColor Green
Write-Host "Total mailles : $totalFeatures"
Write-Host "Avec données : $featuresWithData" -ForegroundColor $(if ($featuresWithData -gt 0) { "Green" } else { "Red" })
Write-Host "Sans données : $featuresWithoutData"

if ($featuresWithData -gt 0) {
    Write-Host "`nÉchantillon de mailles avec données:" -ForegroundColor Yellow
    $json.features | Where-Object { $_.properties.has_data -eq $true } | Select-Object -First 5 | ForEach-Object {
        $props = $_.properties
        Write-Host "  $($props.code): $($props.n_sondages) sondages, $($props.n_essais) échantillons"
    }
    Write-Host "`n✅ SUCCÈS ! Les données sont visibles via l'API" -ForegroundColor Green
} else {
    Write-Host "`n⚠ Aucune maille avec données dans la bbox testée" -ForegroundColor Yellow
}
