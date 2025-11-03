-- ============================================================================
-- SETUP ADM3 MATCHING ROBUSTE (4 passes)
-- ============================================================================
-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;  -- pour dmetaphone

-- ============================================================================
-- 1) Fonction de normalisation
-- ============================================================================
CREATE OR REPLACE FUNCTION normalize_name(s text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE t text;
BEGIN
  t := lower(unaccent(coalesce(s,'')));

  -- retire termes administratifs fréquents
  t := regexp_replace(t, '\b(region|prefecture|commune|canton|arrondissement|ville|quartier|dept|departement|province)\b', ' ', 'gi');

  -- retire articles/prépositions courtes
  t := regexp_replace(t, '\b(de|du|des|d|la|le|les|l|aux|au|a|à|en|et|t1|t2)\b', ' ', 'gi');

  -- remplace tout séparateur par espace, compresse espaces
  t := regexp_replace(t, '[^a-z0-9]+', ' ', 'g');
  t := regexp_replace(t, '\s+', ' ', 'g');
  t := btrim(t);
  RETURN t;
END$$;

-- ============================================================================
-- 2) Vue matérialisée des noms ADM3 (nom officiel + alias)
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

-- Index trigrammes pour recherche fuzzy
CREATE INDEX adm3_names_norm_trgm_idx ON adm3_names
USING gin (name_norm gin_trgm_ops);

CREATE INDEX adm3_names_code_idx ON adm3_names(code);

-- ============================================================================
-- 3) Table synonymes (mapping manuel sûr)
-- ============================================================================
CREATE TABLE IF NOT EXISTS adm3_synonyms (
  alias_norm text PRIMARY KEY,
  adm3_code  text NOT NULL
);

CREATE INDEX IF NOT EXISTS adm3_synonyms_alias_idx ON adm3_synonyms(alias_norm);

-- Exemples de synonymes (à compléter selon tes données)
INSERT INTO adm3_synonyms(alias_norm, adm3_code) VALUES
('keve', 'TG030805'),
('apeheme', 'TG030701'),
('dzogbecope', 'TG030904'),
('tekpo', 'TG030709'),
('konsogou', 'TG020605'),
('nassable', 'TG051703'),
('kontongbongue', 'TG051902')
ON CONFLICT (alias_norm) DO NOTHING;

-- ============================================================================
-- 4) Fonction de matching (4 passes : exact, substring, phonetic, trigram)
-- ============================================================================
CREATE OR REPLACE FUNCTION match_adm3_from_localite(
  p_localite text,
  p_adm2_code text DEFAULT NULL
)
RETURNS TABLE(adm3_code text, adm3_name text, score numeric, method text)
LANGUAGE sql STABLE AS $$
WITH q AS (
  SELECT normalize_name(p_localite) AS qnorm
),
-- Passe 0 : Synonymes (score 0.98)
syn AS (
  SELECT s.adm3_code, an.name AS adm3_name, 0.98::numeric AS score, 'synonym'::text AS method
  FROM q
  JOIN adm3_synonyms s ON s.alias_norm = q.qnorm
  JOIN adm3_names an ON an.code = s.adm3_code
  WHERE p_localite IS NOT NULL
),
-- Passes 1-4 : Candidats avec scoring
cand AS (
  SELECT an.code AS adm3_code,
         an.name AS adm3_name,
         similarity(an.name_norm, q.qnorm) AS sim,
         (an.name_norm = q.qnorm) AS is_exact,
         (position(q.qnorm in an.name_norm) > 0 OR position(an.name_norm in q.qnorm) > 0) AS is_substr,
         (dmetaphone(an.name_norm) = dmetaphone(q.qnorm)) AS is_phone
  FROM adm3_names an
  CROSS JOIN q
  WHERE an.name_norm <> ''
    AND q.qnorm <> ''
    AND (p_adm2_code IS NULL OR an.adm2_pcode = p_adm2_code)
    AND (an.name_norm % q.qnorm OR an.name_norm = q.qnorm)  -- utilise l'index pg_trgm
)
SELECT adm3_code, adm3_name,
       GREATEST(
         CASE WHEN is_exact  THEN 1.00 ELSE 0 END,
         CASE WHEN is_substr THEN 0.92 ELSE 0 END,
         CASE WHEN is_phone  THEN 0.86 ELSE 0 END,
         sim
       ) AS score,
       CASE
         WHEN is_exact  THEN 'exact'
         WHEN is_substr THEN 'substring'
         WHEN is_phone  THEN 'phonetic'
         WHEN sim IS NOT NULL THEN 'trigram'
         ELSE 'unknown'
       END AS method
FROM cand
UNION ALL
SELECT * FROM syn
ORDER BY score DESC
LIMIT 5;
$$;

-- ============================================================================
-- 5) Table de revue manuelle (cas ambigus)
-- ============================================================================
CREATE TABLE IF NOT EXISTS match_review (
  id           bigserial PRIMARY KEY,
  sondage_id   uuid,
  localite     text,
  candidates   jsonb,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS match_review_sondage_idx ON match_review(sondage_id);

-- ============================================================================
-- Test rapide
-- ============================================================================
SELECT 'Setup ADM3 matching terminé' AS status;

-- Test de la fonction
SELECT * FROM match_adm3_from_localite('Davie');
SELECT * FROM match_adm3_from_localite('Apeheme');
SELECT * FROM match_adm3_from_localite('Konsogou T1');
