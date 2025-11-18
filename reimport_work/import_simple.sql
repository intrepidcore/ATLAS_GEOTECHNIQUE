-- ============================================================================
-- IMPORT SIMPLIFIÉ - SONDAGES SEULEMENT
-- ============================================================================

\echo '📋 Import sondages (structure réelle)...'

-- Table temporaire simple
CREATE TEMP TABLE temp_sondages (
    id TEXT,
    code TEXT,
    source TEXT,
    adm3_id TEXT,
    location_mode TEXT,
    localite_base TEXT,
    date_sondage TEXT
);

-- Import CSV (colonnes essentielles seulement)
\copy temp_sondages FROM '/tmp/csv/sondages.csv' WITH (FORMAT csv, HEADER true);

-- Nettoyer
UPDATE temp_sondages SET
    id = CASE WHEN TRIM(COALESCE(id, '')) = '' THEN gen_random_uuid()::text ELSE TRIM(id) END,
    adm3_id = CASE WHEN TRIM(COALESCE(adm3_id, '')) = '' THEN NULL ELSE TRIM(adm3_id) END,
    location_mode = COALESCE(NULLIF(TRIM(location_mode), ''), 'unknown'),
    localite_base = NULLIF(TRIM(localite_base), '');

-- Insert simple (colonnes compatibles)
INSERT INTO public.sondages (id, code, source, adm3_id, location_mode, localite_base)
SELECT 
    id::uuid,
    code,
    source,
    CASE WHEN adm3_id IS NULL THEN NULL ELSE adm3_id::integer END,
    location_mode,
    localite_base
FROM temp_sondages
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    source = EXCLUDED.source,
    adm3_id = EXCLUDED.adm3_id,
    location_mode = EXCLUDED.location_mode,
    localite_base = EXCLUDED.localite_base,
    updated_at = now();

-- Vérification
SELECT 
    COUNT(*) as total,
    COUNT(geom) as with_geom,
    COUNT(adm3_id) as with_adm3,
    COUNT(*) FILTER (WHERE is_geocoded) as geocoded_count
FROM public.sondages;

\echo '✅ Import terminé';
