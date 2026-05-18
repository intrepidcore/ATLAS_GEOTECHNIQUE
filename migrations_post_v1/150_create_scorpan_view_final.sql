-- Migration 150: Create SCORPAN materialized view (FINAL)
SET search_path = atlas, public;

DROP MATERIALIZED VIEW IF EXISTS atlas.v_scorpan_features CASCADE;

CREATE MATERIALIZED VIEW atlas.v_scorpan_features AS
SELECT
    m.id AS maille_id,
    m.code AS maille_code,
    m.geom,

    -- R: Relief (DSM features)
    m.altitude_mean AS dem_altitude,
    m.dem_slope_mean_deg AS dem_slope,
    m.dem_tpi_mean AS dem_tpi,
    m.dem_hand_mean AS dem_hand,
    m.distance_river_m,
    CASE WHEN m.altitude_mean IS NOT NULL THEN true ELSE false END AS dsm_ok,

    -- C: Climate (WorldClim - TRUE VALUES per pixel)
    cf.prec_annual,
    cf.bio12 AS climate_precip_annual,
    cf.bio15 AS climate_precip_seasonality,
    cf.bio4 AS climate_temp_seasonality,
    cf.bio17 AS climate_precip_driest_quarter,
    CASE WHEN cf.prec_annual IS NOT NULL THEN true ELSE false END AS climate_ok,

    -- Spatial coordinates for regression
    ST_X(ST_Centroid(m.geom)) AS lon,
    ST_Y(ST_Centroid(m.geom)) AS lat,
    m.xc_utm31 AS x_utm31,
    m.yc_utm31 AS y_utm31

FROM atlas.mailles m
LEFT JOIN atlas.maille_climate_features cf ON cf.maille_code = m.code
WHERE m.code IS NOT NULL;

-- Create indexes
CREATE INDEX idx_v_scorpan_maille_code ON atlas.v_scorpan_features(maille_code);
CREATE INDEX idx_v_scorpan_geom ON atlas.v_scorpan_features USING GIST(geom);
CREATE INDEX idx_v_scorpan_altitude ON atlas.v_scorpan_features(dem_altitude) WHERE dem_altitude IS NOT NULL;
CREATE INDEX idx_v_scorpan_lon ON atlas.v_scorpan_features(lon);
CREATE INDEX idx_v_scorpan_lat ON atlas.v_scorpan_features(lat);
CREATE INDEX idx_v_scorpan_prec ON atlas.v_scorpan_features(prec_annual) WHERE prec_annual IS NOT NULL;

COMMENT ON MATERIALIZED VIEW atlas.v_scorpan_features IS
'Vue matérialisée SCORPAN pour RK. Features DSM: altitude/slope/TPI/HAND/distance_river. Climate: WorldClim true pixel values. Coordinates: lon/lat/UTM31.';

-- Verify
SELECT 
    COUNT(*) as total,
    COUNT(dem_altitude) as altitude,
    COUNT(dem_slope) as slope,
    COUNT(dem_tpi) as tpi,
    COUNT(dem_hand) as hand,
    COUNT(distance_river_m) as river,
    COUNT(prec_annual) as climate
FROM atlas.v_scorpan_features;

-- Grant permissions
ALTER MATERIALIZED VIEW atlas.v_scorpan_features OWNER TO atlas;
GRANT ALL ON MATERIALIZED VIEW atlas.v_scorpan_features TO atlas;