# Script de validation complète - Atlas v2.0 Audit

Write-Host "🧪 VALIDATION COMPLÈTE - Atlas v2.0" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host ""

$errors = 0
$warnings = 0

# ============================================================================
# 1. VALIDATION SQL
# ============================================================================
Write-Host "📊 1. VALIDATION SQL" -ForegroundColor Yellow
Write-Host ""

# 1.1 Monotonicité granulo
Write-Host "  Vérification monotonicité granulo..." -ForegroundColor Gray
$monotonicity = docker compose exec -T db psql -U atlas -d atlas -t -c "
WITH granulo_check AS (
  SELECT 
    gp.essai_id,
    gp.sieve_mm,
    gp.percent_passing,
    LAG(gp.percent_passing) OVER (PARTITION BY gp.essai_id ORDER BY gp.sieve_mm DESC) AS prev_passing
  FROM granulometrie_points gp
)
SELECT COUNT(*)
FROM granulo_check gc
WHERE gc.prev_passing IS NOT NULL 
  AND gc.percent_passing > gc.prev_passing;
" 2>&1

if ($monotonicity -match "(\d+)") {
    $count = [int]$Matches[1]
    if ($count -gt 0) {
        Write-Host "  ⚠️  $count violations de monotonicité détectées" -ForegroundColor Yellow
        $warnings++
    } else {
        Write-Host "  ✅ Monotonicité OK" -ForegroundColor Green
    }
}

# 1.2 Bornes Atterberg
Write-Host "  Vérification bornes Atterberg..." -ForegroundColor Gray
$atterberg = docker compose exec -T db psql -U atlas -d atlas -t -c "
SELECT COUNT(*)
FROM essais_geotechniques e
WHERE 
  (e.wl IS NOT NULL AND (e.wl < 0 OR e.wl > 100))
  OR (e.wp IS NOT NULL AND (e.wp < 0 OR e.wp > 100))
  OR (e.ip IS NOT NULL AND e.ip < 0)
  OR (e.wp IS NOT NULL AND e.wl IS NOT NULL AND e.wp > e.wl);
" 2>&1

if ($atterberg -match "(\d+)") {
    $count = [int]$Matches[1]
    if ($count -gt 0) {
        Write-Host "  ⚠️  $count essais avec bornes Atterberg invalides" -ForegroundColor Yellow
        $warnings++
    } else {
        Write-Host "  ✅ Bornes Atterberg OK" -ForegroundColor Green
    }
}

# 1.3 Statistiques globales
Write-Host "  Statistiques globales..." -ForegroundColor Gray
$stats = docker compose exec -T db psql -U atlas -d atlas -t -c "
SELECT 
  COUNT(*) AS total_essais,
  COUNT(*) FILTER (WHERE wl IS NOT NULL OR wp IS NOT NULL) AS avec_atterberg,
  COUNT(*) FILTER (WHERE vbs IS NOT NULL) AS avec_vbs,
  COUNT(*) FILTER (WHERE passant_80um IS NOT NULL) AS avec_granulo
FROM essais_geotechniques;
" 2>&1

Write-Host "  $stats" -ForegroundColor White

Write-Host ""

# ============================================================================
# 2. VALIDATION FONCTIONS
# ============================================================================
Write-Host "📐 2. VALIDATION FONCTIONS" -ForegroundColor Yellow
Write-Host ""

