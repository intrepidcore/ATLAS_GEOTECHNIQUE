-- Migration: Backfill localite depuis code
-- Date: 2025-11-06
-- Objectif: Remplir le champ localite pour les 176 sondages qui ont localite=NULL

-- Backfill
UPDATE sondages
SET localite = extract_localite(code)
WHERE localite IS NULL 
  AND code IS NOT NULL
  AND deleted_at IS NULL;

-- Vérifier résultats
SELECT 
  COUNT(*) as total_sondages,
  COUNT(*) FILTER (WHERE localite IS NOT NULL) as avec_localite,
  COUNT(*) FILTER (WHERE localite IS NULL) as sans_localite,
  ROUND(100.0 * COUNT(*) FILTER (WHERE localite IS NOT NULL) / COUNT(*), 1) as pct_avec_localite
FROM sondages
WHERE deleted_at IS NULL;
