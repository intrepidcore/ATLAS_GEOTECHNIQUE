-- ============================================================================
-- IMPORT FINAL - TOUTES COLONNES CSV
-- ============================================================================

\echo '📋 Import sondages (toutes colonnes)...'

-- Table temporaire avec TOUTES les colonnes du CSV
CREATE TEMP TABLE temp_sondages (
    id TEXT,
    date_sondage TEXT,
    source TEXT,
    meta TEXT,
    code TEXT,
    depth_m_min TEXT,
    depth_m_max TEXT,
    maille_code TEXT,
    adm1_name TEXT,
    adm2_name TEXT,
    adm3_name TEXT,
    comment TEXT,
    created_at TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    location_accuracy TEXT,
    is_geocoded TEXT,
    date TEXT,
    operator TEXT,
    notes TEXT,
    type_sol TEXT,
    location_mode TEXT,
    adm1_id TEXT,
    adm2_id TEXT,
    adm3_id TEXT,
    import_id TEXT,
    import_row_idx TEXT,
    loc_mode TEXT,
    geom_real TEXT,
    created_by_batch TEXT,
    updated_by_batch TEXT,
    deleted_by_batch TEXT,
    grid_code TEXT,
    localite_base TEXT,
    localite_key TEXT,
    geom_wkt TEXT
);

-- Import CSV complet
\copy temp_sondages FROM '/tmp/csv/sondages.csv' WITH (FORMAT csv, HEADER true);

-- Nettoyer les données essentielles
UPDATE temp_sondages SET
    id = CASE WHEN TRIM(COALESCE(id, '')) = '' THEN gen_random_uuid()::text ELSE TRIM(id) END,
    adm3_id = CASE WHEN TRIM(COALESCE(adm3_id, '')) = '' THEN NULL ELSE TRIM(adm3_id) END,
    location_mode = COALESCE(NULLIF(TRIM(location_mode), ''), 'unknown'),
    localite_base = NULLIF(TRIM(localite_base), '');

-- Insert avec colonnes compatibles seulement
INSERT INTO public.sondages (
    id, code, source, adm3_id, location_mode, localite_base, 
    adm1_name, adm2_name, adm3_name
)
SELECT 
    id::uuid,
    COALESCE(code, 'IMPORT-' || substring(id::text, 1, 8)),
    COALESCE(source, 'reimport'),
    CASE WHEN adm3_id IS NULL THEN NULL ELSE adm3_id::integer END,
    location_mode,
    localite_base,
    adm1_name,
    adm2_name,
    adm3_name
FROM temp_sondages
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    source = EXCLUDED.source,
    adm3_id = EXCLUDED.adm3_id,
    location_mode = EXCLUDED.location_mode,
    localite_base = EXCLUDED.localite_base,
    updated_at = now();

-- Statistiques
SELECT 
    'SONDAGES' as table_name,
    COUNT(*) as total,
    COUNT(geom) as with_geom,
    COUNT(adm3_id) as with_adm3,
    COUNT(*) FILTER (WHERE is_geocoded) as auto_geocoded,
    COUNT(DISTINCT location_mode) as location_modes
FROM public.sondages;

SELECT location_mode, COUNT(*) FROM public.sondages GROUP BY location_mode;

\echo '✅ Import sondages terminé';
