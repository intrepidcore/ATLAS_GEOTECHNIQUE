-- Migration 149 : Vue matérialisée SCORPAN
-- Consolide toutes les covariables pour la Régression Kriging
-- Ref: SCORPAN (McBratney 2003), ADR-007

BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS atlas.v_scorpan_features AS
SELECT
  m.code AS maille_code,
  m.xc_utm31 AS x_utm31,
  m.yc_utm31 AS y_utm31,

  -- N : Position spatiale
  ST_X(ST_Transform(ST_Centroid(m.geom), 4326)) AS lon_wgs84,
  ST_Y(ST_Transform(ST_Centroid(m.geom), 4326)) AS lat_wgs84,

  -- R : Relief (topographie DSM)
  f.altitude_mean,
  f.dem_slope_mean_deg,
  f.dem_tpi_mean,
  f.dem_curvature_mean,
  f.dem_flow_acc_mean,
  f.dem_hand_mean,
  f.distance_river_m,
  f.distance_fault_m,

  -- P : Parent material (géologie)
  f.geol_code,
  f.geol_label,

  -- Sol type (pédologie)
  f.pedo_code,
  f.pedo_label,

  -- Hydrologie
  f.hydro_code,
  f.hydro_label,

  -- C : Climat (WorldClim empirique)
  c.prec_annual,
  c.bio12,
  c.bio15,
  c.bio4,
  c.bio17,

  -- Risque RGA existant (référence CHASSAGNEUX)
  f.risque_gonflement,
  f.risque_score

FROM atlas.mailles m
LEFT JOIN atlas.ai_context_features_maille f ON f.maille_code = m.code
LEFT JOIN atlas.maille_climate_features c ON c.maille_code = m.code
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v_scorpan_maille_code
  ON atlas.v_scorpan_features (maille_code);

CREATE INDEX IF NOT EXISTS idx_v_scorpan_geol
  ON atlas.v_scorpan_features (geol_code);

CREATE INDEX IF NOT EXISTS idx_v_scorpan_pedo
  ON atlas.v_scorpan_features (pedo_code);

COMMENT ON MATERIALIZED VIEW atlas.v_scorpan_features IS
  'Covariables SCORPAN consolidées pour la Régression Kriging.
   Rafraîchir avec: REFRESH MATERIALIZED VIEW atlas.v_scorpan_features;
   Ref: McBratney 2003, ADR-007, Migration 149';

COMMIT;