# ============================================================================
# Vérifier le câblage API ↔ Base de Données
# ============================================================================
# Description: Vérifie que l'API pointe bien vers atlas_clean
# Usage: .\check-db-wiring.ps1
# ============================================================================

Write-Host "🔍 Vérification du câblage API ↔ DB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier les variables d'environnement de l'API
Write-Host "1️⃣ Variables d'environnement de l'API:" -ForegroundColor Yellow
Write-Host ""

$envVars = docker compose exec -T api-geo printenv 2>$null
if ($envVars) {
    $dbUrl = ($envVars | Select-String -Pattern "^DATABASE_URL=").ToString()
    $postgresDb = ($envVars | Select-String -Pattern "^POSTGRES_DB=").ToString()
    
    if ($dbUrl) {
        $dbName = if ($dbUrl -match "/([\w_]+)(\?|$)") { $matches[1] } else { "?" }
        $isClean = $dbName -eq "atlas_clean"
        
        Write-Host "   $dbUrl" -ForegroundColor $(if ($isClean) { "Green" } else { "Red" })
        Write-Host "   Base détectée: $dbName " -NoNewline
        if ($isClean) {
            Write-Host "✅" -ForegroundColor Green
        } else {
            Write-Host "❌ (devrait être atlas_clean)" -ForegroundColor Red
        }
    } else {
        Write-Host "   ⚠️  DATABASE_URL non trouvée" -ForegroundColor Yellow
    }
    
    if ($postgresDb) {
        Write-Host "   $postgresDb" -ForegroundColor Cyan
    }
} else {
    Write-Host "   ❌ Impossible de lire les variables d'environnement de l'API" -ForegroundColor Red
    Write-Host "   L'API est-elle démarrée ? Vérifiez: docker compose ps api-geo" -ForegroundColor Yellow
}

# 2. Vérifier le fichier .env local
Write-Host ""
Write-Host "2️⃣ Fichier .env local:" -ForegroundColor Yellow
Write-Host ""

if (Test-Path ".env") {
    $envContent = Get-Content .env | Where-Object { $_ -match "DATABASE_URL|POSTGRES_DB" }
    foreach ($line in $envContent) {
        $isClean = $line -match "atlas_clean"
        Write-Host "   $line" -ForegroundColor $(if ($isClean) { "Green" } else { "Yellow" })
    }
} else {
    Write-Host "   ⚠️  Fichier .env non trouvé" -ForegroundColor Yellow
}

# 3. Compter les sondages dans atlas (ancienne DB)
Write-Host ""
Write-Host "3️⃣ Base 'atlas' (ancienne DB):" -ForegroundColor Yellow
Write-Host ""

try {
    $countAtlas = docker compose exec -T db psql -U atlas -d atlas -tAc "SELECT COUNT(*) FROM sondages;" 2>$null
    if ($countAtlas) {
        $count = [int]$countAtlas.Trim()
        Write-Host "   Sondages: $count" -ForegroundColor Cyan
        if ($count -gt 0) {
            Write-Host "   ℹ️  Cette base contient vos données originales" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "   ⚠️  Base 'atlas' non accessible" -ForegroundColor Yellow
}

# 4. Compter les sondages dans atlas_clean (nouvelle DB)
Write-Host ""
Write-Host "4️⃣ Base 'atlas_clean' (nouvelle DB):" -ForegroundColor Yellow
Write-Host ""

try {
    $countClean = docker compose exec -T db psql -U atlas -d atlas_clean -tAc "SELECT COUNT(*) FROM sondages;" 2>$null
    if ($countClean) {
        $count = [int]$countClean.Trim()
        $isClean = $count -eq 0
        
        Write-Host "   Sondages: $count " -NoNewline
        if ($isClean) {
            Write-Host "✅ (vide, prêt pour import)" -ForegroundColor Green
        } else {
            Write-Host "⚠️  (contient déjà des données)" -ForegroundColor Yellow
        }
        
        # Compter les mailles
        $maillesCount = docker compose exec -T db psql -U atlas -d atlas_clean -tAc "SELECT COUNT(*) FROM mailles;" 2>$null
        if ($maillesCount) {
            $mailles = [int]$maillesCount.Trim()
            Write-Host "   Mailles: $mailles " -NoNewline
            if ($mailles -gt 0) {
                Write-Host "✅" -ForegroundColor Green
            } else {
                Write-Host "❌" -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "   ❌ Base 'atlas_clean' non accessible" -ForegroundColor Red
    Write-Host "   Avez-vous exécuté le script de clone ? .\scripts\clone-db-v2.ps1" -ForegroundColor Yellow
}

# 5. Tester l'API
Write-Host ""
Write-Host "5️⃣ Test de l'API:" -ForegroundColor Yellow
Write-Host ""

try {
    $healthResponse = Invoke-WebRequest -Uri "http://127.0.0.1:8000/healthz" -UseBasicParsing -TimeoutSec 3
    $health = $healthResponse.Content | ConvertFrom-Json
    Write-Host "   Health: $($health.status) ✅" -ForegroundColor Green
} catch {
    Write-Host "   ❌ API non accessible sur http://127.0.0.1:8000" -ForegroundColor Red
    Write-Host "   Vérifiez: docker compose ps api-geo" -ForegroundColor Yellow
}

# 6. Tester coverage/mailles (pour voir quelle DB l'API utilise)
Write-Host ""
Write-Host "6️⃣ Endpoint coverage/mailles (via API):" -ForegroundColor Yellow
Write-Host ""

try {
    $coverageResponse = Invoke-WebRequest -Uri "http://127.0.0.1:8000/coverage/mailles" -UseBasicParsing -TimeoutSec 3
    $coverage = $coverageResponse.Content | ConvertFrom-Json
    Write-Host "   Mailles retournées: $($coverage.count)" -ForegroundColor Cyan
    
    # Si count = 0, l'API ne voit pas les mailles → problème de connexion DB
    if ($coverage.count -eq 0) {
        Write-Host "   ⚠️  L'API ne voit aucune maille → problème de connexion DB" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Endpoint non accessible: $_" -ForegroundColor Yellow
}

# Résumé et recommandations
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📊 Résumé & Recommandations" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Analyser la situation
$apiPointsToClean = $dbUrl -match "atlas_clean"
$envPointsToClean = (Get-Content .env -ErrorAction SilentlyContinue) -match "atlas_clean"
$cleanExists = $countClean -ne $null
$cleanIsEmpty = $cleanExists -and ([int]$countClean.Trim() -eq 0)

if ($apiPointsToClean -and $cleanIsEmpty) {
    Write-Host "✅ Configuration correcte !" -ForegroundColor Green
    Write-Host ""
    Write-Host "   L'API pointe vers atlas_clean qui est vide." -ForegroundColor White
    Write-Host "   Vous êtes prêt pour l'import de données." -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 Prochaine étape:" -ForegroundColor Yellow
    Write-Host "   python scripts/02_import_excel.py --file data.xlsx --dsn 'postgresql://atlas:atlas@localhost:5432/atlas_clean'" -ForegroundColor Gray
    
} elseif (-not $apiPointsToClean) {
    Write-Host "❌ L'API ne pointe PAS vers atlas_clean" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Actions requises:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Modifier le fichier .env:" -ForegroundColor White
    Write-Host "   DATABASE_URL=postgres://atlas:atlas@db:5432/atlas_clean" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Redémarrer l'API:" -ForegroundColor White
    Write-Host "   docker compose restart api-geo" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Re-vérifier:" -ForegroundColor White
    Write-Host "   .\scripts\check-db-wiring.ps1" -ForegroundColor Gray
    
} elseif (-not $cleanExists) {
    Write-Host "❌ La base atlas_clean n'existe pas" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Action requise:" -ForegroundColor Yellow
    Write-Host "   .\scripts\clone-db-v2.ps1" -ForegroundColor Gray
    
} elseif (-not $cleanIsEmpty) {
    Write-Host "⚠️  La base atlas_clean contient déjà des données" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Si vous voulez repartir de zéro:" -ForegroundColor White
    Write-Host "   .\scripts\clone-db-v2.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Sinon, vous pouvez importer des données supplémentaires." -ForegroundColor White
}

Write-Host ""
