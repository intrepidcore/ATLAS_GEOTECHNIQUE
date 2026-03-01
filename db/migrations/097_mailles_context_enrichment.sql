-- Migration 097: Enrichissement des mailles avec contexte géologique/pédologique/gonflement
-- Ajoute les colonnes de contexte dominant pour chaque maille (géologie, pédologie, risque)
-- Ces données alimenteront les tooltips dynamiques dans l'UI

BEGIN;

-- Vue calculant le contexte dominant pour chaque maille
CREATE OR REPLACE VIEW atlas.v_mailles_context AS
WITH geol_intersections AS (
    SELECT
        m.code,
        g.libelle AS geol_unit,
        ST_Area(
            ST_Intersection(m.geom, g.geom)
        ) AS inter_area,
        ROW_NUMBER() OVER (
            PARTITION BY m.code
            ORDER BY ST_Area(ST_Intersection(m.geom, g.geom)) DESC
        ) AS rn
    FROM atlas.mailles m
    JOIN atlas.unites_geologiques g
        ON ST_Intersects(m.geom, g.geom)
    WHERE g.geom IS NOT NULL
),
geol_main AS (
    SELECT code, geol_unit
    FROM geol_intersections
    WHERE rn = 1
),
pedo_intersections AS (
    SELECT
        m.code,
        p.libelle AS pedo_unit,
        ST_Area(
            ST_Intersection(m.geom, p.geom)
        ) AS inter_area,
        ROW_NUMBER() OVER (
            PARTITION BY m.code
            ORDER BY ST_Area(ST_Intersection(m.geom, p.geom)) DESC
        ) AS rn
    FROM atlas.mailles m
    JOIN atlas.unites_pedologiques p
        ON ST_Intersects(m.geom, p.geom)
    WHERE p.geom IS NOT NULL
),
pedo_main AS (
    SELECT code, pedo_unit
    FROM pedo_intersections
    WHERE rn = 1
),
swelling_intersections AS (
    SELECT
        m.code,
        COALESCE(r.niveau_risque, r.risque_gonflement) AS swelling_class,
        ST_Area(
            ST_Intersection(m.geom, r.geom)
        ) AS inter_area,
        ROW_NUMBER() OVER (
            PARTITION BY m.code
            ORDER BY ST_Area(ST_Intersection(m.geom, r.geom)) DESC
        ) AS rn
    FROM atlas.mailles m
    JOIN atlas.risque_gonflement r
        ON ST_Intersects(m.geom, r.geom)
    WHERE r.geom IS NOT NULL
),
swelling_main AS (
    SELECT code, swelling_class
    FROM swelling_intersections
    WHERE rn = 1
)
SELECT
    m.code,
    gm.geol_unit,
    pm.pedo_unit,
    sm.swelling_class
FROM atlas.mailles m
LEFT JOIN geol_main gm USING (code)
LEFT JOIN pedo_main pm USING (code)
LEFT JOIN swelling_main sm USING (code);

COMMENT ON VIEW atlas.v_mailles_context IS 
'Vue calculant le contexte géologique/pédologique/gonflement dominant pour chaque maille 2km';

-- Enrichir la vue API principale avec les données de contexte
CREATE OR REPLACE VIEW atlas.mailles_geotechnique_stats_wgs84 AS
SELECT
    mg.*,
    -- Contexte enrichi
    ctx.geol_unit,
    ctx.pedo_unit,
    ctx.swelling_class
FROM atlas.v_mailles_with_location_counts mg
LEFT JOIN atlas.v_mailles_context ctx ON ctx.code = mg.code;

COMMENT ON VIEW atlas.mailles_geotechnique_stats_wgs84 IS 
'Vue principale pour l''API - mailles 2km avec stats géotechniques + contexte géologique/pédologique/gonflement';

-- Vérification
DO $$
DECLARE
    v_total_mailles int;
    v_with_geol int;
    v_with_pedo int;
    v_with_swelling int;
BEGIN
    SELECT COUNT(*) INTO v_total_mailles FROM atlas.mailles;
    SELECT COUNT(*) INTO v_with_geol FROM atlas.v_mailles_context WHERE geol_unit IS NOT NULL;
    SELECT COUNT(*) INTO v_with_pedo FROM atlas.v_mailles_context WHERE pedo_unit IS NOT NULL;
    SELECT COUNT(*) INTO v_with_swelling FROM atlas.v_mailles_context WHERE swelling_class IS NOT NULL;
    
    RAISE NOTICE '✓ Migration 097 terminée';
    RAISE NOTICE '  Total mailles: %', v_total_mailles;
    RAISE NOTICE '  Avec géologie: % (%.1f%%)', v_with_geol, (v_with_geol::float / v_total_mailles * 100);
    RAISE NOTICE '  Avec pédologie: % (%.1f%%)', v_with_pedo, (v_with_pedo::float / v_total_mailles * 100);
    RAISE NOTICE '  Avec risque gonflement: % (%.1f%%)', v_with_swelling, (v_with_swelling::float / v_total_mailles * 100);
END $$;

COMMIT;
