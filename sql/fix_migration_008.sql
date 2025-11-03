-- Fix migration 008: Ajouter les colonnes ADM sans foreign keys

-- Ajouter les colonnes ADM (UUID)
ALTER TABLE sondages 
ADD COLUMN IF NOT EXISTS adm1_id UUID,
ADD COLUMN IF NOT EXISTS adm2_id UUID,
ADD COLUMN IF NOT EXISTS adm3_id UUID;

-- Ajouter les index
CREATE INDEX IF NOT EXISTS idx_sondages_adm1_id ON sondages(adm1_id);
CREATE INDEX IF NOT EXISTS idx_sondages_adm2_id ON sondages(adm2_id);
CREATE INDEX IF NOT EXISTS idx_sondages_adm3_id ON sondages(adm3_id);
CREATE INDEX IF NOT EXISTS idx_sondages_location_mode ON sondages(location_mode);

-- Ajouter la contrainte check
ALTER TABLE sondages 
DROP CONSTRAINT IF EXISTS check_unknown_has_adm;

ALTER TABLE sondages 
ADD CONSTRAINT check_unknown_has_adm 
CHECK (
  location_mode::text != 'unknown' 
  OR (adm1_id IS NOT NULL OR adm2_id IS NOT NULL OR adm3_id IS NOT NULL)
);

-- Créer la vue des sondages non géocodés
DROP VIEW IF EXISTS sondages_non_geocodes;

CREATE VIEW sondages_non_geocodes AS
SELECT 
  s.id,
  s.code,
  s.location_mode::text AS location_mode,
  s.adm1_id,
  s.adm2_id,
  s.adm3_id,
  a1.name AS adm1_name,
  a2.name AS adm2_name,
  a3.name AS adm3_name,
  s.created_at,
  COUNT(e.id) AS n_essais
FROM sondages s
LEFT JOIN adm1 a1 ON s.adm1_id = a1.id
LEFT JOIN adm2 a2 ON s.adm2_id = a2.id
LEFT JOIN adm3 a3 ON s.adm3_id = a3.id
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
WHERE s.location_mode::text = 'unknown'
  AND s.deleted_at IS NULL
GROUP BY s.id, s.code, s.location_mode, s.adm1_id, s.adm2_id, s.adm3_id,
         a1.name, a2.name, a3.name, s.created_at;

-- Commentaires
COMMENT ON COLUMN sondages.adm1_id IS 'Référence à la région (ADM1) pour les sondages sans coordonnées précises';
COMMENT ON COLUMN sondages.adm2_id IS 'Référence à la préfecture (ADM2) pour les sondages sans coordonnées précises';
COMMENT ON COLUMN sondages.adm3_id IS 'Référence à la commune (ADM3) pour les sondages sans coordonnées précises';
COMMENT ON VIEW sondages_non_geocodes IS 'Vue des sondages en attente de géocodage (location_mode = unknown)';
