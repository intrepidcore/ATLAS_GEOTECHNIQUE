BEGIN;

DROP VIEW IF EXISTS atlas.v_maille_features_ai;

CREATE OR REPLACE VIEW atlas.v_maille_features_ai AS
WITH base AS (
  SELECT
    m.id AS maille_id,
    m.code AS maille_code,
    m.geom,
    m.pref_name AS adm1_name,
    m.adm2_name,
    COALESCE(COUNT(DISTINCT s.id), 0)::bigint AS n_sondages,
    AVG(ev.vbs)::float8 AS vbs_moyen,
    AVG(COALESCE(ea.ip_generated, (ea.wl - ea.wp)))::float8 AS ip_moyen,
    AVG(eg.cg)::float8 AS gonflement_cg_moyen,
    COALESCE(MAX(e.depth_m), 0)::float8 AS profondeur_max_m,
    MAX(CASE WHEN ze.code = 'DEPRESSION_LAMA_TG' THEN COALESCE(mze.pct_intersection, 0) ELSE 0 END)::float8 AS pct_in_lama,
    MAX(CASE WHEN ze.risque_rga = 'tres_fort' THEN 1 ELSE 0 END)::int AS in_zone_rga_tres_fort
  FROM atlas.mailles m
  LEFT JOIN atlas.sondages s ON s.maille_code = m.code AND s.deleted_at IS NULL
  LEFT JOIN atlas.echantillons e ON e.sondage_id = s.id
  LEFT JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id
  LEFT JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id
  LEFT JOIN atlas.essais_potentiel_gonflement eg ON eg.echantillon_id = e.id
  LEFT JOIN atlas.mailles_zones_etude mze ON mze.maille_id = m.id
  LEFT JOIN atlas.zones_etude ze ON ze.id = mze.zone_id
  GROUP BY m.id, m.code, m.geom, m.pref_name, m.adm2_name
),
dsm AS (
  SELECT
    d.id AS maille_id,
    NULLIF((d.stats).mean, '-1.4326056241459114e+37'::float8) AS dsm_altitude_moy_m
  FROM atlas.v_maille_dsm_2km d
),
hydro AS (
  SELECT
    m.id AS maille_id,
    ST_Distance(c.centroid, r.geom)::float8 AS dist_riviere_m,
    ST_Distance(c.centroid, s.geom)::float8 AS dist_surface_eau_m
  FROM atlas.mailles m
  CROSS JOIN LATERAL (
    SELECT ST_Centroid(m.geom) AS centroid
  ) c
  LEFT JOIN LATERAL (
    SELECT h.geom
    FROM atlas_ref.hydro_cours_eau_25231 h
    ORDER BY h.geom <-> c.centroid
    LIMIT 1
  ) r ON TRUE
  LEFT JOIN LATERAL (
    SELECT hs.geom
    FROM atlas_ref.hydro_surfaces_25231 hs
    ORDER BY hs.geom <-> c.centroid
    LIMIT 1
  ) s ON TRUE
)
SELECT
  b.maille_id,
  b.maille_code,
  b.adm1_name,
  b.adm2_name,
  b.n_sondages,
  b.vbs_moyen,
  b.ip_moyen,
  b.gonflement_cg_moyen,
  b.profondeur_max_m,
  b.pct_in_lama,
  b.in_zone_rga_tres_fort,
  d.dsm_altitude_moy_m,
  h.dist_riviere_m,
  h.dist_surface_eau_m,
  CASE
    WHEN b.n_sondages = 0 THEN 0
    WHEN b.vbs_moyen IS NOT NULL AND b.ip_moyen IS NOT NULL AND b.gonflement_cg_moyen IS NOT NULL THEN 90
    WHEN b.vbs_moyen IS NOT NULL AND b.ip_moyen IS NOT NULL THEN 70
    WHEN b.n_sondages > 0 THEN 40
    ELSE 20
  END::int AS data_confidence_score
FROM base b
LEFT JOIN dsm d ON d.maille_id = b.maille_id
LEFT JOIN hydro h ON h.maille_id = b.maille_id;

COMMIT;
