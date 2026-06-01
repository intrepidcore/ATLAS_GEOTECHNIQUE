$env:PGPASSWORD = 'postgres'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Grant all necessary permissions to atlas user
GRANT ALL ON SCHEMA atlas TO atlas;
GRANT ALL ON TABLE atlas.mailles TO atlas;
GRANT ALL ON TABLE atlas.dsm_cop30 TO atlas;
GRANT ALL ON TABLE atlas.maille_climate_features TO atlas;
GRANT ALL ON TABLE atlas.hydrogeologie TO atlas;

-- Create dsm_slope table and grant permissions
CREATE TABLE IF NOT EXISTS atlas.dsm_slope AS
SELECT ST_Slope(rast, 1, '32BF') as rast
FROM atlas.dsm_cop30;

ALTER TABLE atlas.dsm_slope OWNER TO atlas;
GRANT ALL ON TABLE atlas.dsm_slope TO atlas;

-- Grant on worldclim tables
GRANT ALL ON TABLE atlas.worldclim_prec TO atlas;
GRANT ALL ON TABLE atlas.worldclim_bio TO atlas;

-- Verify
SELECT 'dsm_slope' as tbl, COUNT(*) FROM atlas.dsm_slope
UNION ALL
SELECT 'permissions_granted', 1;
"