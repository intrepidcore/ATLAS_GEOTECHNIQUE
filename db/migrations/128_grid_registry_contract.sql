-- ==========================================================================
-- MIGRATION 128 : contrat permanent registry des grilles (anti-dette)
-- Objectif : enregistrer explicitement les paramètres de génération des grilles
--            (SRID, origine, pas, algorithme, provenance), pour éviter toute
--            ambiguïté lors des imports/remapping.
-- Notes :
--  - Ne remplace pas atlas.grid_metadata (déjà utilisé). Il complète le modèle.
--  - Idempotent.
-- ==========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS atlas.grid_registry (
  grid_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Paramètres génériques
  srid integer,
  unit text,
  step numeric,
  origin_x numeric,
  origin_y numeric,

  -- Méthode / source
  algo text,
  params jsonb,
  source_ref text,

  -- Notes humaines
  notes text
);

-- Backfill minimal depuis grid_metadata si possible
INSERT INTO atlas.grid_registry (
  grid_id,
  srid,
  unit,
  step,
  origin_x,
  origin_y,
  algo,
  params,
  source_ref,
  notes
)
SELECT
  gm.version AS grid_id,
  gm.srid,
  CASE WHEN gm.cell_size_m IS NOT NULL THEN 'm' ELSE NULL END AS unit,
  gm.cell_size_m::numeric AS step,
  gm.origin_x,
  gm.origin_y,
  COALESCE(gm.spatial_id_algo, 'unknown') AS algo,
  gm.spatial_id_params AS params,
  'atlas.grid_metadata' AS source_ref,
  COALESCE(gm.notes, 'Backfill automatique depuis atlas.grid_metadata (migration 128)') AS notes
FROM atlas.grid_metadata gm
ON CONFLICT (grid_id) DO NOTHING;

COMMIT;
