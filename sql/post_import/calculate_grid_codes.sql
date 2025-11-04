-- Calcule/complète grid_code pour les sondages importés
-- - exact : par point-in-polygon
-- - adm_random_cell : via pick_random_cell_in_adm3(adm3_pcode, seed)

-- 1) exact → affectation par géométrie
UPDATE sondages s
SET grid_code = m.code
FROM mailles m
WHERE s.grid_code IS NULL
  AND s.location_mode = 'exact'
  AND s.geom IS NOT NULL
  AND ST_Contains(m.geom, s.geom);

-- 2) adm_random_cell → affectation déterministe par ADM3 + seed
--    seed = hash simplifié du code sondage pour stabilité
WITH cand AS (
  SELECT
    s.id,
    (SELECT p.cell_code 
     FROM adm3 a
     CROSS JOIN LATERAL pick_random_cell_in_adm3(
       a.adm3_pcode::text,
       substr(encode(digest(s.code,'sha1'),'hex'),1,8)
     ) p
     WHERE a.adm3_pcode = (
       SELECT adm3_pcode FROM adm3 
       WHERE adm3_name = s.adm3_name 
       LIMIT 1
     )
     LIMIT 1) AS picked
  FROM sondages s
  WHERE s.grid_code IS NULL
    AND s.location_mode = 'adm_random_cell'
    AND s.adm3_name IS NOT NULL
)
UPDATE sondages s
SET grid_code = cand.picked
FROM cand
WHERE s.id = cand.id
  AND cand.picked IS NOT NULL;

-- 3) sécurité : pas de spread résiduel
UPDATE sondages
SET location_mode = 'adm_random_cell'
WHERE location_mode = 'spread';

-- 4) index utiles (idempotents)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname='public' AND indexname='idx_sondages_grid_code'
  ) THEN
    CREATE INDEX idx_sondages_grid_code ON sondages(grid_code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname='public' AND indexname='idx_mailles_geom'
  ) THEN
    CREATE INDEX idx_mailles_geom ON mailles USING GIST(geom);
  END IF;
END $$;
