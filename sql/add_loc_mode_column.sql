-- ============================================================================
-- AJOUT COLONNES loc_mode + geom_real POUR GÉOCODAGE ROBUSTE
-- ============================================================================

-- 1) Colonne loc_mode : explicite le mode de localisation
ALTER TABLE sondages
  ADD COLUMN IF NOT EXISTS loc_mode text
  CHECK (loc_mode IN ('spread','real'))
  DEFAULT 'spread';

-- 2) Colonne geom_real : sauvegarde la géométrie réelle avant passage en spread
ALTER TABLE sondages 
  ADD COLUMN IF NOT EXISTS geom_real geometry(Point,25231);

-- 3) Initialiser loc_mode selon l'état actuel
UPDATE sondages
SET loc_mode = CASE 
  WHEN geom IS NOT NULL THEN 'real'
  ELSE 'spread'
END
WHERE loc_mode IS NULL;

-- 4) Créer index
CREATE INDEX IF NOT EXISTS idx_sondages_loc_mode ON sondages(loc_mode);
CREATE INDEX IF NOT EXISTS idx_sondages_geom_real ON sondages USING GIST(geom_real);

-- 5) Vérifier
SELECT 
  loc_mode,
  COUNT(*) AS count,
  COUNT(*) FILTER (WHERE geom IS NOT NULL) AS with_geom,
  COUNT(*) FILTER (WHERE (meta->>'adm3_code') IS NOT NULL) AS with_adm3
FROM sondages
GROUP BY loc_mode;
