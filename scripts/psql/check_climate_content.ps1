$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Check worldclim_prec
SELECT COUNT(*) as prec_count, 
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'worldclim_prec') as n_cols
FROM worldclim_prec;

-- Check worldclim_bio
SELECT COUNT(*) as bio_count,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'worldclim_bio') as n_cols
FROM worldclim_bio;

-- Check maille_climate_features
SELECT COUNT(*) as climate_features_count FROM atlas.maille_climate_features;

-- Sample from worldclim_prec
SELECT * FROM worldclim_prec LIMIT 1;
"