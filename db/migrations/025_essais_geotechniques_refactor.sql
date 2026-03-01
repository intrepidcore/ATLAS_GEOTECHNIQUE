-- ============================================================================
-- Migration 025: Refactor essais_geotechniques - Lien direct avec échantillons
-- Date: 2025-11-18
-- Description: 
--   - Ajouter echantillon_id comme clé primaire logique
--   - Contrainte unique sur echantillon_id (1 essai = 1 échantillon)
--   - Fixer depth_m à NUMERIC(6,3) partout pour cohérence
--   - Vue de contrôle pour audit
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FIXER LA PRÉCISION DE depth_m PARTOUT
-- ============================================================================

-- echantillons
ALTER TABLE echantillons
  ALTER COLUMN depth_m TYPE numeric(6,3)
  USING round(depth_m::numeric, 3);

-- essais_geotechniques
ALTER TABLE essais_geotechniques
  ALTER COLUMN depth_m TYPE numeric(6,3)
  USING round(depth_m::numeric, 3);

-- raw tables
ALTER TABLE raw_lab_agt
  ALTER COLUMN depth_m TYPE numeric(6,3)
  USING round(depth_m::numeric, 3);

ALTER TABLE raw_lab_ags
  ALTER COLUMN depth_m TYPE numeric(6,3)
  USING round(depth_m::numeric, 3);

ALTER TABLE raw_lab_atterberg
  ALTER COLUMN depth_m TYPE numeric(6,3)
  USING round(depth_m::numeric, 3);

DO $$ BEGIN
  RAISE NOTICE '✓ Précision depth_m fixée à NUMERIC(6,3) partout';
END $$;

-- ============================================================================
-- 2. AJOUTER echantillon_id À essais_geotechniques
-- ============================================================================

-- Ajouter la colonne
ALTER TABLE essais_geotechniques
  ADD COLUMN IF NOT EXISTS echantillon_id UUID REFERENCES echantillons(id) ON DELETE CASCADE;

-- Remplir echantillon_id pour les lignes existantes (si il y en a)
UPDATE essais_geotechniques eg
SET echantillon_id = e.id
FROM echantillons e
WHERE eg.sondage_id = e.sondage_id 
  AND round(eg.depth_m::numeric, 3) = round(e.depth_m::numeric, 3)
  AND eg.echantillon_id IS NULL;

DO $$ BEGIN
  RAISE NOTICE '✓ Colonne echantillon_id ajoutée et remplie';
END $$;

-- ============================================================================
-- 3. CONTRAINTE UNIQUE SUR echantillon_id
-- ============================================================================

-- Supprimer l'ancienne contrainte unique si elle existe
ALTER TABLE essais_geotechniques
  DROP CONSTRAINT IF EXISTS essais_geotechniques_sondage_depth_unique;

-- Ajouter la nouvelle contrainte unique sur echantillon_id
ALTER TABLE essais_geotechniques
  ADD CONSTRAINT essais_geotechniques_echantillon_unique 
  UNIQUE (echantillon_id);

DO $$ BEGIN
  RAISE NOTICE '✓ Contrainte unique sur echantillon_id créée';
END $$;

-- ============================================================================
-- 4. INDEX POUR PERFORMANCES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_essais_geo_echantillon
  ON essais_geotechniques(echantillon_id);

CREATE INDEX IF NOT EXISTS idx_essais_geo_sondage_depth
  ON essais_geotechniques(sondage_id, depth_m);

DO $$ BEGIN
  RAISE NOTICE '✓ Index créés';
END $$;

-- ============================================================================
-- 5. VUE DE CONTRÔLE POUR AUDIT
-- ============================================================================

CREATE OR REPLACE VIEW atlas.v_echantillons_essais AS
SELECT
  s.meta->>'code'      AS code_site,
  s.meta->>'localite'  AS localite,
  e.depth_m,
  e.id                 AS echantillon_id,
  eg.id                AS essai_id,
  -- Atterberg
  eg.wl, eg.wp, eg.ip,
  -- VBS
  eg.vbs,
  -- Physiques
  e.water_content_w    AS w_nat,
  e.rho_s_gcm3,
  -- Proctor
  eg.gamma_d_max, eg.w_opt, eg.proctor_type,
  -- Granulo
  eg.passant_80um, eg.passant_2mm, eg.passant_20mm,
  -- Métadonnées
  e.date               AS test_date,
  e.laboratory,
  e.created_at,
  eg.created_at        AS essai_created_at
FROM echantillons e
JOIN sondages s ON e.sondage_id = s.id
LEFT JOIN essais_geotechniques eg ON eg.echantillon_id = e.id
ORDER BY s.meta->>'code', e.depth_m;

COMMENT ON VIEW atlas.v_echantillons_essais IS 
'Vue de contrôle : échantillons avec leurs essais géotechniques. 
Si essai_id est NULL, l''échantillon n''a pas encore d''essai consolidé.';

DO $$ BEGIN
  RAISE NOTICE '✓ Vue atlas.v_echantillons_essais créée';
END $$;

-- ============================================================================
-- 6. COMMENTAIRES SUR LES COLONNES
-- ============================================================================

COMMENT ON COLUMN essais_geotechniques.echantillon_id IS 
'[CANONICAL] Lien direct vers l''échantillon. 1 essai = 1 échantillon.';

COMMENT ON COLUMN essais_geotechniques.sondage_id IS 
'[LEGACY] Conservé pour compatibilité. Utiliser echantillon_id à la place.';

COMMENT ON COLUMN essais_geotechniques.depth_m IS 
'[LEGACY] Conservé pour compatibilité. Utiliser echantillon.depth_m via echantillon_id.';

-- ============================================================================
-- 7. STATISTIQUES FINALES
-- ============================================================================

DO $$
DECLARE
  v_count_echantillons INTEGER;
  v_count_essais INTEGER;
  v_count_linked INTEGER;
  v_count_orphan INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count_echantillons FROM echantillons;
  SELECT COUNT(*) INTO v_count_essais FROM essais_geotechniques;
  SELECT COUNT(*) INTO v_count_linked 
    FROM essais_geotechniques WHERE echantillon_id IS NOT NULL;
  SELECT COUNT(*) INTO v_count_orphan 
    FROM echantillons e 
    WHERE NOT EXISTS (
      SELECT 1 FROM essais_geotechniques eg WHERE eg.echantillon_id = e.id
    );
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration 025 terminée avec succès';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '  Échantillons totaux           : %', v_count_echantillons;
  RAISE NOTICE '  Essais géotechniques totaux   : %', v_count_essais;
  RAISE NOTICE '  Essais liés à un échantillon  : %', v_count_linked;
  RAISE NOTICE '  Échantillons sans essai       : %', v_count_orphan;
  RAISE NOTICE '';
  RAISE NOTICE 'Structure refactorée :';
  RAISE NOTICE '  ✓ depth_m fixé à NUMERIC(6,3)';
  RAISE NOTICE '  ✓ echantillon_id ajouté avec contrainte unique';
  RAISE NOTICE '  ✓ Index créés pour performances';
  RAISE NOTICE '  ✓ Vue de contrôle atlas.v_echantillons_essais disponible';
  RAISE NOTICE '';
  RAISE NOTICE 'Les imports peuvent maintenant utiliser echantillon_id directement.';
  RAISE NOTICE '============================================================================';
END $$;

COMMIT;
