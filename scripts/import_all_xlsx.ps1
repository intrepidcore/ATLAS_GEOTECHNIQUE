# Script pour importer tous les fichiers Excel du dossier IMPORT
# Usage: .\import_all_xlsx.ps1

$ErrorActionPreference = "Continue"
$importDir = "..\data\xlsx\IMPORT"
$dsn = "postgresql://atlas:atlas@localhost:5432/atlas_clean"

# Liste des fichiers à importer (ordre chronologique)
$files = @(
    "atlas_import_nicabou_ninsao_vianney.xlsx",
    "atlas_import_BONOU_Dodji_Morille_Emmanuel_Serge .xlsx",
    "atlas_import_APEDJINOU_Vingnon_Shalom.xlsx",
    "atlas_import_AOKNDOR Tigana Messanh.xlsx",
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

$totalFiles = $files.Count
$successCount = 0
$errorCount = 0
$startTime = Get-Date

Write-Host "`n============================================================================" -ForegroundColor Cyan
Write-Host "IMPORT MASSIF DE $totalFiles FICHIERS EXCEL" -ForegroundColor Cyan
Write-Host "============================================================================`n" -ForegroundColor Cyan

foreach ($i in 0..($files.Count - 1)) {
    $file = $files[$i]
    $filePath = Join-Path $importDir $file
    $num = $i + 1
    
    Write-Host "[$num/$totalFiles] Import: $file" -ForegroundColor Yellow
    Write-Host "----------------------------------------------------------------------" -ForegroundColor DarkGray
    
    if (-not (Test-Path $filePath)) {
        Write-Host "[SKIP] Fichier introuvable: $filePath`n" -ForegroundColor Red
        $errorCount++
        continue
    }
    
    try {
        $output = python 02_import_excel.py --file $filePath --dsn $dsn --import-raw no 2>&1
        
        # Extraire les statistiques du rapport
        $successLine = $output | Select-String "Import terminé avec succès"
        $errorLine = $output | Select-String "Import terminé avec erreurs"
        $stats = $output | Select-String "TOTAL\s+(\d+)\s+(\d+)" | Select-Object -Last 1
        
        if ($successLine) {
            Write-Host "[OK] Import réussi" -ForegroundColor Green
            $successCount++
        } elseif ($errorLine) {
            Write-Host "[WARN] Import avec erreurs (mais données partielles importées)" -ForegroundColor Yellow
            $successCount++
        } else {
            Write-Host "[ERROR] Import échoué" -ForegroundColor Red
            $errorCount++
        }
        
        # Afficher les stats si disponibles
        if ($stats) {
            $match = $stats.Matches[0]
            if ($match.Groups.Count -ge 3) {
                $created = $match.Groups[1].Value
                $updated = $match.Groups[2].Value
                Write-Host "  → Créés: $created | Mis à jour: $updated" -ForegroundColor DarkGray
            }
        }
        
    } catch {
        Write-Host "[ERROR] Exception: $_" -ForegroundColor Red
        $errorCount++
    }
    
    Write-Host ""
}

$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

Write-Host "`n============================================================================" -ForegroundColor Cyan
Write-Host "RÉCAPITULATIF FINAL" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Fichiers traités  : $totalFiles" -ForegroundColor White
Write-Host "Succès            : $successCount" -ForegroundColor Green
Write-Host "Erreurs           : $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })
Write-Host "Durée totale      : $([math]::Round($duration, 1))s" -ForegroundColor White
Write-Host "============================================================================`n" -ForegroundColor Cyan

# Statistiques finales de la base
Write-Host "Vérification de la base de données..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d atlas_clean -c "
SELECT 
    'sondages' as table_name, COUNT(*) as count FROM sondages
UNION ALL SELECT 'echantillons', COUNT(*) FROM echantillons
UNION ALL SELECT 'essais_geotechniques', COUNT(*) FROM essais_geotechniques
UNION ALL SELECT 'essais_atterberg', COUNT(*) FROM essais_atterberg
UNION ALL SELECT 'essais_vbs', COUNT(*) FROM essais_vbs
UNION ALL SELECT 'granulo_points', COUNT(*) FROM granulo_points
ORDER BY table_name;
"

Write-Host "`n[DONE] Import massif terminé !`n" -ForegroundColor Green
