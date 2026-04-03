BEGIN;

-- Formule officielle versionnée « campaign_priority_v1 » (audit / reproductibilité).
-- Alignée sur la pondération métier : variance krigeage, risque gonflement, éloignement forage,
-- transition géologique, enjeu infrastructure.

CREATE OR REPLACE VIEW atlas.v_campaign_priority_score AS
WITH base AS (
    SELECT * FROM atlas.v_campaign_candidate_scores
),
normed AS (
    SELECT
        b.maille_id,
        b.maille_code,
        b.in_depression,
        b.risque_gonflement,
        b.risque_gonflement_score,
        b.distance_sondage_m,
        b.variance_kriging,
        b.transition_geologique,
        b.priorite_infrastructure,
        b.n_sondages,
        b.pct_in_lama,
        LEAST(
            GREATEST(
                COALESCE(b.variance_kriging, 0.0::double precision)
                / (COALESCE(b.variance_kriging, 0.0::double precision) + 15.0::double precision),
                0.0::double precision
            ),
            1.0::double precision
        ) AS norm_variance_v1,
        (b.risque_gonflement_score::double precision / 5.0::double precision) AS norm_risk_v1,
        LEAST(
            LN(b.distance_sondage_m / 1000.0::double precision + 1.0::double precision)
            / LN(15.0::double precision),
            1.0::double precision
        ) AS norm_distance_bh_v1,
        LEAST(GREATEST(b.transition_geologique, 0.0::double precision), 1.0::double precision) AS norm_transition_v1,
        LEAST(GREATEST(b.priorite_infrastructure, 0.0::double precision), 1.0::double precision) AS norm_infra_v1
    FROM base b
)
SELECT
    n.maille_id,
    n.maille_code,
    n.in_depression,
    n.risque_gonflement,
    n.risque_gonflement_score,
    n.distance_sondage_m,
    n.variance_kriging,
    n.transition_geologique,
    n.priorite_infrastructure,
    n.n_sondages,
    n.pct_in_lama,
    n.norm_variance_v1,
    n.norm_risk_v1,
    n.norm_distance_bh_v1,
    n.norm_transition_v1,
    n.norm_infra_v1,
    (
        0.35::double precision * n.norm_variance_v1
        + 0.25::double precision * n.norm_risk_v1
        + 0.15::double precision * n.norm_distance_bh_v1
        + 0.15::double precision * n.norm_transition_v1
        + 0.10::double precision * n.norm_infra_v1
    )::double precision AS priority_score_v1
FROM normed n;

COMMENT ON VIEW atlas.v_campaign_priority_score IS
  'Score criticité versionné campaign_priority_v1 : 0.35*norm_var + 0.25*risk + 0.15*dist_bh + 0.15*transition + 0.10*infra.';

COMMIT;
