BEGIN;

-- Prédictions ML par maille (quantiles) — complément ai_interpolation_values (kriging)
CREATE TABLE IF NOT EXISTS atlas.ai_maille_ml_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    maille_id uuid NOT NULL REFERENCES atlas.mailles(id) ON DELETE CASCADE,
    zone_id uuid REFERENCES atlas.zones_etude(id) ON DELETE SET NULL,
    parameter_id text NOT NULL REFERENCES atlas.ai_parameter_catalog(parameter_id),
    prediction_run_id uuid REFERENCES atlas.ai_prediction_runs(id) ON DELETE CASCADE,
    value double precision,
    p10 double precision,
    p50 double precision,
    p90 double precision,
    model_version text,
    metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (maille_id, parameter_id, prediction_run_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_maille_ml_param ON atlas.ai_maille_ml_values(parameter_id);
CREATE INDEX IF NOT EXISTS idx_ai_maille_ml_run ON atlas.ai_maille_ml_values(prediction_run_id);

COMMENT ON TABLE atlas.ai_maille_ml_values IS
  'Sorties ML supervisées (p10/p50/p90) par maille ; kriging dans ai_interpolation_values.';

-- Contours « plus organiques » pour affichage carte (optionnel) — la vérité reste geom
ALTER TABLE atlas.zones_etude
    ADD COLUMN IF NOT EXISTS geom_display geometry(MultiPolygon, 25231);

COMMENT ON COLUMN atlas.zones_etude.geom_display IS
  'Emprise lissée pour rendu (ST_SimplifyPreserveTopology / buffer). Si NULL, utiliser geom.';

-- Remplir geom_display : simplification topologique (mètres, SRID projeté 25231)
UPDATE atlas.zones_etude z
SET geom_display = ST_Multi(ST_SimplifyPreserveTopology(z.geom, 200))
WHERE z.geom IS NOT NULL AND z.geom_display IS NULL;

COMMIT;
