-- ============================================================================
-- FIX FINAL SIMPLE
-- ============================================================================

-- 1) Géocoder DAVIE (le seul avec ADM3)
UPDATE sondages s
SET geom = ST_Transform(ST_Centroid(a.geom), 25231)
FROM adm3 a
WHERE s.geom IS NULL 
  AND (s.meta->>'adm3_code') = 'TG030805'
  AND a.adm3_pcode = 'TG030805';

-- 2) Vérifier
SELECT 
  meta->>'code' AS code,
  meta->>'localite' AS localite,
  meta->>'adm3_code' AS adm3,
  geom IS NOT NULL AS has_geom
FROM sondages
ORDER BY meta->>'code';

-- 3) Refresh vue
REFRESH MATERIALIZED VIEW mv_mailles_geotech;

-- 4) Compter
SELECT COUNT(*) FROM mv_mailles_geotech;
