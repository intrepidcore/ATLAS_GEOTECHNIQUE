-- ============================================================================
-- GÉNÉRATION DES SUGGESTIONS (SANS ÉCRITURE AUTO DANS SONDAGES)
-- ============================================================================
-- Politique stricte :
-- - synonym → accepted (auto-OK)
-- - trgm+tokens avec score >= 0.88 → accepted (très sûr)
-- - tout le reste → pending (validation manuelle UI)

-- Nettoyer les ADM3 existants (pour test propre)
UPDATE sondages SET meta = meta - 'adm3_code';

-- Générer les suggestions
WITH src AS (
  SELECT id, meta->>'localite' AS localite, meta->>'adm2_code' AS adm2_code
  FROM sondages
  WHERE (meta->>'adm3_code') IS NULL 
    AND nullif(meta->>'localite','') IS NOT NULL
),
calc AS (
  SELECT s.id,
         s.localite,
         s.adm2_code,
         jsonb_agg(jsonb_build_object(
           'code', m.adm3_code, 
           'name', m.adm3_name, 
           'score', m.score, 
           'method', m.method
         ) ORDER BY m.score DESC) AS cand
  FROM src s
  CROSS JOIN LATERAL match_adm3_strict(s.localite, s.adm2_code, 5) m
  GROUP BY s.id, s.localite, s.adm2_code
),
top1 AS (
  SELECT id, localite, adm2_code, cand,
         (cand->0->>'code')::text AS top_code,
         (cand->0->>'method')::text AS top_method,
         (cand->0->>'score')::numeric AS top_score
  FROM calc
)
INSERT INTO geocode_suggestions(entity, entity_id, localite, adm2_code, candidates, top_code, top_score, top_method, status)
SELECT 'sondages', t.id, t.localite, t.adm2_code, t.cand, t.top_code, t.top_score, t.top_method,
       CASE
         WHEN t.top_method = 'synonym' THEN 'accepted'  -- Davie uniquement
         WHEN t.top_method = 'trgm+tokens' AND t.top_score >= 0.88 THEN 'accepted'
         ELSE 'pending'
       END
FROM top1 t
ON CONFLICT (entity, entity_id) DO UPDATE
SET candidates = EXCLUDED.candidates,
    top_code   = EXCLUDED.top_code,
    top_score  = EXCLUDED.top_score,
    top_method = EXCLUDED.top_method,
    status     = EXCLUDED.status,
    created_at = geocode_suggestions.created_at,
    decided_at = NULL;

-- ============================================================================
-- RAPPORT
-- ============================================================================
SELECT 
  status,
  COUNT(*) AS count,
  array_agg(localite ORDER BY localite) AS localites
FROM geocode_suggestions
WHERE entity = 'sondages'
GROUP BY status
ORDER BY status;

-- Détail des suggestions
SELECT 
  gs.localite,
  gs.top_code,
  a.adm3_fr AS top_name,
  gs.top_score,
  gs.top_method,
  gs.status,
  gs.candidates
FROM geocode_suggestions gs
LEFT JOIN adm3 a ON a.adm3_pcode = gs.top_code
WHERE gs.entity = 'sondages'
ORDER BY gs.status, gs.top_score DESC;
