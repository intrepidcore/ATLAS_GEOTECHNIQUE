-- ==========================================================================
-- MIGRATION 130 : enregistrer la grille provisoire TG-00xx (hypothèse / audit)
--
-- Objectif : conserver une trace durable de la grille provisoire (codes TG-00xx)
--            et de l'état de preuve disponible.
--
-- Décision : ne PAS figer une origine X0/Y0 comme vraie tant qu'une validation
--            robuste n'est pas obtenue. On enregistre donc :
--  - le pas supposé (0.01 deg) comme hypothèse
--  - la distribution observée (min/max/médiane) dérivée de l'audit
--  - la source et le statut "hypothesis_not_validated"
--
-- Prérequis : migration 128 (atlas.grid_registry)
-- ==========================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='atlas' AND table_name='grid_registry'
  ) THEN
    RAISE EXCEPTION 'Table atlas.grid_registry manquante (migration 128 requise)';
  END IF;
END $$;

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
VALUES (
  'TG00XX_PROVISIONAL',
  4326,
  'deg',
  0.01,
  NULL,
  NULL,
  'iso_code_inverse_hypothesis',
  jsonb_build_object(
    'status', 'hypothesis_not_validated',
    'observed_x0_min', 0.660574,
    'observed_x0_max', 0.735646,
    'observed_x0_median', 0.707058,
    'observed_y0_min', 5.738121,
    'observed_y0_max', 5.829724,
    'observed_y0_median', 5.790341,
    'validation_n_total', 21,
    'validation_n_ok_abs_le_1', 6,
    'validation_step_deg', 0.01,
    'candidate_x0', 0.687,
    'candidate_y0', 5.795,
    'comment', 'Les missions TG-00xx sont rattachées à V2 via ADM3->centroid (fallback). Les centroïdes V2 ne permettent pas de reconstruire de façon stable la grille TG-00xx à ce stade.'
  ),
  'docs/audit/AUDIT_REMAPPING_2026-03-14.md',
  'Grille provisoire TG-00xx : enregistrement à des fins d''audit. Origine X0/Y0 non validée (ne pas utiliser comme source de vérité géométrique).'
)
ON CONFLICT (grid_id) DO UPDATE
SET
  srid = EXCLUDED.srid,
  unit = EXCLUDED.unit,
  step = EXCLUDED.step,
  origin_x = EXCLUDED.origin_x,
  origin_y = EXCLUDED.origin_y,
  algo = EXCLUDED.algo,
  params = EXCLUDED.params,
  source_ref = EXCLUDED.source_ref,
  notes = EXCLUDED.notes;

COMMIT;
