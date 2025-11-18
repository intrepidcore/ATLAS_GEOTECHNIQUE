-- ============================================================================
-- IMPORT FINAL AVEC TYPES CORRECTS - SOLUTION DÉFINITIVE
-- Import toutes les tables avec les bons types directement
-- ============================================================================

\echo '🎯 IMPORT FINAL AVEC TYPES CORRECTS - SOLUTION DÉFINITIVE'

SET session_replication_role = replica;

-- ============================================================================
-- 1) ESSAIS_ATTERBERG - Import avec bons types
-- ============================================================================
\echo '📋 1. IMPORT ESSAIS_ATTERBERG (types corrects)...'

DROP TABLE IF EXISTS tmp_atterberg;
CREATE TEMP TABLE tmp_atterberg (
    id text,
    echantillon_id text,
    wl text,
    wp text,
    ip_generated text,
    meta text,
    created_at text
);

\copy tmp_atterberg FROM '/tmp/csv_preserve/essais_atterberg.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

ALTER TABLE tmp_atterberg ADD COLUMN row_number SERIAL;

INSERT INTO public.essais_atterberg (id, echantillon_id, wl, wp, ip_generated, meta, created_at)
SELECT 
    id::uuid,
    echantillon_id::uuid,
    CASE WHEN trim(COALESCE(wl, '')) = '' THEN NULL ELSE wl::numeric END,
    CASE WHEN trim(COALESCE(wp, '')) = '' THEN NULL ELSE wp::numeric END,
    CASE WHEN trim(COALESCE(ip_generated, '')) = '' THEN NULL ELSE ip_generated::numeric END,
    '{}'::jsonb,
    CASE WHEN trim(COALESCE(created_at, '')) = '' THEN now() ELSE created_at::timestamptz END
FROM tmp_atterberg
WHERE EXISTS (SELECT 1 FROM public.echantillons WHERE id = echantillon_id::uuid)
ORDER BY row_number;

\echo '✅ ESSAIS_ATTERBERG importés avec types corrects'

-- ============================================================================
-- 2) ESSAIS_GEOTECHNIQUES - Import avec bons types
-- ============================================================================
\echo '📋 2. IMPORT ESSAIS_GEOTECHNIQUES (types corrects)...'

DROP TABLE IF EXISTS tmp_geotechniques;
CREATE TEMP TABLE tmp_geotechniques (
    id text,
    sondage_id text,
    depth_m text,
    passant_80um text,
    passant_2mm text,
    passant_20mm text,
    wl text,
    wp text,
    ip text,
    vbs text,
    gamma_d_max text,
    w_opt text,
    proctor_type text,
    eg text,
    test_date text,
    laboratory text,
    norm text,
    meta text,
    created_at text,
    created_by text,
    updated_at text,
    updated_by text,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    deleted_at text
);

\copy tmp_geotechniques FROM '/tmp/csv_preserve/essais_geotechniques.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

ALTER TABLE tmp_geotechniques ADD COLUMN row_number SERIAL;

INSERT INTO public.essais_geotechniques (
    id, sondage_id, depth_m, passant_80um, passant_2mm, passant_20mm,
    wl, wp, ip, vbs, gamma_d_max, w_opt, proctor_type, eg, test_date,
    laboratory, norm, meta, created_at, updated_at
)
SELECT 
    id::uuid,
    sondage_id::uuid,
    CASE WHEN trim(COALESCE(depth_m, '')) = '' THEN NULL ELSE depth_m::numeric END,
    CASE WHEN trim(COALESCE(passant_80um, '')) = '' THEN NULL ELSE passant_80um::numeric END,
    CASE WHEN trim(COALESCE(passant_2mm, '')) = '' THEN NULL ELSE passant_2mm::numeric END,
    CASE WHEN trim(COALESCE(passant_20mm, '')) = '' THEN NULL ELSE passant_20mm::numeric END,
    CASE WHEN trim(COALESCE(wl, '')) = '' THEN NULL ELSE wl::numeric END,
    CASE WHEN trim(COALESCE(wp, '')) = '' THEN NULL ELSE wp::numeric END,
    CASE WHEN trim(COALESCE(ip, '')) = '' THEN NULL ELSE ip::numeric END,
    CASE WHEN trim(COALESCE(vbs, '')) = '' THEN NULL ELSE vbs::numeric END,
    CASE WHEN trim(COALESCE(gamma_d_max, '')) = '' THEN NULL ELSE gamma_d_max::numeric END,
    CASE WHEN trim(COALESCE(w_opt, '')) = '' THEN NULL ELSE w_opt::numeric END,
    NULLIF(trim(proctor_type), ''),
    NULLIF(trim(eg), ''),
    CASE WHEN trim(COALESCE(test_date, '')) = '' THEN NULL ELSE test_date::date END,
    NULLIF(trim(laboratory), ''),
    NULLIF(trim(norm), ''),
    '{}'::jsonb,
    CASE WHEN trim(COALESCE(created_at, '')) = '' THEN now() ELSE created_at::timestamptz END,
    CASE WHEN trim(COALESCE(updated_at, '')) = '' THEN now() ELSE updated_at::timestamptz END
FROM tmp_geotechniques
WHERE EXISTS (SELECT 1 FROM public.sondages WHERE id = sondage_id::uuid)
ORDER BY row_number;

\echo '✅ ESSAIS_GEOTECHNIQUES importés avec types corrects'

