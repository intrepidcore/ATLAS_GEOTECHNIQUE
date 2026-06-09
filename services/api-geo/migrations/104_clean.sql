BEGIN;

CREATE OR REPLACE FUNCTION atlas.geocode_sondage(p_sondage_id uuid)
RETURNS void LANGUAGE plpgsql AS $func$
DECLARE
    v_geom             geometry(Point, 4326);
    v_geom_25231       geometry(Point, 25231);
    v_maille_code      text;
    v_adm3_id          integer;
    v_adm1_name        text;
    v_adm2_name        text;
    v_adm3_name        text;
    v_current_loc_mode text;
    v_loc_accuracy     numeric;
    v_new_loc_mode     text;
BEGIN
    SELECT geom, location_mode, location_accuracy_m
    INTO v_geom, v_current_loc_mode, v_loc_accuracy
    FROM atlas.sondages WHERE id = p_sondage_id;

    IF v_geom IS NULL THEN RETURN; END IF;
    IF v_current_loc_mode = 'fallback_default' THEN RETURN; END IF;

    v_geom_25231 := ST_Transform(v_geom, 25231);

    SELECT m.code INTO v_maille_code
    FROM atlas.mailles m
    WHERE ST_Contains(m.geom, v_geom_25231)
    LIMIT 1;

    SELECT a.gid, a.adm1_fr, a.adm2_fr, a.adm3_fr
    INTO v_adm3_id, v_adm1_name, v_adm2_name, v_adm3_name
    FROM atlas.adm3 a
    WHERE ST_Contains(a.geom, v_geom)
    LIMIT 1;

    IF v_current_loc_mode IN ('exact', 'gps', 'manual', 'inferred', 'adm_random_cell') THEN
        v_new_loc_mode := v_current_loc_mode;
    ELSIF v_loc_accuracy IS NOT NULL AND v_loc_accuracy < 10 THEN
        v_new_loc_mode := 'exact';
    ELSIF v_loc_accuracy IS NOT NULL AND v_loc_accuracy < 100 THEN
        v_new_loc_mode := 'gps';
    ELSE
        v_new_loc_mode := 'geocoded';
    END IF;

    UPDATE atlas.sondages SET
        maille_code   = COALESCE(v_maille_code, maille_code),
        adm3_id       = COALESCE(v_adm3_id::integer, adm3_id),
        adm1_name     = COALESCE(v_adm1_name, adm1_name),
        adm2_name     = COALESCE(v_adm2_name, adm2_name),
        adm3_name     = COALESCE(v_adm3_name, adm3_name),
        location_mode = v_new_loc_mode,
        updated_at    = NOW()
    WHERE id = p_sondage_id;
END;
$func$;

UPDATE atlas.sondages
SET location_mode = 'geocoded'
WHERE location_mode IS NULL
  AND deleted_at IS NULL
  AND geom IS NOT NULL
  AND geom != ST_SetSRID(ST_MakePoint(1, 8.6), 4326);

COMMIT;