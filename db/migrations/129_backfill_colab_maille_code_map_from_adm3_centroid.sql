-- ==========================================================================
-- MIGRATION 129 : backfill mapping provisoire (TG-00xx) -> V2 via ADM3 centroid
-- Objectif : remplir atlas.colab_maille_code_map.target_code de façon prouvée
--            à partir des communes importées (adm3_fr) et de la grille V2.
--
-- Règle (prouvée en DB) :
--   mission.commune (texte) -> public.adm3.adm3_fr -> centroid (4326->25231)
--   -> maille V2 contenant le point (ST_Contains)
--
-- Notes:
--  - Idempotent (update uniquement si target_code NULL/blank)
--  - Aucune heuristique sur TG-00xx.
-- ==========================================================================

BEGIN;

-- 0) Pré-requis: tables et colonnes attendues
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='atlas' AND table_name='colab_maille_code_map'
  ) THEN
    RAISE EXCEPTION 'Table atlas.colab_maille_code_map manquante';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='adm3'
  ) THEN
    RAISE EXCEPTION 'Table public.adm3 manquante (source géo communes)';
  END IF;
END $$;

-- 1) Backfill via missions Colab ayant une commune et un code source TG-00..
WITH src AS (
  SELECT DISTINCT
    map.source_code,
    cm.commune
  FROM atlas.colab_maille_code_map map
  JOIN atlas.colab_missions cm
    ON cm.notes_internal ILIKE '%' || map.source_code || '%'
   AND cm.deleted_at IS NULL
  WHERE map.source_code LIKE 'TG-00%'
    AND (map.target_code IS NULL OR BTRIM(map.target_code) = '')
    AND cm.commune IS NOT NULL
    AND BTRIM(cm.commune) <> ''
),
adm3_geom AS (
  SELECT
    s.source_code,
    s.commune,
    ST_Transform(ST_Centroid(a.geom), 25231) AS centroid_25231
  FROM src s
  JOIN public.adm3 a
    ON lower(a.adm3_fr) = lower(s.commune)
),
resolved AS (
  SELECT
    a.source_code,
    a.commune,
    m.code AS target_code
  FROM adm3_geom a
  JOIN atlas.mailles m
    ON ST_Contains(m.geom, a.centroid_25231)
)
UPDATE atlas.colab_maille_code_map map
SET
  target_code = r.target_code,
  match_type = COALESCE(map.match_type, 'adm3_centroid_contains'),
  coverage_pct = COALESCE(map.coverage_pct, NULL),
  notes = COALESCE(map.notes, '') ||
    CASE WHEN map.notes IS NULL OR map.notes = '' THEN '' ELSE E'\n' END ||
    'backfill: adm3_centroid_contains commune=' || r.commune,
  updated_at = NOW()
FROM resolved r
WHERE map.source_code = r.source_code
  AND (map.target_code IS NULL OR BTRIM(map.target_code) = '');

COMMIT;
