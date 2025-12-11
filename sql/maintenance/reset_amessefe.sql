-- ============================================================================
-- RESET AMESSEFE - Suppression propre des données AMESSEFE
-- ============================================================================
-- Ce script supprime toutes les données de la source "AMESSEFE Komi Yoan Freddy"
-- dans le bon ordre (enfants → parents) pour respecter les contraintes FK.
--
-- Usage:
--   docker exec -i atlas-db psql -U atlas atlas_clean -f /tmp/reset_amessefe.sql
--
-- ATTENTION: Faire un backup avant d'exécuter !
--   docker exec atlas-db pg_dump -Fc -U atlas atlas_clean -f /tmp/backup_before_reset.dump
-- ============================================================================

BEGIN;

DO $$ 
DECLARE
    v_source TEXT := 'AMESSEFE Komi Yoan Freddy';
    v_count INTEGER;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'RESET AMESSEFE - Début de la suppression';
    RAISE NOTICE 'Source: %', v_source;
    RAISE NOTICE '============================================================';

    -- 1) Supprimer les essais VBS
    DELETE FROM essais_vbs ev
    USING echantillons e, sondages s
    WHERE ev.echantillon_id = e.id
      AND e.sondage_id = s.id
      AND s.source = v_source;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✓ essais_vbs: % lignes supprimées', v_count;

    -- 2) Supprimer les essais de classification
    DELETE FROM essais_classif ec
    USING echantillons e, sondages s
    WHERE ec.echantillon_id = e.id
      AND e.sondage_id = s.id
      AND s.source = v_source;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✓ essais_classif: % lignes supprimées', v_count;

    -- 3) Supprimer les essais de potentiel de gonflement
    DELETE FROM essais_potentiel_gonflement eg
    USING echantillons e, sondages s
    WHERE eg.echantillon_id = e.id
      AND e.sondage_id = s.id
      AND s.source = v_source;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✓ essais_potentiel_gonflement: % lignes supprimées', v_count;

    -- 4) Supprimer les points de granulométrie
    DELETE FROM granulo_points gp
    USING echantillons e, sondages s
    WHERE gp.echantillon_id = e.id
      AND e.sondage_id = s.id
      AND s.source = v_source;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✓ granulo_points: % lignes supprimées', v_count;

    -- 5) Supprimer les essais limites (si la table existe)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'essais_limites') THEN
        DELETE FROM essais_limites el
        USING echantillons e, sondages s
        WHERE el.echantillon_id = e.id
          AND e.sondage_id = s.id
          AND s.source = v_source;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE '  ✓ essais_limites: % lignes supprimées', v_count;
    ELSE
        RAISE NOTICE '  ⚠ essais_limites: table inexistante, ignorée';
    END IF;

    -- 6) Supprimer les essais géotechniques (table legacy)
    DELETE FROM essais_geotechniques eg
    USING echantillons e, sondages s
    WHERE eg.echantillon_id = e.id
      AND e.sondage_id = s.id
      AND s.source = v_source;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✓ essais_geotechniques: % lignes supprimées', v_count;

    -- 7) Supprimer les échantillons
    DELETE FROM echantillons e
    USING sondages s
    WHERE e.sondage_id = s.id
      AND s.source = v_source;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✓ echantillons: % lignes supprimées', v_count;

    -- 8) Supprimer les sondages
    DELETE FROM sondages s
    WHERE s.source = v_source;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✓ sondages: % lignes supprimées', v_count;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'RESET AMESSEFE - Terminé avec succès';
    RAISE NOTICE '============================================================';
END $$;

COMMIT;
