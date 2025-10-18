# ============================================================================
# Script de nettoyage - Supprime TOUS les sondages et essais
# ============================================================================
# ⚠️  ATTENTION: Ce script supprime toutes les données de sondages !
# ============================================================================

param(
    [switch]$Force
)

Write-Host "`n⚠️  ATTENTION: Suppression de TOUS les sondages" -ForegroundColor Red
Write-Host "=" * 80 -ForegroundColor Yellow

if (-not $Force) {
    $confirmation = Read-Host "Êtes-vous sûr de vouloir supprimer TOUS les sondages? (tapez 'OUI' pour confirmer)"
    if ($confirmation -ne "OUI") {
        Write-Host "`n❌ Opération annulée" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "`n🗑️  Suppression en cours..." -ForegroundColor Cyan

# SQL pour supprimer tous les sondages (cascade sur essais, classifications, etc.)
$sql = @"
-- Supprimer tous les sondages (cascade sur essais et classifications)
DELETE FROM sondages WHERE deleted_at IS NULL;

-- Réinitialiser les stats des mailles
UPDATE mailles SET 
    n_sondages = 0,
    stats = '{}'::jsonb,
    updated_at = now();

-- Afficher le résultat
SELECT 
    (SELECT COUNT(*) FROM sondages WHERE deleted_at IS NULL) AS sondages_restants,
    (SELECT COUNT(*) FROM essais WHERE deleted_at IS NULL) AS essais_restants,
    (SELECT COUNT(*) FROM mailles WHERE n_sondages > 0) AS mailles_avec_donnees;
"@

# Exécuter via Docker
$sql | docker exec -i atlas-db psql -U atlas -d atlas

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Suppression terminée avec succès" -ForegroundColor Green
    Write-Host "  • Tous les sondages ont été supprimés" -ForegroundColor Gray
    Write-Host "  • Les stats des mailles ont été réinitialisées" -ForegroundColor Gray
} else {
    Write-Host "`n❌ Erreur lors de la suppression" -ForegroundColor Red
    exit 1
}

Write-Host "`n💡 Pour régénérer des données:" -ForegroundColor Cyan
Write-Host "  .\scripts\generate-bulk-surveys.ps1" -ForegroundColor Gray
Write-Host "=" * 80 -ForegroundColor Gray
