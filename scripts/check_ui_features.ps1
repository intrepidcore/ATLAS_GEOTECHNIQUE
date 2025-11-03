$response = Invoke-WebRequest http://localhost:8080
$content = $response.Content

Write-Host "=== Vérification des fonctionnalités UI ===" -ForegroundColor Cyan
Write-Host ""

# Version
if ($content -match "appVersion") {
    Write-Host "✅ Version dynamique (appVersion)" -ForegroundColor Green
} else {
    Write-Host "❌ Version dynamique manquante" -ForegroundColor Red
}

# Sondages list
if ($content -match "sondagesList") {
    Write-Host "✅ Container sondagesList présent" -ForegroundColor Green
} else {
    Write-Host "❌ Container sondagesList manquant" -ForegroundColor Red
}

# Charts
if ($content -match "chartAtterberg") {
    Write-Host "✅ Chart Atterberg présent" -ForegroundColor Green
} else {
    Write-Host "❌ Chart Atterberg manquant" -ForegroundColor Red
}

if ($content -match "chartVBS") {
    Write-Host "✅ Chart VBS présent" -ForegroundColor Green
} else {
    Write-Host "❌ Chart VBS manquant" -ForegroundColor Red
}

if ($content -match "chartDepth") {
    Write-Host "✅ Chart Depth présent" -ForegroundColor Green
} else {
    Write-Host "❌ Chart Depth manquant" -ForegroundColor Red
}

# Taille de la réponse
$size = [math]::Round($content.Length / 1024, 2)
Write-Host ""
Write-Host "📊 Taille de index.html: $size KB" -ForegroundColor Cyan
