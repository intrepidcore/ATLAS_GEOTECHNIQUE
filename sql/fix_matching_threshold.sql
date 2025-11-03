-- ============================================================================
-- FIX : Abaisser le seuil et retourner plus de candidats
-- ============================================================================

CREATE OR REPLACE FUNCTION match_adm3_strict(
  p_localite  text,
  p_adm2_code text DEFAULT NULL,
  p_limit     int  DEFAULT 5
)
RETURNS TABLE(adm3_code text, adm3_name text, score numeric, method text) 
LANGUAGE sql STABLE AS $$
WITH q AS (
  SELECT normalize_name(p_localite) AS qnorm,
         regexp_split_to_array(normalize_name(p_localite), '\s+') AS qtok
),
-- Passe 0 : Synonymes (table blanche)
syn AS (
  SELECT s.adm3_code, a.name AS adm3_name, 0.99::numeric AS score, 'synonym'::text AS method
  FROM q
  JOIN adm3_synonyms s ON s.alias_norm = q.qnorm
  JOIN adm3_names a ON a.code = s.adm3_code
  WHERE q.qnorm <> ''
),
-- Candidats trigrammes (TOUS avec similarité > 0.2)
cand AS (
  SELECT an.code AS adm3_code,
         an.name AS adm3_name,
         an.name_norm,
         similarity(an.name_norm, q.qnorm) AS sim,
         regexp_split_to_array(an.name_norm, '\s+') AS atok
  FROM adm3_names an
  CROSS JOIN q
  WHERE an.name_norm <> ''
    AND q.qnorm <> ''
    AND (p_adm2_code IS NULL OR an.adm2_pcode = p_adm2_code)
    AND similarity(an.name_norm, q.qnorm) > 0.2  -- Seuil minimal abaissé
),
-- Calcul Jaccard
tok AS (
  SELECT c.adm3_code, c.adm3_name, c.sim,
         CASE
           WHEN cardinality(q.qtok)=0 OR cardinality(c.atok)=0 THEN 0::numeric
           ELSE (
             SELECT COUNT(DISTINCT x)::numeric / NULLIF(
               (SELECT COUNT(DISTINCT y) FROM (
                 SELECT unnest(q.qtok) UNION SELECT unnest(c.atok)
               ) z(y)), 0
             )
             FROM unnest(q.qtok) x
             WHERE x = ANY(c.atok)
           )
         END AS jaccard
  FROM cand c CROSS JOIN q
)
-- Retourner tous les candidats
SELECT adm3_code, adm3_name,
       sim AS score,
       CASE
         WHEN sim >= 0.85 AND jaccard >= 0.66 THEN 'trgm+tokens'
         WHEN sim >= 0.70 THEN 'trgm'
         WHEN jaccard >= 0.50 THEN 'tokens'
         ELSE 'candidate'
       END AS method
FROM tok
WHERE sim > 0.2  -- Au moins 20% de similarité
UNION ALL
SELECT * FROM syn
ORDER BY score DESC NULLS LAST, adm3_name
LIMIT p_limit;
$$;

-- Test
SELECT 'Test Apeheme' AS test;
SELECT * FROM match_adm3_strict('Apeheme');
