-- ============================================================================
-- Migration 025: Créer les triggers de synchronisation vers essais_geotechniques
-- Date: 2025-11-17
-- Description: Triggers pour synchroniser automatiquement echantillons et essais
--              vers la table essais_geotechniques (compatibilité legacy)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FONCTION: Synchroniser depuis échantillon
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_echantillon_to_eg()
RETURNS TRIGGER AS $$
DECLARE
  v_wl NUMERIC;
  v_wp NUMERIC;
  v_vbs NUMERIC;
BEGIN
  -- Récupérer les valeurs depuis les tables détaillées
  SELECT wl, wp INTO v_wl, v_wp
  FROM essais_atterberg WHERE echantillon_id = NEW.id;
  
  SELECT vbs INTO v_vbs
  FROM essais_vbs WHERE echantillon_id = NEW.id;
  
  -- Upsert dans essais_geotechniques
  INSERT INTO essais_geotechniques (
    id, sondage_id, depth_m, 
    wl, wp, vbs,
    test_date, laboratory,
    created_at
  ) VALUES (
    gen_random_uuid(),
    NEW.sondage_id, 
    NEW.depth_m,
    v_wl, v_wp, v_vbs,
    NEW.date, 
    NEW.laboratory,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (sondage_id, depth_m) 
  DO UPDATE SET
    wl = EXCLUDED.wl,
    wp = EXCLUDED.wp,
    vbs = EXCLUDED.vbs,
    test_date = EXCLUDED.test_date,
    laboratory = EXCLUDED.laboratory,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. FONCTION: Synchroniser depuis essais (Atterberg, VBS)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_essai_to_eg()
RETURNS TRIGGER AS $$
DECLARE
  v_sondage_id UUID;
  v_depth_m NUMERIC;
  v_date DATE;
  v_laboratory TEXT;
  v_wl NUMERIC;
  v_wp NUMERIC;
  v_vbs NUMERIC;
  v_echantillon_id UUID;
BEGIN
  -- Déterminer l'echantillon_id (NEW pour INSERT/UPDATE, OLD pour DELETE)
  IF TG_OP = 'DELETE' THEN
    v_echantillon_id := OLD.echantillon_id;
  ELSE
    v_echantillon_id := NEW.echantillon_id;
  END IF;
  
  -- Récupérer les infos de l'échantillon
  SELECT e.sondage_id, e.depth_m, e.date, e.laboratory
  INTO v_sondage_id, v_depth_m, v_date, v_laboratory
  FROM echantillons e
  WHERE e.id = v_echantillon_id;
  
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Récupérer les valeurs depuis les tables détaillées
  SELECT wl, wp INTO v_wl, v_wp
  FROM essais_atterberg WHERE echantillon_id = v_echantillon_id;
  
  SELECT vbs INTO v_vbs
  FROM essais_vbs WHERE echantillon_id = v_echantillon_id;
  
  -- Upsert dans essais_geotechniques
  INSERT INTO essais_geotechniques (
    id, sondage_id, depth_m, 
    wl, wp, vbs,
    test_date, laboratory,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_sondage_id, 
    v_depth_m,
    v_wl, v_wp, v_vbs,
    v_date, 
    v_laboratory,
    now()
  )
  ON CONFLICT (sondage_id, depth_m) 
  DO UPDATE SET
    wl = EXCLUDED.wl,
    wp = EXCLUDED.wp,
    vbs = EXCLUDED.vbs,
    test_date = EXCLUDED.test_date,
    laboratory = EXCLUDED.laboratory,
    updated_at = now();
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. CRÉER LES TRIGGERS
-- ============================================================================

-- Trigger sur échantillons
DROP TRIGGER IF EXISTS trg_sync_echantillon_to_eg ON echantillons;
CREATE TRIGGER trg_sync_echantillon_to_eg
AFTER INSERT OR UPDATE ON echantillons
FOR EACH ROW
EXECUTE FUNCTION sync_echantillon_to_eg();

-- Triggers sur essais détaillés
DROP TRIGGER IF EXISTS trg_sync_atterberg_to_eg ON essais_atterberg;
CREATE TRIGGER trg_sync_atterberg_to_eg
AFTER INSERT OR UPDATE OR DELETE ON essais_atterberg
FOR EACH ROW
EXECUTE FUNCTION sync_essai_to_eg();

DROP TRIGGER IF EXISTS trg_sync_vbs_to_eg ON essais_vbs;
CREATE TRIGGER trg_sync_vbs_to_eg
AFTER INSERT OR UPDATE OR DELETE ON essais_vbs
FOR EACH ROW
EXECUTE FUNCTION sync_essai_to_eg();

-- ============================================================================
-- 4. SYNCHRONISER LES DONNÉES EXISTANTES
-- ============================================================================

-- Recréer les entrées essais_geotechniques depuis les échantillons existants
TRUNCATE TABLE essais_geotechniques CASCADE;

INSERT INTO essais_geotechniques (
  id, sondage_id, depth_m, 
  wl, wp, vbs,
  test_date, laboratory,
  created_at
)
SELECT 
  gen_random_uuid(),
  e.sondage_id,
  e.depth_m,
  a.wl,
  a.wp,
  v.vbs,
  e.date,
  e.laboratory,
  COALESCE(e.created_at, now())
FROM echantillons e
LEFT JOIN essais_atterberg a ON a.echantillon_id = e.id
LEFT JOIN essais_vbs v ON v.echantillon_id = e.id
ON CONFLICT (sondage_id, depth_m) DO NOTHING;

-- ============================================================================
-- 5. NOTIFICATIONS
-- ============================================================================

DO $$
DECLARE
  v_count_eg INTEGER;
  v_count_echantillons INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count_eg FROM essais_geotechniques;
  SELECT COUNT(*) INTO v_count_echantillons FROM echantillons;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration 025 terminée avec succès';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '  - Triggers créés: 3';
  RAISE NOTICE '  - Échantillons: %', v_count_echantillons;
  RAISE NOTICE '  - Essais géotechniques synchronisés: %', v_count_eg;
  RAISE NOTICE '';
  RAISE NOTICE 'Les essais_geotechniques seront maintenant automatiquement synchronisés';
  RAISE NOTICE 'lors de l''insertion/mise à jour des échantillons et essais.';
  RAISE NOTICE '============================================================================';
END $$;

COMMIT;
