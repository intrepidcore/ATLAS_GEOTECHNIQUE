$env:PGPASSWORD = 'postgres'
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"

# Try as postgres superuser
& $psql -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -c "
ALTER TABLE atlas.ai_context_features_maille
ADD COLUMN IF NOT EXISTS altitude_mean DOUBLE PRECISION;"

# Now check
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ai_context_features_maille'
  AND column_name = 'altitude_mean';"