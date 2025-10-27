-- Supprimer la contrainte qui bloque les sondages sans geom
ALTER TABLE sondages DROP CONSTRAINT IF EXISTS check_geocoded_has_geom;

-- Vérification
SELECT 'Contrainte supprimee' AS status;
