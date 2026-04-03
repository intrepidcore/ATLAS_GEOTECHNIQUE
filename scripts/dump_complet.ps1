#!/usr/bin/env pwsh
# Script de dump complet avec vérifications

# Évite les warnings Docker liés à DATABASE_URL (sorties parasites dans la chaîne de résultat)
$env:DATABASE_URL = "ignore"

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpDir = "dumps"
$dumpFile = "$dumpDir/full_atlas_${timestamp}.sql"

# Créer le dossier dumps s'il n'existe pas
if (-not (Test-Path $dumpDir)) {
    New-Item -ItemType Directory -Path $dumpDir | Out-Null
}

Write-Host "="*70
Write-Host "DUMP COMPLET ATLAS - Avec vérifications"
Write-Host "="*70

Write-Host "`n🔍 Vérification pré-dump..."
$preCheckRaw = docker compose exec -T db psql -U atlas -d atlas_clean -t -c "SELECT COUNT(*) FROM atlas.maille_28km;"
$preCheckText = ($preCheckRaw | Out-String).Trim()
$maille28kmCount = [int](([regex]::Match($preCheckText, '\d+')).Value)
Write-Host "   Mailles 28km dans la base: $maille28kmCount"

if ($maille28kmCount -eq 0) {
    Write-Host "   ⚠️  WARNING: La base ne contient PAS de mailles 28km!"
    Write-Host "   Le dump sera créé mais ne contiendra pas de mailles 28km."
    Write-Host "   Continuer quand même? (y/n)"
    $response = Read-Host
    if ($response -ne "y") {
        Write-Host "Annulé."
        exit 1
    }
}

Write-Host "`n💾 Création du dump..."
docker compose exec -T db pg_dump -U atlas -d atlas_clean --clean --if-exists > $dumpFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la création du dump"
    exit 1
}

Write-Host "✅ Dump créé: $dumpFile"
$size = (Get-Item $dumpFile).Length / 1MB
Write-Host "   Taille: $([math]::Round($size, 2)) MB"

Write-Host "`n🔍 Vérification du contenu..."
$maille28kmOccurrences = (Select-String -Path $dumpFile -Pattern "maille_28km" -AllMatches).Count
Write-Host "   Occurrences 'maille_28km': $maille28kmOccurrences"

if ($maille28kmOccurrences -eq 0) {
    Write-Host "   ❌ WARNING: Le dump ne contient PAS maille_28km!"
} else {
    Write-Host "   ✅ Le dump contient maille_28km"
}

# Vérifier aussi les tables colab
$colabOccurrences = (Select-String -Path $dumpFile -Pattern "colab_students" -AllMatches).Count
Write-Host "   Occurrences 'colab_students': $colabOccurrences"

Write-Host "`n" + "="*70
Write-Host "✅ DUMP TERMINÉ"
Write-Host "="*70
Write-Host "`nPour restaurer ce dump:"
Write-Host "   docker compose exec -T db psql -U atlas -d atlas_clean < $dumpFile"
Write-Host "`nPuis vérifier:"
Write-Host "   python atlas/scripts/check_28km.py"
