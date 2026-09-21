-- Migration: Recalculer is_geocoded dans sondages
-- Date: 2025-11-06
-- Objectif: Remplacer is_geocoded par une colonne générée

-- Supprimer ancienne colonne (CASCADE car vues dépendent)
ALTER TABLE sondages DROP COLUMN IF EXISTS is_geocoded CASCADE;

-- Ajouter colonne générée
ALTER TABLE sondages 
  ADD COLUMN is_geocoded BOOLEAN 
    GENERATED ALWAYS AS (geom IS NOT NULL OR adm3_id IS NOT NULL) STORED;

-- Recréer vues dépendantes (si nécessaire)
-- Note: Les vues matérialisées doivent être refresh après

-- Créer index
CREATE INDEX IF NOT EXISTS idx_sondages_is_geocoded_v2 
  ON sondages (is_geocoded) 
  WHERE deleted_at IS NULL;

-- Vérifier résultats
SELECT 
  COUNT(*) as total_sondages,
  COUNT(*) FILTER (WHERE is_geocoded) as geocodes,
  COUNT(*) FILTER (WHERE NOT is_geocoded) as non_geocodes,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_geocoded) / COUNT(*), 1) as pct_geocodes
FROM sondages
WHERE deleted_at IS NULL;
