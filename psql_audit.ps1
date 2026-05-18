$env:PGPASSWORD = 'atlas'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'

Write-Output "=== 5.1 COUNTS DE BASE ==="
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "SELECT (SELECT COUNT(*) FROM atlas.mailles) as mailles, (SELECT COUNT(*) FROM atlas.sondages WHERE deleted_at IS NULL) as sondages, (SELECT COUNT(DISTINCT parameter_id) FROM atlas.ai_interpolation_values WHERE COALESCE(is_superseded,false)=false) as params_interpoles, (SELECT COUNT(*) FROM atlas.ai_variograms) as variogrammes, (SELECT COUNT(*) FROM atlas.ai_variograms WHERE loo_rmse IS NOT NULL) as vario_avec_loo, (SELECT COUNT(*) FROM atlas.ai_variograms WHERE nugget IS NOT NULL) as vario_avec_nugget, (SELECT COUNT(*) FROM atlas.ai_plot_cache) as cache_plots;"

Write-Output "`n=== 5.2 VARIOGRAMMES KED ==="
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "SELECT parameter_id, nugget IS NOT NULL as has_nugget, ROUND(nugget::numeric,4) as nugget, ROUND(sill::numeric,4) as sill, ROUND(loo_rmse::numeric,3) as loo_rmse FROM atlas.ai_variograms WHERE parameter_id LIKE '%ked%' ORDER BY parameter_id, created_at DESC LIMIT 30;"

Write-Output "`n=== 5.3 COUVERTURE PAR PARAMETRE ==="
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "SELECT parameter_id, COUNT(DISTINCT maille_id) as n, ROUND(COUNT(DISTINCT maille_id)::numeric*100/29407,1) as pct FROM atlas.ai_interpolation_values WHERE COALESCE(is_superseded,false)=false GROUP BY parameter_id ORDER BY n DESC LIMIT 15;"

Write-Output "`n=== 5.4 METRIQUES ML ==="
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "SELECT model_target, model_version, status, metrics->>'rmse_cg' as rmse_cg, metrics->>'r2_cg' as r2_cg, metrics->>'n_cg_training' as n_cg FROM atlas.ai_model_registry ORDER BY created_at DESC;"

Write-Output "`n=== EXTRA: TOUS VARIOGRAMMES LOO ==="
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "SELECT parameter_id, horizon, model_type, ROUND(nugget::numeric,4) as nugget, ROUND(sill::numeric,4) as sill, ROUND(loo_rmse::numeric,4) as loo_rmse FROM atlas.ai_variograms ORDER BY parameter_id, horizon LIMIT 50;"

Write-Output "`n=== EXTRA: PARAMS AI CATALOGUE ==="
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "SELECT COUNT(*) as total_params FROM atlas.ai_parameters WHERE is_active = true;"
