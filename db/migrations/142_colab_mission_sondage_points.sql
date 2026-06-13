BEGIN;

-- ============================================================================
-- Colab : Profondeurs indicatives et points de sondage par mission
-- ============================================================================

-- Ajouter les champs de profondeur indicative sur colab_missions
ALTER TABLE atlas.colab_missions
    ADD COLUMN IF NOT EXISTS depth_h1_m NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS depth_h2_m NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS depth_h3_m NUMERIC(6,2);

COMMENT ON COLUMN atlas.colab_missions.depth_h1_m IS 'Profondeur indicative H1 recommandée (en mètres)';
COMMENT ON COLUMN atlas.colab_missions.depth_h2_m IS 'Profondeur indicative H2 recommandée (en mètres)';
COMMENT ON COLUMN atlas.colab_missions.depth_h3_m IS 'Profondeur indicative H3 recommandée (en mètres)';

-- Table des points GPS de sondage attendus pour chaque mission
CREATE TABLE IF NOT EXISTS atlas.colab_mission_sondage_points (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id  UUID NOT NULL REFERENCES atlas.colab_missions(id) ON DELETE CASCADE,
    numero      INTEGER NOT NULL,
    label       TEXT,
    lat         DOUBLE PRECISION NOT NULL,
    lon         DOUBLE PRECISION NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_sondage_lat  CHECK (lat  BETWEEN -90  AND 90),
    CONSTRAINT chk_sondage_lon  CHECK (lon  BETWEEN -180 AND 180),
    CONSTRAINT chk_sondage_num  CHECK (numero >= 1)
);

CREATE INDEX IF NOT EXISTS idx_colab_sondage_points_mission
    ON atlas.colab_mission_sondage_points(mission_id, numero);

COMMENT ON TABLE atlas.colab_mission_sondage_points IS
    'Localisation GPS planifiée de chaque sondage attendu pour une mission Colab';

-- Droits pour l'utilisateur atlas
GRANT SELECT, INSERT, UPDATE, DELETE
    ON atlas.colab_mission_sondage_points TO atlas;

COMMIT;
