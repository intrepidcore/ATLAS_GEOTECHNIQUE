-- Migration 104 : Fix atlas.geocode_sondage() — ajoute la mise à jour de location_mode
-- Problème : la fonction géocode correctement (maille_code, adm3_id, etc.) mais
--            ne met JAMAIS à jour location_mode. Résultat : 370 sondages avec
--            location_mode = NULL même s'ils ont des coordonnées réelles.
-- Date : 2026-06-04
-- Ref  : AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md — Phase 3 / Bug #2

BEGIN;

CREATE OR REPLACE FUNCTION atlas.geocode_sondage(p_sondage_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_geom              geometry(Point, 4326);
    v_geom_25231        geometry(Point, 25231);
    v_maille_code       text;
    v_adm3_id           integer;
    v_adm1_name         text;
    v_adm2_name         text;
    v_adm3_name         text;
    v_current_loc_mode  text;
    v_loc_accuracy      numeric;
BEGIN
    -- Récupère la géométrie et le mode de localisation actuels
    SELECT geom, location_mode, location_accuracy_m
    INTO v_geom, v_current_loc_mode, v_loc_accuracy
    FROM atlas.sondages
    WHERE id = p_sondage_id;

    IF v_geom IS NULL THEN
        RETURN;
    END IF;

    -- Ne pas re-géocoder si le fallback est déjà marqué
    -- (évite d'écraser une correction manuelle en cours)
    IF v_current_loc_mode = 'fallback_default' THEN
        RETURN;
    END IF;

    -- Transformer en SRID 25231 (UTM fuseau Togo)
    v_geom_25231 := ST_Transform(v_geom, 25231);

    -- Trouver la maille par point-in-polygon
    SELECT m.code INTO v_maille_code
    FROM atlas.mailles m
    WHERE ST_Contains(m.geom, v_geom_25231)
    LIMIT 1;

    -- Trouver l'ADM3 par point-in-polygon (SRID 4326)
    SELECT a.gid, a.adm1_fr, a.adm2_fr, a.adm3_fr
    INTO v_adm3_id, v_adm1_name, v_adm2_name, v_adm3_name
    FROM atlas.adm3 a
    WHERE ST_Contains(a.geom, v_geom)
    LIMIT 1;

    -- Déterminer le location_mode selon la précision / état actuel
    -- Règle :
    --   Si location_mode est déjà un mode "fort" (exact/gps/manual/inferred), le conserver.
    --   Si location_mode est NULL ou 'geocoded', classifier selon la précision.
    --   Ne JAMAIS écraser adm_random_cell (règle de verrouillage, AUDIT §4.3).
    DECLARE
        v_new_loc_mode text;
    BEGIN
        IF v_current_loc_mode IN ('exact', 'gps', 'manual', 'inferred') THEN
            v_new_loc_mode := v_current_loc_mode;   -- conserver le mode fort
        ELSIF v_current_loc_mode = 'adm_random_cell' THEN
            v_new_loc_mode := 'adm_random_cell';    -- verrouillé, ne pas modifier
        ELSIF v_loc_accuracy IS NOT NULL AND v_loc_accuracy < 10 THEN
            v_new_loc_mode := 'exact';
        ELSIF v_loc_accuracy IS NOT NULL AND v_loc_accuracy < 100 THEN
            v_new_loc_mode := 'gps';
        ELSE
            v_new_loc_mode := 'geocoded';           -- mode par défaut (mieux que NULL)
        END IF;

        -- Mise à jour complète : maille + ADM + location_mode
        UPDATE atlas.sondages
        SET
            maille_code  = COALESCE(v_maille_code, maille_code),
            adm3_id      = COALESCE(v_adm3_id::integer, adm3_id),
            adm1_name    = COALESCE(v_adm1_name, adm1_name),
            adm2_name    = COALESCE(v_adm2_name, adm2_name),
            adm3_name    = COALESCE(v_adm3_name, adm3_name),
            location_mode = v_new_loc_mode,         -- ← CORRECTION BUG #2
            updated_at   = NOW()
        WHERE id = p_sondage_id;
    END;
END;
$$;

-- Reclassifier les sondages avec location_mode = NULL qui ont une vraie geom
-- (pas le fallback POINT(1 8.6), déjà traité par migration 103)
UPDATE atlas.sondages
SET location_mode = 'geocoded'
WHERE location_mode IS NULL
  AND deleted_at IS NULL
  AND geom IS NOT NULL
  AND geom != ST_SetSRID(ST_MakePoint(1, 8.6), 4326);

DO $$
DECLARE v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM atlas.sondages
    WHERE location_mode = 'geocoded' AND deleted_at IS NULL;
    RAISE NOTICE 'Sondages classifiés geocoded : %', v_count;
END;
$$;

COMMIT;
