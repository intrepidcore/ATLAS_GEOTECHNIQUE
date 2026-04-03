BEGIN;

-- Snapshot matérialisable des features campagne (aligné sur v_campaign_candidate_scores).
-- Optionnel : appeler atlas.refresh_ai_campaign_features() après grosses mises à jour SIG / krigeage.

CREATE TABLE IF NOT EXISTS atlas.ai_campaign_features (
    maille_id uuid PRIMARY KEY REFERENCES atlas.mailles(id) ON DELETE CASCADE,
    updated_at timestamptz NOT NULL DEFAULT now(),
    in_depression boolean NOT NULL DEFAULT false,
    risque_gonflement text,
    risque_gonflement_score integer,
    distance_sondage_m double precision,
    variance_kriging double precision,
    transition_geologique double precision,
    priorite_infrastructure double precision
);

CREATE INDEX IF NOT EXISTS idx_ai_campaign_features_depression
    ON atlas.ai_campaign_features (in_depression)
    WHERE in_depression;

COMMENT ON TABLE atlas.ai_campaign_features IS
  'Copie de travail des scores maille pour campagne (voir atlas.refresh_ai_campaign_features). La vue atlas.v_campaign_candidate_scores reste la source calculée en temps réel.';

CREATE OR REPLACE FUNCTION atlas.refresh_ai_campaign_features()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    n integer;
BEGIN
    INSERT INTO atlas.ai_campaign_features AS t (
        maille_id,
        updated_at,
        in_depression,
        risque_gonflement,
        risque_gonflement_score,
        distance_sondage_m,
        variance_kriging,
        transition_geologique,
        priorite_infrastructure
    )
    SELECT
        v.maille_id,
        now(),
        v.in_depression,
        v.risque_gonflement,
        v.risque_gonflement_score,
        v.distance_sondage_m,
        v.variance_kriging,
        v.transition_geologique,
        v.priorite_infrastructure
    FROM atlas.v_campaign_candidate_scores v
    ON CONFLICT (maille_id) DO UPDATE SET
        updated_at = EXCLUDED.updated_at,
        in_depression = EXCLUDED.in_depression,
        risque_gonflement = EXCLUDED.risque_gonflement,
        risque_gonflement_score = EXCLUDED.risque_gonflement_score,
        distance_sondage_m = EXCLUDED.distance_sondage_m,
        variance_kriging = EXCLUDED.variance_kriging,
        transition_geologique = EXCLUDED.transition_geologique,
        priorite_infrastructure = EXCLUDED.priorite_infrastructure;

    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END;
$$;

COMMENT ON FUNCTION atlas.refresh_ai_campaign_features() IS
  'Upsert toutes les lignes depuis atlas.v_campaign_candidate_scores ; retourne le nombre de lignes touchées.';

COMMIT;
