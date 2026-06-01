$env:PGPASSWORD = 'postgres'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -f "C:\PROJET_ATLAS_MASTER\atlas_reclone\scripts\psql\slope_compute.sql"