-- ============================================================================
-- MIGRATION 110 : RESTORE VIEWS AFTER GRID V2
-- Objectif : recréer les vues droppées (CASCADE) pendant les migrations 108/109
--            sans relancer d'anciennes migrations complètes.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Vues liées à mv_mailles_geotech / API compat
-- ---------------------------------------------------------------------------

-- La vue de compat peut exister avec une signature différente (ancien schéma).
-- CREATE OR REPLACE ne peut pas changer les noms/ordre des colonnes : on drop puis recrée.
DROP VIEW IF EXISTS mailles_geotechnique_stats_wgs84 CASCADE;
DROP VIEW IF EXISTS atlas.mailles_geotechnique_stats_wgs84 CASCADE;

CREATE OR REPLACE VIEW atlas.v_mailles_with_location_counts AS
WITH location_counts AS (
    SELECT 
        m.code,
        COUNT(DISTINCT s.id) FILTER (
            WHERE s.location_mode IN ('exact', 'gps', 'manual')
        ) AS n_sondages_exact,
        COUNT(DISTINCT s.id) FILTER (
            WHERE s.location_mode IN ('adm_random_cell', 'adm3', 'adm2', 'adm1', 'random')
        ) AS n_sondages_random
    FROM atlas.mailles m
    LEFT JOIN atlas.sondages s 
        ON ST_Contains(m.geom, ST_Transform(s.geom, 25231))
        AND s.deleted_at IS NULL
        AND s.geom IS NOT NULL
    GROUP BY m.code
)
SELECT 
    mv.*,
    COALESCE(lc.n_sondages_exact, 0)::int AS n_sondages_exact,
    COALESCE(lc.n_sondages_random, 0)::int AS n_sondages_random
FROM atlas.mv_mailles_geotech mv
LEFT JOIN location_counts lc ON lc.code = mv.code;

CREATE OR REPLACE VIEW mailles_geotechnique_stats_wgs84 AS
SELECT 
    id,
    code,
    geom_4326 AS geom,
    geom_simplified,
    adm1_name,
    adm2_name,
    adm3_name,
    n_sondages,
    n_sondages_exact,
    n_sondages_random,
    n_echantillons,
    n_essais_total AS n_essais_geo,
    has_data,
    has_exact_location,
    has_random_location,
    wl_avg, wp_avg, ip_avg, ip_stddev, ip_min, ip_max,
    vbs_avg, vbs_stddev, vbs_min, vbs_max,
    gamma_d_max_avg, gamma_d_max_min AS gamma_d_max_stddev,
    w_opt_avg, w_opt_min AS w_opt_stddev,
    eg_avg, eg_stddev, eg_min, eg_max,
    passant_80um_avg, passant_2mm_avg, passant_20mm_avg,
    n_vbs_insensible, n_vbs_peu_sensible, n_vbs_sensible,
    n_vbs_moyen_argileux, n_vbs_argileux, n_vbs_tres_argileux,
    n_eg_negligeable, n_eg_faible, n_eg_moyen, n_eg_fort, n_eg_tres_fort
FROM atlas.v_mailles_with_location_counts;

-- ---------------------------------------------------------------------------
-- 2) Vues 28km (KPI + map)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW atlas.v_maille_28km_kpi AS
WITH
sond_m28 AS (
    SELECT
        s.id AS id_sondage,
        COALESCE(m2.id_m28, m28.id_m28) AS id_m28
    FROM atlas.sondages s
    LEFT JOIN atlas.mailles m2
           ON s.grid_code = m2.code
    LEFT JOIN atlas.maille_28km m28
           ON m2.id_m28 IS NULL
          AND s.geom IS NOT NULL 
          AND ST_Intersects(ST_Transform(s.geom, 25231), m28.geom)
    WHERE COALESCE(m2.id_m28, m28.id_m28) IS NOT NULL
),
obs AS (
    SELECT
        sm28.id_m28,
        sm28.id_sondage,
        eg.ip,
        eg.vbs,
        eg.eg
    FROM sond_m28 sm28
    LEFT JOIN atlas.essais_geotechniques eg
           ON eg.sondage_id = sm28.id_sondage
)
SELECT
    m28.id_m28,
    m28.code_m28,
    m28.profil_num,
    m28.pk_min_km,
    m28.pk_max_km,
    m28.geom,
    ST_Area(m28.geom) / 1000000.0 AS area_km2,
    COUNT(DISTINCT obs.id_sondage) AS n_sondages,
    COUNT(*) FILTER (WHERE obs.ip  IS NOT NULL) AS n_ip,
    COUNT(*) FILTER (WHERE obs.vbs IS NOT NULL) AS n_vbs,
    COUNT(*) FILTER (WHERE obs.eg  IS NOT NULL) AS n_eg,
    AVG(obs.ip)  FILTER (WHERE obs.ip  IS NOT NULL) AS ip_avg,
    AVG(obs.vbs) FILTER (WHERE obs.vbs IS NOT NULL) AS vbs_avg,
    AVG(obs.eg)  FILTER (WHERE obs.eg  IS NOT NULL) AS eg_avg,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY obs.ip)
        FILTER (WHERE obs.ip IS NOT NULL) AS ip_median,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY obs.ip)
        FILTER (WHERE obs.ip IS NOT NULL) AS ip_p25,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY obs.ip)
        FILTER (WHERE obs.ip IS NOT NULL) AS ip_p75,
    CASE
      WHEN COUNT(*) FILTER (WHERE obs.ip IS NOT NULL) = 0 THEN NULL
      ELSE 100.0
           * COUNT(*) FILTER (WHERE obs.ip IS NOT NULL AND obs.ip >= 17)
           / COUNT(*) FILTER (WHERE obs.ip IS NOT NULL)
    END AS pct_plastiques_ip17,
    CASE 
        WHEN COUNT(DISTINCT obs.id_sondage) > 0 THEN true 
        ELSE false 
    END as has_data,
    CASE
      WHEN ST_Area(m28.geom) = 0 THEN NULL
      ELSE COUNT(DISTINCT obs.id_sondage) / (ST_Area(m28.geom) / 1000000.0)
    END AS sondages_per_km2
