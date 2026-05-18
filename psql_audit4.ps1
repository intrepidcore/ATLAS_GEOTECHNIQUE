$env:PGPASSWORD = 'atlas'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$conn = @('-U', 'atlas', '-h', '127.0.0.1', '-p', '5433', '-d', 'atlas_clean')

Write-Output "=== CACHE PLOTS (colonne svg) ==="
& $psql @conn -c "SELECT parameter_id, horizon_label, plot_type, pg_size_pretty(length(svg)) as taille, created_at FROM atlas.ai_plot_cache ORDER BY created_at DESC LIMIT 10;"

Write-Output "`n=== CATALOGUE PARAMETRES (ai_parameter_catalog) ==="
& $psql @conn -c "SELECT COUNT(*) as total FROM atlas.ai_parameter_catalog;"

& $psql @conn -c "SELECT id, category, unit, physical_min, physical_max, strat_threshold, rk_threshold, status FROM atlas.ai_parameter_catalog ORDER BY id LIMIT 20;"

Write-Output "`n=== COLONNES ai_parameter_catalog ==="
& $psql @conn -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='atlas' AND table_name='ai_parameter_catalog' ORDER BY ordinal_position;"
