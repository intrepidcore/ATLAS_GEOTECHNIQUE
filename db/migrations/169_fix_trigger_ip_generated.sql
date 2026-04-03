BEGIN;

-- Keep ip_generated consistent with wl/wp.
-- IMPORTANT: '-' placeholders in Excel must be parsed as NULL upstream; this trigger
-- should not invent zeros.

CREATE OR REPLACE FUNCTION atlas.compute_ip_generated()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.wl IS NOT NULL AND NEW.wp IS NOT NULL THEN
    NEW.ip_generated := NEW.wl - NEW.wp;
  ELSE
    -- Preserve explicit ip_generated if it was provided; otherwise leave NULL.
    NEW.ip_generated := COALESCE(NEW.ip_generated, NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_ip_generated ON atlas.essais_atterberg;

CREATE TRIGGER trg_compute_ip_generated
BEFORE INSERT OR UPDATE ON atlas.essais_atterberg
FOR EACH ROW
EXECUTE FUNCTION atlas.compute_ip_generated();

COMMIT;

