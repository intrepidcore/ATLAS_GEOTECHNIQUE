$env:PGPASSWORD = 'postgres'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -c "
GRANT ALL ON atlas.v_scorpan_features TO atlas;
GRANT ALL ON ALL TABLES IN SCHEMA atlas TO atlas;
SELECT COUNT(*) FROM atlas.v_scorpan_features;"