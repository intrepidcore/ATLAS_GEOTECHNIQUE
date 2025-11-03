-- Vérifier l'état final
SELECT 
  COUNT(*) AS total_mailles,
  COUNT(*) FILTER (WHERE has_data) AS mailles_avec_donnees,
  SUM(n_sondages) AS total_sondages,
  SUM(n_essais) AS total_essais
FROM mv_mailles_geotech;

SELECT COUNT(*) AS associations FROM v_maille_sondages_all;

SELECT 
  source,
  COUNT(DISTINCT maille_code) AS mailles,
  COUNT(DISTINCT sondage_id) AS sondages
FROM v_maille_sondages_all
GROUP BY source;

-- Vérifier Davie
SELECT 
  s.id,
  s.meta->>'code' AS code,
  s.meta->>'adm3_code' AS adm3,
  s.geom IS NOT NULL AS has_geom,
  s.loc_mode
FROM sondages s
WHERE (s.meta->>'adm3_code') = 'TG030805';

-- Compter mailles Davie
SELECT COUNT(*) FROM mv_adm3_maille_map WHERE adm3_code = 'TG030805';
