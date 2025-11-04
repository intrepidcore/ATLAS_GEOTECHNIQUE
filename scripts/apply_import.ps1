# Appliquer import SQL
param([string]$SqlFile)

Get-Content $SqlFile | docker exec -i atlas-db psql -U atlas -d atlas_clean
