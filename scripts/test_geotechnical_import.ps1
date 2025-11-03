#!/usr/bin/env pwsh
# ============================================================================
# Script de test pour l'import géotechnique
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "🧪 Test de l'import géotechnique Atlas" -ForegroundColor Cyan
Write-Host "=" * 60

# Configuration
$API_URL = "http://localhost:3000/api/v1/surveys/bulk-import/geotechnical"
$EXAMPLE_FILE = "atlas_import_example.xlsx"

# ============================================================================
# 1. Vérifier que le fichier exemple existe
# ============================================================================

Write-Host "`n📁 Étape 1: Vérification du fichier exemple" -ForegroundColor Yellow

if (-not (Test-Path $EXAMPLE_FILE)) {
    Write-Host "❌ Fichier $EXAMPLE_FILE introuvable" -ForegroundColor Red
    Write-Host "Génération du fichier..." -ForegroundColor Yellow
    
    if (-not (Test-Path "make_atlas_example_xlsx.py")) {
        Write-Host "❌ Script make_atlas_example_xlsx.py introuvable" -ForegroundColor Red
        exit 1
    }
    
    python make_atlas_example_xlsx.py
    
    if (-not (Test-Path $EXAMPLE_FILE)) {
        Write-Host "❌ Échec de génération du fichier" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Fichier trouvé: $EXAMPLE_FILE" -ForegroundColor Green
$fileSize = (Get-Item $EXAMPLE_FILE).Length
Write-Host "   Taille: $([math]::Round($fileSize/1KB, 2)) KB" -ForegroundColor Gray

# ============================================================================
# 2. Vérifier que l'API est accessible
# ============================================================================

Write-Host "`n🌐 Étape 2: Vérification de l'API" -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method GET -TimeoutSec 5
    Write-Host "✅ API accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ API non accessible sur http://localhost:3000" -ForegroundColor Red
    Write-Host "   Assurez-vous que le serveur est démarré" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# 3. Tester l'import
# ============================================================================

Write-Host "`n🚀 Étape 3: Test de l'import" -ForegroundColor Yellow

$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

# Lire le fichier
$fileBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $EXAMPLE_FILE))
$fileContent = [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes)

# Construire le multipart/form-data
$bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"file`"; filename=`"$EXAMPLE_FILE`"",
    "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "",
    $fileContent,
    "--$boundary",
    "Content-Disposition: form-data; name=`"geolocation_mode`"",
    "",
    "centroid",
    "--$boundary--"
)

$body = $bodyLines -join $LF

try {
    Write-Host "   Envoi de la requête..." -ForegroundColor Gray
    
    $response = Invoke-WebRequest `
        -Uri $API_URL `
        -Method POST `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Body ([System.Text.Encoding]::GetEncoding("iso-8859-1").GetBytes($body)) `
        -TimeoutSec 60
    
    $result = $response.Content | ConvertFrom-Json
    
    Write-Host "`n✅ Import réussi!" -ForegroundColor Green
    Write-Host "   Message: $($result.message)" -ForegroundColor Gray
    
    # Afficher les statistiques
    Write-Host "`n📊 Statistiques d'import:" -ForegroundColor Cyan
    Write-Host "   Sondages créés:      $($result.stats.sondages_created)" -ForegroundColor White
    Write-Host "   Sondages mis à jour: $($result.stats.sondages_updated)" -ForegroundColor White
    Write-Host "   Échantillons:        $($result.stats.echantillons_created)" -ForegroundColor White
    Write-Host "   Atterberg:           $($result.stats.atterberg_created)" -ForegroundColor White
    Write-Host "   VBS:                 $($result.stats.vbs_created)" -ForegroundColor White
    Write-Host "   Proctor:             $($result.stats.proctor_created)" -ForegroundColor White
    Write-Host "   Points granulo:      $($result.stats.granulo_points_created)" -ForegroundColor White
    
    # Afficher les erreurs
    if ($result.stats.errors.Count -gt 0) {
        Write-Host "`n⚠️  Erreurs ($($result.stats.errors.Count)):" -ForegroundColor Yellow
        foreach ($error in $result.stats.errors) {
            Write-Host "   - $error" -ForegroundColor Red
        }
    }
    
    # Afficher les warnings
    if ($result.stats.warnings.Count -gt 0) {
        Write-Host "`n⚠️  Avertissements ($($result.stats.warnings.Count)):" -ForegroundColor Yellow
        foreach ($warning in $result.stats.warnings) {
            Write-Host "   - $warning" -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "`n❌ Échec de l'import" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Réponse: $responseBody" -ForegroundColor Gray
    }
    
    exit 1
}

# ============================================================================
# 4. Vérifier les données en base
# ============================================================================

Write-Host "`n🔍 Étape 4: Vérification en base de données" -ForegroundColor Yellow

# Note: Cette partie nécessite psql ou une connexion à la base
# Pour l'instant, on affiche juste les instructions

Write-Host @"

Pour vérifier les données importées, exécutez:

  psql -d atlas_db -c "SELECT * FROM v_echantillons_complets LIMIT 5;"
  
  psql -d atlas_db -c "SELECT code_site, depth_m, COUNT(*) as n_points 
                       FROM granulo_points 
                       JOIN echantillons ON granulo_points.echantillon_id = echantillons.id 
                       JOIN sondages ON echantillons.sondage_id = sondages.id 
                       GROUP BY code_site, depth_m;"

  psql -d atlas_db -c "REFRESH MATERIALIZED VIEW mailles_geotechnique_stats;"

"@ -ForegroundColor Gray

# ============================================================================
# Résumé
# ============================================================================

Write-Host "`n" + ("=" * 60)
Write-Host "✅ Test terminé avec succès!" -ForegroundColor Green
Write-Host @"

Prochaines étapes:
1. Vérifier les données dans l'interface web
2. Consulter les cartes thématiques
3. Exporter les courbes granulométriques

Documentation complète: GUIDE_IMPORT_GEOTECHNIQUE.md
"@ -ForegroundColor Cyan
