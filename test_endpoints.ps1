Write-Host "🧪 Test des endpoints thématiques" -ForegroundColor Cyan
Write-Host ""

# Test 1: Liste des palettes
Write-Host "1️⃣  GET /thematic/palettes" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/thematic/palettes" -UseBasicParsing
    $palettes = $response.Content | ConvertFrom-Json
    Write-Host "✅ Palettes disponibles: $($palettes -join ', ')" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Données thématiques (sans géométrie)
Write-Host "2️⃣  GET /thematic/data?parameter=n_sondages&include_geometry=false" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/thematic/data?parameter=n_sondages&include_geometry=false" -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json
    Write-Host "✅ Features: $($data.features.Count)" -ForegroundColor Green
    Write-Host "✅ Stats - Min: $($data.statistics.min), Max: $($data.statistics.max), Mean: $([math]::Round($data.statistics.mean, 2))" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Données IP moyen
Write-Host "3️⃣  GET /thematic/data?parameter=ip_avg&include_geometry=false" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/thematic/data?parameter=ip_avg&include_geometry=false" -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json
    Write-Host "✅ Features: $($data.features.Count)" -ForegroundColor Green
    Write-Host "✅ Stats - Min: $([math]::Round($data.statistics.min, 2)), Max: $([math]::Round($data.statistics.max, 2)), Mean: $([math]::Round($data.statistics.mean, 2))" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: Classification
Write-Host "4️⃣  POST /thematic/classify" -ForegroundColor Yellow
try {
    $body = @{
        values = @(5, 10, 15, 20, 25, 30, 35, 40, 45, 50)
        method = "quantiles"
        n_classes = 5
        palette = "Blues"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "http://localhost:8001/thematic/classify" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    $result = $response.Content | ConvertFrom-Json
    Write-Host "✅ Breaks: $($result.breaks -join ', ')" -ForegroundColor Green
    Write-Host "✅ Colors: $($result.colors.Count) couleurs" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: Liste des configurations
Write-Host "5️⃣  GET /thematic/configs" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/thematic/configs" -UseBasicParsing
    $configs = $response.Content | ConvertFrom-Json
    Write-Host "✅ Configurations prédéfinies: $($configs.Count)" -ForegroundColor Green
    foreach ($config in $configs | Select-Object -First 3) {
        Write-Host "   - $($config.name)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}
Write-Host ""

# Test 6: Données avec filtre ADM1
Write-Host "6️⃣  GET /thematic/data?parameter=vbs_avg&adm1=Maritime&min_sondages=3&include_geometry=false" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/thematic/data?parameter=vbs_avg&adm1=Maritime&min_sondages=3&include_geometry=false" -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json
    Write-Host "✅ Features (Maritime, min 3 sondages): $($data.features.Count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "🎉 Tests terminés!" -ForegroundColor Green
