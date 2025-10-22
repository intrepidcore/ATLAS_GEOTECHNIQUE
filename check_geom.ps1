$query = @'
SELECT * FROM mailles_geotechnique_stats LIMIT 0;
'@

docker compose exec db psql -U atlas -d atlas -c $query
