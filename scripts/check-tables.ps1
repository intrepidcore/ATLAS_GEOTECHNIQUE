# Vérifier les tables dans la base source
Write-Host "📊 Tables dans la base 'atlas':" -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
