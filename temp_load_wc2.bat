@echo off
set PGPASSWORD=atlas
set R2P="C:\Program Files\PostgreSQL\17\bin\raster2pgsql.exe"
set PSQL="C:\Program Files\PostgreSQL\17\bin\psql.exe"
set CONN=-U atlas -h 127.0.0.1 -p 5433 -d atlas_clean

echo === WorldClim Precipitation ===
cd C:\PROJET_ATLAS_MASTER\atlas_reclone\data\word-clim\prec
%R2P% -s 4326 -I -C -M -t 100x100 wc2.1_2.5m_prec_*.tif atlas.worldclim_prec | %PSQL% %CONN%

echo === WorldClim Bioclimatic ===
cd C:\PROJET_ATLAS_MASTER\atlas_reclone\data\word-clim\bio
%R2P% -s 4326 -I -C -M -t 100x100 wc2.1_2.5m_bio_*.tif atlas.worldclim_bio | %PSQL% %CONN%

echo === Verify ===
%PSQL% %CONN% -c "SELECT COUNT(*) as prec FROM atlas.worldclim_prec; SELECT COUNT(*) as bio FROM atlas.worldclim_bio;"