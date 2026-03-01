-- Migration 047: Remplir grid_code pour tous les sondages géocodés
-- et créer un trigger pour maintenir la cohérence

-- 1) Remplir grid_code pour les sondages existants avec géométrie
UPDATE sondages s
SET grid_code = m.code
FROM mailles m
WHERE
  s.geom IS NOT NULL
  AND s.deleted_at IS NULL
  AND s.grid_code IS NULL
  AND ST_Contains(m.geom, ST_Transform(s.geom, 25231));

-- Afficher le nombre de sondages mis à jour
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM sondages WHERE grid_code IS NOT NULL;
  RAISE NOTICE 'Sondages avec grid_code: %', updated_count;
END $$;

-- 2) Créer la fonction de mise à jour automatique du grid_code
CREATE OR REPLACE FUNCTION set_sondage_grid_code()
RETURNS trigger AS $$
BEGIN
  -- Si la géométrie est définie, chercher la maille correspondante
  IF NEW.geom IS NOT NULL THEN
    SELECT code INTO NEW.grid_code
    FROM mailles
    WHERE ST_Contains(mailles.geom, ST_Transform(NEW.geom, 25231))
    LIMIT 1;
  ELSE
    NEW.grid_code := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Créer le trigger (supprimer s'il existe déjà)
DROP TRIGGER IF EXISTS trg_set_sondage_grid_code ON sondages;

CREATE TRIGGER trg_set_sondage_grid_code
BEFORE INSERT OR UPDATE OF geom
ON sondages
FOR EACH ROW
EXECUTE FUNCTION set_sondage_grid_code();

-- 4) Créer un index sur grid_code s'il n'existe pas
CREATE INDEX IF NOT EXISTS idx_sondages_grid_code ON sondages(grid_code);

-- Vérification finale
DO $$
DECLARE
  total_sondages INTEGER;
  with_grid_code INTEGER;
  with_geom INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_sondages FROM sondages WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO with_grid_code FROM sondages WHERE deleted_at IS NULL AND grid_code IS NOT NULL;
  SELECT COUNT(*) INTO with_geom FROM sondages WHERE deleted_at IS NULL AND geom IS NOT NULL;
  
  RAISE NOTICE 'Total sondages: %, avec géom: %, avec grid_code: %', total_sondages, with_geom, with_grid_code;
END $$;
