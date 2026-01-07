-- Migration 099: Créer table mailles_28km et vues de couverture complètes
-- Implémente grille 28km avec couleurs unifiées et clipping frontière

BEGIN;

-- ============================================================================
-- 1. Créer table mailles_28km si elle n'existe pas
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlas.mailles_28km (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    geom geometry(Polygon, 25231) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mailles_28km_geom ON atlas.mailles_28km USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_mailles_28km_code ON atlas.mailles_28km(code);

COMMENT ON TABLE atlas.mailles_28km IS 'Grille 28km (profils régionaux) pour vue macro du territoire';

-- ============================================================================
-- 2. Générer la grille 28km si vide
-- ============================================================================

DO $$
DECLARE
    v_count int;
BEGIN
    SELECT COUNT(*) INTO v_count FROM atlas.mailles_28km;
    
    IF v_count = 0 THEN
        -- Générer grille 28km à partir de l'emprise des mailles 2km
        WITH extent AS (
            SELECT ST_Extent(geom) AS bbox FROM atlas.mailles
        ),
        grid AS (
            SELECT 
                row_number() OVER () AS id,
                cell.geom
            FROM extent,
            LATERAL ST_CreateFishnet(
                14,  -- nrows (28km ≈ 14 x 2km)
                14,  -- ncols
                28000, 28000,  -- cell width/height en mètres
                (ST_XMin(bbox))::numeric,
                (ST_YMin(bbox))::numeric
            ) AS cell(geom)
        )
        INSERT INTO atlas.mailles_28km (code, geom)
        SELECT 
            'M28-' || LPAD(id::text, 3, '0') AS code,
            geom
        FROM grid
        WHERE ST_Intersects(
            geom,
            (SELECT ST_Union(geom) FROM atlas.mailles)
        );
        
        RAISE NOTICE '✓ Grille 28km générée: % mailles', (SELECT COUNT(*) FROM atlas.mailles_28km);
    END IF;
END $$;

-- ============================================================================
-- 3. Clipper mailles 28km à la frontière du Togo
-- ============================================================================

DO $$
DECLARE
    v_updated int;
BEGIN
    -- Vérifier si ADM0 existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'atlas' AND table_name = 'adm0') THEN
        -- Clipper les mailles à la frontière
        WITH togo_boundary AS (
            SELECT ST_Union(geom) AS geom 
            FROM atlas.adm0 
            WHERE country_code = 'TG' OR name_0 ILIKE '%Togo%'
            LIMIT 1
        )
        UPDATE atlas.mailles_28km m
        SET geom = ST_Intersection(m.geom, tb.geom)
        FROM togo_boundary tb
        WHERE NOT ST_Equals(m.geom, ST_Intersection(m.geom, tb.geom))
          AND ST_Intersects(m.geom, tb.geom);
        
        GET DIAGNOSTICS v_updated = ROW_COUNT;
        RAISE NOTICE '✓ Mailles 28km clippées à la frontière: % mailles modifiées', v_updated;
        
        -- Supprimer mailles vides après clipping
        DELETE FROM atlas.mailles_28km WHERE ST_IsEmpty(geom) OR ST_Area(geom) < 1000;
    ELSE
        RAISE NOTICE '⚠ Table adm0 non trouvée, clipping frontière ignoré';
    END IF;
END $$;

-- ============================================================================
-- 4. Lier sondages aux mailles 28km
-- ============================================================================

-- Ajouter colonne id_m28 si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'atlas' AND table_name = 'sondages' AND column_name = 'id_m28'
    ) THEN
        ALTER TABLE atlas.sondages ADD COLUMN id_m28 INTEGER REFERENCES atlas.mailles_28km(id);
        CREATE INDEX idx_sondages_id_m28 ON atlas.sondages(id_m28);
    END IF;
END $$;

-- Mettre à jour les liens sondages -> mailles 28km
UPDATE atlas.sondages s
SET id_m28 = m28.id
FROM atlas.mailles_28km m28
WHERE s.geom IS NOT NULL
  AND ST_Intersects(s.geom, m28.geom)
  AND s.id_m28 IS NULL;

-- ============================================================================
-- 5. Vue de couverture 28km avec compteurs exact/random
-- ============================================================================

CREATE OR REPLACE VIEW atlas.v_coverage_mailles_28km AS
SELECT 
    m28.id,
    m28.code,
    ST_Transform(m28.geom, 4326) AS geom,
    COALESCE(stats.n_sondages, 0) AS n_sondages,
    COALESCE(stats.n_sondages_exact, 0) AS n_sondages_exact,
    COALESCE(stats.n_sondages_random, 0) AS n_sondages_random,
    COALESCE(stats.n_echantillons, 0) AS n_echantillons,
    COALESCE(stats.n_mailles_2km, 0) AS n_mailles_2km,
    COALESCE(stats.n_mailles_2km_with_data, 0) AS n_mailles_2km_with_data
FROM atlas.mailles_28km m28
LEFT JOIN (
    SELECT 
        s.id_m28,
        COUNT(DISTINCT s.id) AS n_sondages,
        SUM(CASE WHEN s.location_mode = 'exact' THEN 1 ELSE 0 END) AS n_sondages_exact,
        SUM(CASE WHEN s.location_mode IN ('adm_random_cell', 'adm_spread') THEN 1 ELSE 0 END) AS n_sondages_random,
        COUNT(DISTINCT e.id) AS n_echantillons,
        COUNT(DISTINCT s.maille_code) AS n_mailles_2km,
        COUNT(DISTINCT CASE WHEN s.maille_code IS NOT NULL THEN s.maille_code END) AS n_mailles_2km_with_data
    FROM atlas.sondages s
    LEFT JOIN atlas.echantillons e ON e.sondage_id = s.id
    WHERE s.id_m28 IS NOT NULL
    GROUP BY s.id_m28
) stats ON stats.id_m28 = m28.id;

COMMENT ON VIEW atlas.v_coverage_mailles_28km IS 
'Vue de couverture des mailles 28km avec compteurs exact/random pour couleurs unifiées';

-- ============================================================================
-- 6. Vérification et statistiques
-- ============================================================================

DO $$
DECLARE
    v_total_28km int;
    v_with_data int;
    v_total_2km int;
    v_with_exact int;
    v_with_random int;
BEGIN
    -- Stats 28km
    SELECT COUNT(*) INTO v_total_28km FROM atlas.mailles_28km;
    SELECT COUNT(*) INTO v_with_data FROM atlas.v_coverage_mailles_28km WHERE n_sondages > 0;
    
    RAISE NOTICE '✓ Migration 099 terminée';
    RAISE NOTICE '  Mailles 28km total: %', v_total_28km;
    RAISE NOTICE '  Mailles 28km avec données: % (%.1f%%)', 
        v_with_data, 
        CASE WHEN v_total_28km > 0 THEN (v_with_data::float / v_total_28km * 100) ELSE 0 END;
    
    -- Stats 2km
    SELECT COUNT(*) INTO v_total_2km FROM atlas.v_coverage_mailles_2km WHERE n_sondages > 0;
    SELECT COUNT(*) INTO v_with_exact FROM atlas.v_coverage_mailles_2km WHERE n_sondages_exact > 0;
    SELECT COUNT(*) INTO v_with_random FROM atlas.v_coverage_mailles_2km WHERE n_sondages_random > 0;
    
    RAISE NOTICE '  Mailles 2km avec données: %', v_total_2km;
    RAISE NOTICE '  Avec sondages exact: %', v_with_exact;
    RAISE NOTICE '  Avec sondages random: %', v_with_random;
END $$;

COMMIT;
