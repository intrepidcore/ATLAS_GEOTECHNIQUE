DROP TRIGGER IF EXISTS essais_calculate_ip ON essais;
DROP FUNCTION IF EXISTS calculate_atterberg_ip();

CREATE OR REPLACE FUNCTION calculate_atterberg_ip()
RETURNS TRIGGER AS $$
DECLARE
  wl_val NUMERIC;
  wp_val NUMERIC;
  ip_val NUMERIC;
  ip_essai_id UUID;
BEGIN
  IF NEW.type_essai IN ('Atterberg_WL', 'Atterberg_WP') AND NEW.deleted_at IS NULL THEN
    SELECT 
      MAX(valeur_numerique) FILTER (WHERE type_essai = 'Atterberg_WL'),
      MAX(valeur_numerique) FILTER (WHERE type_essai = 'Atterberg_WP')
    INTO wl_val, wp_val
    FROM essais
    WHERE sondage_id = NEW.sondage_id 
      AND depth_m = NEW.depth_m
      AND deleted_at IS NULL
      AND type_essai IN ('Atterberg_WL', 'Atterberg_WP');
    
    IF wl_val IS NOT NULL AND wp_val IS NOT NULL THEN
      ip_val := wl_val - wp_val;
      
      SELECT id INTO ip_essai_id
      FROM essais
      WHERE sondage_id = NEW.sondage_id
        AND depth_m = NEW.depth_m
        AND type_essai = 'Atterberg_IP'
        AND deleted_at IS NULL
      LIMIT 1;
      
      IF ip_essai_id IS NOT NULL THEN
        UPDATE essais
        SET valeur_numerique = ip_val,
            updated_at = now()
        WHERE id = ip_essai_id;
      ELSE
        INSERT INTO essais (id, sondage_id, depth_m, type_essai, valeur_numerique, unit)
        VALUES (gen_random_uuid(), NEW.sondage_id, NEW.depth_m, 'Atterberg_IP', ip_val, '%');
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER essais_calculate_ip
  AFTER INSERT OR UPDATE ON essais
  FOR EACH ROW
  EXECUTE FUNCTION calculate_atterberg_ip();
