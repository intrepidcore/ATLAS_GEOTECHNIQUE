-- 187_mobile_tolerance_confirm_push.sql
-- Atlas Mobile V0.1 : tolérance GPS paramétrable par mission, confirmation
-- de point de prélèvement, enregistrement des tokens de push mobile.
-- Voir docs/mobile/adr/ADR-MOBILE-004 et ADR-MOBILE-005.

-- Tolérance GPS par mission (NULL = utiliser le défaut système, jamais une
-- constante codée en dur côté application).
ALTER TABLE atlas.colab_missions
    ADD COLUMN IF NOT EXISTS sondage_tolerance_m INTEGER;

COMMENT ON COLUMN atlas.colab_missions.sondage_tolerance_m IS
    'Rayon de tolérance (mètres) pour confirmer un point de prélèvement prévu. NULL = défaut système (ATLAS_DEFAULT_SONDAGE_TOLERANCE_M).';

-- Lien point prévisionnel -> sondage réel confirmé (une fois posé sur le terrain).
ALTER TABLE atlas.colab_mission_sondage_points
    ADD COLUMN IF NOT EXISTS confirmed_sondage_id UUID,
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES atlas.users(id);

CREATE INDEX IF NOT EXISTS idx_colab_sondage_points_confirmed
    ON atlas.colab_mission_sondage_points(mission_id) WHERE confirmed_sondage_id IS NOT NULL;

-- Tokens de push mobile (Expo Push), préparation V0.2 (ADR-MOBILE-005).
CREATE TABLE IF NOT EXISTS atlas.colab_mobile_push_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    expo_token  TEXT NOT NULL,
    platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, expo_token)
);

CREATE INDEX IF NOT EXISTS idx_colab_mobile_push_tokens_user
    ON atlas.colab_mobile_push_tokens(user_id);
