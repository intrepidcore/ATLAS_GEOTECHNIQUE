BEGIN;

CREATE TABLE IF NOT EXISTS atlas.hydrogeologie (
    ogc_fid serial PRIMARY KEY,
    geom geometry(MultiPolygon, 25231),
    code varchar(50),
    libelle text,
    description text
);
CREATE INDEX IF NOT EXISTS hydrogeologie_geom_geom_idx
    ON atlas.hydrogeologie USING GIST (geom);

ALTER TABLE atlas.ai_context_features_maille
    ADD COLUMN IF NOT EXISTS hydro_code text,
    ADD COLUMN IF NOT EXISTS hydro_label text;

CREATE OR REPLACE FUNCTION atlas.refresh_ai_context_features_maille()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    INSERT INTO atlas.ai_context_features_maille (
        maille_code, geol_code, geol_label, pedo_code, pedo_label, hydro_code, hydro_label, risque_gonflement, risque_score, updated_at
    )
    SELECT
        m.code AS maille_code,
        g.code AS geol_code,
        g.libelle AS geol_label,
        p.code AS pedo_code,
        p.libelle AS pedo_label,
        h.code AS hydro_code,
        h.libelle AS hydro_label,
        rg.risque_gonflement,
        atlas.risque_to_score(rg.risque_gonflement) AS risque_score,
        now() AS updated_at
    FROM atlas.mailles m
    LEFT JOIN LATERAL (
        SELECT ug.code, ug.libelle
        FROM atlas.unites_geologiques ug
        WHERE ug.geom IS NOT NULL
          AND ST_Intersects(m.geom, ug.geom)
        ORDER BY ST_Area(ST_Intersection(m.geom, ug.geom)) DESC NULLS LAST
        LIMIT 1
    ) g ON true
    LEFT JOIN LATERAL (
        SELECT up.code, up.libelle
        FROM atlas.unites_pedologiques up
        WHERE up.geom IS NOT NULL
          AND ST_Intersects(m.geom, up.geom)
        ORDER BY ST_Area(ST_Intersection(m.geom, up.geom)) DESC NULLS LAST
        LIMIT 1
    ) p ON true
    LEFT JOIN LATERAL (
        SELECT hy.code, hy.libelle
        FROM atlas.hydrogeologie hy
        WHERE hy.geom IS NOT NULL
          AND ST_Intersects(m.geom, hy.geom)
        ORDER BY ST_Area(ST_Intersection(m.geom, hy.geom)) DESC NULLS LAST
        LIMIT 1
    ) h ON true
    LEFT JOIN LATERAL (
        SELECT r.risque_gonflement
        FROM atlas.risque_gonflement r
        WHERE r.geom IS NOT NULL
          AND ST_Intersects(m.geom, r.geom)
        ORDER BY ST_Area(ST_Intersection(m.geom, r.geom)) DESC NULLS LAST
        LIMIT 1
    ) rg ON true
    ON CONFLICT (maille_code) DO UPDATE SET
        geol_code = EXCLUDED.geol_code,
        geol_label = EXCLUDED.geol_label,
        pedo_code = EXCLUDED.pedo_code,
        pedo_label = EXCLUDED.pedo_label,
        hydro_code = EXCLUDED.hydro_code,
        hydro_label = EXCLUDED.hydro_label,
        risque_gonflement = EXCLUDED.risque_gonflement,
        risque_score = EXCLUDED.risque_score,
        updated_at = EXCLUDED.updated_at;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

SELECT atlas.refresh_ai_context_features_maille();

DROP VIEW IF EXISTS atlas.v_ai_training_matrix_multitarget;

CREATE OR REPLACE VIEW atlas.v_ai_training_matrix_multitarget AS
SELECT
    m.code AS maille_code,
    af.n_sondages,
    af.dsm_altitude_mean AS altitude_mean,
    af.dsm_altitude_stddev AS altitude_stddev,
    af.dsm_altitude_range AS altitude_range,
    af.pct_in_lama,
    cf.geol_code,
    cf.pedo_code,
    cf.hydro_code,
    cf.risque_gonflement,
    cf.risque_score,
    s.vbs_avg,
    s.ip_avg,
    s.wl_avg,
    s.wp_avg,
    s.eg_avg,
    s.gamma_d_max_avg,
    s.w_opt_avg,
    s.passant_80um_avg,
    s.passant_2mm_avg,
    s.passant_20mm_avg
FROM atlas.mailles m
LEFT JOIN atlas.ai_maille_features_fast af ON af.maille_code = m.code
LEFT JOIN atlas.ai_context_features_maille cf ON cf.maille_code = m.code
LEFT JOIN mailles_geotechnique_stats_wgs84 s ON s.code = m.code;

COMMIT;
