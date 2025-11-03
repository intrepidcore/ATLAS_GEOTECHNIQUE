-- Vue de compatibilité améliorée pour l'ancienne table essais
-- Transforme les colonnes de essais_geotechniques en lignes avec type_essai

DROP VIEW IF EXISTS essais CASCADE;

CREATE OR REPLACE VIEW essais AS
-- Granulométrie passant 80um
SELECT 
    gen_random_uuid() as id,
    sondage_id,
    'Granulometrie' as type_essai,
    passant_80um as valeur_numerique,
    '%' as unit,
    depth_m,
    created_at,
    NULL::timestamptz as updated_at,
    NULL::timestamptz as deleted_at,
    created_by,
    NULL::uuid as updated_by
FROM essais_geotechniques
WHERE passant_80um IS NOT NULL

UNION ALL

-- VBS
SELECT 
    gen_random_uuid() as id,
    sondage_id,
    'BleuMethylene_VBS' as type_essai,
    vbs as valeur_numerique,
    'g/100g' as unit,
    depth_m,
    created_at,
    NULL::timestamptz as updated_at,
    NULL::timestamptz as deleted_at,
    created_by,
    NULL::uuid as updated_by
FROM essais_geotechniques
WHERE vbs IS NOT NULL

UNION ALL

-- Atterberg WL
SELECT 
    gen_random_uuid() as id,
    sondage_id,
    'Atterberg_WL' as type_essai,
    wl as valeur_numerique,
    '%' as unit,
    depth_m,
    created_at,
    NULL::timestamptz as updated_at,
    NULL::timestamptz as deleted_at,
    created_by,
    NULL::uuid as updated_by
FROM essais_geotechniques
WHERE wl IS NOT NULL

UNION ALL

-- Atterberg WP
SELECT 
    gen_random_uuid() as id,
    sondage_id,
    'Atterberg_WP' as type_essai,
    wp as valeur_numerique,
    '%' as unit,
    depth_m,
    created_at,
    NULL::timestamptz as updated_at,
    NULL::timestamptz as deleted_at,
    created_by,
    NULL::uuid as updated_by
FROM essais_geotechniques
WHERE wp IS NOT NULL;

COMMENT ON VIEW essais IS 'Vue de compatibilité - transforme essais_geotechniques en format legacy avec type_essai';
