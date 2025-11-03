-- ============================================================================
-- APPLIQUER GÉOCODAGE SPREAD POUR DAVIE
-- ============================================================================

-- 1) Appliquer spread pour Davie (le seul sondage avec ADM3)
SELECT geocode_adm3_spread(
  id,
  'TG030805'
) FROM sondages WHERE (meta->>'adm3_code') = 'TG030805';

-- 2) Refresh vues
REFRESH MATERIALIZED VIEW mv_adm3_maille_map;
REFRESH MATERIALIZED VIEW mv_mailles_geotech;

-- 3) Vérifier résultat
SELECT COUNT(*) AS total_mailles FROM mv_mailles_geotech;

-- 4) Compter associations sondages-mailles
SELECT COUNT(*) AS associations FROM v_maille_sondages_all;

-- 5) Détails par source
SELECT 
  source,
  COUNT(DISTINCT maille_code) AS mailles,
  COUNT(DISTINCT sondage_id) AS sondages
FROM v_maille_sondages_all
GROUP BY source;
