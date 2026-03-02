-- Migration 005: Support des modes de localisation (exact/centroid/random/unknown)
-- Version: 1.2.0
-- Date: 2025-10-17

-- ============================================================================
-- 1. Ajouter colonnes de localisation et traçabilité
-- ============================================================================

ALTER TABLE sondages
  ADD COLUMN IF NOT EXISTS location_accuracy TEXT NOT NULL DEFAULT 'exact'
    CHECK (location_accuracy IN ('exact', 'centroid_adm3', 'centroid_adm2', 'centroid_adm1', 
                                   'random_adm3', 'random_adm2', 'random_adm1', 'unknown')),
  ADD COLUMN IF NOT EXISTS is_geocoded BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS operator TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Permettre geom NULL pour les sondages non géolocalisés
ALTER TABLE sondages ALTER COLUMN geom DROP NOT NULL;

-- Index pour filtrage rapide
CREATE INDEX IF NOT EXISTS idx_sondages_location_accuracy ON sondages(location_accuracy);
CREATE INDEX IF NOT EXISTS idx_sondages_is_geocoded ON sondages(is_geocoded);
CREATE INDEX IF NOT EXISTS idx_sondages_adm1 ON sondages(adm1_name);
CREATE INDEX IF NOT EXISTS idx_sondages_adm2 ON sondages(adm2_name);
CREATE INDEX IF NOT EXISTS idx_sondages_adm3 ON sondages(adm3_name);

-- ============================================================================
-- 2. Mettre à jour les sondages existants
-- ============================================================================

-- Tous les sondages existants avec geom sont considérés comme 'exact'
UPDATE sondages 
SET location_accuracy = 'exact', 
    is_geocoded = TRUE 
WHERE geom IS NOT NULL AND location_accuracy = 'exact';

-- ============================================================================
-- 3. Fonction helper: placer au centroïde d'une zone ADM
-- ============================================================================

CREATE OR REPLACE FUNCTION place_at_centroid(
  adm_level TEXT,
  adm_name TEXT
) RETURNS geometry(Point, 25231) AS $$
DECLARE
  centroid_4326 geometry(Point, 4326);
  centroid_25231 geometry(Point, 25231);
BEGIN
  -- Trouver le centroïde selon le niveau ADM
  IF adm_level = 'ADM3' THEN
    SELECT ST_Centroid(geom) INTO centroid_4326
    FROM adm3_tg
    WHERE name = adm_name
    LIMIT 1;
  ELSIF adm_level = 'ADM2' THEN
    SELECT ST_Centroid(geom) INTO centroid_4326
    FROM adm2_tg
    WHERE name = adm_name
    LIMIT 1;
  ELSIF adm_level = 'ADM1' THEN
    SELECT ST_Centroid(geom) INTO centroid_4326
    FROM adm1_tg
    WHERE name = adm_name
    LIMIT 1;
  END IF;
  
  IF centroid_4326 IS NULL THEN
    RAISE EXCEPTION 'Zone ADM non trouvée: % %', adm_level, adm_name;
  END IF;
  
  -- Transformer en 25231
  centroid_25231 := ST_Transform(centroid_4326, 25231);
  
  RETURN centroid_25231;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Fonction helper: placer aléatoirement dans une zone ADM (stable)
-- ============================================================================

CREATE OR REPLACE FUNCTION place_random_in_adm(
  adm_level TEXT,
  adm_name TEXT,
  seed_text TEXT
) RETURNS geometry(Point, 25231) AS $$
DECLARE
  adm_geom_4326 geometry;
  random_point_4326 geometry(Point, 4326);
  random_point_25231 geometry(Point, 25231);
  bbox geometry;
  attempt INT := 0;
  max_attempts INT := 100;
BEGIN
  -- Trouver la géométrie selon le niveau ADM
  IF adm_level = 'ADM3' THEN
    SELECT geom INTO adm_geom_4326 FROM adm3_tg WHERE name = adm_name LIMIT 1;
  ELSIF adm_level = 'ADM2' THEN
    SELECT geom INTO adm_geom_4326 FROM adm2_tg WHERE name = adm_name LIMIT 1;
  ELSIF adm_level = 'ADM1' THEN
    SELECT geom INTO adm_geom_4326 FROM adm1_tg WHERE name = adm_name LIMIT 1;
  END IF;
  
  IF adm_geom_4326 IS NULL THEN
    RAISE EXCEPTION 'Zone ADM non trouvée: % %', adm_level, adm_name;
  END IF;
  
  -- Seed stable basé sur le texte (pour reproductibilité)
  PERFORM setseed(('x' || substr(md5(seed_text), 1, 16))::bit(32)::int::float / (2^32-1)::float);
  
  -- Générer point aléatoire dans bbox jusqu'à ce qu'il soit dans le polygone
  bbox := ST_Envelope(adm_geom_4326);
  
  LOOP
    random_point_4326 := ST_SetSRID(
      ST_MakePoint(
        ST_XMin(bbox) + random() * (ST_XMax(bbox) - ST_XMin(bbox)),
        ST_YMin(bbox) + random() * (ST_YMax(bbox) - ST_YMin(bbox))
      ),
      4326
    );
    
    EXIT WHEN ST_Contains(adm_geom_4326, random_point_4326);
    
    attempt := attempt + 1;
    IF attempt > max_attempts THEN
      -- Fallback au centroïde si échec
      random_point_4326 := ST_Centroid(adm_geom_4326);
      EXIT;
    END IF;
  END LOOP;
  
  -- Transformer en 25231
  random_point_25231 := ST_Transform(random_point_4326, 25231);
  
  RETURN random_point_25231;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. View: sondages géolocalisés uniquement (pour calculs IDW)
