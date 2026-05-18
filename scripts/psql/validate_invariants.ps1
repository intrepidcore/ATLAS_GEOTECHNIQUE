$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Validation invariants critiques
SELECT 
    'INV-001: 29407 mailles' as invariant,
    (COUNT(*) = 29407) as valid
FROM atlas.mailles
UNION ALL
SELECT 
    'INV-002: Climate > 29000',
    (COUNT(prec_annual) >= 29000)
FROM atlas.maille_climate_features
UNION ALL
SELECT 
    'INV-003: DSM features > 29000',
    (COUNT(altitude_mean) >= 29000)
FROM atlas.mailles
UNION ALL
SELECT 
    'INV-004: RK values > 350000',
    (COUNT(*) >= 350000)
FROM atlas.ai_interpolation_values
WHERE method = 'regression_kriging_scorpan'
AND COALESCE(is_superseded, false) = false;

-- Stats finales
SELECT 
    COUNT(*) as total_mailles,
    COUNT(altitude_mean) as altitude,
    COUNT(dem_slope_mean_deg) as slope,
    COUNT(dem_tpi_mean) as tpi,
    COUNT(dem_hand_mean) as hand,
    COUNT(distance_river_m) as river
FROM atlas.mailles;

SELECT 
    COUNT(parameter_id) as rk_params,
    COUNT(*) as rk_values
FROM atlas.ai_interpolation_values
WHERE method = 'regression_kriging_scorpan'
AND COALESCE(is_superseded, false) = false;
"