FROM atlas.maille_28km m28
LEFT JOIN obs ON obs.id_m28 = m28.id_m28
GROUP BY
    m28.id_m28, m28.code_m28, m28.profil_num, m28.pk_min_km, m28.pk_max_km, m28.geom;

CREATE OR REPLACE VIEW atlas.v_maille_28km_map AS
SELECT
  id_m28,
  code_m28,
  profil_num,
  pk_min_km,
  pk_max_km,
  geom
FROM atlas.maille_28km;

-- ---------------------------------------------------------------------------
-- 3) Vues 28km clipées (affichage)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW atlas.v_mailles_28km_clip AS
WITH togo_boundary AS (
    SELECT COALESCE(
      (SELECT ST_Union(geom) FROM atlas.boundary_togo),
      (SELECT ST_Transform(ST_Union(geom), 25231) FROM public.adm0_raw)
    ) AS geom
)
SELECT
    m.id_m28,
    m.code_m28,
    m.code_lisible,
    m.profil_num,
    m.pk_min_km,
    m.pk_max_km,
    ST_SnapToGrid(
      ST_Intersection(m.geom, tb.geom),
      0.001
    ) AS geom
FROM atlas.maille_28km m
CROSS JOIN togo_boundary tb
WHERE tb.geom IS NOT NULL
  AND ST_Intersects(m.geom, tb.geom);

CREATE OR REPLACE VIEW atlas.v_coverage_mailles_28km_clip AS
WITH togo_boundary AS (
    SELECT COALESCE(
      (SELECT ST_Union(geom) FROM atlas.boundary_togo),
      (SELECT ST_Transform(ST_Union(geom), 25231) FROM public.adm0_raw)
    ) AS geom
)
SELECT
  c.id_m28,
  c.code_m28,
  c.code_lisible,
  ST_SnapToGrid(
    ST_Intersection(ST_Transform(c.geom, 25231), tb.geom),
    0.001
  ) AS geom,
  c.n_sondages,
  c.n_sondages_exact,
  c.n_sondages_random
FROM atlas.v_coverage_mailles_28km c
CROSS JOIN togo_boundary tb
WHERE tb.geom IS NOT NULL
  AND ST_Intersects(ST_Transform(c.geom, 25231), tb.geom);

-- ---------------------------------------------------------------------------
-- 4) Vues DSM (si DSM non importé, elles seront vides)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW atlas.v_maille_dsm_2km AS
SELECT
    m.id,
    m.code,
    ST_SummaryStatsAgg(
        ST_Clip(r.rast, m.geom),
        1,
        TRUE
    ) AS stats
FROM atlas.mailles m
LEFT JOIN atlas.dsm_cop30 r
  ON ST_Intersects(m.geom, ST_ConvexHull(r.rast))
GROUP BY m.id, m.code;

CREATE OR REPLACE VIEW atlas.v_maille_dsm_2km_flat AS
SELECT
    m.id,
    m.code,
    ROUND((m.stats).count::numeric, 0) AS nb_pixels,
    ROUND((m.stats).mean::numeric, 1) AS altitude_mean,
    ROUND((m.stats).min::numeric, 1) AS altitude_min,
    ROUND((m.stats).max::numeric, 1) AS altitude_max,
    ROUND((m.stats).stddev::numeric, 1) AS altitude_stddev,
    ROUND(((m.stats).max - (m.stats).min)::numeric, 1) AS altitude_range
FROM atlas.v_maille_dsm_2km m
WHERE (m.stats).count > 0;

CREATE OR REPLACE VIEW atlas.v_maille_dsm_28km AS
SELECT
    m.id_m28,
    m.code_m28,
    m.profil_num,
    ST_SummaryStatsAgg(
        ST_Clip(r.rast, m.geom),
        1,
        TRUE
    ) AS stats
FROM atlas.maille_28km m
LEFT JOIN atlas.dsm_cop30 r
  ON ST_Intersects(m.geom, ST_ConvexHull(r.rast))
GROUP BY m.id_m28, m.code_m28, m.profil_num;

CREATE OR REPLACE VIEW atlas.v_maille_dsm_28km_flat AS
SELECT
    m.id_m28,
    m.code_m28,
    m.profil_num,
    ROUND((m.stats).count::numeric, 0) AS nb_pixels,
    ROUND((m.stats).mean::numeric, 1) AS altitude_mean,
    ROUND((m.stats).min::numeric, 1) AS altitude_min,
    ROUND((m.stats).max::numeric, 1) AS altitude_max,
    ROUND((m.stats).stddev::numeric, 1) AS altitude_stddev,
    ROUND(((m.stats).max - (m.stats).min)::numeric, 1) AS altitude_range
FROM atlas.v_maille_dsm_28km m
WHERE (m.stats).count > 0;

COMMIT;
