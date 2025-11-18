-- ============================================================================
-- IMPORT SONDAGES SEULEMENT (VERSION CORRIGÉE)
-- ============================================================================

\echo '📋 Import sondages (version corrigée)...'

-- Créer table temporaire avec tous les champs TEXT
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

-- Importer CSV
\copy temp_sondages FROM '/tmp/csv/sondages.csv' WITH (FORMAT csv, HEADER true);

-- Nettoyer les données NULL
UPDATE temp_sondages SET
    id = CASE WHEN TRIM(COALESCE(id, '')) = '' THEN gen_random_uuid()::text ELSE TRIM(id) END,
    date_sondage = CASE WHEN TRIM(COALESCE(date_sondage, '')) = '' THEN NULL ELSE TRIM(date_sondage) END,
    depth_m_min = CASE WHEN TRIM(COALESCE(depth_m_min, '')) = '' THEN NULL ELSE TRIM(depth_m_min) END,
    depth_m_max = CASE WHEN TRIM(COALESCE(depth_m_max, '')) = '' THEN NULL ELSE TRIM(depth_m_max) END,
    adm3_id = CASE WHEN TRIM(COALESCE(adm3_id, '')) = '' THEN NULL ELSE TRIM(adm3_id) END,
    is_geocoded = CASE WHEN TRIM(COALESCE(is_geocoded, '')) IN ('true', 'True', '1') THEN 'true' ELSE 'false' END,
    location_mode = COALESCE(NULLIF(TRIM(location_mode), ''), 'unknown'),
    maille_code = NULLIF(TRIM(maille_code), ''),
    location_accuracy = NULLIF(TRIM(location_accuracy), ''),
    localite_base = NULLIF(TRIM(localite_base), '');

-- Insérer avec casts appropriés
INSERT INTO public.sondages (
    id, date_sondage, source, meta, code, 
    depth_m_min, depth_m_max, maille_code, 
    adm1_name, adm2_name, adm3_name, comment,
    location_accuracy, is_geocoded, operator, notes, type_sol,
    location_mode, adm3_id, localite_base
)
SELECT 
    id::uuid,
    CASE WHEN date_sondage IS NULL THEN NULL ELSE date_sondage::date END,
    source, meta, code,
    CASE WHEN depth_m_min IS NULL THEN NULL ELSE depth_m_min::numeric END,
    CASE WHEN depth_m_max IS NULL THEN NULL ELSE depth_m_max::numeric END,
    maille_code,
    adm1_name, adm2_name, adm3_name, comment,
    location_accuracy,
    is_geocoded::boolean,
    operator, notes, type_sol, location_mode,
    CASE WHEN adm3_id IS NULL THEN NULL ELSE adm3_id::integer END,
    localite_base
FROM temp_sondages
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    date_sondage = EXCLUDED.date_sondage,
    source = EXCLUDED.source,
    adm3_id = EXCLUDED.adm3_id,
    location_mode = EXCLUDED.location_mode,
    updated_at = now();

-- Vérification
SELECT COUNT(*) as sondages_imported FROM public.sondages;

\echo '✅ Sondages importés avec succès';
