BEGIN;

CREATE TABLE IF NOT EXISTS atlas.dsm_maille_flat_cache (
  id uuid PRIMARY KEY,
  code text NOT NULL,
  nb_pixels numeric NULL,
  altitude_mean numeric NULL,
  altitude_min numeric NULL,
  altitude_max numeric NULL,
  altitude_stddev numeric NULL,
  altitude_range numeric NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dsm_maille_flat_cache_code ON atlas.dsm_maille_flat_cache(code);

CREATE OR REPLACE FUNCTION atlas.refresh_dsm_maille_flat_cache()
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  n bigint;
BEGIN
  INSERT INTO atlas.dsm_maille_flat_cache (
    id, code, nb_pixels, altitude_mean, altitude_min, altitude_max, altitude_stddev, altitude_range, updated_at
  )
  SELECT
    id, code, nb_pixels, altitude_mean, altitude_min, altitude_max, altitude_stddev, altitude_range, now()
  FROM atlas.v_maille_dsm_2km_flat
  ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    nb_pixels = EXCLUDED.nb_pixels,
    altitude_mean = EXCLUDED.altitude_mean,
    altitude_min = EXCLUDED.altitude_min,
    altitude_max = EXCLUDED.altitude_max,
    altitude_stddev = EXCLUDED.altitude_stddev,
    altitude_range = EXCLUDED.altitude_range,
    updated_at = now();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMIT;

