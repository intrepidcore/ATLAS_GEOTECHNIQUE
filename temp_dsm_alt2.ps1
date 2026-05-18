$env:PGPASSWORD = 'postgres'
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"

Write-Output "=== Calcul altitude_mean via centroïde (corrigé) ==="

$query = @"
UPDATE atlas.ai_context_features_maille f
SET altitude_mean = sub.alt
FROM (
  SELECT
    f2.maille_code,
    ST_Value(d.rast, ST_Transform(ST_Centroid(m.geom), 25231)) AS alt
  FROM atlas.ai_context_features_maille f2
  JOIN atlas.mailles m ON m.code = f2.maille_code
  JOIN LATERAL (
    SELECT rast FROM atlas.dsm_cop30 d
    WHERE ST_Intersects(d.rast, m.geom)
    LIMIT 1
  ) d ON true
  WHERE f2.altitude_mean IS NULL
) sub
WHERE f.maille_code = sub.maille_code;
"@

& $psql -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -c "$query" 2>&1

Write-Output "`n=== Vérification altitude ==="
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT
  COUNT(*) AS total,
  COUNT(altitude_mean) AS alt_ok,
  ROUND(AVG(altitude_mean)::numeric, 1) AS alt_moy_m,
  ROUND(MIN(altitude_mean)::numeric, 1) AS alt_min_m,
  ROUND(MAX(altitude_mean)::numeric, 1) AS alt_max_m
FROM atlas.ai_context_features_maille;"