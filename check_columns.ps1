docker compose exec db psql -U atlas -d atlas -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'mailles_geotechnique_stats' ORDER BY ordinal_position;"
