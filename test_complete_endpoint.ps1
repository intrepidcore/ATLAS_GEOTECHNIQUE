# Script de test pour l'endpoint /cells/{code}/complete

Write-Host "🧪 Test de l'endpoint /cells/{code}/complete" -ForegroundColor Cyan
Write-Host ""

# Test avec une maille connue
$code = "TG-0496-0212-01"
$url = "http://localhost:8000/cells/$code/complete"

Write-Host "📍 Test avec la maille: $code" -ForegroundColor Yellow
Write-Host "🌐 URL: $url" -ForegroundColor Gray
Write-Host ""

try {
    Write-Host "⏳ Appel de l'API..." -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
    
    Write-Host "✅ Succès !" -ForegroundColor Green
    Write-Host ""
    
    # Afficher les KPIs
    Write-Host "📊 KPIs:" -ForegroundColor Cyan
    Write-Host "  - Sondages: $($response.kpi.n_sondages)" -ForegroundColor White
    Write-Host "  - Échantillons: $($response.kpi.n_echantillons)" -ForegroundColor White
    Write-Host "  - Essais: $($response.kpi.n_essais)" -ForegroundColor White
    Write-Host "  - % Spread: $($response.kpi.pct_spread)%" -ForegroundColor White
    Write-Host "  - Profondeur max: $($response.kpi.depth_max_m)m" -ForegroundColor White
    Write-Host ""
    
    # Afficher les données overview
    Write-Host "📈 Overview:" -ForegroundColor Cyan
    Write-Host "  - Atterberg points: $($response.overview.atterberg.Count)" -ForegroundColor White
    Write-Host "  - VBS points: $($response.overview.vbs.Count)" -ForegroundColor White
    Write-Host "  - Granulo points: $($response.overview.granulo.Count)" -ForegroundColor White
    Write-Host "  - Depth bins: $($response.overview.depth_hist.Count)" -ForegroundColor White
    Write-Host ""
    
    # Afficher les samples
    Write-Host "🔬 Samples complets: $($response.samples.Count)" -ForegroundColor Cyan
    if ($response.samples.Count -gt 0) {
        $sample = $response.samples[0]
        Write-Host "  Premier échantillon:" -ForegroundColor Gray
        Write-Host "    - Profondeur: $($sample.depth_m)m" -ForegroundColor White
        Write-Host "    - Atterberg: $(if ($sample.atterberg) { '✅' } else { '❌' })" -ForegroundColor White
        Write-Host "    - VBS: $(if ($sample.vbs) { '✅' } else { '❌' })" -ForegroundColor White
        Write-Host "    - Granulo: $(if ($sample.granulo) { '✅' } else { '❌' })" -ForegroundColor White
        Write-Host "    - Proctor: $(if ($sample.proctor) { '✅' } else { '❌' })" -ForegroundColor White
        Write-Host "    - Swelling: $(if ($sample.swelling) { '✅' } else { '❌' })" -ForegroundColor White
        Write-Host "    - Classif: $(if ($sample.classif) { '✅' } else { '❌' })" -ForegroundColor White
        
        if ($sample.classif) {
            Write-Host "      - USCS: $($sample.classif.uscs)" -ForegroundColor Magenta
            Write-Host "      - AASHTO: $($sample.classif.aashto)" -ForegroundColor Magenta
            Write-Host "      - GTR: $($sample.classif.gtr)" -ForegroundColor Magenta
        }
    }
    Write-Host ""
    
    # Afficher les surveys
    Write-Host "📋 Surveys: $($response.surveys.Count)" -ForegroundColor Cyan
    if ($response.surveys.Count -gt 0) {
        foreach ($survey in $response.surveys) {
            Write-Host "  - $($survey.code_site) ($($survey.mode)) - $($survey.samples) échantillons, $($survey.tests) essais" -ForegroundColor White
        }
    }
    Write-Host ""
    
    # Afficher les source surveys
    if ($response.source_surveys.Count -gt 0) {
        Write-Host "🔄 Source Surveys (diffusion): $($response.source_surveys.Count)" -ForegroundColor Cyan
        foreach ($survey in $response.source_surveys) {
            Write-Host "  - $($survey.code_site) ($($survey.adm3_code))" -ForegroundColor White
        }
        Write-Host ""
    }
    
    # Sauvegarder la réponse complète
    $jsonFile = "test_complete_response.json"
    $response | ConvertTo-Json -Depth 10 | Out-File $jsonFile -Encoding UTF8
    Write-Host "💾 Réponse complète sauvegardée dans: $jsonFile" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Erreur !" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        Write-Host "Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    }
    
    exit 1
}

Write-Host ""
Write-Host "✅ Test terminé avec succès !" -ForegroundColor Green
