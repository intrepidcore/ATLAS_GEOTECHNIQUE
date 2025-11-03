docker compose exec db psql -U atlas -d atlas -c "SELECT ST_X(ST_Centroid(geom)), ST_Y(ST_Centroid(geom)) FROM mailles WHERE code = 'TG-0510-0225-01';"
