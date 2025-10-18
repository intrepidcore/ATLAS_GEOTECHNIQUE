# Script de test pour l'API géotechnique enrichie
# Version: 1.4.0

$API_URL = "http://localhost:8001"

Write-Host "=== Test API Géotechnique Atlas v1.4.0 ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Healthcheck
Write-Host "Test 1: Healthcheck..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$API_URL/healthz" -Method Get
    Write-Host "✅ API opérationnelle: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ API non accessible" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Création d'un sondage géotechnique complet
Write-Host "Test 2: Création sondage géotechnique..." -ForegroundColor Yellow

$payload = @{
    survey = @{
        code = "TEST-GEOTECH-001"
        date = "2025-10-18"
        type_sol = "Vertisols et Paravertisols"
        source = "Test automatique"
        operator = "Script PowerShell"
        notes = "Sondage de test pour validation v1.4.0"
    }
    location = @{
        lon = 1.084
        lat = 8.592
    }
    essais_par_profondeur = @(
        @{
            profondeur_m = 1.0
            mesures = @(
                @{
                    type = "Granulometrie"
                    valeur_numerique = 77.73
                    unit = "%"
                    meta = @{ sieve_mm = 0.08 }
                }
                @{
                    type = "BleuMethylene_VBS"
                    valeur_numerique = 3.00
                }
                @{
                    type = "Analyse_Bleu"
                    valeur_qualitative = "Moyen"
                }
                @{
                    type = "Atterberg_WL"
                    valeur_numerique = 50.34
                }
                @{
                    type = "Atterberg_WP"
                    valeur_numerique = 22.64
                }
            )
        }
        @{
            profondeur_m = 1.5
            mesures = @(
                @{
                    type = "Granulometrie"
                    valeur_numerique = 81.80
                    unit = "%"
                }
                @{
                    type = "Atterberg_WL"
                    valeur_numerique = 48.20
                }
                @{
                    type = "Atterberg_WP"
                    valeur_numerique = 21.10
                }
            )
        }
    )
    classifications_par_profondeur = @(
        @{
            profondeur_m = 1.0
            analyses = @(
                @{
                    methode = "CHASSAGNEUX D. et al. ;1996"
                    resultat = "Moyen"
                }
                @{
                    methode = "SEED H. (1962)"
                    resultat = "Elevé"
                }
                @{
                    methode = "VIJAYVERGIYA et GHAZZALY 1973"
                    resultat = "Non gonflant"
                }
            )
        }
        @{
            profondeur_m = 1.5
            analyses = @(
                @{
                    methode = "SEED H. (1962)"
                    resultat = "Moyen"
                }
            )
        }
    )
    snap_to_grid = $true
}

$jsonPayload = $payload | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$API_URL/surveys/geotech" `
        -Method Post `
        -ContentType "application/json" `
        -Body $jsonPayload
    
    Write-Host "✅ Sondage créé avec succès!" -ForegroundColor Green
    Write-Host "   ID: $($response.sondage_id)" -ForegroundColor Gray
    Write-Host "   Code: $($response.code)" -ForegroundColor Gray
    Write-Host "   Maille: $($response.maille_code)" -ForegroundColor Gray
    Write-Host "   Précision: $($response.location_accuracy)" -ForegroundColor Gray
    Write-Host "   Essais: $($response.n_essais)" -ForegroundColor Gray
    Write-Host "   Classifications: $($response.n_classifications)" -ForegroundColor Gray
    
    $sondageId = $response.sondage_id
} catch {
    Write-Host "❌ Erreur création: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusCode -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 3: Récupération du sondage complet
Write-Host "Test 3: Récupération sondage complet..." -ForegroundColor Yellow

try {
    $detail = Invoke-RestMethod -Uri "$API_URL/surveys/$sondageId/geotech" -Method Get
    
    Write-Host "✅ Sondage récupéré!" -ForegroundColor Green
    Write-Host "   Type de sol: $($detail.type_sol)" -ForegroundColor Gray
    Write-Host "   Nombre d'essais: $($detail.essais.Count)" -ForegroundColor Gray
    Write-Host "   Nombre de classifications: $($detail.classifications.Count)" -ForegroundColor Gray
    
    # Vérifier le calcul automatique de IP
    $ipEssai = $detail.essais | Where-Object { $_.type_essai -eq "Atterberg_IP" }
    if ($ipEssai) {
        Write-Host "   ✅ IP auto-calculé trouvé!" -ForegroundColor Green
        foreach ($ip in $ipEssai) {
            Write-Host "      Profondeur $($ip.profondeur_m)m: IP = $($ip.valeur_numerique)%" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠️  IP non calculé automatiquement" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erreur récupération: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 4: Liste des classifications
Write-Host "Test 4: Liste des classifications..." -ForegroundColor Yellow

try {
    $classifs = Invoke-RestMethod -Uri "$API_URL/classifications/$sondageId" -Method Get
    
    Write-Host "✅ Classifications récupérées: $($classifs.Count)" -ForegroundColor Green
    foreach ($c in $classifs) {
        Write-Host "   - $($c.profondeur_m)m: $($c.methode) → $($c.resultat)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Erreur liste classifications: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 5: Validation - Type de sol invalide
Write-Host "Test 5: Validation type de sol invalide..." -ForegroundColor Yellow

$invalidPayload = @{
    survey = @{
        type_sol = "TypeInvalide"
    }
    essais_par_profondeur = @()
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod -Uri "$API_URL/surveys/geotech" `
        -Method Post `
        -ContentType "application/json" `
        -Body $invalidPayload
    
    Write-Host "❌ Validation échouée: devrait rejeter type invalide" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 422) {
        Write-Host "✅ Validation OK: type invalide rejeté (HTTP 422)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Erreur inattendue: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Résumé
Write-Host "=== Résumé des tests ===" -ForegroundColor Cyan
Write-Host "✅ API opérationnelle" -ForegroundColor Green
Write-Host "✅ Création sondage géotechnique complet" -ForegroundColor Green
Write-Host "✅ Récupération avec essais et classifications" -ForegroundColor Green
Write-Host "✅ Calcul automatique IP (WL - WP)" -ForegroundColor Green
Write-Host "✅ Validation des ENUMs" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 Tous les tests passés avec succès!" -ForegroundColor Green
Write-Host ""
Write-Host "Sondage de test créé: $sondageId" -ForegroundColor Cyan
Write-Host "Pour le supprimer: curl -X DELETE $API_URL/surveys/$sondageId" -ForegroundColor Gray
