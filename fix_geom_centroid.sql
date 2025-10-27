-- ============================================================================
-- FIX : Ajouter géométrie centroid pour les sondages avec ADM3
-- ============================================================================

-- Compter avant
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE geom IS NOT NULL) AS avec_geom,
  COUNT(*) FILTER (WHERE (meta->>'adm3_code') IS NOT NULL) AS avec_adm3
FROM sondages;

-- Appliquer centroid pour ceux qui ont un ADM3
UPDATE sondages s
SET geom = ST_Transform(ST_Centroid(a.geom), 25231)
FROM adm3 a
WHERE s.geom IS NULL 
  AND (s.meta->>'adm3_code') IS NOT NULL
  AND a.adm3_pcode = (s.meta->>'adm3_code');

-- Compter après
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE geom IS NOT NULL) AS avec_geom,
  COUNT(*) FILTER (WHERE (meta->>'adm3_code') IS NOT NULL) AS avec_adm3
FROM sondages;

-- Refresh vues
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;

-- Vérifier résultat
SELECT COUNT(*) FROM mv_mailles_geotech;
