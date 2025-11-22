-- Migration 036: Ajouter fonction pour générer point aléatoire dans polygone
-- Objectif: Supporter le mode adm_random_cell pour géocodage

-- Fonction pour générer un point aléatoire dans un polygone
CREATE OR REPLACE FUNCTION public.random_point_in_polygon(geom geometry)
RETURNS geometry AS $$
DECLARE
  bbox geometry;
  random_point geometry;
  max_attempts integer := 1000;
  attempt integer := 0;
BEGIN
  -- Obtenir la bounding box du polygone
  bbox := ST_Envelope(geom);
  
  -- Essayer de générer un point aléatoire dans le polygone
  LOOP
    attempt := attempt + 1;
    
    -- Générer un point aléatoire dans la bounding box
    random_point := ST_SetSRID(
      ST_MakePoint(
        ST_XMin(bbox) + (ST_XMax(bbox) - ST_XMin(bbox)) * random(),
        ST_YMin(bbox) + (ST_YMax(bbox) - ST_YMin(bbox)) * random()
      ),
      ST_SRID(geom)
    );
    
    -- Vérifier si le point est dans le polygone
    IF ST_Contains(geom, random_point) THEN
      RETURN random_point;
    END IF;
    
    -- Éviter boucle infinie
    IF attempt >= max_attempts THEN
      -- Fallback: retourner le centroïde
      RAISE WARNING 'Could not generate random point after % attempts, returning centroid', max_attempts;
      RETURN ST_Centroid(geom);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION public.random_point_in_polygon(geometry) IS 
'Génère un point aléatoire à l''intérieur d''un polygone.
Utilise une méthode de rejection sampling dans la bounding box.
Fallback sur le centroïde après 1000 tentatives.';

-- Test de la fonction
DO $$
DECLARE
  test_geom geometry;
  random_pt geometry;
BEGIN
  -- Prendre un ADM3 pour tester
  SELECT geom INTO test_geom FROM adm3 LIMIT 1;
  
  IF test_geom IS NOT NULL THEN
    random_pt := public.random_point_in_polygon(test_geom);
    
    IF ST_Contains(test_geom, random_pt) THEN
      RAISE NOTICE '✅ Test OK: Point aléatoire généré dans le polygone';
    ELSE
      RAISE WARNING '⚠️ Test FAILED: Point hors du polygone';
    END IF;
  END IF;
END $$;
