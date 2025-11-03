-- ============================================================================
-- MIGRATION: Taguer les mailles avec les noms ADM1/ADM2/ADM3
-- ============================================================================
-- Objectif: Éviter les ST_Intersects à chaque requête thématique
-- Performance: Index sur les colonnes ADM pour filtres rapides
-- ============================================================================

BEGIN;

-- 1. Ajouter les colonnes ADM si absentes
ALTER TABLE mailles ADD COLUMN IF NOT EXISTS adm1_name text;
ALTER TABLE mailles ADD COLUMN IF NOT EXISTS adm2_name text;
ALTER TABLE mailles ADD COLUMN IF NOT EXISTS adm3_name text;

-- 2. Vérifier l'existence des tables admin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'adm1') THEN
    RAISE NOTICE '⚠️  Table adm1 non trouvée - étiquetage ADM1 ignoré';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'adm2') THEN
    RAISE NOTICE '⚠️  Table adm2 non trouvée - étiquetage ADM2 ignoré';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'adm3') THEN
    RAISE NOTICE '⚠️  Table adm3 non trouvée - étiquetage ADM3 ignoré';
  END IF;
END $$;

-- 3. Étiquetage ADM1 (Régions)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'adm1') THEN
    UPDATE mailles m
    SET adm1_name = a.name
    FROM adm1 a
    WHERE ST_Intersects(m.geom, a.geom);
    
    RAISE NOTICE '✅ Mailles étiquetées avec ADM1';
  END IF;
END $$;

-- 4. Étiquetage ADM2 (Préfectures)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'adm2') THEN
    UPDATE mailles m
    SET adm2_name = a.name
    FROM adm2 a
    WHERE ST_Intersects(m.geom, a.geom);
    
    RAISE NOTICE '✅ Mailles étiquetées avec ADM2';
  END IF;
END $$;

-- 5. Étiquetage ADM3 (Communes)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'adm3') THEN
    UPDATE mailles m
    SET adm3_name = a.name
    FROM adm3 a
    WHERE ST_Intersects(m.geom, a.geom);
    
    RAISE NOTICE '✅ Mailles étiquetées avec ADM3';
  END IF;
END $$;

-- 6. Créer les index pour filtres rapides
CREATE INDEX IF NOT EXISTS idx_mailles_adm1 ON mailles(adm1_name) WHERE adm1_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mailles_adm2 ON mailles(adm2_name) WHERE adm2_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mailles_adm3 ON mailles(adm3_name) WHERE adm3_name IS NOT NULL;

-- 7. Statistiques post-migration
SELECT 
  COUNT(*) as total_mailles,
  COUNT(adm1_name) as avec_adm1,
  COUNT(adm2_name) as avec_adm2,
  COUNT(adm3_name) as avec_adm3
FROM mailles;

-- 8. Exemples de mailles étiquetées
SELECT code, adm1_name, adm2_name, adm3_name
FROM mailles
WHERE adm1_name IS NOT NULL
LIMIT 5;

COMMIT;

-- ============================================================================
-- VÉRIFICATIONS POST-MIGRATION
-- ============================================================================

-- Compter les mailles par région
SELECT adm1_name, COUNT(*) as n_mailles
FROM mailles
WHERE adm1_name IS NOT NULL
GROUP BY adm1_name
ORDER BY n_mailles DESC;

-- Compter les mailles par préfecture (top 10)
SELECT adm2_name, COUNT(*) as n_mailles
FROM mailles
WHERE adm2_name IS NOT NULL
GROUP BY adm2_name
ORDER BY n_mailles DESC
LIMIT 10;
