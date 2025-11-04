-- Migration 016: Convertir spread → adm_random_cell
-- Date: 2025-11-03
-- Objectif: Éliminer le mode spread, ancrer chaque sondage sur 1 maille déterministe

BEGIN;

-- 1. Sauvegarde des sondages en mode spread
CREATE TABLE IF NOT EXISTS backup_spread_20251103 AS
SELECT * FROM sondages WHERE location_mode = 'spread';

-- 2. Compter les sondages à migrer
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM sondages WHERE location_mode = 'spread';
    RAISE NOTICE 'Sondages en mode spread à migrer: %', v_count;
END $$;

-- 3. Migration: choisir 1 maille aléatoire par sondage
WITH picked AS (
  SELECT 
    s.id,
    p.cell_code,
    p.cell_centroid
  FROM sondages s
  CROSS JOIN LATERAL pick_random_cell_in_adm3(
    -- Récupérer le code ADM3 (depuis adm3_id ou meta)
    COALESCE(
      (SELECT adm3_pcode FROM adm3 WHERE id = s.adm3_id),
      s.meta->>'adm3_code'
    ),
    -- Seed stable (code ou id)
    COALESCE(s.code, s.id::text)
  ) AS p
  WHERE s.location_mode = 'spread'
    AND (s.adm3_id IS NOT NULL OR s.meta->>'adm3_code' IS NOT NULL)
)
UPDATE sondages AS s
SET 
    grid_code = picked.cell_code,
    geom = ST_Transform(picked.cell_centroid, 25231),
    location_mode = 'adm_random_cell',
    location_accuracy = 'random_adm3',
    updated_at = now()
FROM picked
WHERE s.id = picked.id;

-- 4. Gérer les sondages spread sans ADM (passer en unknown)
UPDATE sondages
SET 
    location_mode = 'unknown',
    location_accuracy = 'no_adm',
    updated_at = now()
WHERE location_mode = 'spread'
  AND adm3_id IS NULL
  AND (meta->>'adm3_code') IS NULL;

-- 5. Vérification
DO $$
DECLARE
    v_remaining INT;
    v_migrated INT;
    v_unknown INT;
BEGIN
    SELECT COUNT(*) INTO v_remaining FROM sondages WHERE location_mode = 'spread';
    SELECT COUNT(*) INTO v_migrated FROM sondages WHERE location_mode = 'adm_random_cell';
    SELECT COUNT(*) INTO v_unknown FROM backup_spread_20251103;
    
    RAISE NOTICE 'Migration terminée:';
    RAISE NOTICE '  - Sondages migrés vers adm_random_cell: %', v_migrated;
    RAISE NOTICE '  - Sondages restants en spread: %', v_remaining;
    RAISE NOTICE '  - Sauvegarde dans backup_spread_20251103: % lignes', v_unknown;
END $$;

COMMIT;
