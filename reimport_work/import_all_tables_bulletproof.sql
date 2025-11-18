-- ============================================================================
-- IMPORT BULLETPROOF DE TOUTES LES TABLES RESTANTES
-- Même méthode que les sondages pour préserver la fidélité
-- ============================================================================

\echo '🛡️ IMPORT BULLETPROOF DE TOUTES LES TABLES RESTANTES'

SET session_replication_role = replica;

-- ============================================================================
-- 1) ESSAIS_ATTERBERG
-- ============================================================================
\echo '📋 1. IMPORT ESSAIS_ATTERBERG...'

TRUNCATE TABLE public.essais_atterberg CASCADE;

DROP TABLE IF EXISTS tmp_essais_atterberg;
CREATE TEMP TABLE tmp_essais_atterberg (
    id text,
    echantillon_id text,
    wl text,
    wp text,
    ip_generated text,
    meta text,
    created_at text
);

\copy tmp_essais_atterberg FROM '/tmp/csv_preserve/essais_atterberg.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

ALTER TABLE tmp_essais_atterberg ADD COLUMN row_number SERIAL;

INSERT INTO public.essais_atterberg (id, echantillon_id, wl, wp, ip_generated, meta, created_at)
SELECT 
    id::uuid,
    echantillon_id::uuid,
    CASE WHEN trim(COALESCE(wl, '')) = '' THEN NULL ELSE wl::numeric END,
    CASE WHEN trim(COALESCE(wp, '')) = '' THEN NULL ELSE wp::numeric END,
    CASE WHEN trim(COALESCE(ip_generated, '')) = '' THEN NULL ELSE ip_generated::numeric END,
    '{}'::jsonb,
    CASE WHEN trim(COALESCE(created_at, '')) = '' THEN now() ELSE created_at::timestamptz END
FROM tmp_essais_atterberg
WHERE EXISTS (SELECT 1 FROM public.echantillons WHERE id = echantillon_id::uuid)
ORDER BY row_number;

\echo '✅ ESSAIS_ATTERBERG importés'

-- ============================================================================
-- 2) ESSAIS_GEOTECHNIQUES
-- ============================================================================
\echo '📋 2. IMPORT ESSAIS_GEOTECHNIQUES...'

TRUNCATE TABLE public.essais_geotechniques CASCADE;

DROP TABLE IF EXISTS tmp_essais_geotechniques;
CREATE TEMP TABLE tmp_essais_geotechniques (
    id text,
    sondage_id text,
    depth_m text,
    test_type text,
    value text,
    unit text,
    norm text,
    laboratory text,
    date text,
    operator text,
    notes text,
    meta text,
    created_at text,
    updated_at text,
    deleted_at text,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    echantillon_id text,
    wl text,
    wp text,
    ip text,
    vbs text,
    gs text,
    rho_s_gcm3 text,
    water_content_w text
);

\copy tmp_essais_geotechniques FROM '/tmp/csv_preserve/essais_geotechniques.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

ALTER TABLE tmp_essais_geotechniques ADD COLUMN row_number SERIAL;

INSERT INTO public.essais_geotechniques (
    id, sondage_id, depth_m, test_type, value, unit, norm, laboratory, 
    date, operator, notes, meta, created_at, updated_at, echantillon_id,
    wl, wp, ip, vbs, gs, rho_s_gcm3, water_content_w
)
SELECT 
    id::uuid,
    sondage_id::uuid,
    CASE WHEN trim(COALESCE(depth_m, '')) = '' THEN NULL ELSE depth_m::numeric END,
    NULLIF(trim(test_type), ''),
    CASE WHEN trim(COALESCE(value, '')) = '' THEN NULL ELSE value::numeric END,
    NULLIF(trim(unit), ''),
    NULLIF(trim(norm), ''),
    NULLIF(trim(laboratory), ''),
    CASE WHEN trim(COALESCE(date, '')) = '' THEN NULL ELSE date::date END,
    NULLIF(trim(operator), ''),
    NULLIF(trim(notes), ''),
    '{}'::jsonb,
    CASE WHEN trim(COALESCE(created_at, '')) = '' THEN now() ELSE created_at::timestamptz END,
    CASE WHEN trim(COALESCE(updated_at, '')) = '' THEN now() ELSE updated_at::timestamptz END,
    CASE WHEN trim(COALESCE(echantillon_id, '')) = '' THEN NULL ELSE echantillon_id::uuid END,
    CASE WHEN trim(COALESCE(wl, '')) = '' THEN NULL ELSE wl::numeric END,
    CASE WHEN trim(COALESCE(wp, '')) = '' THEN NULL ELSE wp::numeric END,
    CASE WHEN trim(COALESCE(ip, '')) = '' THEN NULL ELSE ip::numeric END,
    CASE WHEN trim(COALESCE(vbs, '')) = '' THEN NULL ELSE vbs::numeric END,
    CASE WHEN trim(COALESCE(gs, '')) = '' THEN NULL ELSE gs::numeric END,
    CASE WHEN trim(COALESCE(rho_s_gcm3, '')) = '' THEN NULL ELSE rho_s_gcm3::numeric END,
    CASE WHEN trim(COALESCE(water_content_w, '')) = '' THEN NULL ELSE water_content_w::numeric END
