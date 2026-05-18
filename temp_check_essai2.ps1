$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT COUNT(*) as n FROM atlas.essais;
SELECT COUNT(*) as n FROM atlas.sondages;
SELECT COUNT(*) as n FROM atlas.essais_geotechniques;"