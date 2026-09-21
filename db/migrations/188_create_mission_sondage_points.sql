-- 188_create_mission_sondage_points.sql
-- Table de base manquante : points de prélèvement prévisionnels par mission
-- (référencée par colab/routes.rs et colab/mobile.rs depuis la conception initiale
-- de l'app mobile, mais jamais créée — seule la migration 187 l'ALTERait).

CREATE TABLE IF NOT EXISTS atlas.colab_mission_sondage_points (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id  UUID NOT NULL REFERENCES atlas.colab_missions(id) ON DELETE CASCADE,
    numero      INTEGER NOT NULL,
    label       TEXT,
    lat         DOUBLE PRECISION NOT NULL,
    lon         DOUBLE PRECISION NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colab_mission_sondage_points_mission
    ON atlas.colab_mission_sondage_points(mission_id);
