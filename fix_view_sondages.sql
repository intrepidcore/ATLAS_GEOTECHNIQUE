-- Créer la vue des sondages non géocodés avec gid au lieu de id
DROP VIEW IF EXISTS sondages_non_geocodes;

CREATE VIEW sondages_non_geocodes AS
SELECT 
  s.id,
  s.code,
  s.location_mode::text AS location_mode,
  s.adm1_id,
  s.adm2_id,
  s.adm3_id,
  a1.name AS adm1_name,
  a2.name AS adm2_name,
  a3.name AS adm3_name,
  s.created_at,
  COUNT(e.id) AS n_essais
FROM sondages s
LEFT JOIN adm1 a1 ON s.adm1_id::text = a1.gid::text
LEFT JOIN adm2 a2 ON s.adm2_id::text = a2.gid::text
LEFT JOIN adm3 a3 ON s.adm3_id::text = a3.gid::text
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
WHERE s.location_mode::text = 'unknown'
  AND s.deleted_at IS NULL
GROUP BY s.id, s.code, s.location_mode, s.adm1_id, s.adm2_id, s.adm3_id,
         a1.name, a2.name, a3.name, s.created_at;

COMMENT ON VIEW sondages_non_geocodes IS 'Vue des sondages en attente de géocodage (location_mode = unknown)';
