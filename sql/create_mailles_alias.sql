-- Créer un alias mailles → grid pour compatibilité backend
-- Le backend Rust utilise encore "mailles" mais on a créé "grid"

DROP VIEW IF EXISTS mailles CASCADE;

CREATE VIEW mailles AS
SELECT 
    id,
    code,
    geom,
    adm1_name,
    adm2_name,
    adm3_name,
    created_at,
    updated_at,
    deleted_at
FROM grid;

-- Index (hérités de grid)
COMMENT ON VIEW mailles IS 'Vue de compatibilité - alias vers grid';

SELECT 'Vue mailles créée avec succès !' as status;
SELECT COUNT(*) as total_mailles FROM mailles;
