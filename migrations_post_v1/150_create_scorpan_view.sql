-- Migration 150: Create SCORPAN materialized view (WITH BIO COLUMNS)
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
    CASE WHEN m.altitude_mean IS NOT NULL THEN true ELSE false END AS dsm_ok,

    -- C: Climate (WorldClim - TRUE VALUES per pixel)
    cf.prec_annual,
    cf.prec_dry,
    cf.prec_wet,
    cf.bio12,
    cf.bio15,
    cf.bio4,
    cf.bio17,
    CASE WHEN cf.prec_annual IS NOT NULL THEN true ELSE false END AS climate_ok,

    -- Spatial coordinates
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
CREATE INDEX idx_v_scorpan_bio12 ON atlas.v_scorpan_features(bio12) WHERE bio12 IS NOT NULL;
CREATE INDEX idx_v_scorpan_bio15 ON atlas.v_scorpan_features(bio15) WHERE bio15 IS NOT NULL;

COMMENT ON MATERIALIZED VIEW atlas.v_scorpan_features IS
'Vue matérialisée SCORPAN pour RK. Features: DSM altitude, WorldClim true pixel values (prec, bio). Coordinates: lon/lat/UTM31.';

-- Verify
SELECT
    COUNT(*) as total,
    COUNT(dem_altitude) as with_altitude,
    COUNT(prec_annual) as with_prec,
    COUNT(bio12) as with_bio12,
    COUNT(bio15) as with_bio15
FROM atlas.v_scorpan_features;