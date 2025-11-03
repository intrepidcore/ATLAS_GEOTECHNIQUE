-- ============================================================================
-- FIX : Fonction match_adm3_strict pour retourner TOUS les candidats
-- ============================================================================
-- La fonction doit retourner tous les candidats (même score 0) pour les suggestions
-- Seul le statut accepted/pending sera déterminé par les seuils

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
-- Passe 0 : Synonymes (table blanche) - score 0.99
syn AS (
  SELECT s.adm3_code, a.name AS adm3_name, 0.99::numeric AS score, 'synonym'::text AS method
  FROM q
  JOIN adm3_synonyms s ON s.alias_norm = q.qnorm
  JOIN adm3_names a ON a.code = s.adm3_code
  WHERE q.qnorm <> ''
),
-- Candidats trigrammes (TOUS, même faibles)
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
    AND (an.name_norm % q.qnorm OR similarity(an.name_norm, q.qnorm) > 0.3)  -- seuil minimal pour candidature
),
-- Calcul Jaccard (recouvrement tokens)
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
-- Retourner TOUS les candidats avec leur score brut
SELECT adm3_code, adm3_name,
       sim AS score,  -- Score brut (pas de filtrage ici)
       CASE
         WHEN sim >= 0.85 AND jaccard >= 0.66 THEN 'trgm+tokens'
         WHEN sim >= 0.70 THEN 'trgm'
         WHEN jaccard >= 0.50 THEN 'tokens'
         ELSE 'candidate'
       END AS method
FROM tok
WHERE sim > 0  -- Au moins une similarité > 0
UNION ALL
SELECT * FROM syn
ORDER BY score DESC NULLS LAST, adm3_name
LIMIT p_limit;
$$;

-- Test
SELECT '=== Test Apeheme ===' AS test;
SELECT * FROM match_adm3_strict('Apeheme');

SELECT '=== Test Dzogbecope ===' AS test;
SELECT * FROM match_adm3_strict('Dzogbecope');

SELECT '=== Test Konsogou T1 ===' AS test;
SELECT * FROM match_adm3_strict('Konsogou T1');
