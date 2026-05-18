$env:PGPASSWORD = 'atlas'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$conn = @('-U', 'atlas', '-h', '127.0.0.1', '-p', '5433', '-d', 'atlas_clean')

Write-Output "=== SCHEMA TABLES atlas ==="
& $psql @conn -c "SELECT table_name FROM information_schema.tables WHERE table_schema='atlas' ORDER BY table_name;"

Write-Output "`n=== COLONNES ai_variograms ==="
& $psql @conn -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='atlas' AND table_name='ai_variograms' ORDER BY ordinal_position;"

Write-Output "`n=== COLONNES ai_parameters ==="
& $psql @conn -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='atlas' AND table_name='ai_parameters' ORDER BY ordinal_position;"

Write-Output "`n=== VARIOGRAMMES COMPLETS (top 50) ==="
& $psql @conn -c "SELECT parameter_id, model_type, ROUND(nugget::numeric,4) as nugget, ROUND(sill::numeric,4) as sill, ROUND(loo_rmse::numeric,4) as loo_rmse FROM atlas.ai_variograms ORDER BY parameter_id, created_at DESC LIMIT 50;"

Write-Output "`n=== vbs_avg VARIOGRAMMES ==="
& $psql @conn -c "SELECT parameter_id, model_type, nugget IS NOT NULL as has_nugget, ROUND(nugget::numeric,4) as nugget, ROUND(sill::numeric,4) as sill, ROUND(loo_rmse::numeric,4) as loo_rmse, created_at FROM atlas.ai_variograms WHERE parameter_id LIKE 'vbs%' ORDER BY created_at DESC LIMIT 10;"

Write-Output "`n=== PARAMS AI ACTIVE COUNT ==="
& $psql @conn -c "SELECT COUNT(*) as active_params FROM atlas.ai_parameters WHERE status='active';" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Output "Table ai_parameters non trouvee - recherche alternative..."
    & $psql @conn -c "SELECT COUNT(*) as total FROM atlas.ai_parameters;" 2>&1
}

Write-Output "`n=== CACHE PLOTS ==="
& $psql @conn -c "SELECT parameter_id, model_type, pg_size_pretty(length(svg_content::bytea)) as taille, created_at FROM atlas.ai_plot_cache ORDER BY created_at DESC LIMIT 10;"
