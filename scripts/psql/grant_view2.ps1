$env:PGPASSWORD = 'postgres'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Grant access to view
GRANT ALL ON MATERIALIZED VIEW atlas.v_scorpan_features TO atlas;
GRANT SELECT ON MATERIALIZED VIEW atlas.v_scorpan_features TO atlas;

-- Also refresh the view to ensure data
REFRESH MATERIALIZED VIEW atlas.v_scorpan_features;

-- Check columns
SELECT column_name FROM information_schema.columns WHERE table_schema = 'atlas' AND table_name = 'v_scorpan_features' ORDER BY column_name;
"