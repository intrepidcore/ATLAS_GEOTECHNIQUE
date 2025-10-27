-- Ajouter index unique pour REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS adm3_names_unique_idx 
ON adm3_names(code, name_norm);

-- Refresh normal (sans CONCURRENTLY pour la première fois)
REFRESH MATERIALIZED VIEW adm3_names;

-- Maintenant refresh mv_mailles_geotech
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;

SELECT 'Refresh terminé' AS status;
