-- ============================================================================
-- BATCH MATCHING ADM3 depuis localités
-- ============================================================================
-- Remplit automatiquement adm3_code pour les sondages qui ont une localité
-- mais pas d'ADM3, avec seuils de confiance :
-- - score >= 0.72
-- - marge top1 - top2 >= 0.08

-- ============================================================================
-- Étape 1 : Identifier les candidats et scorer
-- ============================================================================
WITH to_do AS (
  SELECT s.id, s.meta->>'localite' AS localite, s.meta->>'adm2_code' AS adm2_code
  FROM sondages s
  WHERE (s.meta->>'adm3_code') IS NULL
    AND nullif(s.meta->>'localite','') IS NOT NULL
),
cands AS (
  SELECT t.id,
         jsonb_agg(
           jsonb_build_object(
             'code', m.adm3_code,
             'name', m.adm3_name,
             'score', m.score,
             'method', m.method
           ) ORDER BY m.score DESC
         ) AS cand
  FROM to_do t
  CROSS JOIN LATERAL match_adm3_from_localite(t.localite, t.adm2_code) m
  GROUP BY t.id
),
ranked AS (
  SELECT c.id,
         (c.cand->0->>'code')::text AS top_code,
         (c.cand->0->>'name')::text AS top_name,
         (c.cand->0->>'score')::numeric AS top_score,
         (c.cand->0->>'method')::text AS top_method,
         (c.cand->1->>'score')::numeric AS next_score,
         c.cand
  FROM cands c
),
-- Séparer les cas sûrs des ambigus
sure_matches AS (
  SELECT * FROM ranked
  WHERE top_score >= 0.72
    AND (next_score IS NULL OR top_score - next_score >= 0.08)
),
ambiguous_matches AS (
  SELECT * FROM ranked
  WHERE NOT (
    top_score >= 0.72
    AND (next_score IS NULL OR top_score - next_score >= 0.08)
  )
)
-- ============================================================================
-- Étape 2a : Mise à jour des cas sûrs
-- ============================================================================
, updates AS (
  UPDATE sondages s
  SET meta = jsonb_set(s.meta, '{adm3_code}', to_jsonb(sm.top_code))
  FROM sure_matches sm
  WHERE s.id = sm.id
  RETURNING s.id, s.meta->>'localite' AS localite, s.meta->>'adm3_code' AS adm3_code, 
            sm.top_score, sm.top_method
)
-- ============================================================================
-- Étape 2b : Insertion des cas ambigus en revue
-- ============================================================================
, reviews AS (
  INSERT INTO match_review(sondage_id, localite, candidates)
  SELECT am.id, s.meta->>'localite', am.cand
  FROM ambiguous_matches am
  JOIN sondages s ON s.id = am.id
  RETURNING sondage_id, localite
)
-- ============================================================================
-- Rapport
-- ============================================================================
SELECT 
  (SELECT COUNT(*) FROM updates) AS matches_surs,
  (SELECT COUNT(*) FROM reviews) AS matches_ambigus,
  (SELECT COUNT(*) FROM sondages WHERE (meta->>'adm3_code') IS NOT NULL) AS total_avec_adm3,
  (SELECT COUNT(*) FROM sondages WHERE (meta->>'adm3_code') IS NULL 
                                   AND nullif(meta->>'localite','') IS NOT NULL) AS reste_sans_adm3;

-- ============================================================================
-- Détail des matches sûrs
-- ============================================================================
SELECT 
  s.meta->>'code' AS code_site,
  s.meta->>'localite' AS localite,
  s.meta->>'adm3_code' AS adm3_code,
  a.adm3_fr AS adm3_name,
  a.adm2_fr AS adm2_name
FROM sondages s
LEFT JOIN adm3 a ON a.adm3_pcode = s.meta->>'adm3_code'
WHERE (s.meta->>'adm3_code') IS NOT NULL
ORDER BY s.created_at DESC;

-- ============================================================================
-- Cas ambigus à revoir
-- ============================================================================
SELECT 
  mr.id,
  mr.localite,
  mr.candidates->0->>'name' AS top1_name,
  (mr.candidates->0->>'score')::numeric AS top1_score,
  mr.candidates->1->>'name' AS top2_name,
  (mr.candidates->1->>'score')::numeric AS top2_score,
  mr.candidates
FROM match_review mr
ORDER BY mr.created_at DESC;
