$env:PGPASSWORD = 'atlas'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$conn = @('-U', 'atlas', '-h', '127.0.0.1', '-p', '5433', '-d', 'atlas_clean')

Write-Output "=== COLONNES zones_etude ==="
& $psql @conn -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='atlas' AND table_name='zones_etude' ORDER BY ordinal_position;"

Write-Output "`n=== CONTENU zones_etude ==="
& $psql @conn -c "SELECT * FROM atlas.zones_etude LIMIT 10;"

Write-Output "`n=== STATS PAR ZONE (avec bon nom colonne) ==="
& $psql @conn -c "SELECT z.name, COUNT(DISTINCT m.id) as n_mailles, ROUND(AVG(CASE WHEN iv.parameter_id='vbs_ked_h1' THEN iv.value END)::numeric,3) as avg_vbs_h1, ROUND(AVG(CASE WHEN iv.parameter_id='eg_ked_h1' THEN iv.value END)::numeric,3) as avg_eg_h1 FROM atlas.zones_etude z JOIN atlas.mailles_zones_etude mze ON mze.zone_id=z.id JOIN atlas.mailles m ON m.id=mze.maille_id LEFT JOIN atlas.ai_interpolation_values iv ON iv.maille_id=m.id AND iv.parameter_id IN ('vbs_ked_h1','eg_ked_h1') AND COALESCE(iv.is_superseded,false)=false GROUP BY z.name ORDER BY avg_vbs_h1 DESC NULLS LAST;" 2>&1
if ($LASTEXITCODE -ne 0) {
  & $psql @conn -c "SELECT column_name FROM information_schema.columns WHERE table_schema='atlas' AND table_name='zones_etude';"
}

Write-Output "`n=== STATS VBS H1/H2/H3 GLOBALES ==="
& $psql @conn -c "SELECT parameter_id, COUNT(*) as n, ROUND(MIN(value)::numeric,3) as min_v, ROUND(AVG(value)::numeric,3) as avg_v, ROUND(MAX(value)::numeric,3) as max_v FROM atlas.ai_interpolation_values WHERE parameter_id IN ('vbs_ked_h1','vbs_ked_h2','vbs_ked_h3','eg_ked_h1','eg_ked_h2','eg_ked_h3','ip_ked_h1','ip_derived_h1') AND COALESCE(is_superseded,false)=false GROUP BY parameter_id ORDER BY parameter_id;"

Write-Output "`n=== MAILLE LAMA (code TG-0490 max VBS) TOUS PARAMS KED ==="
& $psql @conn -c "SELECT iv.parameter_id, ROUND(iv.value::numeric,4) as value, iv.method FROM atlas.ai_interpolation_values iv JOIN atlas.mailles m ON m.id=iv.maille_id WHERE m.code='TG-0490-0227-01' AND COALESCE(iv.is_superseded,false)=false ORDER BY iv.parameter_id LIMIT 30;"

Write-Output "`n=== SONDAGES DANS LA MAILLE TG-0490-0227-01 ==="
& $psql @conn -c "SELECT s.code, s.latitude, s.longitude FROM atlas.sondages s JOIN atlas.mailles m ON ST_Within(ST_SetSRID(ST_Point(s.longitude,s.latitude),4326), m.geom) WHERE m.code='TG-0490-0227-01' AND s.deleted_at IS NULL LIMIT 10;"

Write-Output "`n=== PARAMETRES DISPONIBLES (TOUS) ==="
& $psql @conn -c "SELECT DISTINCT parameter_id FROM atlas.ai_interpolation_values WHERE COALESCE(is_superseded,false)=false ORDER BY parameter_id;"
