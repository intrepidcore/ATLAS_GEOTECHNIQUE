param(
    [string]$Cell="TG-0703-0236-01", 
    [string]$ApiUrl="http://localhost:8000"
)

Write-Host "🧪 TEST API /cells/$Cell/complete" -ForegroundColor Cyan
Write-Host "API: $ApiUrl" -ForegroundColor Gray
Write-Host ""

try {
    $res = Invoke-RestMethod "$ApiUrl/cells/$Cell/complete" -ErrorAction Stop
    
    # Vérifications
    $ok1 = $res.samples -ne $null
    $ok2 = $res.surveys -ne $null
    $ok3 = ($res.samples | Where-Object { $_.physiques -or $_.classif } | Measure-Object).Count
    $ok4 = ($res.surveys | Where-Object { $_.badge -eq "ADM random cell" } | Measure-Object).Count -ge 0
    
    Write-Host "✓ samples present:" $ok1 -ForegroundColor $(if ($ok1) { "Green" } else { "Red" })
    Write-Host "✓ surveys present:" $ok2 -ForegroundColor $(if ($ok2) { "Green" } else { "Red" })
    Write-Host "✓ samples with phys/classif:" $ok3 -ForegroundColor $(if ($ok3 -gt 0) { "Green" } else { "Yellow" })
    Write-Host "✓ badge field exists:" $ok4 -ForegroundColor Green
    
    Write-Host ""
    Write-Host "📊 Détails:" -ForegroundColor Cyan
    Write-Host "  - Sondages: $($res.kpi.n_sondages)"
    Write-Host "  - Échantillons: $($res.kpi.n_echantillons)"
    Write-Host "  - Samples: $($res.samples.Count)"
    Write-Host "  - Surveys: $($res.surveys.Count)"
    
    if ($res.samples.Count -gt 0) {
        $sample = $res.samples[0]
        Write-Host ""
        Write-Host "📝 Premier sample:" -ForegroundColor Cyan
        Write-Host "  - ID: $($sample.id)"
        Write-Host "  - Depth: $($sample.depth_m) m"
        Write-Host "  - WL: $($sample.wl)"
        Write-Host "  - VBS: $($sample.vbs)"
        Write-Host "  - Physiques: $(if ($sample.physiques) { 'OUI' } else { 'NON' })"
        Write-Host "  - Classif: $(if ($sample.classif) { 'OUI' } else { 'NON' })"
    }
    
    if ($res.surveys.Count -gt 0) {
        $survey = $res.surveys[0]
        Write-Host ""
        Write-Host "🧭 Premier survey:" -ForegroundColor Cyan
        Write-Host "  - Code: $($survey.code_site)"
        Write-Host "  - Mode: $($survey.mode)"
        Write-Host "  - Badge: $($survey.badge)"
    }
    
    if (-not $ok1 -or -not $ok2) { 
        throw "❌ API /complete invalide" 
    }
    
    Write-Host ""
    Write-Host "✅ API OK" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
