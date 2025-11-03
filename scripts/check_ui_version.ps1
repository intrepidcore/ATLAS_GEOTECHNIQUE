$response = Invoke-WebRequest http://localhost:8080
$content = $response.Content

if ($content -match "appVersion") {
    Write-Host "✅ appVersion trouvé dans la réponse HTTP" -ForegroundColor Green
} else {
    Write-Host "❌ appVersion NON trouvé" -ForegroundColor Red
}

if ($content -match "v1\.6\.0") {
    Write-Host "✅ v1.6.0 trouvé dans la réponse HTTP" -ForegroundColor Green
} else {
    Write-Host "❌ v1.6.0 NON trouvé" -ForegroundColor Red
}

if ($content -match "v1\.3\.0") {
    Write-Host "⚠️  v1.3.0 encore présent (ancienne version)" -ForegroundColor Yellow
}

# Extraire la ligne avec la version
$lines = $content -split "`n"
foreach ($line in $lines) {
    if ($line -match "Atlas Géotechnique" -and $line -match "v1\.") {
        Write-Host "`nLigne version trouvée:" -ForegroundColor Cyan
        Write-Host $line.Trim()
    }
}
