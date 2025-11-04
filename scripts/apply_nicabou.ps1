Get-Content "sql\imports_projects\NICABOU Ninsao Vianney.sql" | docker exec -i atlas-db psql -U atlas -d atlas_clean