# 2.1 Test fn_granulo_indices
Write-Host "  Test fn_granulo_indices..." -ForegroundColor Gray
$granulo_test = docker compose exec -T db psql -U atlas -d atlas -t -c "
SELECT fn_granulo_indices('[
  {\"mm\": 2, \"pct\": 98},
  {\"mm\": 0.5, \"pct\": 80},
  {\"mm\": 0.25, \"pct\": 65},
  {\"mm\": 0.125, \"pct\": 45},
  {\"mm\": 0.063, \"pct\": 12}
]'::jsonb);
" 2>&1

if ($granulo_test -match "d10") {
    Write-Host "  ✅ fn_granulo_indices OK" -ForegroundColor Green
} else {
    Write-Host "  ❌ fn_granulo_indices ERREUR" -ForegroundColor Red
    $errors++
}

# 2.2 Test fn_classify_uscs
Write-Host "  Test fn_classify_uscs..." -ForegroundColor Gray
$uscs_test = docker compose exec -T db psql -U atlas -d atlas -t -c "
SELECT fn_classify_uscs(42, 20, 65, NULL, NULL, NULL);
" 2>&1

if ($uscs_test -match "class") {
    Write-Host "  ✅ fn_classify_uscs OK (retourne JSONB avec class/reason)" -ForegroundColor Green
} else {
    Write-Host "  ❌ fn_classify_uscs ERREUR" -ForegroundColor Red
    $errors++
}

# 2.3 Test fn_classify_aashto
Write-Host "  Test fn_classify_aashto..." -ForegroundColor Gray
$aashto_test = docker compose exec -T db psql -U atlas -d atlas -t -c "
SELECT fn_classify_aashto(42, 20, 65, 95);
" 2>&1

if ($aashto_test -match "class") {
    Write-Host "  ✅ fn_classify_aashto OK (retourne JSONB avec class/reason)" -ForegroundColor Green
} else {
    Write-Host "  ❌ fn_classify_aashto ERREUR" -ForegroundColor Red
    $errors++
}

# 2.4 Test v_samples_complete
Write-Host "  Test v_samples_complete..." -ForegroundColor Gray
$view_test = docker compose exec -T db psql -U atlas -d atlas -t -c "
SELECT COUNT(*) FROM v_samples_complete;
" 2>&1

if ($view_test -match "(\d+)") {
    $count = [int]$Matches[1]
    Write-Host "  ✅ v_samples_complete OK ($count échantillons)" -ForegroundColor Green
} else {
    Write-Host "  ❌ v_samples_complete ERREUR" -ForegroundColor Red
    $errors++
}

Write-Host ""

# ============================================================================
# 3. VALIDATION API
# ============================================================================
Write-Host "🌐 3. VALIDATION API" -ForegroundColor Yellow
Write-Host ""

# 3.1 Test endpoint /complete
Write-Host "  Test endpoint /cells/{code}/complete..." -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/cells/TG-0496-0212-01/complete" -Method Get -ErrorAction Stop
    
    if ($response.kpi -and $response.overview -and $response.samples -ne $null -and $response.surveys -ne $null) {
        Write-Host "  ✅ Endpoint /complete OK" -ForegroundColor Green
        Write-Host "    - KPI: $($response.kpi.n_sondages) sondages, $($response.kpi.n_essais) essais" -ForegroundColor Gray
        Write-Host "    - Overview: $($response.overview.atterberg.Count) atterberg, $($response.overview.vbs.Count) vbs" -ForegroundColor Gray
        Write-Host "    - Samples: $($response.samples.Count) échantillons" -ForegroundColor Gray
        
        # Vérifier structure classifications
        if ($response.samples.Count -gt 0) {
            $sample = $response.samples[0]
            if ($sample.classif) {
                $uscsType = $sample.classif.uscs.GetType().Name
                if ($uscsType -eq "PSCustomObject") {
                    Write-Host "    ✅ Classifications avec structure class/reason" -ForegroundColor Green
                } else {
                    Write-Host "    ⚠️  Classifications en format simple (pas class/reason)" -ForegroundColor Yellow
                    $warnings++
                }
            }
        }
    } else {
        Write-Host "  ❌ Endpoint /complete structure invalide" -ForegroundColor Red
        $errors++
    }
} catch {
    Write-Host "  ❌ Endpoint /complete inaccessible" -ForegroundColor Red
    Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
    $errors++
}

Write-Host ""

# ============================================================================
# 4. VALIDATION UI
# ============================================================================
Write-Host "🎨 4. VALIDATION UI" -ForegroundColor Yellow
Write-Host ""

# 4.1 Vérifier build UI
Write-Host "  Vérification build UI..." -ForegroundColor Gray
if (Test-Path "ui/dist/index.html") {
    Write-Host "  ✅ Build UI présent" -ForegroundColor Green
    
    # Vérifier taille bundle
    $jsFiles = Get-ChildItem "ui/dist/assets/*.js" -ErrorAction SilentlyContinue
    if ($jsFiles) {
        $totalSize = ($jsFiles | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Host "    - Bundle JS: $([math]::Round($totalSize, 2)) MB" -ForegroundColor Gray
        if ($totalSize -gt 2) {
            Write-Host "    ⚠️  Bundle JS > 2MB (considérer code-splitting)" -ForegroundColor Yellow
            $warnings++
        }
    }
} else {
    Write-Host "  ❌ Build UI manquant" -ForegroundColor Red
    $errors++
}

# 4.2 Vérifier feature flags dans main.ts
Write-Host "  Vérification feature flags..." -ForegroundColor Gray
$mainTs = Get-Content "ui/src/main.ts" -Raw
if ($mainTs -match "ATLAS_FLAGS") {
    Write-Host "  ✅ Feature flags présents" -ForegroundColor Green
} else {
    Write-Host "  ❌ Feature flags manquants" -ForegroundColor Red
    $errors++
}

# 4.3 Vérifier badges CSS
Write-Host "  Vérification badges CSS..." -ForegroundColor Gray
$indexHtml = Get-Content "ui/index.html" -Raw
$badges = @("badge-ip-faible", "badge-ip-moyen", "badge-ip-fort", "badge-vbs-faible", "badge-vbs-moyen", "badge-vbs-eleve")
$missingBadges = @()
foreach ($badge in $badges) {
    if ($indexHtml -notmatch $badge) {
        $missingBadges += $badge
    }
}
if ($missingBadges.Count -eq 0) {
    Write-Host "  ✅ Tous les badges CSS présents" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Badges manquants: $($missingBadges -join ', ')" -ForegroundColor Yellow
    $warnings++
}

Write-Host ""

# ============================================================================
# 5. VALIDATION DOCKER
# ============================================================================
Write-Host "🐳 5. VALIDATION DOCKER" -ForegroundColor Yellow
Write-Host ""

# 5.1 Vérifier services
Write-Host "  Vérification services Docker..." -ForegroundColor Gray
$services = docker compose ps --format json 2>&1 | ConvertFrom-Json
$apiRunning = $services | Where-Object { $_.Service -eq "api-geo" -and $_.State -eq "running" }
$dbRunning = $services | Where-Object { $_.Service -eq "db" -and $_.State -eq "running" }

if ($apiRunning) {
    Write-Host "  ✅ API running" -ForegroundColor Green
} else {
    Write-Host "  ❌ API not running" -ForegroundColor Red
    $errors++
}

if ($dbRunning) {
    Write-Host "  ✅ DB running" -ForegroundColor Green
} else {
    Write-Host "  ❌ DB not running" -ForegroundColor Red
    $errors++
}

Write-Host ""

# ============================================================================
# RÉSUMÉ
# ============================================================================
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host ""
Write-Host "📋 RÉSUMÉ" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Erreurs: $errors" -ForegroundColor $(if ($errors -eq 0) { "Green" } else { "Red" })
Write-Host "  Avertissements: $warnings" -ForegroundColor $(if ($warnings -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host "✅ VALIDATION COMPLÈTE RÉUSSIE !" -ForegroundColor Green
    exit 0
} elseif ($errors -eq 0) {
    Write-Host "⚠️  VALIDATION RÉUSSIE AVEC AVERTISSEMENTS" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "❌ VALIDATION ÉCHOUÉE" -ForegroundColor Red
    exit 1
}
