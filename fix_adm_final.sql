-- Fix final: Vue et fonctions avec les bonnes colonnes ADM

-- 1. Vue des sondages non géocodés
DROP VIEW IF EXISTS sondages_non_geocodes;

CREATE VIEW sondages_non_geocodes AS
SELECT 
  s.id,
  s.code,
  s.location_mode::text AS location_mode,
  s.adm1_id,
  s.adm2_id,
  s.adm3_id,
  a1.adm1_fr AS adm1_name,
  a2.adm2_fr AS adm2_name,
  a3.adm3_fr AS adm3_name,
  s.created_at,
  COUNT(e.id) AS n_essais
FROM sondages s
LEFT JOIN adm1 a1 ON s.adm1_id::text = a1.gid::text
LEFT JOIN adm2 a2 ON s.adm2_id::text = a2.gid::text
LEFT JOIN adm3 a3 ON s.adm3_id::text = a3.gid::text
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
WHERE s.location_mode::text = 'unknown'
  AND s.deleted_at IS NULL
GROUP BY s.id, s.code, s.location_mode, s.adm1_id, s.adm2_id, s.adm3_id,
         a1.adm1_fr, a2.adm2_fr, a3.adm3_fr, s.created_at;

COMMENT ON VIEW sondages_non_geocodes IS 'Vue des sondages en attente de géocodage (location_mode = unknown)';

-- 2. Fonction get_adm_centroid (avec gid au lieu de id)
DROP FUNCTION IF EXISTS get_adm_centroid(TEXT, UUID);
DROP FUNCTION IF EXISTS get_adm_centroid(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION get_adm_centroid(
  p_adm_level TEXT,
  p_adm_gid INTEGER
) RETURNS geometry AS $$
DECLARE
  v_geom geometry;
BEGIN
  CASE p_adm_level
    WHEN 'ADM1' THEN
      SELECT ST_Transform(ST_Centroid(geom), 25231) INTO v_geom
      FROM adm1 WHERE gid = p_adm_gid;
    WHEN 'ADM2' THEN
      SELECT ST_Transform(ST_Centroid(geom), 25231) INTO v_geom
      FROM adm2 WHERE gid = p_adm_gid;
    WHEN 'ADM3' THEN
      SELECT ST_Transform(ST_Centroid(geom), 25231) INTO v_geom
      FROM adm3 WHERE gid = p_adm_gid;
    ELSE
      RAISE EXCEPTION 'Invalid ADM level: %', p_adm_level;
  END CASE;
  
  RETURN v_geom;
END;
$$ LANGUAGE plpgsql;

-- 3. Fonction get_adm_random_point (avec gid au lieu de id)
DROP FUNCTION IF EXISTS get_adm_random_point(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS get_adm_random_point(TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION get_adm_random_point(
  p_adm_level TEXT,
  p_adm_gid INTEGER,
  p_seed TEXT
) RETURNS geometry AS $$
DECLARE
  v_geom_4326 geometry;
  v_geom_25231 geometry;
  v_bbox geometry;
  v_point geometry;
  v_attempts INT := 0;
  v_max_attempts INT := 100;
  v_seed_hash FLOAT;
BEGIN
  -- Récupérer le polygone en 4326
  CASE p_adm_level
    WHEN 'ADM1' THEN
      SELECT geom INTO v_geom_4326 FROM adm1 WHERE gid = p_adm_gid;
    WHEN 'ADM2' THEN
      SELECT geom INTO v_geom_4326 FROM adm2 WHERE gid = p_adm_gid;
    WHEN 'ADM3' THEN
      SELECT geom INTO v_geom_4326 FROM adm3 WHERE gid = p_adm_gid;
    ELSE
      RAISE EXCEPTION 'Invalid ADM level: %', p_adm_level;
  END CASE;
  
  IF v_geom_4326 IS NULL THEN
    RAISE EXCEPTION 'ADM geometry not found';
  END IF;
  
  -- Calculer un hash du seed pour avoir un random déterministe
  v_seed_hash := (hashtext(p_seed)::bigint % 1000000) / 1000000.0;
  
  -- Obtenir la bounding box
  v_bbox := ST_Envelope(v_geom_4326);
  
  -- Générer un point aléatoire dans la bbox jusqu'à ce qu'il soit dans le polygone
  LOOP
    v_attempts := v_attempts + 1;
    
    IF v_attempts > v_max_attempts THEN
      -- Fallback: retourner le centroïde
      RETURN ST_Transform(ST_Centroid(v_geom_4326), 25231);
    END IF;
    
    -- Générer un point aléatoire dans la bbox
    v_point := ST_SetSRID(
      ST_MakePoint(
        ST_XMin(v_bbox) + (ST_XMax(v_bbox) - ST_XMin(v_bbox)) * ((v_seed_hash + v_attempts * 0.1) % 1.0),
        ST_YMin(v_bbox) + (ST_YMax(v_bbox) - ST_YMin(v_bbox)) * ((v_seed_hash + v_attempts * 0.2) % 1.0)
      ),
      4326
    );
    
    -- Vérifier si le point est dans le polygone
    IF ST_Contains(v_geom_4326, v_point) THEN
      v_geom_25231 := ST_Transform(v_point, 25231);
      RETURN v_geom_25231;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_adm_centroid IS 'Retourne le centroïde (EPSG:25231) d''un polygone administratif (utilise gid)';
COMMENT ON FUNCTION get_adm_random_point IS 'Génère un point aléatoire déterministe (EPSG:25231) dans un polygone administratif (utilise gid)';
