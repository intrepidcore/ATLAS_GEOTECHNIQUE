-- Mapping Davie
SELECT COUNT(*) AS mailles_davie FROM mv_adm3_maille_map WHERE adm3_code='TG030805';

-- Sondages Davie
SELECT 
  id, 
  meta->>'adm3_code' AS adm3_code,
  (geom IS NULL) AS geom_is_null, 
  loc_mode
FROM sondages
WHERE meta->>'adm3_code'='TG030805';
