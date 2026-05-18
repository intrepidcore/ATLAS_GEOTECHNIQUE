$env:PGPASSWORD = 'atlas'
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"

& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT
  COUNT(*) AS total,
  COUNT(altitude_mean) AS alt_ok,
  COUNT(dem_slope_mean_deg) AS slope_ok,
  COUNT(dem_tpi_mean) AS tpi_ok,
  COUNT(dem_hand_mean) AS hand_ok,
  COUNT(dem_curvature_mean) AS curv_ok,
  COUNT(dem_flow_acc_mean) AS flow_ok,
  ROUND(AVG(altitude_mean)::numeric, 1) AS alt_moy,
  ROUND(MIN(altitude_mean)::numeric, 1) AS alt_min,
  ROUND(MAX(altitude_mean)::numeric, 1) AS alt_max
FROM atlas.ai_context_features_maille;"