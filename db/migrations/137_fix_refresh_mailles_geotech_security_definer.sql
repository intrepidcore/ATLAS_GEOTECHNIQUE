BEGIN;

CREATE OR REPLACE FUNCTION atlas.refresh_mailles_geotech()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = atlas, public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech;
  RETURN NULL;
END;
$$;

ALTER FUNCTION atlas.refresh_mailles_geotech() OWNER TO atlas;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_app') THEN
    CREATE ROLE atlas_app NOLOGIN;
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION atlas.refresh_mailles_geotech() TO atlas_app;

COMMIT;
