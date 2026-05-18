@echo off
set PGPASSWORD=atlas
cd C:\PROJET_ATLAS_MASTER\atlas_reclone\data\word-clim\bio
"C:\Program Files\PostgreSQL\17\bin\raster2pgsql.exe" -s 4326 -I -C -M -t 100x100 wc2.1_2.5m_bio_*.tif atlas.worldclim_bio | "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean