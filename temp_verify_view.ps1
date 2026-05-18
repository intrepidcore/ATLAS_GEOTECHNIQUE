$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT
  COUNT(*) as total,
  COUNT(altitude_mean) as alt_ok,
  COUNT(geol_label) as geol_ok,
  COUNT(pedo_label) as pedo_ok,
  COUNT(prec_annual) as prec_ok,
  COUNT(bio15) as bio15_ok
FROM atlas.v_scorpan_features;"