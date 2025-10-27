-- ============================================================================
-- FIX COMPLET UI V2 - Sans CONCURRENTLY
-- ============================================================================

-- 1) Appliquer toutes les suggestions accepted
WITH accepted AS (
  SELECT entity_id AS id, top_code
  FROM geocode_suggestions
  WHERE entity = 'sondages' 
    AND status = 'accepted'
    AND top_code IS NOT NULL
)
UPDATE sondages s
SET meta = jsonb_set(s.meta, '{adm3_code}', to_jsonb(a.top_code))
FROM accepted a
WHERE s.id = a.id
  AND (s.meta->>'adm3_code') IS NULL;

-- 2) Géocoder avec centroid tous les sondages qui ont un ADM3
UPDATE sondages s
SET geom = ST_Transform(ST_Centroid(a.geom), 25231)
FROM adm3 a
WHERE s.geom IS NULL 
  AND (s.meta->>'adm3_code') IS NOT NULL
  AND a.adm3_pcode = (s.meta->>'adm3_code');

-- 3) Vérifier résultat
SELECT 
  COUNT(*) AS total_sondages,
  COUNT(*) FILTER (WHERE geom IS NOT NULL) AS avec_geom,
  COUNT(*) FILTER (WHERE (meta->>'adm3_code') IS NOT NULL) AS avec_adm3
FROM sondages;

-- 4) Refresh vues (sans CONCURRENTLY)
REFRESH MATERIALIZED VIEW mv_adm3_maille_map;
REFRESH MATERIALIZED VIEW mv_mailles_geotech;

-- 5) Vérifier le résultat final
SELECT 
  COUNT(*) AS total_mailles,
  SUM(CASE WHEN stats->>'n_sondages' IS NOT NULL THEN (stats->>'n_sondages')::int ELSE 0 END) AS total_sondages,
  COUNT(*) FILTER (WHERE stats->>'n_sondages' IS NOT NULL AND (stats->>'n_sondages')::int > 0) AS mailles_avec_donnees
FROM mv_mailles_geotech;
