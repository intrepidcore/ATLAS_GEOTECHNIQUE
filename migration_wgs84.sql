-- ============================================================================
-- Migration WGS84 - Solution Complète SRID
-- ============================================================================
-- Objectif : Normaliser toutes les géométries en WGS84 (4326)
--            et créer une MV optimisée pour les cartes thématiques
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. AJOUTER EPSG:25231 (Lome 1977 / UTM zone 31N)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM spatial_ref_sys WHERE srid = 25231) THEN
    INSERT INTO spatial_ref_sys (srid, auth_name, auth_srid, proj4text, srtext)
    VALUES (
      25231,'EPSG',25231,
      '+proj=utm +zone=31 +ellps=clrk80 +towgs84=-88,4,101,0,0,0,0 +units=m +no_defs',
      'PROJCS["Lome 1977 / UTM zone 31N",GEOGCS["Lome 1977",DATUM["Lome_1977",SPHEROID["Clarke 1880 (IGN)",6378249.2,293.4660212936269]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",3],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",0],UNIT["metre",1]]'
    );
    RAISE NOTICE '✅ SRID 25231 ajouté';
  ELSE
    RAISE NOTICE '✅ SRID 25231 déjà présent';
  END IF;
END $$;

-- ============================================================================
-- 2. NORMALISER SRID DES MAILLES
-- ============================================================================

-- Compter les géométries avec SRID incorrect
DO $$
DECLARE
  cnt_bad_srid INT;
BEGIN
  SELECT COUNT(*) INTO cnt_bad_srid
  FROM mailles
  WHERE ST_SRID(geom) IS NULL OR ST_SRID(geom) = 0 OR ST_SRID(geom) != 25231;
  
  RAISE NOTICE 'Mailles avec SRID incorrect : %', cnt_bad_srid;
  
  IF cnt_bad_srid > 0 THEN
    -- Normaliser SRID
    UPDATE mailles
    SET geom = ST_SetSRID(geom, 25231)
    WHERE (ST_SRID(geom) IS NULL OR ST_SRID(geom) = 0 OR ST_SRID(geom) != 25231)
      AND ST_X(ST_Envelope(geom)) BETWEEN 100000 AND 900000
      AND ST_Y(ST_Envelope(geom)) BETWEEN 0 AND 1200000;
    
    RAISE NOTICE '✅ SRID normalisé pour % mailles', cnt_bad_srid;
  END IF;
END $$;

-- ============================================================================
-- 3. AJOUTER COLONNE geom_4326 (GÉNÉRÉE)
-- ============================================================================

-- Pour mailles
ALTER TABLE mailles
  ADD COLUMN IF NOT EXISTS geom_4326 geometry(Polygon,4326)
  GENERATED ALWAYS AS (ST_Transform(geom, 4326)) STORED;

CREATE INDEX IF NOT EXISTS idx_mailles_geom_4326
  ON mailles USING GIST (geom_4326);

-- Pour grid (si utilisé)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'grid') THEN
    ALTER TABLE grid
      ADD COLUMN IF NOT EXISTS geom_4326 geometry(Polygon,4326)
      GENERATED ALWAYS AS (ST_Transform(geom, 4326)) STORED;
    
    CREATE INDEX IF NOT EXISTS idx_grid_geom_4326
      ON grid USING GIST (geom_4326);
    
    RAISE NOTICE '✅ Colonne geom_4326 ajoutée à grid';
  ELSE
    RAISE NOTICE '⚠️  Table grid non trouvée';
  END IF;
END $$;

-- ============================================================================
-- 4. CRÉER VUE MATÉRIALISÉE WGS84
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mailles_geotechnique_stats_wgs84 CASCADE;

CREATE MATERIALIZED VIEW mailles_geotechnique_stats_wgs84 AS
SELECT
  m.id,
  m.code,
  m.geom_4326 AS geom,
  ST_SimplifyPreserveTopology(m.geom_4326, 0.0003) AS geom_simplified,
  s.passant_80um_avg,
  s.passant_2mm_avg,
  s.passant_20mm_avg,
  s.wl_avg,
  s.wp_avg,
  s.ip_avg,
  s.vbs_avg,
  s.gamma_d_max_avg,
  s.w_opt_avg,
  s.eg_avg,
  s.n_sondages,
  s.n_essais_geo
FROM mailles m
JOIN mailles_geotechnique_stats s ON s.code = m.code
WHERE s.n_sondages > 0;  -- Exclure les mailles vides

-- Index pour performances
CREATE UNIQUE INDEX idx_mstatsw_id ON mailles_geotechnique_stats_wgs84 (id);
CREATE UNIQUE INDEX idx_mstatsw_code ON mailles_geotechnique_stats_wgs84 (code);
CREATE INDEX idx_mstatsw_geom ON mailles_geotechnique_stats_wgs84 USING GIST (geom);
CREATE INDEX idx_mstatsw_geom_simplified ON mailles_geotechnique_stats_wgs84 USING GIST (geom_simplified);
CREATE INDEX idx_mstatsw_n_sondages ON mailles_geotechnique_stats_wgs84 (n_sondages);

-- Index partiels pour chaque paramètre
CREATE INDEX idx_mstatsw_passant80 ON mailles_geotechnique_stats_wgs84 (passant_80um_avg) 
  WHERE passant_80um_avg IS NOT NULL;
CREATE INDEX idx_mstatsw_ip ON mailles_geotechnique_stats_wgs84 (ip_avg) 
  WHERE ip_avg IS NOT NULL;
CREATE INDEX idx_mstatsw_vbs ON mailles_geotechnique_stats_wgs84 (vbs_avg) 
  WHERE vbs_avg IS NOT NULL;

-- ============================================================================
-- 5. FONCTION UTILITAIRE safe_to_wgs84
-- ============================================================================

CREATE OR REPLACE FUNCTION safe_to_wgs84(g geometry)
RETURNS geometry AS $$
BEGIN
  IF g IS NULL THEN RETURN NULL; END IF;
  IF ST_SRID(g) = 4326 THEN RETURN g; END IF;
  IF ST_SRID(g) = 0 OR ST_SRID(g) IS NULL THEN
     RETURN ST_Transform(ST_SetSRID(g, 25231), 4326);
  END IF;
  RETURN ST_Transform(g, 4326);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMIT;

-- ============================================================================
-- 6. VÉRIFICATIONS POST-MIGRATION
-- ============================================================================

-- Vérifier SRID
SELECT 'SRID Check' AS test, 
       ST_SRID(geom) AS srid_geom, 
       ST_SRID(geom_simplified) AS srid_simplified
FROM mailles_geotechnique_stats_wgs84 LIMIT 1;

-- Compter les features disponibles
SELECT 'Feature Count' AS test,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE geom IS NOT NULL) AS with_geom,
       COUNT(*) FILTER (WHERE ip_avg IS NOT NULL) AS with_ip,
       COUNT(*) FILTER (WHERE passant_80um_avg IS NOT NULL) AS with_passant80
FROM mailles_geotechnique_stats_wgs84;

-- Exemple de coordonnées
SELECT 'Coords Check' AS test,
       code,
       ST_X(ST_Centroid(geom)) AS lon,
       ST_Y(ST_Centroid(geom)) AS lat
FROM mailles_geotechnique_stats_wgs84
WHERE passant_80um_avg IS NOT NULL
LIMIT 3;
