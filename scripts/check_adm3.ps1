docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT column_name FROM information_schema.columns WHERE table_name='adm3' AND column_name LIKE '%code%'"
