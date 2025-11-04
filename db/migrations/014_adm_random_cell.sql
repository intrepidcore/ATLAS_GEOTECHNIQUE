-- Migration 014: Fonction choix maille aléatoire déterministe dans ADM
-- Date: 2025-11-03

CREATE OR REPLACE FUNCTION pick_random_cell_in_adm3(p_adm3_code TEXT, p_seed TEXT)
RETURNS TABLE(cell_code TEXT, cell_centroid geometry) 
LANGUAGE sql STABLE AS
$$
WITH cells AS (
  SELECT m.code, ST_Centroid(m.geom) AS centroid
  FROM mailles m
  JOIN adm3 a ON ST_Intersects(m.geom, a.geom)
  WHERE a.adm3_pcode = p_adm3_code
)
SELECT code, centroid
FROM cells
ORDER BY md5(code || ':' || p_seed)  -- Hasard déterministe
LIMIT 1;
$$;

COMMENT ON FUNCTION pick_random_cell_in_adm3 IS 'Choisit 1 maille aléatoire (déterministe) dans un ADM3 donné';

-- Ajouter colonnes manquantes dans sondages si nécessaire
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='sondages' AND column_name='grid_code') THEN
    ALTER TABLE sondages ADD COLUMN grid_code TEXT;
    CREATE INDEX idx_sondages_grid_code ON sondages(grid_code);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='sondages' AND column_name='location_mode') THEN
    ALTER TABLE sondages ADD COLUMN location_mode TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='sondages' AND column_name='location_accuracy') THEN
    ALTER TABLE sondages ADD COLUMN location_accuracy TEXT;
  END IF;
  
  RAISE NOTICE 'Migration 014 terminée: fonction pick_random_cell_in_adm3 créée';
END $$;
