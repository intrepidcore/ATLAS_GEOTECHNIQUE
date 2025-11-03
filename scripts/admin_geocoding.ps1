# ============================================================================
# SCRIPT ADMIN GÉOCODAGE - Tout-en-un
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('generate', 'apply', 'refresh', 'check', 'full')]
    [string]$Action = 'full'
)

$API_URL = "http://localhost:8000"

Write-Host "="*80 -ForegroundColor Cyan
Write-Host "ADMIN GÉOCODAGE - Action: $Action" -ForegroundColor Cyan
Write-Host "="*80 -ForegroundColor Cyan

function Invoke-Generate {
    Write-Host "`n🔄 Génération des suggestions..." -ForegroundColor Yellow
    python scripts\post_import_hook.py
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors de la génération" -ForegroundColor Red
        return $false
    }
    return $true
}

function Invoke-Apply {
    Write-Host "`n🚀 Application des suggestions accepted..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "$API_URL/geocode/apply-accepted" -Method POST
        Write-Host "✅ Appliqué: $($response.applied_count) suggestion(s)" -ForegroundColor Green
        if ($response.refreshed) {
            Write-Host "✅ Vues matérialisées refreshed" -ForegroundColor Green
        }
        return $true
    } catch {
        Write-Host "❌ Erreur: $_" -ForegroundColor Red
        return $false
    }
}

function Invoke-Refresh {
    Write-Host "`n🔄 Refresh vues matérialisées..." -ForegroundColor Yellow
    python run_sql.py -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors du refresh" -ForegroundColor Red
        return $false
    }
    Write-Host "✅ Vues refreshed" -ForegroundColor Green
    return $true
}

function Invoke-Check {
    Write-Host "`n📊 Vérification état du système..." -ForegroundColor Yellow
    
    try {
        # Stats API
        $stats = Invoke-RestMethod -Uri "$API_URL/geocode/stats" -Method GET
        Write-Host "`nStatistiques suggestions:" -ForegroundColor Cyan
        Write-Host "  ✅ Accepted   : $($stats.accepted)" -ForegroundColor Green
        Write-Host "  ⚠️  Pending    : $($stats.pending)" -ForegroundColor Yellow
        Write-Host "  ❌ Rejected   : $($stats.rejected)" -ForegroundColor Red
        Write-Host "  ⊘  No match   : $($stats.no_suggestion)" -ForegroundColor Gray
        Write-Host "  📊 Total      : $($stats.total)" -ForegroundColor Cyan
        
        # Sondages DB
        python check_suggestions.py
        
        return $true
    } catch {
        Write-Host "❌ Erreur: $_" -ForegroundColor Red
        return $false
    }
}

# Exécution selon action
$success = $true

switch ($Action) {
    'generate' {
        $success = Invoke-Generate
    }
    'apply' {
        $success = Invoke-Apply
    }
    'refresh' {
        $success = Invoke-Refresh
    }
    'check' {
        $success = Invoke-Check
    }
    'full' {
        Write-Host "`n🎯 Exécution complète (generate → apply → refresh → check)" -ForegroundColor Cyan
        $success = Invoke-Generate
        if ($success) { $success = Invoke-Apply }
        if ($success) { $success = Invoke-Refresh }
        if ($success) { $success = Invoke-Check }
    }
}

Write-Host "`n="*80 -ForegroundColor Cyan
if ($success) {
    Write-Host "✅ TERMINÉ AVEC SUCCÈS" -ForegroundColor Green
} else {
    Write-Host "❌ TERMINÉ AVEC ERREURS" -ForegroundColor Red
}
Write-Host "="*80 -ForegroundColor Cyan

exit $(if ($success) { 0 } else { 1 })
