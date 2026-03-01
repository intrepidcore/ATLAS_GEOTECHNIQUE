-- Migration 008: Support des sondages sans coordonnées avec rattachement ADM
-- Date: 2025-10-18
-- Description: Permet de créer des sondages rattachés à un niveau administratif
--              sans coordonnées précises, avec géocodage ultérieur possible

-- ============================================================================
-- 1. ENUM pour les modes de localisation
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'location_mode_enum'
  ) THEN
    CREATE TYPE location_mode_enum AS ENUM (
      'exact',      -- Coordonnées GPS précises
      'unknown',    -- Position inconnue, rattaché à ADM uniquement
      'centroid',   -- Centroïde du polygone ADM
      'random'      -- Point aléatoire dans le polygone ADM
    );
  END IF;
END $$;

-- ============================================================================
-- 2. Modifier la table sondages
-- ============================================================================

-- Ajouter la colonne location_mode
ALTER TABLE sondages 
ADD COLUMN IF NOT EXISTS location_mode location_mode_enum DEFAULT 'exact';

-- Ajouter un index pour location_mode
CREATE INDEX IF NOT EXISTS idx_sondages_location_mode ON sondages(location_mode);

-- Tout le reste de cette migration dépend de tables génériques public.adm1/adm2/adm3
-- (UUID + geom). En desktop, on a adm*_tg (name + geom) et ce modèle n'est pas garanti.
-- On applique ces changements uniquement si les tables existent.
DO $do$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm1')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm2')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm3')
  ) THEN
    RAISE NOTICE '⏭️  Migration 008 partiellement skippée: tables public.adm1/adm2/adm3 introuvables (schéma desktop différent).';
    RETURN;
  END IF;

  -- Ajouter les colonnes ADM (si pas déjà présentes)
  EXECUTE 'ALTER TABLE sondages '
    || 'ADD COLUMN IF NOT EXISTS adm1_id UUID REFERENCES adm1(id),'
    || 'ADD COLUMN IF NOT EXISTS adm2_id UUID REFERENCES adm2(id),'
    || 'ADD COLUMN IF NOT EXISTS adm3_id UUID REFERENCES adm3(id)';

  -- Ajouter un index pour les requêtes par ADM
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sondages_adm1_id ON sondages(adm1_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sondages_adm2_id ON sondages(adm2_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sondages_adm3_id ON sondages(adm3_id)';

  -- Ajouter une contrainte: si location_mode = ''unknown'', au moins un ADM doit être renseigné
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'check_unknown_has_adm'
      AND n.nspname = 'public'
      AND t.relname = 'sondages'
  ) THEN
    EXECUTE 'ALTER TABLE sondages '
      || 'ADD CONSTRAINT check_unknown_has_adm CHECK ('
      || 'location_mode != ''unknown'' '
      || 'OR (adm1_id IS NOT NULL OR adm2_id IS NOT NULL OR adm3_id IS NOT NULL)'
      || ')';
  END IF;

END $do$;

-- ============================================================================
-- 3. Modifier les contraintes
-- ============================================================================

-- Permettre geom NULL si location_mode = 'unknown'
-- (pas de contrainte à ajouter, geom est déjà nullable)

-- (check_unknown_has_adm est géré conditionnellement plus haut)

-- ============================================================================
-- 4. Fonction helper: Obtenir le centroïde d'un ADM
-- ============================================================================

CREATE OR REPLACE FUNCTION get_adm_centroid(
  p_adm_level TEXT,
  p_adm_id UUID
) RETURNS geometry AS $$
DECLARE
  v_geom geometry;
BEGIN
  CASE p_adm_level
    WHEN 'ADM1' THEN
      SELECT ST_Transform(ST_Centroid(geom), 25231) INTO v_geom
      FROM adm1 WHERE id = p_adm_id;
    WHEN 'ADM2' THEN
      SELECT ST_Transform(ST_Centroid(geom), 25231) INTO v_geom
      FROM adm2 WHERE id = p_adm_id;
    WHEN 'ADM3' THEN
      SELECT ST_Transform(ST_Centroid(geom), 25231) INTO v_geom
      FROM adm3 WHERE id = p_adm_id;
    ELSE
      RAISE EXCEPTION 'Invalid ADM level: %', p_adm_level;
  END CASE;
  
  RETURN v_geom;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Fonction helper: Obtenir un point aléatoire dans un ADM
-- ============================================================================

CREATE OR REPLACE FUNCTION get_adm_random_point(
  p_adm_level TEXT,
  p_adm_id UUID,
  p_seed TEXT  -- Seed déterministe (ex: code du sondage)
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
      SELECT geom INTO v_geom_4326 FROM adm1 WHERE id = p_adm_id;
    WHEN 'ADM2' THEN
      SELECT geom INTO v_geom_4326 FROM adm2 WHERE id = p_adm_id;
    WHEN 'ADM3' THEN
      SELECT geom INTO v_geom_4326 FROM adm3 WHERE id = p_adm_id;
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
    -- Utiliser le seed + attempt pour avoir un résultat déterministe
    v_point := ST_SetSRID(
      ST_MakePoint(
        ST_XMin(v_bbox) + (ST_XMax(v_bbox) - ST_XMin(v_bbox)) * ((v_seed_hash + v_attempts * 0.1) % 1.0),
        ST_YMin(v_bbox) + (ST_YMax(v_bbox) - ST_YMin(v_bbox)) * ((v_seed_hash + v_attempts * 0.2) % 1.0)
      ),
      4326
    );
    
    -- Vérifier si le point est dans le polygone
    IF ST_Contains(v_geom_4326, v_point) THEN
      -- Transformer en 25231
      v_geom_25231 := ST_Transform(v_point, 25231);
      RETURN v_geom_25231;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. Fonction helper: Trouver la maille contenant un point
-- ============================================================================

CREATE OR REPLACE FUNCTION find_maille_for_point(
  p_geom geometry  -- En EPSG:25231
) RETURNS UUID AS $$
DECLARE
  v_maille_id UUID;
BEGIN
  SELECT id INTO v_maille_id
  FROM mailles
  WHERE ST_Contains(geom, p_geom)
  LIMIT 1;
  
  RETURN v_maille_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Mettre à jour les sondages existants
-- ============================================================================

-- Tous les sondages existants avec geom sont en mode 'exact'
UPDATE sondages 
SET location_mode = 'exact'
WHERE geom IS NOT NULL AND location_mode IS NULL;

-- Les sondages sans geom sont en mode 'unknown'
UPDATE sondages 
SET location_mode = 'unknown'
WHERE geom IS NULL AND location_mode IS NULL;

-- ============================================================================
-- 8. Vue pour les sondages géocodables
-- ============================================================================

CREATE OR REPLACE VIEW sondages_non_geocodes AS
SELECT
  s.id,
  s.code,
  s.location_mode,
  s.adm1_id,
  s.adm2_id,
  s.adm3_id,
  a1.name AS adm1_name,
  a2.name AS adm2_name,
  a3.name AS adm3_name,
  s.created_at,
  COUNT(e.id) AS n_essais
FROM sondages s
LEFT JOIN adm1 a1 ON s.adm1_id = a1.id
LEFT JOIN adm2 a2 ON s.adm2_id = a2.id
LEFT JOIN adm3 a3 ON s.adm3_id = a3.id
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
WHERE s.location_mode IN ('unknown', 'centroid', 'random')
  AND s.deleted_at IS NULL
GROUP BY s.id, s.code, s.location_mode, s.adm1_id, s.adm2_id, s.adm3_id,
         a1.name, a2.name, a3.name, s.created_at;

-- ============================================================================
-- 9. Commentaires
-- ============================================================================

COMMENT ON COLUMN sondages.location_mode IS 'Mode de localisation: exact (GPS), unknown (non géocodé), centroid (centroïde ADM), random (point aléatoire dans ADM)';
COMMENT ON COLUMN sondages.adm1_id IS 'Référence à la région (ADM1) pour les sondages sans coordonnées précises';
COMMENT ON COLUMN sondages.adm2_id IS 'Référence à la préfecture (ADM2) pour les sondages sans coordonnées précises';
COMMENT ON COLUMN sondages.adm3_id IS 'Référence à la commune (ADM3) pour les sondages sans coordonnées précises';

COMMENT ON FUNCTION get_adm_centroid IS 'Retourne le centroïde (EPSG:25231) d''un polygone administratif';
COMMENT ON FUNCTION get_adm_random_point IS 'Génère un point aléatoire déterministe (EPSG:25231) dans un polygone administratif';
COMMENT ON FUNCTION find_maille_for_point IS 'Trouve la maille contenant un point donné (EPSG:25231)';

COMMENT ON VIEW sondages_non_geocodes IS 'Vue des sondages en attente de géocodage ou pouvant être re-géocodés (location_mode IN (unknown, centroid, random))';

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================
