-- ============================================================================
-- MIGRATION 121 : normaliser l'archive legacy V1 pour le remapping
-- Source: public.mailles__legacy_table_20260309
-- Cible: public.mailles_legacy_v1_archive (attendue par migration 112)
-- ============================================================================

BEGIN;

-- Table canonique attendue par 112_legacy_lookup_view.sql
CREATE TABLE IF NOT EXISTS public.mailles_legacy_v1_archive (
  id text PRIMARY KEY,
  code text,
  geom geometry(Polygon, 25231)
);

-- Backfill idempotent (insert only missing)
INSERT INTO public.mailles_legacy_v1_archive (id, code, geom)
SELECT
  l.id,
  l.code,
  CASE
    WHEN l.geom IS NULL THEN NULL
    WHEN ST_SRID(l.geom) = 25231 THEN ST_MakeValid(l.geom)::geometry(Polygon,25231)
    WHEN ST_SRID(l.geom) = 4326 THEN ST_Transform(ST_MakeValid(l.geom), 25231)::geometry(Polygon,25231)
    WHEN ST_SRID(l.geom) = 0 THEN ST_SetSRID(ST_MakeValid(l.geom), 25231)::geometry(Polygon,25231)
    ELSE ST_Transform(ST_MakeValid(l.geom), 25231)::geometry(Polygon,25231)
  END AS geom
FROM public.mailles__legacy_table_20260309 l
ON CONFLICT (id) DO NOTHING;

-- Index spatial pour accélérer ST_Intersects
CREATE INDEX IF NOT EXISTS idx_mailles_legacy_v1_archive_geom
  ON public.mailles_legacy_v1_archive
  USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_mailles_legacy_v1_archive_code
  ON public.mailles_legacy_v1_archive (code);

COMMIT;
