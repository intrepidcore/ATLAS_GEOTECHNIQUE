$env:PGPASSWORD = 'postgres'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Change owner
ALTER MATERIALIZED VIEW atlas.v_scorpan_features OWNER TO atlas;

-- Refresh  
REFRESH MATERIALIZED VIEW atlas.v_scorpan_features;

-- Verify
SELECT COUNT(*) FROM atlas.v_scorpan_features;
SELECT column_name FROM information_schema.columns WHERE table_schema = 'atlas' AND table_name = 'v_scorpan_features' ORDER BY column_name;
"