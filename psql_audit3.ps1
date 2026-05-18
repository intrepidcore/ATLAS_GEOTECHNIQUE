$env:PGPASSWORD = 'atlas'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$conn = @('-U', 'atlas', '-h', '127.0.0.1', '-p', '5433', '-d', 'atlas_clean')

Write-Output "=== COLONNES ai_plot_cache ==="
& $psql @conn -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='atlas' AND table_name='ai_plot_cache' ORDER BY ordinal_position;"

Write-Output "`n=== CACHE PLOTS CONTENU ==="
& $psql @conn -c "SELECT parameter_id, pg_size_pretty(length(svg_content)) as taille, created_at FROM atlas.ai_plot_cache ORDER BY created_at DESC LIMIT 10;"

Write-Output "`n=== TABLE ai_parameters ALTERNATIVE ==="
& $psql @conn -c "SELECT table_name FROM information_schema.tables WHERE table_schema='atlas' AND table_name LIKE '%param%';"

Write-Output "`n=== TOUS VARIOGRAMMES RESTANTS (vbs, wl, wp) ==="
& $psql @conn -c "SELECT parameter_id, model_type, ROUND(nugget::numeric,4) as nugget, ROUND(sill::numeric,4) as sill, ROUND(loo_rmse::numeric,4) as loo_rmse FROM atlas.ai_variograms WHERE parameter_id NOT LIKE '%ked%' AND parameter_id NOT LIKE 'eg_%' AND parameter_id NOT LIKE 'ip_%' AND parameter_id NOT LIKE 'passant%' AND parameter_id NOT LIKE 'kriging%' ORDER BY parameter_id, created_at DESC LIMIT 30;"

Write-Output "`n=== DOUBLONS VARIOGRAMMES PAR PARAM ==="
& $psql @conn -c "SELECT parameter_id, COUNT(*) as nb FROM atlas.ai_variograms GROUP BY parameter_id ORDER BY nb DESC LIMIT 20;"
