$env:PGPASSWORD = 'atlas'
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"

& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT
  (SELECT COUNT(*) FROM atlas.mailles) AS mailles,
  (SELECT COUNT(*) FROM atlas.ai_context_features_maille
   WHERE geol_label IS NOT NULL) AS geol_ok,
  (SELECT COUNT(*) FROM atlas.ai_context_features_maille
   WHERE pedo_label IS NOT NULL) AS pedo_ok,
  (SELECT COUNT(*) FROM atlas.ai_context_features_maille
   WHERE dem_slope_mean_deg IS NOT NULL) AS dsm_features_ok,
  (SELECT COUNT(*) FROM atlas.dsm_cop30) AS dsm_tiles,
  (SELECT COUNT(*) FROM atlas.ai_interpolation_values
   WHERE method = 'regression_kriging_scorpan'
     AND COALESCE(is_superseded,false) = false) AS rk_values_existing;"