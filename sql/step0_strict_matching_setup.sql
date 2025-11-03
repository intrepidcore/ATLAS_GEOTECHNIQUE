-- ============================================================================
-- SETUP MATCHING STRICT + SYSTÈME DE SUGGESTIONS
-- ============================================================================
-- Extensions (si pas déjà fait)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- ============================================================================
-- 1) Fonction de normalisation (mise à jour)
-- ============================================================================
CREATE OR REPLACE FUNCTION normalize_name(s text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE t text;
BEGIN
  t := lower(unaccent(coalesce(s,'')));
  t := regexp_replace(t, '\b(region|prefecture|commune|canton|arrondissement|ville|quartier|dept|departement|province)\b', ' ', 'gi');
  t := regexp_replace(t, '\b(de|du|des|d|la|le|les|l|aux|au|a|à|en|et|t1|t2)\b', ' ', 'gi');
  t := regexp_replace(t, '[^a-z0-9]+', ' ', 'g');
  t := regexp_replace(t, '\s+', ' ', 'g');
  t := btrim(t);
  RETURN t;
END$$;

-- ============================================================================
-- 2) Gazetteer ADM3 (refresh si déjà existant)
-- ============================================================================
DROP MATERIALIZED VIEW IF EXISTS adm3_names CASCADE;

CREATE MATERIALIZED VIEW adm3_names AS
SELECT a.adm3_pcode AS code,
       a.adm3_fr AS name,
       a.adm3_fr AS original_name,
       normalize_name(a.adm3_fr) AS name_norm,
       a.adm2_pcode,
       a.adm1_pcode
FROM adm3 a
WHERE a.adm3_fr IS NOT NULL;

CREATE INDEX adm3_names_norm_trgm_idx ON adm3_names
USING gin (name_norm gin_trgm_ops);

CREATE INDEX adm3_names_code_idx ON adm3_names(code);

-- ============================================================================
-- 3) Table synonymes (politique blanche - seuls auto-OK)
-- ============================================================================
-- Réinitialiser avec SEULEMENT Davie (le seul exact validé)
TRUNCATE TABLE adm3_synonyms;

INSERT INTO adm3_synonyms(alias_norm, adm3_code) VALUES
('davie', 'TG030805')  -- SEUL match exact validé
ON CONFLICT (alias_norm) DO NOTHING;

-- ============================================================================
-- 4) Fonction de scoring STRICT (seuils élevés)
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
-- Passe 0 : Synonymes (table blanche) - SEULS AUTO-OK
syn AS (
  SELECT s.adm3_code, a.name AS adm3_name, 0.99::numeric AS score, 'synonym'::text AS method
  FROM q
  JOIN adm3_synonyms s ON s.alias_norm = q.qnorm
  JOIN adm3_names a ON a.code = s.adm3_code
),
-- Candidats trigrammes
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
    AND an.name_norm % q.qnorm  -- utilise index pg_trgm
),
-- Calcul Jaccard (recouvrement tokens)
tok AS (
  SELECT c.adm3_code, c.adm3_name, c.sim,
         CASE
           WHEN cardinality(q.qtok)=0 OR cardinality(c.atok)=0 THEN 0::numeric
           ELSE (
             SELECT (COUNT(DISTINCT x)::numeric) / NULLIF(
               (SELECT COUNT(DISTINCT y) FROM unnest(q.qtok || c.atok) y), 0
             )
             FROM unnest(q.qtok) x
             WHERE x = ANY(c.atok)
           )
         END AS jaccard
  FROM cand c CROSS JOIN q
)
-- Scoring strict : seulement si sim >= 0.85 ET jaccard >= 0.66
SELECT adm3_code, adm3_name,
       CASE
         WHEN sim >= 0.85 AND jaccard >= 0.66 THEN sim
         ELSE 0.0  -- Non conforme → score 0 (suggestion only)
       END AS score,
       CASE
         WHEN sim >= 0.85 AND jaccard >= 0.66 THEN 'trgm+tokens'
         ELSE 'candidate'
       END AS method
FROM tok
UNION ALL
SELECT * FROM syn
ORDER BY score DESC NULLS LAST, adm3_name
LIMIT p_limit;
$$;

-- ============================================================================
-- 5) Table des suggestions (pour UI Géocodage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS geocode_suggestions (
  id           bigserial PRIMARY KEY,
  entity       text NOT NULL DEFAULT 'sondages',
  entity_id    uuid NOT NULL,
  localite     text,
  adm2_code    text,
  candidates   jsonb NOT NULL,
  top_code     text,
  top_score    numeric,
  top_method   text,
  status       text NOT NULL DEFAULT 'pending',  -- pending|accepted|rejected
  created_at   timestamptz DEFAULT now(),
  decided_at   timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS geocode_suggestions_unique
  ON geocode_suggestions(entity, entity_id);

CREATE INDEX IF NOT EXISTS geocode_suggestions_status_idx
  ON geocode_suggestions(status);

-- ============================================================================
-- Test rapide
-- ============================================================================
SELECT 'Setup matching strict terminé' AS status;

-- Tests
SELECT '=== Test Davie (synonym - auto-OK) ===' AS test;
SELECT * FROM match_adm3_strict('Davie');

SELECT '=== Test Apeheme (candidate - pending) ===' AS test;
SELECT * FROM match_adm3_strict('Apeheme');

SELECT '=== Test Konsogou T1 (candidate - pending) ===' AS test;
SELECT * FROM match_adm3_strict('Konsogou T1');
