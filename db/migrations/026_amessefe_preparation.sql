-- ============================================================================
-- Migration 026: Préparation pour import AMESSEFE
-- Date: 2025-11-18
-- Description: 
--   - Ajouter depth_m_min, depth_m_max, operator à sondages
--   - Ajouter colonnes spécifiques AMESSEFE à essais_geotechniques
--   - Remplir operator = 'Serge TABE DJATO' pour tous les sondages existants
--   - Calculer depth_min/max automatiquement
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. AJOUTER COLONNES À sondages
-- ============================================================================

ALTER TABLE sondages
  ADD COLUMN IF NOT EXISTS depth_m_min NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS depth_m_max NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS operator TEXT;

COMMENT ON COLUMN sondages.depth_m_min IS 
'Profondeur minimale des échantillons (calculée automatiquement depuis echantillons)';

COMMENT ON COLUMN sondages.depth_m_max IS 
'Profondeur maximale des échantillons (calculée automatiquement depuis echantillons)';

COMMENT ON COLUMN sondages.operator IS 
'Opérateur/technicien ayant réalisé le sondage (ex: Serge TABE DJATO)';

DO $$ BEGIN
  RAISE NOTICE '✓ Colonnes depth_m_min, depth_m_max, operator ajoutées à sondages';
END $$;

-- ============================================================================
-- 2. AJOUTER COLONNES AMESSEFE À essais_geotechniques
-- ============================================================================

-- Potentiel de gonflement (cg)
ALTER TABLE essais_geotechniques
  ADD COLUMN IF NOT EXISTS cg NUMERIC,
  ADD COLUMN IF NOT EXISTS cg_qual TEXT;

-- Classifications multiples
ALTER TABLE essais_geotechniques
  ADD COLUMN IF NOT EXISTS class_chassagneux TEXT,
  ADD COLUMN IF NOT EXISTS class_daksha TEXT,
  ADD COLUMN IF NOT EXISTS class_seed TEXT,
  ADD COLUMN IF NOT EXISTS class_vijay TEXT,
  ADD COLUMN IF NOT EXISTS type_sol TEXT;

-- Qualificatif VBS (Faible/Moyen/Forte/Très forte)
ALTER TABLE essais_geotechniques
  ADD COLUMN IF NOT EXISTS vbs_qual TEXT;

COMMENT ON COLUMN essais_geotechniques.cg IS 
'Potentiel de gonflement (cg) - données AMESSEFE';

COMMENT ON COLUMN essais_geotechniques.cg_qual IS 
'Analyse du potentiel de gonflement (Faible/Moyen/Élevé) - données AMESSEFE';

COMMENT ON COLUMN essais_geotechniques.class_chassagneux IS 
'Classification CHASSAGNEUX D. et al. 1996';

COMMENT ON COLUMN essais_geotechniques.class_daksha IS 
'Classification Dakshanamurthy et Raman 1973';

COMMENT ON COLUMN essais_geotechniques.class_seed IS 
'Classification SEED H. et al 1962';

COMMENT ON COLUMN essais_geotechniques.class_vijay IS 
'Classification VIJAYVERGIYA et GHAZZALY 1973';

COMMENT ON COLUMN essais_geotechniques.type_sol IS 
'Type de sol (Vertisols, Ferrugineux, etc.)';

COMMENT ON COLUMN essais_geotechniques.vbs_qual IS 
'Analyse qualitative VBS (Faible/Moyen/Forte/Très forte)';

DO $$ BEGIN
  RAISE NOTICE '✓ Colonnes AMESSEFE ajoutées à essais_geotechniques';
END $$;

-- ============================================================================
-- 3. REMPLIR operator = 'Serge TABE DJATO' POUR TOUS LES SONDAGES EXISTANTS
-- ============================================================================

UPDATE sondages
SET operator = 'Serge TABE DJATO'
WHERE operator IS NULL;

DO $$ 
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM sondages WHERE operator = 'Serge TABE DJATO';
  RAISE NOTICE '✓ Operator rempli pour % sondages', v_count;
END $$;

-- ============================================================================
-- 4. CALCULER depth_m_min ET depth_m_max POUR TOUS LES SONDAGES
-- ============================================================================

UPDATE sondages s
SET depth_m_min = sub.depth_min,
    depth_m_max = sub.depth_max,
    updated_at = now()
