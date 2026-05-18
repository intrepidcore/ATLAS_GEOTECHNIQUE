$env:PGPASSWORD = 'atlas'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$conn = @('-U', 'atlas', '-h', '127.0.0.1', '-p', '5433', '-d', 'atlas_clean')

Write-Output "=== 0C: COUVERTURE PAR PARAMETRE (TOP 15) ==="
& $psql @conn -c "SELECT parameter_id, COUNT(*) as n FROM atlas.ai_interpolation_values WHERE COALESCE(is_superseded,false)=false GROUP BY parameter_id ORDER BY n DESC LIMIT 15;"

Write-Output "`n=== 18A: STATS GLOBALES VBS_KED_H1 ==="
& $psql @conn -c "SELECT COUNT(*) as total_mailles, ROUND(MIN(value)::numeric,3) as min_vbs, ROUND(AVG(value)::numeric,3) as avg_vbs, ROUND(MAX(value)::numeric,3) as max_vbs, ROUND(STDDEV(value)::numeric,3) as std_vbs FROM atlas.ai_interpolation_values iv WHERE iv.parameter_id = 'vbs_ked_h1' AND COALESCE(iv.is_superseded,false)=false;"

Write-Output "`n=== 18A: STATS EG_KED_H1 ==="
& $psql @conn -c "SELECT COUNT(*) as total_mailles, ROUND(MIN(value)::numeric,3) as min_eg, ROUND(AVG(value)::numeric,3) as avg_eg, ROUND(MAX(value)::numeric,3) as max_eg, ROUND(STDDEV(value)::numeric,3) as std_eg FROM atlas.ai_interpolation_values iv WHERE iv.parameter_id = 'eg_ked_h1' AND COALESCE(iv.is_superseded,false)=false;"

Write-Output "`n=== 18A: STATS IP_KED_H1 ==="
& $psql @conn -c "SELECT COUNT(*) as total_mailles, ROUND(MIN(value)::numeric,3) as min_ip, ROUND(AVG(value)::numeric,3) as avg_ip, ROUND(MAX(value)::numeric,3) as max_ip FROM atlas.ai_interpolation_values iv WHERE iv.parameter_id = 'ip_ked_h1' AND COALESCE(iv.is_superseded,false)=false;"

Write-Output "`n=== 18C: STATS PAR ZONE D'ETUDE ==="
& $psql @conn -c "SELECT z.nom_zone, COUNT(DISTINCT m.id) as n_mailles, ROUND(AVG(CASE WHEN iv.parameter_id='vbs_ked_h1' THEN iv.value END)::numeric,3) as avg_vbs_h1, ROUND(AVG(CASE WHEN iv.parameter_id='eg_ked_h1' THEN iv.value END)::numeric,3) as avg_eg_h1 FROM atlas.zones_etude z JOIN atlas.mailles_zones_etude mze ON mze.zone_id = z.id JOIN atlas.mailles m ON m.id = mze.maille_id LEFT JOIN atlas.ai_interpolation_values iv ON iv.maille_id = m.id AND iv.parameter_id IN ('vbs_ked_h1','eg_ked_h1') AND COALESCE(iv.is_superseded,false)=false GROUP BY z.nom_zone ORDER BY avg_vbs_h1 DESC NULLS LAST;" 2>&1

Write-Output "`n=== EG: COMPARAISON H1/H2/H3 SUR 5 MAILLES ALEATOIRES ==="
& $psql @conn -c "SELECT m.code, ROUND(MAX(CASE WHEN iv.parameter_id='vbs_ked_h1' THEN iv.value END)::numeric,4) as vbs_h1, ROUND(MAX(CASE WHEN iv.parameter_id='vbs_ked_h2' THEN iv.value END)::numeric,4) as vbs_h2, ROUND(MAX(CASE WHEN iv.parameter_id='vbs_ked_h3' THEN iv.value END)::numeric,4) as vbs_h3, ROUND(MAX(CASE WHEN iv.parameter_id='eg_ked_h1' THEN iv.value END)::numeric,4) as eg_h1 FROM atlas.ai_interpolation_values iv JOIN atlas.mailles m ON m.id = iv.maille_id WHERE iv.parameter_id IN ('vbs_ked_h1','vbs_ked_h2','vbs_ked_h3','eg_ked_h1') AND COALESCE(iv.is_superseded,false)=false GROUP BY m.code ORDER BY RANDOM() LIMIT 5;"

Write-Output "`n=== SCHEMA TABLE zones_etude ==="
& $psql @conn -c "SELECT table_name FROM information_schema.tables WHERE table_schema='atlas' AND table_name LIKE '%zone%';"

Write-Output "`n=== TOP 5 MAILLES VBS_KED_H1 ELEVEES ==="
& $psql @conn -c "SELECT m.code, ROUND(iv.value::numeric,4) as vbs_h1 FROM atlas.ai_interpolation_values iv JOIN atlas.mailles m ON m.id = iv.maille_id WHERE iv.parameter_id='vbs_ked_h1' AND COALESCE(iv.is_superseded,false)=false ORDER BY iv.value DESC LIMIT 5;"

Write-Output "`n=== TOKEN JWT ==="
$body = '{"email":"admin@atlas.local","password":"Atlas2024!"}'
$resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/auth/login" -Method POST -ContentType "application/json" -Body $body
$tok = $resp.access_token
if ($tok) { Write-Output "TOKEN OK: $($tok.Substring(0,40))..." ; $tok | Out-File 'C:\PROJET_ATLAS_MASTER\atlas_reclone\token.txt' -Encoding utf8 -Force } else { Write-Output "TOKEN FAIL" }
