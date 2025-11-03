$response = Invoke-RestMethod -Uri "http://localhost:8000/coverage/mailles" -Method GET
$withData = $response.features | Where-Object { $_.properties.n_sondages -gt 0 }

Write-Host "Total mailles: $($response.features.Count)"
Write-Host "Mailles avec données: $($withData.Count)"

if ($withData.Count -gt 0) {
    Write-Host "`nMailles avec sondages:"
    $withData | ForEach-Object {
        Write-Host "  - $($_.properties.code): $($_.properties.n_sondages) sondages, $($_.properties.n_essais) essais"
    }
} else {
    Write-Host "`n⚠️ Aucune maille avec données"
}
