-- Migration 096: Couper les mailles 28km à la frontière du Togo
-- Évite les débordements sur les pays voisins (Bénin, Burkina Faso, Ghana)

BEGIN;

-- Vérifier que la table mailles_28km existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'atlas' AND table_name = 'mailles_28km') THEN
        RAISE NOTICE 'Table mailles_28km non trouvée - migration ignorée';
        RETURN;
    END IF;
END $$;

-- Couper les mailles 28km à la frontière du Togo
UPDATE atlas.mailles_28km m
SET geom = ST_Intersection(m.geom, a.geom)
FROM atlas.adm0 a
WHERE a.country_code = 'TG'
  AND NOT ST_Equals(m.geom, ST_Intersection(m.geom, a.geom))
  AND ST_Intersects(m.geom, a.geom);

-- Supprimer les mailles 28km qui ne touchent plus le Togo après intersection
DELETE FROM atlas.mailles_28km m
WHERE NOT EXISTS (
    SELECT 1 FROM atlas.adm0 a
    WHERE a.country_code = 'TG'
    AND ST_Intersects(m.geom, a.geom)
);

-- Recalculer les statistiques de la table
ANALYZE atlas.mailles_28km;

-- Rafraîchir la vue matérialisée si elle existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'atlas' AND matviewname = 'mailles_28km_stats_wgs84') THEN
        REFRESH MATERIALIZED VIEW atlas.mailles_28km_stats_wgs84;
        RAISE NOTICE 'Vue mailles_28km_stats_wgs84 rafraîchie';
    END IF;
END $$;

COMMIT;

-- Commentaire
COMMENT ON TABLE atlas.mailles_28km IS 
'Mailles 28km clippées à la frontière du Togo pour éviter les débordements sur les pays voisins';
