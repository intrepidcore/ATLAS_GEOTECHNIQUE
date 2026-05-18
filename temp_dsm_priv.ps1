$env:PGPASSWORD = 'atlas'
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"

# Check privileges
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT grantee, privilege_type, table_name
FROM information_schema.table_privileges
WHERE table_schema = 'atlas'
  AND table_name = 'ai_context_features_maille';"

# Try using DO block to add column
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'atlas'
      AND table_name = 'ai_context_features_maille'
      AND column_name = 'altitude_mean'
  ) THEN
    ALTER TABLE atlas.ai_context_features_maille
    ADD COLUMN altitude_mean DOUBLE PRECISION;
    RAISE NOTICE 'Column added';
  ELSE
    RAISE NOTICE 'Column already exists';
  END IF;
END
\$\$;"

# Check columns now
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ai_context_features_maille'
ORDER BY ordinal_position;"