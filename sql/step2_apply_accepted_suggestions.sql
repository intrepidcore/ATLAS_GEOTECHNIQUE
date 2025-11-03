-- ============================================================================
-- APPLIQUER LES SUGGESTIONS ACCEPTED
-- ============================================================================
-- Écrit adm3_code dans sondages.meta pour toutes les suggestions accepted

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
  AND (s.meta->>'adm3_code') IS NULL
RETURNING s.meta->>'code' AS code_site, 
          s.meta->>'localite' AS localite,
          s.meta->>'adm3_code' AS adm3_code;

-- Rapport
SELECT 
  COUNT(*) FILTER (WHERE (meta->>'adm3_code') IS NOT NULL) AS avec_adm3,
  COUNT(*) FILTER (WHERE (meta->>'adm3_code') IS NULL) AS sans_adm3
FROM sondages;
