$env:PGPASSWORD = 'postgres'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -c "
ALTER TABLE atlas.ai_interpolation_runs ADD COLUMN IF NOT EXISTS meta JSONB;
SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_interpolation_runs';"