-- ============================================================================
-- MIGRATION 112 : SERVICE DE RECHERCHE LEGACY (MAPPING V1 -> V2)
-- Objectif : Créer une table de correspondance pré-calculée entre 
--            les anciens codes (legacy) et les nouveaux (V2).
-- ============================================================================

BEGIN;

-- 1. IDENTIFICATION DE LA SOURCE LEGACY
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema='public' AND table_name='mailles_legacy_v1_archive'
    ) THEN
        RAISE EXCEPTION 'La table archive public.mailles_legacy_v1_archive est introuvable. Avez-vous joué la migration 111 ?';
    END IF;
END $$;

-- 2. CRÉATION DE LA VUE MATÉRIALISÉE
DROP MATERIALIZED VIEW IF EXISTS atlas.mv_legacy_mapping CASCADE;

CREATE MATERIALIZED VIEW atlas.mv_legacy_mapping AS
WITH intersection_data AS (
    SELECT 
        old.code AS legacy_code,
        new.code AS new_code,
        ST_Area(ST_Intersection(old.geom, new.geom)) AS intersect_area,
        ST_Area(old.geom) AS old_area
    FROM public.mailles_legacy_v1_archive old
    JOIN atlas.mailles new 
        ON ST_Intersects(old.geom, new.geom)
),
ratios AS (
    SELECT 
        legacy_code,
        new_code,
        intersect_area,
        ROUND((intersect_area / old_area * 100)::numeric, 1) AS coverage_pct
    FROM intersection_data
    WHERE old_area > 0
      AND (intersect_area / old_area) > 0.01 
)
SELECT 
    legacy_code,
    new_code,
    coverage_pct,
    ROW_NUMBER() OVER (PARTITION BY legacy_code ORDER BY coverage_pct DESC) as rank
FROM ratios;

-- 3. INDEXATION
CREATE UNIQUE INDEX idx_mv_legacy_mapping_unique ON atlas.mv_legacy_mapping (legacy_code, new_code);
CREATE INDEX idx_mv_legacy_mapping_legacy_code ON atlas.mv_legacy_mapping (legacy_code);
CREATE INDEX idx_mv_legacy_mapping_new_code ON atlas.mv_legacy_mapping (new_code);

-- 4. VUE API
CREATE OR REPLACE VIEW atlas.v_api_legacy_lookup AS
SELECT 
    legacy_code,
    new_code,
    coverage_pct,
    rank,
    CASE 
        WHEN coverage_pct >= 90 THEN 'EXACT'
        WHEN coverage_pct >= 50 THEN 'MAJOR'
        ELSE 'PARTIAL'
    END as match_type
FROM atlas.mv_legacy_mapping;

COMMIT;
