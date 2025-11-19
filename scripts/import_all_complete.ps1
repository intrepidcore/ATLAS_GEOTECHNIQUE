# ============================================================================
# Script d'import complet de tous les fichiers Excel
# ============================================================================

$ErrorActionPreference = "Continue"
$DSN = "postgresql://atlas:atlas@localhost:5432/atlas_clean"
$ImportDir = "data\xlsx\IMPORT"

# Liste des fichiers à importer (ordre logique)
$files = @(
    "atlas_import_nicabou_ninsao_vianney_CONVERTED.xlsx",
    "atlas_import_BONOU_Dodji_Morille_Emmanuel_Serge .xlsx",
    "atlas_import_AOKNDOR Tigana Messanh.xlsx",
    "atlas_import_APEDJINOU_Vingnon_Shalom.xlsx",
    "atlas_import_BADJOUDOUM Abidé.xlsx",
    "atlas_import_OUDJABITI Bassirou.xlsx",
    "atlas_import_SODANDJI_SEIDOU_ Moukhalid..xlsx",
    "ADANDOGOU Afiwa Pamela.xlsx",
    "ANYOH Akoueté Jean-Paul.xlsx",
    "NABIYOU Warou.xlsx",
    "NIGHASSIME ZAKARI KABOU OF NGOAPO Roxane Lenira Chrisie.xlsx",
    "SOGLO Ferdinand.xlsx",
    "TCHALA Komla Hyacinthe.xlsx",
    "TCHESSI Ezani Léleng Richard.xlsx"
)

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "IMPORT COMPLET DE TOUS LES FICHIERS EXCEL" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

$totalFiles = $files.Count
$successCount = 0
$errorCount = 0
$results = @()

foreach ($file in $files) {
    $filePath = Join-Path $ImportDir $file
    
    if (-not (Test-Path $filePath)) {
        Write-Host "⚠️  SKIP: $file (fichier introuvable)" -ForegroundColor Yellow
        $errorCount++
        continue
    }
    
    Write-Host "📂 Import: $file" -ForegroundColor Green
    Write-Host "   Chemin: $filePath" -ForegroundColor Gray
    
    $startTime = Get-Date
    
    try {
        $output = python scripts\02_import_excel.py --file "$filePath" --dsn "$DSN" 2>&1
        $exitCode = $LASTEXITCODE
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds
        
        # Extraire les stats du rapport
        $linesCreated = ($output | Select-String "TOTAL\s+(\d+)" | ForEach-Object { $_.Matches.Groups[1].Value })
        
        if ($exitCode -eq 0) {
            Write-Host "   ✅ Succès ($([math]::Round($duration, 1))s) - $linesCreated lignes créées" -ForegroundColor Green
            $successCount++
            $results += [PSCustomObject]@{
                File = $file
                Status = "✅ OK"
                Duration = "$([math]::Round($duration, 1))s"
                Lines = $linesCreated
            }
        } else {
            Write-Host "   ⚠️  Terminé avec erreurs ($([math]::Round($duration, 1))s)" -ForegroundColor Yellow
            $errorCount++
            $results += [PSCustomObject]@{
                File = $file
                Status = "⚠️  ERREURS"
                Duration = "$([math]::Round($duration, 1))s"
                Lines = $linesCreated
            }
            
            # Afficher les erreurs
            $errors = $output | Select-String "\[ERROR\]|\[X\] ERREURS" -Context 0,3
            if ($errors) {
                Write-Host "   Erreurs détectées:" -ForegroundColor Red
                $errors | ForEach-Object { Write-Host "     $_" -ForegroundColor Red }
            }
        }
    } catch {
        Write-Host "   ❌ ÉCHEC: $_" -ForegroundColor Red
        $errorCount++
        $results += [PSCustomObject]@{
            File = $file
            Status = "❌ ÉCHEC"
            Duration = "N/A"
            Lines = "0"
        }
    }
    
    Write-Host ""
}

# Résumé final
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "RÉSUMÉ DE L'IMPORT" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total fichiers : $totalFiles" -ForegroundColor White
Write-Host "Succès         : $successCount" -ForegroundColor Green
Write-Host "Erreurs        : $errorCount" -ForegroundColor Yellow
Write-Host ""

# Tableau des résultats
$results | Format-Table -AutoSize

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Statistiques DB
Write-Host "📊 STATISTIQUES BASE DE DONNÉES" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan

$dbStats = docker compose exec db psql -U atlas -d atlas_clean -t -c "
SELECT 
  'sondages' as table, COUNT(*) as count FROM sondages
UNION ALL SELECT 'echantillons', COUNT(*) FROM echantillons
UNION ALL SELECT 'essais_atterberg', COUNT(*) FROM essais_atterberg
UNION ALL SELECT 'essais_vbs', COUNT(*) FROM essais_vbs
UNION ALL SELECT 'essais_physiques', COUNT(*) FROM essais_physiques
UNION ALL SELECT 'essais_classif', COUNT(*) FROM essais_classif
UNION ALL SELECT 'essais_proctor', COUNT(*) FROM essais_proctor
UNION ALL SELECT 'granulo_points', COUNT(*) FROM granulo_points
ORDER BY 1;
"

Write-Host $dbStats
Write-Host "============================================================================" -ForegroundColor Cyan

if ($errorCount -eq 0) {
    Write-Host "✅ IMPORT COMPLET RÉUSSI !" -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  Import terminé avec $errorCount erreur(s)" -ForegroundColor Yellow
    exit 1
}