FROM tmp_essais_geotechniques
WHERE EXISTS (SELECT 1 FROM public.sondages WHERE id = sondage_id::uuid)
ORDER BY row_number;

\echo '✅ ESSAIS_GEOTECHNIQUES importés'

-- ============================================================================
-- 3) ESSAIS_PHYSIQUES
-- ============================================================================
\echo '📋 3. IMPORT ESSAIS_PHYSIQUES...'

TRUNCATE TABLE public.essais_physiques CASCADE;

DROP TABLE IF EXISTS tmp_essais_physiques;
CREATE TEMP TABLE tmp_essais_physiques (
    id text,
    echantillon_id text,
    test_type text,
    value text,
    unit text,
    norm text,
    laboratory text,
    date text,
    operator text,
    notes text,
    meta text,
    created_at text,
    updated_at text,
    deleted_at text,
    created_by_batch text,
    updated_by_batch text
);

\copy tmp_essais_physiques FROM '/tmp/csv_preserve/essais_physiques.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

ALTER TABLE tmp_essais_physiques ADD COLUMN row_number SERIAL;

INSERT INTO public.essais_physiques (
    id, echantillon_id, test_type, value, unit, norm, laboratory, 
    date, operator, notes, meta, created_at, updated_at
)
SELECT 
    id::uuid,
    echantillon_id::uuid,
    NULLIF(trim(test_type), ''),
    CASE WHEN trim(COALESCE(value, '')) = '' THEN NULL ELSE value::numeric END,
    NULLIF(trim(unit), ''),
    NULLIF(trim(norm), ''),
    NULLIF(trim(laboratory), ''),
    CASE WHEN trim(COALESCE(date, '')) = '' THEN NULL ELSE date::date END,
    NULLIF(trim(operator), ''),
    NULLIF(trim(notes), ''),
    '{}'::jsonb,
    CASE WHEN trim(COALESCE(created_at, '')) = '' THEN now() ELSE created_at::timestamptz END,
    CASE WHEN trim(COALESCE(updated_at, '')) = '' THEN now() ELSE updated_at::timestamptz END
FROM tmp_essais_physiques
WHERE EXISTS (SELECT 1 FROM public.echantillons WHERE id = echantillon_id::uuid)
ORDER BY row_number;

\echo '✅ ESSAIS_PHYSIQUES importés'

-- ============================================================================
-- 4) ESSAIS_VBS
-- ============================================================================
\echo '📋 4. IMPORT ESSAIS_VBS...'

TRUNCATE TABLE public.essais_vbs CASCADE;

DROP TABLE IF EXISTS tmp_essais_vbs;
CREATE TEMP TABLE tmp_essais_vbs (
    id text,
    echantillon_id text,
    vbs text,
    commentaire text,
    meta text,
    created_at text
);

\copy tmp_essais_vbs FROM '/tmp/csv_preserve/essais_vbs.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

ALTER TABLE tmp_essais_vbs ADD COLUMN row_number SERIAL;

INSERT INTO public.essais_vbs (id, echantillon_id, vbs, commentaire, meta, created_at)
SELECT 
    id::uuid,
    echantillon_id::uuid,
    CASE WHEN trim(COALESCE(vbs, '')) = '' THEN NULL ELSE vbs::numeric END,
    NULLIF(trim(commentaire), ''),
    '{}'::jsonb,
    CASE WHEN trim(COALESCE(created_at, '')) = '' THEN now() ELSE created_at::timestamptz END
FROM tmp_essais_vbs
WHERE EXISTS (SELECT 1 FROM public.echantillons WHERE id = echantillon_id::uuid)
ORDER BY row_number;

\echo '✅ ESSAIS_VBS importés'

-- ============================================================================
-- 5) VALIDATION FINALE
-- ============================================================================
\echo '🔧 VALIDATION FINALE...'

SET session_replication_role = DEFAULT;

SELECT 
    'COMPTES_FINAUX_TOUTES_TABLES' as section,
    (SELECT COUNT(*) FROM public.sondages) as sondages,
    (SELECT COUNT(*) FROM public.echantillons) as echantillons,
    (SELECT COUNT(*) FROM public.essais_atterberg) as essais_atterberg,
    (SELECT COUNT(*) FROM public.essais_geotechniques) as essais_geotechniques,
    (SELECT COUNT(*) FROM public.essais_physiques) as essais_physiques,
    (SELECT COUNT(*) FROM public.essais_vbs) as essais_vbs,
    (SELECT COUNT(*) FROM public.ref_types_essais) as ref_types_essais;

\echo '🎉 IMPORT BULLETPROOF DE TOUTES LES TABLES TERMINÉ';
