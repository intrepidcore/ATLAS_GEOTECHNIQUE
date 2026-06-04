-- Migration 103 : Marquage des sondages avec coordonnée fallback POINT(1 8.6)
-- Contexte : 187 sondages importés par V10_MASTER_2026 ont reçu le centroïde
--            du canton Kaniamboua (POINT(1.0, 8.6)) comme coordonnée par défaut.
--            Ce n'est pas une vraie localisation terrain.
-- Impact   : Ces sondages concentrent artificiellement dans la maille TG-0672-0197-01
-- Date     : 2026-06-04
-- Ref      : AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md — Phase 1

BEGIN;

-- Étape 1 : Marquer les sondages avec coordonnée fallback connue
-- Note : is_geocoded est une colonne GENERATED (geom IS NOT NULL OR adm3_id IS NOT NULL)
--        → ne peut pas être mise à jour directement
UPDATE atlas.sondages
SET
    location_mode    = 'fallback_default',
    notes            = COALESCE(notes || E'\n', '') ||
                       '[AUDIT-2026-06-04] geom=POINT(1 8.6) identifiée comme centroïde ADM fallback V10. Nécessite re-géocodage.'
WHERE geom = ST_SetSRID(ST_MakePoint(1, 8.6), 4326)
  AND deleted_at IS NULL;

-- Vérification
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM atlas.sondages
    WHERE location_mode = 'fallback_default' AND deleted_at IS NULL;

    RAISE NOTICE 'Sondages marqués fallback_default : %', v_count;

    IF v_count = 0 THEN
        RAISE EXCEPTION 'Aucun sondage marqué — vérifier que POINT(1 8.6) existe bien';
    END IF;
END;
$$;

-- Étape 2 : Rafraîchir la MV pour refléter le marquage
-- (les sondages fallback_default ne sont plus comptés dans la vue corrigée
--  car location_mode n'est pas dans les modes valides du CTE)
REFRESH MATERIALIZED VIEW atlas.mv_mailles_geotech;

COMMIT;
