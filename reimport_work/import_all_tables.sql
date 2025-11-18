-- ============================================================================
-- SCRIPT D'IMPORT COMPLET - TEMP TABLES + UPSERT
-- Importe tous les CSV via tables temporaires puis UPSERT
-- ============================================================================

\echo '🚀 Début import complet des données Atlas'

-- ============================================================================
-- 1. RÉFÉRENTIELS (ref_types_essais) - PRIORITÉ 1
-- ============================================================================
\echo '📋 Import ref_types_essais...'

CREATE TEMP TABLE temp_ref_types_essais (
    code TEXT,
    nom_fr TEXT,
    nom_en TEXT,
    categorie TEXT,
    unite_defaut TEXT,
    description TEXT,
    ordre_affichage TEXT,
    id TEXT
);

\copy temp_ref_types_essais FROM '/tmp/csv/ref_types_essais.csv' WITH (FORMAT csv, HEADER true);

-- Nettoyer et convertir types
UPDATE temp_ref_types_essais SET 
    ordre_affichage = CASE WHEN ordre_affichage = '' THEN NULL ELSE ordre_affichage::integer END;

-- Générer UUID si manquant
UPDATE temp_ref_types_essais SET id = gen_random_uuid()::text WHERE id IS NULL OR id = '';

-- Upsert
INSERT INTO public.ref_types_essais (code, nom_fr, nom_en, categorie, unite_defaut, description, ordre_affichage)
SELECT code, nom_fr, nom_en, categorie, unite_defaut, description, ordre_affichage::integer
FROM temp_ref_types_essais
ON CONFLICT (code) DO UPDATE SET
    nom_fr = EXCLUDED.nom_fr,
    nom_en = EXCLUDED.nom_en,
    categorie = EXCLUDED.categorie,
    unite_defaut = EXCLUDED.unite_defaut,
    description = EXCLUDED.description,
    ordre_affichage = EXCLUDED.ordre_affichage;

\echo '✅ ref_types_essais importé'

-- ============================================================================
-- 2. SONDAGES - PRIORITÉ 2
-- ============================================================================
\echo '📋 Import sondages...'

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

\copy temp_sondages FROM '/tmp/csv/sondages.csv' WITH (FORMAT csv, HEADER true);

-- Nettoyer et convertir types
UPDATE temp_sondages SET
    id = CASE WHEN id = '' OR id IS NULL THEN gen_random_uuid()::text ELSE id END,
    date_sondage = CASE WHEN date_sondage = '' THEN NULL ELSE date_sondage::date END,
    depth_m_min = CASE WHEN depth_m_min = '' THEN NULL ELSE depth_m_min::numeric END,
    depth_m_max = CASE WHEN depth_m_max = '' THEN NULL ELSE depth_m_max::numeric END,
    adm3_id = CASE WHEN adm3_id = '' THEN NULL ELSE adm3_id::integer END,
    is_geocoded = CASE WHEN is_geocoded = '' THEN false ELSE is_geocoded::boolean END,
    location_mode = COALESCE(NULLIF(location_mode, ''), 'unknown');

-- Upsert sondages
INSERT INTO public.sondages (
    id, date_sondage, source, meta, code, depth_m_min, depth_m_max, 
    maille_code, adm1_name, adm2_name, adm3_name, comment, 
    location_accuracy, is_geocoded, operator, notes, type_sol, 
    location_mode, adm3_id, localite_base
)
SELECT 
    id::uuid, date_sondage, source, meta, code, depth_m_min, depth_m_max,
    NULLIF(maille_code, ''), adm1_name, adm2_name, adm3_name, comment,
    NULLIF(location_accuracy, ''), is_geocoded, operator, notes, type_sol,
    location_mode, adm3_id, NULLIF(localite_base, '')
FROM temp_sondages
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    date_sondage = EXCLUDED.date_sondage,
    source = EXCLUDED.source,
    adm3_id = EXCLUDED.adm3_id,
    location_mode = EXCLUDED.location_mode,
    updated_at = now();

\echo '✅ sondages importé'

-- ============================================================================
-- 3. ÉCHANTILLONS - PRIORITÉ 3
-- ============================================================================
\echo '📋 Import echantillons...'

