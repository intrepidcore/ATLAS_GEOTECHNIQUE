Get-Content "sql\imports_projects\GAMBAGA Inoussa.sql" | docker exec -i atlas-db psql -U atlas -d atlas_clean
