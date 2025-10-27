-- Debug associations
SELECT COUNT(*) AS total_associations FROM v_maille_sondages_all;

-- Vérifier si la vue fonctionne
SELECT * FROM v_maille_sondages_all LIMIT 5;

-- Vérifier mv_adm3_maille_map pour Davie
SELECT COUNT(*) AS mailles_davie FROM mv_adm3_maille_map WHERE adm3_code = 'TG030805';

-- Vérifier sondage Davie
SELECT 
  id,
  meta->>'adm3_code' AS adm3,
  geom IS NOT NULL AS has_geom,
  loc_mode
FROM sondages
WHERE meta->>'localite' = 'Davie';

-- Test manuel de la jointure spread
SELECT COUNT(*) 
FROM mailles m
JOIN mv_adm3_maille_map map ON map.maille_id = m.id
JOIN sondages s ON s.geom IS NULL 
  AND (s.meta->>'adm3_code') = map.adm3_code
  AND COALESCE(s.loc_mode, 'spread') = 'spread'
WHERE map.adm3_code = 'TG030805';
