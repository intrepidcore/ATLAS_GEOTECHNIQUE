-- ============================================================================
-- UNIFICATION DES SONDAGES PAR LOCALITÉ
-- ============================================================================
-- Regroupe les sondages BLEU-*, LIMITE-*, GRANULO-* sous une clé canonique
-- Sans modifier les tables existantes (pas de migration lourde)
-- ============================================================================

-- 0) Extensions
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) Schéma utilitaire
CREATE SCHEMA IF NOT EXISTS atlas;

-- 2) Fonction de normalisation - Clé canonique SANS accents/espaces
CREATE OR REPLACE FUNCTION atlas.norm_key(txt text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN txt IS NULL THEN NULL
    ELSE upper(regexp_replace(unaccent(txt), '[^A-Za-z0-9]+', '', 'g'))
  END
$$;

-- 3) Fonction d'extraction de localité depuis le code
CREATE OR REPLACE FUNCTION atlas.extract_localite(code text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(btrim(regexp_replace(code, '^(BLEU|LIMITE|GRANULO|VBS|ATTERBERG)[-_]*', '', 'i')), '')
$$;

-- 4) Vue d'unification (1 ligne = 1 localité)
CREATE OR REPLACE VIEW atlas.v_sondages_unifies AS
WITH base AS (
  SELECT
    s.id,
    s.code,
    s.source,
    atlas.extract_localite(s.code) AS localite_base,
    atlas.norm_key(atlas.extract_localite(s.code)) AS localite_key,
    CASE
      WHEN s.code ILIKE 'BLEU-%' OR s.source = 'bleu' THEN 'BLEU'
      WHEN s.code ILIKE 'LIMITE-%' OR s.source = 'limite' THEN 'LIMITE'
      WHEN s.code ILIKE 'GRANULO-%' OR s.source = 'Granulométrie' THEN 'GRANULO'
      WHEN s.code ILIKE 'VBS-%' THEN 'VBS'
      WHEN s.code ILIKE 'ATTERBERG-%' THEN 'ATTERBERG'
      ELSE NULL
    END AS serie,
    s.adm3_id,
    s.adm3_name,
    s.grid_code,
    s.geom,
    s.date,
    s.deleted_at
  FROM sondages s
  WHERE s.deleted_at IS NULL
),
g AS (
  SELECT
    b.localite_key,
    min(initcap(lower(b.localite_base))) AS localite,  -- Libellé d'affichage
    array_agg(b.id ORDER BY b.id) AS survey_ids,
    array_agg(b.code ORDER BY b.code) AS survey_codes,
    bool_or(serie='BLEU') AS has_bleu,
    bool_or(serie='LIMITE') AS has_limite,
    bool_or(serie='GRANULO') AS has_granulo,
    bool_or(serie='VBS') AS has_vbs,
    bool_or(serie='ATTERBERG') AS has_atterberg,
    count(*) AS variants,
    (array_agg(b.adm3_id ORDER BY CASE WHEN b.adm3_id IS NOT NULL THEN 0 ELSE 1 END, b.id))[1] AS adm3_id,
    (array_agg(b.adm3_name ORDER BY CASE WHEN b.adm3_name IS NOT NULL THEN 0 ELSE 1 END, b.id))[1] AS adm3_name,
    (array_agg(b.grid_code ORDER BY CASE WHEN b.grid_code IS NOT NULL THEN 0 ELSE 1 END, b.id))[1] AS grid_code,
    bool_or(b.geom IS NOT NULL) AS has_geometry,
    max(b.date) AS latest_date,
    -- Prendre la géométrie du premier sondage qui en a une
    (array_agg(b.geom ORDER BY CASE WHEN b.geom IS NOT NULL THEN 0 ELSE 1 END, b.id))[1] AS geom
  FROM base b
  WHERE b.localite_key IS NOT NULL AND b.localite_key != ''
  GROUP BY b.localite_key
)
SELECT
  g.localite_key,
  g.localite,
  g.survey_ids,
  g.survey_codes,
  g.has_bleu, g.has_limite, g.has_granulo, g.has_vbs, g.has_atterberg,
  g.variants,
  g.adm3_id, g.adm3_name, g.grid_code, g.has_geometry,
  g.latest_date,
  g.geom,
  -- Compter les essais
  COALESCE((SELECT count(*) FROM echantillons e 
            JOIN essais_atterberg a ON a.echantillon_id = e.id 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) AS atterberg_count,
  COALESCE((SELECT count(*) FROM echantillons e 
            JOIN granulo_points gr ON gr.echantillon_id = e.id 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) AS granulo_count,
  COALESCE((SELECT count(*) FROM echantillons e 
            JOIN essais_vbs v ON v.echantillon_id = e.id 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) AS vbs_count,
  COALESCE((SELECT count(*) FROM echantillons e 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) AS echantillons_count,
  -- Total essais
  COALESCE((SELECT count(*) FROM echantillons e 
            JOIN essais_atterberg a ON a.echantillon_id = e.id 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) +
  COALESCE((SELECT count(*) FROM echantillons e 
            JOIN granulo_points gr ON gr.echantillon_id = e.id 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) +
  COALESCE((SELECT count(*) FROM echantillons e 
            JOIN essais_vbs v ON v.echantillon_id = e.id 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) AS total_essais
FROM g;

-- 5) Vue matérialisée pour performance
DROP MATERIALIZED VIEW IF EXISTS atlas.mv_sondages_unifies CASCADE;
CREATE MATERIALIZED VIEW atlas.mv_sondages_unifies AS
  SELECT * FROM atlas.v_sondages_unifies;

CREATE INDEX IF NOT EXISTS mv_sondages_unifies_key_idx 
  ON atlas.mv_sondages_unifies(localite_key);
CREATE INDEX IF NOT EXISTS mv_sondages_unifies_localite_idx 
  ON atlas.mv_sondages_unifies USING gin(to_tsvector('french', localite));
CREATE INDEX IF NOT EXISTS mv_sondages_unifies_geom_idx 
  ON atlas.mv_sondages_unifies USING gist(geom);

-- 6) Fonction de refresh
CREATE OR REPLACE FUNCTION atlas.refresh_sondages_unifies()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW atlas.mv_sondages_unifies;
END;
$$;

-- Refresh initial
SELECT atlas.refresh_sondages_unifies();

-- ============================================================================
-- REQUÊTES UTILES
-- ============================================================================

-- Liste unifiée (remplace /surveys?limit=...)
COMMENT ON VIEW atlas.v_sondages_unifies IS 
'Vue unifiée des sondages regroupés par localité canonique. 
Utiliser pour afficher une liste consolidée sans doublons BLEU-*/LIMITE-*/GRANULO-*.';

-- Exemple: Liste des localités avec leurs essais
-- SELECT localite, variants, total_essais, has_bleu, has_limite, has_granulo
-- FROM atlas.mv_sondages_unifies
-- ORDER BY localite;

-- Exemple: Détails d'une localité
-- SELECT survey_ids, survey_codes
-- FROM atlas.mv_sondages_unifies
-- WHERE localite_key = atlas.norm_key('Adjengré');

-- Exemple: Tous les essais d'une localité
-- WITH loc AS (
--   SELECT survey_ids FROM atlas.mv_sondages_unifies 
--   WHERE localite_key = atlas.norm_key('Adjengré')
-- )
-- SELECT s.code, e.depth_m, a.wl, a.wp, v.vbs
-- FROM sondages s
-- JOIN echantillons e ON e.sondage_id = s.id
-- LEFT JOIN essais_atterberg a ON a.echantillon_id = e.id
-- LEFT JOIN essais_vbs v ON v.echantillon_id = e.id
-- WHERE s.id = ANY((SELECT survey_ids FROM loc))
-- ORDER BY s.code, e.depth_m;

-- ============================================================================
-- STATISTIQUES
-- ============================================================================

-- Nombre de localités uniques vs nombre de sondages
SELECT 
  (SELECT COUNT(*) FROM atlas.mv_sondages_unifies) as localites_uniques,
  (SELECT COUNT(*) FROM sondages WHERE deleted_at IS NULL) as total_sondages,
  (SELECT COUNT(*) FROM atlas.mv_sondages_unifies WHERE variants > 1) as localites_avec_doublons;

-- Localités avec le plus de variants
SELECT localite, variants, survey_codes, total_essais
FROM atlas.mv_sondages_unifies
WHERE variants > 1
ORDER BY variants DESC, total_essais DESC
LIMIT 20;
