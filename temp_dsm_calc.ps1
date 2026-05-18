$env:PGPASSWORD = 'postgres'
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"

Write-Output "=== Calcul altitude_mean par maille ==="
$query = @"
UPDATE atlas.ai_context_features_maille f
SET altitude_mean = sub.alt
FROM (
  SELECT
    m.code AS maille_code,
    (ST_SummaryStats(
      ST_Clip(d.rast, m.geom)
    )).mean AS alt
  FROM atlas.mailles m
  JOIN atlas.dsm_cop30 d ON ST_Intersects(d.rast, m.geom)
  WHERE f.altitude_mean IS NULL
  GROUP BY m.code
) sub
WHERE f.maille_code = sub.maille_code
  AND f.altitude_mean IS NULL;
"@

& $psql -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -c "$query" 2>&1

Write-Output "`n=== Vérification ==="
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT
  COUNT(*) AS total,
  COUNT(altitude_mean) AS alt_ok,
  ROUND(AVG(altitude_mean)::numeric, 1) AS alt_moy_m,
  ROUND(MIN(altitude_mean)::numeric, 1) AS alt_min_m,
  ROUND(MAX(altitude_mean)::numeric, 1) AS alt_max_m
FROM atlas.ai_context_features_maille;"