CREATE TEMP TABLE temp_echantillons (
    id TEXT,
    sondage_id TEXT,
    depth_m TEXT,
    date TEXT,
    laboratory TEXT,
    norm TEXT,
    rho_s_gcm3 TEXT,
    water_content_w TEXT,
    is_index TEXT,
    eg TEXT,
    meta TEXT,
    created_at TEXT,
    updated_at TEXT
);

\copy temp_echantillons FROM '/tmp/csv/echantillons.csv' WITH (FORMAT csv, HEADER true);

-- Nettoyer
UPDATE temp_echantillons SET
    id = CASE WHEN id = '' OR id IS NULL THEN gen_random_uuid()::text ELSE id END,
    depth_m = CASE WHEN depth_m = '' THEN NULL ELSE depth_m::numeric END,
    date = CASE WHEN date = '' THEN NULL ELSE date::date END,
    rho_s_gcm3 = CASE WHEN rho_s_gcm3 = '' THEN NULL ELSE rho_s_gcm3::numeric END,
    water_content_w = CASE WHEN water_content_w = '' THEN NULL ELSE water_content_w::numeric END,
    is_index = CASE WHEN is_index = '' THEN false ELSE is_index::boolean END;

-- Upsert echantillons
INSERT INTO public.echantillons (
    id, sondage_id, depth_m, date, laboratory, norm, 
    rho_s_gcm3, water_content_w, is_index, eg, meta
)
SELECT 
    id::uuid, sondage_id::uuid, depth_m, date, laboratory, norm,
    rho_s_gcm3, water_content_w, is_index, eg, meta
FROM temp_echantillons
WHERE sondage_id::uuid IN (SELECT id FROM public.sondages)
ON CONFLICT (id) DO UPDATE SET
    depth_m = EXCLUDED.depth_m,
    laboratory = EXCLUDED.laboratory,
    updated_at = now();

\echo '✅ echantillons importé'

-- ============================================================================
-- 4. ESSAIS ATTERBERG - PRIORITÉ 4
-- ============================================================================
\echo '📋 Import essais_atterberg...'

CREATE TEMP TABLE temp_essais_atterberg (
    id TEXT,
    echantillon_id TEXT,
    wl TEXT,
    wp TEXT,
    ip_generated TEXT,
    meta TEXT,
    created_at TEXT,
    ip_calculated TEXT
);

\copy temp_essais_atterberg FROM '/tmp/csv/essais_atterberg.csv' WITH (FORMAT csv, HEADER true);

-- Nettoyer et calculer IP
UPDATE temp_essais_atterberg SET
    id = CASE WHEN id = '' OR id IS NULL THEN gen_random_uuid()::text ELSE id END,
    wl = CASE WHEN wl = '' THEN NULL ELSE wl::numeric END,
    wp = CASE WHEN wp = '' THEN NULL ELSE wp::numeric END,
    ip_generated = CASE WHEN wl != '' AND wp != '' THEN (wl::numeric - wp::numeric) ELSE NULL END;

-- Upsert
INSERT INTO public.essais_atterberg (id, echantillon_id, wl, wp, ip_generated, meta)
SELECT 
    id::uuid, echantillon_id::uuid, wl, wp, ip_generated, meta
FROM temp_essais_atterberg
WHERE echantillon_id::uuid IN (SELECT id FROM public.echantillons)
ON CONFLICT (id) DO UPDATE SET
    wl = EXCLUDED.wl,
    wp = EXCLUDED.wp,
    ip_generated = EXCLUDED.ip_generated,
    meta = EXCLUDED.meta;

\echo '✅ essais_atterberg importé'

-- ============================================================================
-- STATISTIQUES FINALES
-- ============================================================================
\echo '📊 Statistiques post-import:'

SELECT 'sondages' as table_name, COUNT(*) as rows FROM public.sondages
UNION ALL
SELECT 'echantillons', COUNT(*) FROM public.echantillons
UNION ALL
SELECT 'essais_atterberg', COUNT(*) FROM public.essais_atterberg
UNION ALL
SELECT 'ref_types_essais', COUNT(*) FROM public.ref_types_essais;

\echo '🎯 Import terminé - Prêt pour trigger auto-géocodage';
