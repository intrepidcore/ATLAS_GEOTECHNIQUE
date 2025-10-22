# Test Final - Atlas v1.5.0.1
# Valide que le bug "Failed to fetch" est corrigé

Write-Host @"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧪 Test Final - Atlas v1.5.0.1                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

$allTestsPassed = $true

# Test 1: Services Running
Write-Host "`n1️⃣  Vérification des services..." -ForegroundColor Yellow
try {
    $services = docker compose ps --format json | ConvertFrom-Json
    $apiRunning = $services | Where-Object { $_.Service -eq "api-geo" -and $_.Health -eq "healthy" }
    $uiRunning = $services | Where-Object { $_.Service -eq "ui" -and $_.Health -eq "healthy" }
    $dbRunning = $services | Where-Object { $_.Service -eq "db" -and $_.Health -eq "healthy" }
    
    if ($apiRunning -and $uiRunning -and $dbRunning) {
        Write-Host "   ✅ Tous les services sont UP et HEALTHY" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Certains services ne sont pas healthy" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
    $allTestsPassed = $false
}

# Test 2: API Health Check
Write-Host "`n2️⃣  Test API Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8001/healthz" -Method Get -TimeoutSec 5
    if ($health.status -eq "ok") {
        Write-Host "   ✅ API répond correctement" -ForegroundColor Green
    } else {
        Write-Host "   ❌ API répond mais status != ok" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "   ❌ API ne répond pas: $_" -ForegroundColor Red
    $allTestsPassed = $false
}

# Test 3: Endpoint Thématique (le test critique)
Write-Host "`n3️⃣  Test Endpoint Thématique (IP moyen)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8001/thematic/data?parameter=ip_avg&min_sondages=3" -Method Get -TimeoutSec 10
    
    if ($response.features) {
        $count = $response.features.Count
        Write-Host "   ✅ Endpoint répond avec $count features" -ForegroundColor Green
        Write-Host "      • Min: $($response.statistics.min)" -ForegroundColor Gray
        Write-Host "      • Max: $($response.statistics.max)" -ForegroundColor Gray
        Write-Host "      • Moyenne: $($response.statistics.mean)" -ForegroundColor Gray
        
        if ($count -eq 0) {
            Write-Host "   ⚠️  Aucune feature retournée (normal si min_sondages trop élevé)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ❌ Pas de features dans la réponse" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
    Write-Host "   ⚠️  C'est l'erreur 'Failed to fetch' si elle persiste !" -ForegroundColor Yellow
    $allTestsPassed = $false
}

# Test 4: Autres paramètres
Write-Host "`n4️⃣  Test autres paramètres..." -ForegroundColor Yellow

$parameters = @(
    @{name="VBS moyen"; param="vbs_avg"},
    @{name="Passant 80µm"; param="passant_80um_avg"},
    @{name="WL moyen"; param="wl_avg"}
)

foreach ($p in $parameters) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8001/thematic/data?parameter=$($p.param)&min_sondages=3" -Method Get -TimeoutSec 5
        Write-Host "   ✅ $($p.name): $($response.features.Count) features" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ $($p.name): Erreur" -ForegroundColor Red
        $allTestsPassed = $false
    }
}

# Test 5: Base de données
Write-Host "`n5️⃣  Test Base de Données..." -ForegroundColor Yellow
try {
    $query = "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE n_sondages > 0) as avec_donnees FROM mailles_geotechnique_stats;"
    $result = docker compose exec -T db psql -U atlas -d atlas -t -c $query 2>$null
    
    if ($result) {
        Write-Host "   ✅ Base de données accessible" -ForegroundColor Green
        Write-Host "      $result" -ForegroundColor Gray
    } else {
        Write-Host "   ❌ Erreur d'accès à la base" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
    $allTestsPassed = $false
}

# Test 6: UI (simple check)
Write-Host "`n6️⃣  Test UI..." -ForegroundColor Yellow
try {
    $ui = Invoke-WebRequest -Uri "http://localhost:8080" -Method Get -TimeoutSec 5 -UseBasicParsing
    if ($ui.StatusCode -eq 200) {
        Write-Host "   ✅ UI accessible (HTTP 200)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  UI répond mais status code: $($ui.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ UI inaccessible: $_" -ForegroundColor Red
    $allTestsPassed = $false
}

# Résumé
Write-Host @"

╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   📊 RÉSUMÉ DES TESTS                                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

if ($allTestsPassed) {
    Write-Host @"

✅ TOUS LES TESTS SONT PASSÉS !

Le bug "Failed to fetch" est corrigé.
Atlas v1.5.0.1 est prêt pour le déploiement.

🚀 Prochaines étapes :
   1. Tester depuis le navigateur : http://localhost:8080
   2. Tester la carte thématique (🗺️ → IP moyen)
   3. Configurer le firewall pour le LAN
   4. Communiquer l'URL aux testeurs

📚 Documentation :
   • GO_LIVE_CHECKLIST.md - Checklist complète
   • RESUME_FINAL_v1.5.0.1.md - Résumé final

"@ -ForegroundColor Green
} else {
    Write-Host @"

❌ CERTAINS TESTS ONT ÉCHOUÉ

Veuillez vérifier :
   1. Les services sont-ils tous démarrés ? (docker compose ps)
   2. Les logs contiennent-ils des erreurs ? (docker compose logs)
   3. Le .env est-il correctement configuré ?

📚 Dépannage :
   • CORRECTIFS_v1.5.0.1.md - Solutions aux problèmes
   • DEPLOIEMENT_LAN.md - Guide de dépannage

"@ -ForegroundColor Red
}

# Proposer d'ouvrir le navigateur
if ($allTestsPassed) {
    $openBrowser = Read-Host "`nOuvrir le navigateur pour tester l'UI ? (O/N)"
    if ($openBrowser -eq "O" -or $openBrowser -eq "o") {
        Start-Process "http://localhost:8080"
        Write-Host "`n🌐 Navigateur ouvert. Testez la carte thématique !" -ForegroundColor Cyan
        Write-Host "   1. Cliquez sur 🗺️ (bas droite)" -ForegroundColor Gray
        Write-Host "   2. Sélectionnez 'IP moyen'" -ForegroundColor Gray
        Write-Host "   3. Cliquez 'Appliquer'" -ForegroundColor Gray
        Write-Host "   4. Vérifiez que les mailles sont colorées" -ForegroundColor Gray
    }
}

Write-Host "`n"
