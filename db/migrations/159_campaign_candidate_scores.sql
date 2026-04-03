BEGIN;

-- =============================================================================
-- Optimisation de campagne de reconnaissance (pré-requis GA / api-opti campagne)
-- Vue des scores candidats par maille : dépression (contrainte dure), risque,
-- éloignement sondages, variance krigeage VBS, transition géologique, proxy infra.
-- =============================================================================

CREATE OR REPLACE VIEW atlas.v_campaign_candidate_scores AS
WITH cent AS (
    SELECT
        m.id AS maille_id,
        m.code AS maille_code,
        ST_PointOnSurface(m.geom) AS g
    FROM atlas.mailles m
    WHERE m.geom IS NOT NULL
),
depression_mailles AS (
    SELECT DISTINCT mze.maille_id, TRUE AS in_depression
    FROM atlas.mailles_zones_etude mze
    INNER JOIN atlas.zones_etude z ON z.id = mze.zone_id
    WHERE z.is_published = TRUE
      AND z.type_zone = 'depression_geologique'
),
risque AS (
    SELECT
        m.id AS maille_id,
        cf.risque_gonflement,
        CASE lower(coalesce(cf.risque_gonflement, ''))
            WHEN 'faible' THEN 1
            WHEN 'moyen' THEN 3
            WHEN 'fort' THEN 5
            WHEN 'tres_fort' THEN 5
            ELSE 1
        END::integer AS risque_gonflement_score
    FROM atlas.mailles m
    LEFT JOIN atlas.ai_context_features_maille cf ON cf.maille_code = m.code
),
sond_dist AS (
    SELECT
        c.maille_id,
        (
            SELECT min(
                ST_Distance(
                    c.g,
                    ST_Transform(ST_PointOnSurface(s.geom), ST_SRID(c.g))
                )
            )::double precision
            FROM atlas.sondages s
            WHERE s.deleted_at IS NULL
              AND s.geom IS NOT NULL
        ) AS distance_sondage_m
    FROM cent c
),
krig_var AS (
    SELECT
        li.maille_id,
        li.variance::double precision AS variance_kriging
    FROM atlas.v_latest_ai_interpolation li
    WHERE li.parameter_id = 'vbs_avg'
),
geol_trans AS (
    SELECT
        c.maille_id,
        (
            SELECT ST_Distance(c.g, ST_Boundary(ST_Transform(ug.geom, ST_SRID(c.g))))::double precision
            FROM atlas.unites_geologiques ug
            WHERE ug.geom IS NOT NULL
            ORDER BY c.g <-> ST_Transform(ug.geom, ST_SRID(c.g))
            LIMIT 1
        ) AS dist_nearest_geol_boundary_m
    FROM cent c
)
SELECT
    c.maille_id,
    c.maille_code,
    COALESCE(dm.in_depression, FALSE) AS in_depression,
    r.risque_gonflement,
    r.risque_gonflement_score,
    COALESCE(sd.distance_sondage_m, 1e7::double precision) AS distance_sondage_m,
    kv.variance_kriging,
    CASE
        WHEN gt.dist_nearest_geol_boundary_m IS NULL OR gt.dist_nearest_geol_boundary_m <= 0 THEN 0.0::double precision
        ELSE (1.0::double precision / (1.0::double precision + (gt.dist_nearest_geol_boundary_m / 500.0::double precision)))
    END AS transition_geologique,
    COALESCE(
        (
            1.0::double precision
            / (
                1.0::double precision
                + least(COALESCE(vf.dist_riviere_m, 1e9::double precision) / 50000.0::double precision, 50.0::double precision)
            )
        ),
        0.0::double precision
    ) AS priorite_infrastructure,
    COALESCE(vf.n_sondages, 0::bigint) AS n_sondages,
    COALESCE(vf.pct_in_lama, 0.0::double precision) AS pct_in_lama
FROM cent c
LEFT JOIN depression_mailles dm ON dm.maille_id = c.maille_id
LEFT JOIN risque r ON r.maille_id = c.maille_id
LEFT JOIN sond_dist sd ON sd.maille_id = c.maille_id
LEFT JOIN krig_var kv ON kv.maille_id = c.maille_id
LEFT JOIN geol_trans gt ON gt.maille_id = c.maille_id
LEFT JOIN atlas.v_maille_features_ai vf ON vf.maille_id = c.maille_id;

COMMENT ON VIEW atlas.v_campaign_candidate_scores IS
  'Features normalisées pour optimisation de campagne (AG) : dépression, risque gonflement, distance sondage, variance krigeage vbs_avg, transition géologique, proxy infrastructure (routes/eau).';

COMMIT;
