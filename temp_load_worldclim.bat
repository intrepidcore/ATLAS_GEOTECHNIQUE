@echo off
set PGPASSWORD=atlas
set R2P=C:\Program Files\PostgreSQL\17\bin\raster2pgsql.exe
set PSQL=C:\Program Files\PostgreSQL\17\bin\psql.exe
set CONN=-U atlas -h 127.0.0.1 -p 5433 -d atlas_clean
set PREC_DIR=C:\PROJET_ATLAS_MASTER\atlas_reclone\data\word-clim\prec
set BIO_DIR=C:\PROJET_ATLAS_MASTER\atlas_reclone\data\word-clim\bio

echo === Chargement precipitations (12 mois) ===
%R2P% -s 4326 -I -C -M -t 100x100 -F %PREC_DIR%\wc2.1_2.5m_prec_*.tif atlas.worldclim_prec | %PSQL% %CONN%

echo === Chargement bioclimatiques (19 variables) ===
%R2P% -s 4326 -I -C -M -t 100x100 -F %BIO_DIR%\wc2.1_2.5m_bio_*.tif atlas.worldclim_bio | %PSQL% %CONN%

echo === Done ===