-- ============================================================================

CREATE OR REPLACE VIEW v_sondages_geocoded AS
SELECT 
  s.*
FROM sondages s
WHERE s.deleted_at IS NULL 
  AND s.is_geocoded = TRUE 
  AND s.geom IS NOT NULL;

COMMENT ON VIEW v_sondages_geocoded IS 'Sondages avec coordonnées exactes pour calculs spatiaux (IDW, etc.)';

-- ============================================================================
-- 6. View: sondages par niveau ADM (pour agrégations)
-- ============================================================================

CREATE OR REPLACE VIEW v_sondages_by_adm AS
SELECT 
  adm1_name,
  adm2_name,
  adm3_name,
  location_accuracy,
  COUNT(*) as n_sondages,
  COUNT(*) FILTER (WHERE is_geocoded) as n_geocoded,
  COUNT(DISTINCT maille_code) FILTER (WHERE maille_code IS NOT NULL) as n_mailles,
  SUM((SELECT COUNT(*) FROM essais WHERE sondage_id = sondages.id AND deleted_at IS NULL)) as n_essais
FROM sondages
WHERE deleted_at IS NULL
GROUP BY adm1_name, adm2_name, adm3_name, location_accuracy;

COMMENT ON VIEW v_sondages_by_adm IS 'Agrégation des sondages par zone administrative et précision de localisation';

-- ============================================================================
-- 7. Contraintes de cohérence
-- ============================================================================

-- Si is_geocoded = TRUE, alors geom doit être non-NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'check_geocoded_has_geom'
      AND n.nspname = 'public'
      AND t.relname = 'sondages'
  ) THEN
    ALTER TABLE sondages ADD CONSTRAINT check_geocoded_has_geom
      CHECK (NOT is_geocoded OR geom IS NOT NULL);
  END IF;
END $$;

-- Si location_accuracy = 'exact', alors is_geocoded doit être TRUE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'check_exact_is_geocoded'
      AND n.nspname = 'public'
      AND t.relname = 'sondages'
  ) THEN
    ALTER TABLE sondages ADD CONSTRAINT check_exact_is_geocoded
      CHECK (location_accuracy != 'exact' OR is_geocoded = TRUE);
  END IF;
END $$;

-- Si location_accuracy = 'unknown', alors geom doit être NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'check_unknown_no_geom'
      AND n.nspname = 'public'
      AND t.relname = 'sondages'
  ) THEN
    ALTER TABLE sondages ADD CONSTRAINT check_unknown_no_geom
      CHECK (location_accuracy != 'unknown' OR geom IS NULL);
  END IF;
END $$;

-- ============================================================================
-- 8. Audit log: ajouter champ location_mode
-- ============================================================================

ALTER TABLE audit_log 
  ADD COLUMN IF NOT EXISTS location_mode TEXT;

COMMENT ON COLUMN audit_log.location_mode IS 'Mode de localisation utilisé lors de la création/modification';

-- ============================================================================
-- 9. Commentaires
-- ============================================================================

COMMENT ON COLUMN sondages.location_accuracy IS 'Précision de la localisation: exact, centroid_admX, random_admX, unknown';
COMMENT ON COLUMN sondages.is_geocoded IS 'TRUE si le sondage a des coordonnées géographiques (geom non-NULL)';
COMMENT ON COLUMN sondages.date IS 'Date de réalisation du sondage';
COMMENT ON COLUMN sondages.source IS 'Source des données (laboratoire, entreprise, etc.)';
COMMENT ON COLUMN sondages.operator IS 'Opérateur ayant réalisé le sondage';
COMMENT ON COLUMN sondages.notes IS 'Notes et commentaires additionnels';

-- ============================================================================
-- FIN MIGRATION 005
-- ============================================================================
