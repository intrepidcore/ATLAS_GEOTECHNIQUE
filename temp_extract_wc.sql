-- Extract WorldClim values from rasters to maille_climate_features
-- Using ST_Value for precise extraction at centroid

-- Update precipitation (summing 12 months)
UPDATE atlas.maille_climate_features c
SET prec_annual = sub.prec,
    bio12 = sub.prec
FROM (
  SELECT
    m.code as maille_code,
    (
      COALESCE((SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 FROM atlas.worldclim_prec r
                 WHERE r.filename = 'wc2.1_2.5m_prec_01.tif'
                   AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 LIMIT 1), 0) +
      COALESCE((SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 FROM atlas.worldclim_prec r
                 WHERE r.filename = 'wc2.1_2.5m_prec_02.tif'
                   AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 LIMIT 1), 0) +
      COALESCE((SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 FROM atlas.worldclim_prec r
                 WHERE r.filename = 'wc2.1_2.5m_prec_03.tif'
                   AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 LIMIT 1), 0) +
      COALESCE((SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 FROM atlas.worldclim_prec r
                 WHERE r.filename = 'wc2.1_2.5m_prec_04.tif'
                   AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 LIMIT 1), 0) +
      COALESCE((SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 FROM atlas.worldclim_prec r
                 WHERE r.filename = 'wc2.1_2.5m_prec_05.tif'
                   AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 LIMIT 1), 0) +
      COALESCE((SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 FROM atlas.worldclim_prec r
                 WHERE r.filename = 'wc2.1_2.5m_prec_06.tif'
                   AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 LIMIT 1), 0) +
      COALESCE((SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 FROM atlas.worldclim_prec r
                 WHERE r.filename = 'wc2.1_2.5m_prec_07.tif'
                   AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 LIMIT 1), 0) +
      COALESCE((SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 FROM atlas.worldclim_prec r
                 WHERE r.filename = 'wc2.1_2.5m_prec_08.tif'
                   AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 LIMIT 1), 0) +
      COALESCE((SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 FROM atlas.worldclim_prec r
                 WHERE r.filename = 'wc2.1_2.5m_prec_09.tif'
                   AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 LIMIT 1), 0) +
      COALESCE((SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 FROM atlas.worldclim_prec r
                 WHERE r.filename = 'wc2.1_2.5m_prec_10.tif'
                   AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 LIMIT 1), 0) +
      COALESCE((SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 FROM atlas.worldclim_prec r
                 WHERE r.filename = 'wc2.1_2.5m_prec_11.tif'
                   AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 LIMIT 1), 0) +
      COALESCE((SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 FROM atlas.worldclim_prec r
                 WHERE r.filename = 'wc2.1_2.5m_prec_12.tif'
                   AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                 LIMIT 1), 0)
    ) as prec
  FROM atlas.mailles m
) sub
WHERE c.maille_code = sub.maille_code;

-- Update bio15 (precipitation seasonality)
UPDATE atlas.maille_climate_features c
SET bio15 = sub.bio15
FROM (
  SELECT m.code as maille_code,
    (SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
     FROM atlas.worldclim_bio r
     WHERE r.filename = 'wc2.1_2.5m_bio_15.tif'
       AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
     LIMIT 1) as bio15
  FROM atlas.mailles m
) sub
WHERE c.maille_code = sub.maille_code;

-- Update bio4 (temp seasonality)
UPDATE atlas.maille_climate_features c
SET bio4 = sub.bio4
FROM (
  SELECT m.code as maille_code,
    (SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
     FROM atlas.worldclim_bio r
     WHERE r.filename = 'wc2.1_2.5m_bio_4.tif'
       AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
     LIMIT 1) as bio4
  FROM atlas.mailles m
) sub
WHERE c.maille_code = sub.maille_code;

-- Update bio17 (driest quarter precip)
UPDATE atlas.maille_climate_features c
SET bio17 = sub.bio17
FROM (
  SELECT m.code as maille_code,
    (SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
     FROM atlas.worldclim_bio r
     WHERE r.filename = 'wc2.1_2.5m_bio_17.tif'
       AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
     LIMIT 1) as bio17
  FROM atlas.mailles m
) sub
WHERE c.maille_code = sub.maille_code;