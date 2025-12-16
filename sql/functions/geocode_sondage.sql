-- ============================================================================
-- FONCTION DE GÉOCODAGE AUTOMATIQUE DES SONDAGES
-- ============================================================================
-- Cette fonction est appelée automatiquement via trigger lors de l'insertion
-- ou la mise à jour d'un sondage avec une géométrie.
--
-- Elle remplit automatiquement :
--   - maille_code : code de la maille géotechnique contenant le point
--   - adm3_id, adm3_name : canton (niveau 3)
--   - adm2_name : préfecture (niveau 2)  
--   - adm1_name : région (niveau 1)
--
-- SRID :
--   - sondages.geom : 4326 (WGS84)
--   - mailles.geom : 25231 (UTM 31N Togo)
--   - adm*_tg.geom : 4326 (WGS84)
-- ============================================================================

-- Fonction principale de géocodage
CREATE OR REPLACE FUNCTION atlas.geocode_sondage(p_sondage_id uuid)
RETURNS void AS $$
DECLARE
    v_geom geometry;
    v_geom_25231 geometry;
    v_maille_code text;
    v_adm1_name text;
    v_adm2_name text;
    v_adm3_id integer;
    v_adm3_name text;
BEGIN
    -- 1) Récupérer la géométrie du sondage
    SELECT geom INTO v_geom
    FROM atlas.sondages
    WHERE id = p_sondage_id AND deleted_at IS NULL;

    -- Si pas de géométrie, on ne fait rien
    IF v_geom IS NULL THEN
        RETURN;
    END IF;

    -- 2) Transformer en SRID 25231 pour les mailles
    v_geom_25231 := ST_Transform(v_geom, 25231);

    -- 3) Trouver la maille (point-in-polygon)
    SELECT m.code INTO v_maille_code
    FROM atlas.mailles m
    WHERE ST_Contains(m.geom, v_geom_25231)
    LIMIT 1;

    -- 4) Trouver ADM3 (canton) - SRID 4326
    SELECT a.id, a.name, a.adm2_name INTO v_adm3_id, v_adm3_name, v_adm2_name
    FROM atlas.adm3_tg a
    WHERE ST_Contains(a.geom, v_geom)
    LIMIT 1;

    -- 5) Trouver ADM1 (région) - SRID 4326
    SELECT a.name INTO v_adm1_name
    FROM atlas.adm1_tg a
    WHERE ST_Contains(a.geom, v_geom)
    LIMIT 1;

    -- 6) Mettre à jour le sondage
    UPDATE atlas.sondages
    SET 
        maille_code = COALESCE(v_maille_code, maille_code),
        adm1_name = COALESCE(v_adm1_name, adm1_name),
        adm2_name = COALESCE(v_adm2_name, adm2_name),
        adm3_id = COALESCE(v_adm3_id, adm3_id),
        adm3_name = COALESCE(v_adm3_name, adm3_name),
        updated_at = now()
    WHERE id = p_sondage_id;

    -- Log (optionnel, pour debug)
    -- RAISE NOTICE 'Geocoded sondage %: maille=%, adm3=%', p_sondage_id, v_maille_code, v_adm3_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atlas.geocode_sondage(uuid) IS 
'Géocode un sondage : trouve la maille et les divisions administratives (ADM1/2/3) contenant le point.';


-- ============================================================================
-- TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION atlas.trg_geocode_sondage()
RETURNS trigger AS $$
BEGIN
    -- Ne géocoder que si la géométrie est présente et a changé
    IF NEW.geom IS NOT NULL THEN
        -- Sur INSERT ou si la géométrie a changé
        IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND 
            (OLD.geom IS NULL OR NOT ST_Equals(OLD.geom, NEW.geom))) THEN
            PERFORM atlas.geocode_sondage(NEW.id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atlas.trg_geocode_sondage() IS 
'Trigger function pour géocoder automatiquement les sondages lors de INSERT/UPDATE.';


-- ============================================================================
-- TRIGGER
-- ============================================================================

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trg_sondage_geocode ON atlas.sondages;

-- Créer le trigger AFTER INSERT OR UPDATE
CREATE TRIGGER trg_sondage_geocode
AFTER INSERT OR UPDATE OF geom
ON atlas.sondages
FOR EACH ROW
EXECUTE FUNCTION atlas.trg_geocode_sondage();

COMMENT ON TRIGGER trg_sondage_geocode ON atlas.sondages IS 
'Géocode automatiquement les sondages lors de l''insertion ou modification de la géométrie.';


-- ============================================================================
-- SCRIPT DE RATTRAPAGE (à exécuter une fois pour l'historique)
-- ============================================================================
-- DO $$
-- DECLARE
--     v_count integer := 0;
--     r RECORD;
-- BEGIN
--     RAISE NOTICE 'Début du rattrapage géocodage...';
--     
--     FOR r IN
--         SELECT id FROM atlas.sondages
--         WHERE geom IS NOT NULL
--           AND deleted_at IS NULL
--           AND (maille_code IS NULL OR adm3_id IS NULL)
--     LOOP
--         PERFORM atlas.geocode_sondage(r.id);
--         v_count := v_count + 1;
--         IF v_count % 100 = 0 THEN
--             RAISE NOTICE 'Géocodés: %', v_count;
--         END IF;
--     END LOOP;
--     
--     RAISE NOTICE 'Rattrapage terminé: % sondages géocodés', v_count;
-- END;
-- $$;
