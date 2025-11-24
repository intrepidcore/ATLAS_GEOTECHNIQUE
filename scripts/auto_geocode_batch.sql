-- Script one-shot pour auto-géocoder tous les sondages existants
-- Usage: psql -d atlas -f auto_geocode_batch.sql

\echo 'Starting auto-geocode batch for existing surveys...'

-- 1. Afficher les statistiques avant
\echo 'Statistics BEFORE auto-geocoding:'
SELECT 
  COUNT(*) as total_surveys,
  COUNT(*) FILTER (WHERE is_geocoded = true) as geocoded,
  COUNT(*) FILTER (WHERE is_geocoded = false) as not_geocoded,
  COUNT(*) FILTER (WHERE location_mode = 'unknown') as unknown_mode
FROM sondages;

-- 2. Afficher les suggestions disponibles
\echo 'Available suggestions:'
SELECT 
  COUNT(*) as total_suggestions,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE top_score >= 90) as high_score_90,
  COUNT(*) FILTER (WHERE top_score >= 80) as high_score_80,
  AVG(top_score) as avg_score
FROM geocode_suggestions 
WHERE status = 'pending';

-- 3. Exécuter l'auto-géocodage avec seuil 85%
\echo 'Running auto-geocode with threshold 85%...'
SELECT run_auto_geocode_batch(85.0);

-- 4. Afficher les statistiques après
\echo 'Statistics AFTER auto-geocoding:'
SELECT 
  COUNT(*) as total_surveys,
  COUNT(*) FILTER (WHERE is_geocoded = true) as geocoded,
  COUNT(*) FILTER (WHERE is_geocoded = false) as not_geocoded,
  COUNT(*) FILTER (WHERE location_mode = 'adm_random_cell') as auto_geocoded
FROM sondages;

-- 5. Afficher les suggestions traitées
\echo 'Suggestions processed:'
SELECT 
  COUNT(*) as total_suggestions,
  COUNT(*) FILTER (WHERE status = 'pending') as still_pending,
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected
FROM geocode_suggestions;

-- 6. Afficher les dernières mises à jour
\echo 'Recent auto-geocoded surveys:'
SELECT 
  code,
  localite,
  location_mode,
  adm3_name,
  updated_at
FROM sondages 
WHERE location_mode = 'adm_random_cell'
  AND updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 10;

\echo 'Auto-geocode batch completed!'
