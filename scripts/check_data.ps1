Write-Host "=== Verification Donnees Disponibles ===" -ForegroundColor Cyan

Write-Host "`nComptage par parametre dans la vue materialisee:" -ForegroundColor Yellow

$params = @(
    "n_sondages",
    "n_essais_geo",
    "passant_80um_avg",
    "passant_2mm_avg",
    "passant_20mm_avg",
    "wl_avg",
    "wp_avg",
    "ip_avg",
    "vbs_avg",
    "gamma_d_max_avg",
    "w_opt_avg",
    "eg_avg"
)

foreach ($param in $params) {
    $query = "SELECT COUNT(*) FROM mailles_geotechnique_stats WHERE $param IS NOT NULL;"
    $result = docker compose exec db psql -U atlas -d atlas -t -c $query 2>&1 | Select-String -Pattern "\d+"
    if ($result) {
        $count = $result.Matches[0].Value.Trim()
        if ([int]$count -gt 0) {
            Write-Host "  $param : $count mailles" -ForegroundColor Green
        } else {
            Write-Host "  $param : 0 mailles" -ForegroundColor Gray
        }
    }
}

Write-Host "`nParametres recommandes pour tester:" -ForegroundColor Cyan
Write-Host "  - Utilisez un parametre avec des donnees (count > 0)" -ForegroundColor Yellow
Write-Host "  - Si tous sont a 0, importez des donnees de test" -ForegroundColor Yellow
