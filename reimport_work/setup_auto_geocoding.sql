-- ============================================================================
-- TRIGGER AUTO-GÉOCODAGE
-- ============================================================================

\echo '⚡ Installation du trigger auto-géocodage...'

-- Fonction de géocodage automatique
CREATE OR REPLACE FUNCTION auto_geocode_sondage()
RETURNS TRIGGER AS $$
BEGIN
  -- Seulement si pas de géométrie
  IF NEW.geom IS NULL THEN
    -- Si adm3_id présent, essayer centroïde
    IF NEW.adm3_id IS NOT NULL THEN
      BEGIN
        -- Utiliser fonction existante get_adm_centroid
        SELECT geom INTO NEW.geom 
        FROM adm3 
        WHERE gid = NEW.adm3_id;
        
        IF NEW.geom IS NOT NULL THEN
          NEW.location_mode := COALESCE(NEW.location_mode, 'centroid');
          RAISE NOTICE 'Géocodage ADM3 réussi pour sondage %', NEW.id;
        END IF;
        
      EXCEPTION WHEN others THEN
        -- En cas d'erreur, marquer comme unknown
        NEW.location_mode := COALESCE(NEW.location_mode, 'unknown');
        RAISE NOTICE 'Géocodage ADM3 échoué pour sondage %: %', NEW.id, SQLERRM;
      END;
    ELSE
      -- Pas d'ADM3, marquer comme unknown
      NEW.location_mode := COALESCE(NEW.location_mode, 'unknown');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer trigger existant s'il existe
DROP TRIGGER IF EXISTS trigger_auto_geocode ON public.sondages;

-- Créer nouveau trigger
CREATE TRIGGER trigger_auto_geocode
  BEFORE INSERT OR UPDATE ON public.sondages
  FOR EACH ROW 
  EXECUTE FUNCTION auto_geocode_sondage();

\echo '✅ Trigger installé'

-- Test du trigger sur données existantes
\echo '🔄 Application du géocodage sur données existantes...'

-- Forcer UPDATE pour déclencher le trigger
UPDATE public.sondages 
SET updated_at = now() 
WHERE geom IS NULL AND adm3_id IS NOT NULL;

-- Statistiques post-géocodage
\echo '📊 Statistiques après géocodage:'

SELECT 
    'APRÈS TRIGGER' as phase,
    COUNT(*) as total,
    COUNT(geom) as with_geom,
    COUNT(adm3_id) as with_adm3,
    COUNT(*) FILTER (WHERE is_geocoded) as auto_geocoded
FROM public.sondages;

SELECT 
    location_mode, 
    COUNT(*) as count,
    COUNT(geom) as with_geom,
    ROUND(100.0 * COUNT(geom) / COUNT(*), 1) as pct_geocoded
FROM public.sondages 
GROUP BY location_mode 
ORDER BY count DESC;

\echo '🎯 Auto-géocodage configuré et appliqué';