FROM (
    SELECT sondage_id,
           MIN(depth_m) AS depth_min,
           MAX(depth_m) AS depth_max
    FROM echantillons
    GROUP BY sondage_id
) AS sub
WHERE s.id = sub.sondage_id;

DO $$ 
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count 
  FROM sondages 
  WHERE depth_m_min IS NOT NULL AND depth_m_max IS NOT NULL;
  RAISE NOTICE '✓ depth_min/max calculés pour % sondages', v_count;
END $$;

-- ============================================================================
-- 5. CRÉER UN TRIGGER POUR MAINTENIR depth_min/max AUTOMATIQUEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_sondage_depth_range()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour depth_min et depth_max du sondage concerné
  UPDATE sondages s
  SET depth_m_min = sub.depth_min,
      depth_m_max = sub.depth_max,
      updated_at = now()
  FROM (
      SELECT sondage_id,
             MIN(depth_m) AS depth_min,
             MAX(depth_m) AS depth_max
      FROM echantillons
      WHERE sondage_id = COALESCE(NEW.sondage_id, OLD.sondage_id)
      GROUP BY sondage_id
  ) AS sub
  WHERE s.id = sub.sondage_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_sondage_depth_range ON echantillons;
CREATE TRIGGER trg_update_sondage_depth_range
AFTER INSERT OR UPDATE OR DELETE ON echantillons
FOR EACH ROW
EXECUTE FUNCTION update_sondage_depth_range();

DO $$ BEGIN
  RAISE NOTICE '✓ Trigger de mise à jour automatique depth_min/max créé';
END $$;

-- ============================================================================
-- 6. VUE DE CONTRÔLE POUR SONDAGES AVEC PROFONDEURS
-- ============================================================================

CREATE OR REPLACE VIEW atlas.v_sondages_profondeurs AS
SELECT 
  s.id,
  s.meta->>'code' AS code_site,
  s.meta->>'localite' AS localite,
  s.source,
  s.operator,
  s.depth_m_min,
  s.depth_m_max,
  COUNT(e.id) AS nb_echantillons,
  array_agg(DISTINCT e.depth_m ORDER BY e.depth_m) AS profondeurs,
  s.created_at,
  s.updated_at
FROM sondages s
LEFT JOIN echantillons e ON e.sondage_id = s.id
WHERE s.meta->>'code' IS NOT NULL
GROUP BY s.id, s.meta, s.source, s.operator, s.depth_m_min, s.depth_m_max, s.created_at, s.updated_at
ORDER BY s.meta->>'code';

COMMENT ON VIEW atlas.v_sondages_profondeurs IS 
'Vue de contrôle : sondages avec leurs profondeurs min/max et liste des échantillons';

DO $$ BEGIN
  RAISE NOTICE '✓ Vue atlas.v_sondages_profondeurs créée';
END $$;

-- ============================================================================
-- 7. STATISTIQUES FINALES
-- ============================================================================

DO $$
DECLARE
  v_sondages INTEGER;
  v_echantillons INTEGER;
  v_with_depth INTEGER;
  v_with_operator INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_sondages FROM sondages;
  SELECT COUNT(*) INTO v_echantillons FROM echantillons;
  SELECT COUNT(*) INTO v_with_depth FROM sondages WHERE depth_m_min IS NOT NULL;
  SELECT COUNT(*) INTO v_with_operator FROM sondages WHERE operator IS NOT NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration 026 terminée avec succès';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '  Sondages totaux              : %', v_sondages;
  RAISE NOTICE '  Échantillons totaux          : %', v_echantillons;
  RAISE NOTICE '  Sondages avec depth_min/max  : %', v_with_depth;
  RAISE NOTICE '  Sondages avec operator       : %', v_with_operator;
  RAISE NOTICE '';
  RAISE NOTICE 'Nouvelles colonnes :';
  RAISE NOTICE '  ✓ sondages: depth_m_min, depth_m_max, operator';
  RAISE NOTICE '  ✓ essais_geotechniques: cg, cg_qual, class_*, type_sol, vbs_qual';
  RAISE NOTICE '';
  RAISE NOTICE 'Trigger automatique :';
  RAISE NOTICE '  ✓ depth_min/max mis à jour à chaque INSERT/UPDATE/DELETE sur echantillons';
  RAISE NOTICE '';
  RAISE NOTICE 'Prêt pour import AMESSEFE !';
  RAISE NOTICE '============================================================================';
END $$;

COMMIT;
