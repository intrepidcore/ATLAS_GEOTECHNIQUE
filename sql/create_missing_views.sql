-- Créer les vues manquantes

-- 1. Vue sondages_non_geocodes
DROP VIEW IF EXISTS sondages_non_geocodes CASCADE;

CREATE VIEW sondages_non_geocodes AS
SELECT 
    id,
    code,
    date,
    source,
    adm1_name,
    adm2_name,
    adm3_name,
    created_at
FROM sondages
WHERE geom IS NULL 
  AND deleted_at IS NULL;

COMMENT ON VIEW sondages_non_geocodes IS 'Sondages sans coordonnées géographiques';

-- Statistiques
SELECT 
    'Vues créées avec succès !' as status,
    (SELECT COUNT(*) FROM sondages_non_geocodes) as sondages_non_geocodes;
