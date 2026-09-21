-- Résultats de laboratoire saisis depuis Atlas Colab Studio.
-- Les mesures restent structurées en JSONB pendant la validation scientifique ;
-- leur promotion vers les tables canoniques d'essais est un flux séparé.

CREATE TABLE IF NOT EXISTS atlas.colab_lab_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id uuid NOT NULL REFERENCES atlas.colab_missions(id) ON DELETE CASCADE,
    sondage_id uuid NOT NULL REFERENCES atlas.sondages(id) ON DELETE RESTRICT,
    sample_code text NOT NULL,
    depth_top_m numeric(10,3) NOT NULL CHECK (depth_top_m >= 0),
    depth_bottom_m numeric(10,3) NOT NULL CHECK (depth_bottom_m > depth_top_m),
    sample jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(sample) = 'object'),
    tests jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(tests) = 'object'),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'complete')),
    created_by uuid NOT NULL REFERENCES atlas.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT colab_lab_results_sample_unique UNIQUE (mission_id, sample_code)
);

CREATE INDEX IF NOT EXISTS idx_colab_lab_results_mission
    ON atlas.colab_lab_results (mission_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_colab_lab_results_sondage
    ON atlas.colab_lab_results (sondage_id);

COMMENT ON TABLE atlas.colab_lab_results IS
    'Saisie laboratoire Colab liée à un sondage terrain ; validation avant promotion canonique.';
