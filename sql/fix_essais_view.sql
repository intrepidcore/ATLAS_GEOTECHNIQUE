-- Vue de compatibilité pour l'ancienne table essais
-- Permet au code existant de continuer à fonctionner

CREATE OR REPLACE VIEW essais AS
SELECT 
    id,
    sondage_id,
    'geotechnique' as type_essai,  -- Type générique
    NULL::numeric as valeur_numerique,  -- Pas de valeur unique
    NULL::text as unit,
    depth_m,
    created_at,
    NULL::timestamptz as updated_at,
    NULL::timestamptz as deleted_at,
    created_by,
    NULL::uuid as updated_by
FROM essais_geotechniques;

COMMENT ON VIEW essais IS 'Vue de compatibilité - redirige vers essais_geotechniques';
