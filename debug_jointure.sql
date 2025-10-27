-- Debug jointure v_maille_sondages_all
SELECT 
  s.id,
  s.meta->>'adm3_code' AS adm3_from_sondage,
  length(s.meta->>'adm3_code') AS len_sondage,
  s.geom IS NULL AS geom_is_null,
  COALESCE(s.loc_mode, 'spread') AS loc_mode
FROM sondages s
WHERE s.meta->>'localite' = 'Davie';

-- Vérifier mv_adm3_maille_map
SELECT 
  adm3_code,
  length(adm3_code) AS len_code,
  COUNT(*) AS nb_mailles
FROM mv_adm3_maille_map
WHERE adm3_code = 'TG030805'
GROUP BY adm3_code;

-- Test jointure manuelle
SELECT COUNT(*)
FROM mailles m
JOIN mv_adm3_maille_map map ON map.maille_id = m.id
JOIN sondages s ON s.geom IS NULL 
  AND (s.meta->>'adm3_code') = map.adm3_code
WHERE map.adm3_code = 'TG030805';

-- Test avec TRIM
SELECT COUNT(*)
FROM mailles m
JOIN mv_adm3_maille_map map ON map.maille_id = m.id
JOIN sondages s ON s.geom IS NULL 
  AND TRIM(s.meta->>'adm3_code') = TRIM(map.adm3_code)
WHERE map.adm3_code = 'TG030805';
