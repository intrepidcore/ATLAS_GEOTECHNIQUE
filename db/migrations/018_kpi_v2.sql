-- 018_kpi_v2.sql
-- Migration vers KPI v2: utilise essais_geotechniques/physiques/classif
-- Supprime dépendance à l'ancien schéma "echantillons"

-- 1) Vue KPI par maille (source unique pour tous les KPI)
DROP VIEW IF EXISTS v_maille_kpi_v2 CASCADE;

CREATE VIEW v_maille_kpi_v2 AS
SELECT
  m.code AS grid_code,
  m.geom,
  -- Compteurs
  COUNT(DISTINCT s.id) AS n_sondages,
  COUNT(DISTINCT eg.id) AS n_essais,
  COUNT(*) FILTER (WHERE eg.vbs IS NOT NULL) AS n_vbs,
  COUNT(*) FILTER (WHERE eg.wl IS NOT NULL) AS n_wl,
  COUNT(*) FILTER (WHERE eg.wp IS NOT NULL) AS n_wp,
  COUNT(*) FILTER (WHERE ep.teneur_eau_pct IS NOT NULL) AS n_phys,
  COUNT(*) FILTER (WHERE ec.id IS NOT NULL) AS n_classif,
  COUNT(DISTINCT gp.id) AS n_granulo,
  -- Profondeur
  MAX(eg.depth_m) AS depth_max_m,
  -- Spread (adm_random_cell)
  COALESCE(
    100.0 * COUNT(DISTINCT CASE WHEN s.location_mode = 'adm_random_cell' THEN s.id END)::numeric / 
    NULLIF(COUNT(DISTINCT s.id), 0),
    0
  ) AS pct_spread,
  -- Stats core (min/max/percentiles)
  jsonb_strip_nulls(jsonb_build_object(
    'wl_min', MIN(eg.wl),
    'wl_max', MAX(eg.wl),
    'wl_p50', PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY eg.wl),
    'wp_min', MIN(eg.wp),
    'wp_max', MAX(eg.wp),
    'vbs_min', MIN(eg.vbs),
    'vbs_max', MAX(eg.vbs),
    'vbs_p50', PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY eg.vbs),
    'depth_p50', PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY eg.depth_m)
  )) AS stats_core,
  -- Timestamp
  NOW() AS updated_at
FROM mailles m
LEFT JOIN sondages s ON s.grid_code = m.code AND s.deleted_at IS NULL
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id AND eg.deleted_at IS NULL
LEFT JOIN essais_physiques ep ON ep.essai_id = eg.id AND ep.deleted_at IS NULL
LEFT JOIN essais_classif ec ON ec.essai_id = eg.id AND ec.deleted_at IS NULL
LEFT JOIN LATERAL (
  SELECT DISTINCT ON (ech.id) gp.id
  FROM echantillons ech
  LEFT JOIN granulo_points gp ON gp.echantillon_id = ech.id
  WHERE ech.sondage_id = s.id
) gp ON true
GROUP BY m.code, m.geom;

COMMENT ON VIEW v_maille_kpi_v2 IS 'KPI v2 par maille - source unique pour API /cells/{code}/complete';

-- 2) Vue résumé sondages pour table attributaire
DROP VIEW IF EXISTS v_sondages_summary_v2 CASCADE;

CREATE VIEW v_sondages_summary_v2 AS
SELECT
  s.id,
  s.code,
  s.source,
  s.location_mode,
  s.grid_code,
  s.geom,
  s.adm1_name,
  s.adm2_name,
  s.adm3_name,
  -- Compteurs essais
  COUNT(eg.id) AS essais_count,
  COUNT(*) FILTER (WHERE eg.wl IS NOT NULL) AS wl_count,
  COUNT(*) FILTER (WHERE eg.vbs IS NOT NULL) AS vbs_count,
  COUNT(*) FILTER (WHERE ep.id IS NOT NULL) AS phys_count,
  COUNT(*) FILTER (WHERE ec.id IS NOT NULL) AS classif_count,
  -- Flags
  BOOL_OR(eg.wl IS NOT NULL OR eg.vbs IS NOT NULL) AS has_labs,
  s.geom IS NOT NULL AS has_geom,
  s.grid_code IS NOT NULL AS has_grid,
  -- Badge
  CASE 
    WHEN s.location_mode = 'adm_random_cell' THEN 'ADM random cell'
    WHEN s.location_mode = 'exact' THEN 'Exact'
    ELSE 'Unknown'
  END AS badge,
  -- Timestamp
  s.created_at,
  s.updated_at
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id AND eg.deleted_at IS NULL
LEFT JOIN essais_physiques ep ON ep.essai_id = eg.id AND ep.deleted_at IS NULL
LEFT JOIN essais_classif ec ON ec.essai_id = eg.id AND ec.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.code, s.source, s.location_mode, s.grid_code, s.geom, 
         s.adm1_name, s.adm2_name, s.adm3_name, s.created_at, s.updated_at;

COMMENT ON VIEW v_sondages_summary_v2 IS 'Résumé sondages v2 pour table attributaire et carte';

-- 3) Vue granulo minipack (points clés pour aperçu rapide)
-- TODO v2.5.1: migrer granulo_points vers nouveau schéma avec essai_id
-- DROP VIEW IF EXISTS v_granulo_minipack CASCADE;

-- 4) Index pour performance
CREATE INDEX IF NOT EXISTS idx_essais_geotechniques_sondage ON essais_geotechniques(sondage_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_essais_physiques_essai ON essais_physiques(essai_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_essais_classif_essai ON essais_classif(essai_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sondages_grid_location ON sondages(grid_code, location_mode) WHERE deleted_at IS NULL;
