$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Check ai_maille_features_fast columns
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'atlas' AND table_name = 'ai_maille_features_fast'
ORDER BY column_name;

-- Count rows
SELECT COUNT(*) as ai_features_count FROM atlas.ai_maille_features_fast;

-- Sample
SELECT * FROM atlas.ai_maille_features_fast LIMIT 1;
"