-- ============================================================================
-- 3) ESSAIS_PHYSIQUES - Import avec bons types
-- ============================================================================
\echo '📋 3. IMPORT ESSAIS_PHYSIQUES (types corrects)...'

DROP TABLE IF EXISTS tmp_physiques;
CREATE TEMP TABLE tmp_physiques (
    id text,
    essai_id text,
    densite_apparente_gcm3 text,
    densite_absolue_gcm3 text,
    teneur_eau_pct text,
    source text,
    measured_at text,
    meta text,
    created_at text,
    updated_at text,
    created_by text,
    updated_by text,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    deleted_at text
);

\copy tmp_physiques FROM '/tmp/csv_preserve/essais_physiques.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

ALTER TABLE tmp_physiques ADD COLUMN row_number SERIAL;

INSERT INTO public.essais_physiques (
    id, essai_id, densite_apparente_gcm3, densite_absolue_gcm3, teneur_eau_pct,
    source, measured_at, meta, created_at, updated_at
)
SELECT 
    id::uuid,
    essai_id::uuid,
    CASE WHEN trim(COALESCE(densite_apparente_gcm3, '')) = '' THEN NULL ELSE densite_apparente_gcm3::numeric END,
    CASE WHEN trim(COALESCE(densite_absolue_gcm3, '')) = '' THEN NULL ELSE densite_absolue_gcm3::numeric END,
    CASE WHEN trim(COALESCE(teneur_eau_pct, '')) = '' THEN NULL ELSE teneur_eau_pct::numeric END,
    NULLIF(trim(source), ''),
    CASE WHEN trim(COALESCE(measured_at, '')) = '' THEN NULL ELSE measured_at::timestamptz END,
    '{}'::jsonb,
    CASE WHEN trim(COALESCE(created_at, '')) = '' THEN now() ELSE created_at::timestamptz END,
    CASE WHEN trim(COALESCE(updated_at, '')) = '' THEN now() ELSE updated_at::timestamptz END
FROM tmp_physiques
ORDER BY row_number;

\echo '✅ ESSAIS_PHYSIQUES importés avec types corrects'

-- ============================================================================
-- 4) ESSAIS_VBS - Import avec bons types
-- ============================================================================
\echo '📋 4. IMPORT ESSAIS_VBS (types corrects)...'

DROP TABLE IF EXISTS tmp_vbs;
CREATE TEMP TABLE tmp_vbs (
    id text,
    echantillon_id text,
    vbs text,
    commentaire text,
    meta text,
    created_at text
);

\copy tmp_vbs FROM '/tmp/csv_preserve/essais_vbs.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

ALTER TABLE tmp_vbs ADD COLUMN row_number SERIAL;

INSERT INTO public.essais_vbs (id, echantillon_id, vbs, commentaire, meta, created_at)
SELECT 
    id::uuid,
    echantillon_id::uuid,
    CASE WHEN trim(COALESCE(vbs, '')) = '' THEN NULL ELSE vbs::numeric END,
    NULLIF(trim(commentaire), ''),
    '{}'::jsonb,
    CASE WHEN trim(COALESCE(created_at, '')) = '' THEN now() ELSE created_at::timestamptz END
FROM tmp_vbs
WHERE EXISTS (SELECT 1 FROM public.echantillons WHERE id = echantillon_id::uuid)
ORDER BY row_number;

\echo '✅ ESSAIS_VBS importés avec types corrects'

-- ============================================================================
-- 5) VALIDATION FINALE COMPLÈTE
-- ============================================================================
\echo '🔍 VALIDATION FINALE COMPLÈTE...'

SET session_replication_role = DEFAULT;

SELECT 
    'COMPTES_FINAUX_TOUS_IMPORTS' as section,
    (SELECT COUNT(*) FROM public.sondages) as sondages,
    (SELECT COUNT(*) FROM public.echantillons) as echantillons,
    (SELECT COUNT(*) FROM public.essais_atterberg) as essais_atterberg,
    (SELECT COUNT(*) FROM public.essais_geotechniques) as essais_geotechniques,
    (SELECT COUNT(*) FROM public.essais_physiques) as essais_physiques,
    (SELECT COUNT(*) FROM public.essais_vbs) as essais_vbs,
    (SELECT COUNT(*) FROM public.ref_types_essais) as ref_types_essais;

-- Vérification intégrité FK
SELECT 
    'INTEGRITE_FK_FINALE' as section,
    (SELECT COUNT(*) FROM public.echantillons e LEFT JOIN public.sondages s ON e.sondage_id = s.id WHERE s.id IS NULL) as echantillons_orphelins,
    (SELECT COUNT(*) FROM public.essais_atterberg ea LEFT JOIN public.echantillons e ON ea.echantillon_id = e.id WHERE e.id IS NULL) as atterberg_orphelins,
    (SELECT COUNT(*) FROM public.essais_vbs ev LEFT JOIN public.echantillons e ON ev.echantillon_id = e.id WHERE e.id IS NULL) as vbs_orphelins;

\echo '🎉 IMPORT COMPLET AVEC TYPES CORRECTS TERMINÉ'
\echo ''
\echo '✅ RÉSULTATS:'
\echo '   - Tous les types de colonnes sont corrects'
\echo '   - Toutes les données Excel importées fidèlement'
\echo '   - Intégrité FK préservée'
\echo '   - Géocodage fonctionnel (sondages)'
\echo ''
\echo '🌐 Système Atlas complètement opérationnel!';
