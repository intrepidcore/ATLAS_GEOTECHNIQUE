-- ============================================================================
-- IMPORT DES TABLES RESTANTES
-- ============================================================================

\echo '📋 Import des tables restantes...'

-- ESSAIS_PHYSIQUES
\echo '8/16 - Import essais_physiques...'
CREATE TEMP TABLE temp_essais_physiques (
    id TEXT, essai_id TEXT, densite_apparente_gcm3 TEXT, densite_absolue_gcm3 TEXT, 
    teneur_eau_pct TEXT, source TEXT, measured_at TEXT, meta TEXT, created_at TEXT, 
    updated_at TEXT, created_by TEXT, updated_by TEXT, created_by_batch TEXT, 
    updated_by_batch TEXT, deleted_by_batch TEXT, deleted_at TEXT
);
\copy temp_essais_physiques FROM '/tmp/csv/essais_physiques.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.essais_physiques (id, essai_id, densite_apparente_gcm3, densite_absolue_gcm3, teneur_eau_pct, source, measured_at, meta)
SELECT DISTINCT
    COALESCE(NULLIF(TRIM(id), ''), gen_random_uuid()::text)::uuid,
    CASE WHEN TRIM(COALESCE(essai_id, '')) = '' THEN NULL ELSE essai_id::uuid END,
    CASE WHEN TRIM(COALESCE(densite_apparente_gcm3, '')) = '' THEN NULL ELSE densite_apparente_gcm3::numeric END,
    CASE WHEN TRIM(COALESCE(densite_absolue_gcm3, '')) = '' THEN NULL ELSE densite_absolue_gcm3::numeric END,
    CASE WHEN TRIM(COALESCE(teneur_eau_pct, '')) = '' THEN NULL ELSE teneur_eau_pct::numeric END,
    NULLIF(TRIM(source), ''),
    CASE WHEN TRIM(COALESCE(measured_at, '')) = '' THEN NULL ELSE measured_at::timestamp END,
    NULLIF(TRIM(meta), '')
FROM temp_essais_physiques;

-- ESSAIS_VBS
\echo '9/16 - Import essais_vbs...'
CREATE TEMP TABLE temp_essais_vbs_full (
    id TEXT, echantillon_id TEXT, vbs TEXT, commentaire TEXT, meta TEXT, created_at TEXT
);
\copy temp_essais_vbs_full FROM '/tmp/csv/essais_vbs.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.essais_vbs (id, echantillon_id, vbs, commentaire, meta)
SELECT DISTINCT
    COALESCE(NULLIF(TRIM(id), ''), gen_random_uuid()::text)::uuid,
    echantillon_id::uuid,
    CASE WHEN TRIM(COALESCE(vbs, '')) = '' THEN NULL ELSE vbs::numeric END,
    NULLIF(TRIM(commentaire), ''),
    NULLIF(TRIM(meta), '')
FROM temp_essais_vbs_full
WHERE echantillon_id IS NOT NULL 
  AND TRIM(echantillon_id) != ''
  AND EXISTS (SELECT 1 FROM public.echantillons WHERE id = echantillon_id::uuid);

-- ESSAIS_PROCTOR
\echo '10/16 - Import essais_proctor...'
CREATE TEMP TABLE temp_essais_proctor (
    id TEXT, echantillon_id TEXT, proctor_type TEXT, gamma_d_max TEXT, w_opt TEXT, meta TEXT, created_at TEXT
);
\copy temp_essais_proctor FROM '/tmp/csv/essais_proctor.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.essais_proctor (id, echantillon_id, proctor_type, gamma_d_max, w_opt, meta)
SELECT DISTINCT
    COALESCE(NULLIF(TRIM(id), ''), gen_random_uuid()::text)::uuid,
    CASE 
        WHEN TRIM(COALESCE(echantillon_id, '')) = '' THEN NULL 
        WHEN EXISTS (SELECT 1 FROM public.echantillons WHERE id = echantillon_id::uuid) THEN echantillon_id::uuid
        ELSE NULL 
    END,
    NULLIF(TRIM(proctor_type), ''),
    CASE WHEN TRIM(COALESCE(gamma_d_max, '')) = '' THEN NULL ELSE gamma_d_max::numeric END,
    CASE WHEN TRIM(COALESCE(w_opt, '')) = '' THEN NULL ELSE w_opt::numeric END,
    NULLIF(TRIM(meta), '')
FROM temp_essais_proctor
WHERE TRIM(COALESCE(echantillon_id, '')) != '';

-- GRANULO_POINTS
\echo '11/16 - Import granulo_points...'
CREATE TEMP TABLE temp_granulo_points (
    id TEXT, echantillon_id TEXT, method TEXT, sieve_mm TEXT, passing_pct TEXT, meta TEXT, created_at TEXT
);
\copy temp_granulo_points FROM '/tmp/csv/granulo_points.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.granulo_points (id, echantillon_id, method, sieve_mm, passing_pct, meta)
SELECT DISTINCT
    COALESCE(NULLIF(TRIM(id), ''), gen_random_uuid()::text)::uuid,
    echantillon_id::uuid,
    NULLIF(TRIM(method), ''),
    CASE WHEN TRIM(COALESCE(sieve_mm, '')) = '' THEN NULL ELSE sieve_mm::numeric END,
    CASE WHEN TRIM(COALESCE(passing_pct, '')) = '' THEN NULL ELSE passing_pct::numeric END,
    NULLIF(TRIM(meta), '')
FROM temp_granulo_points
WHERE echantillon_id IS NOT NULL 
  AND TRIM(echantillon_id) != ''
  AND EXISTS (SELECT 1 FROM public.echantillons WHERE id = echantillon_id::uuid);

-- GRANULOMETRIE_POINTS
\echo '12/16 - Import granulometrie_points...'
CREATE TEMP TABLE temp_granulometrie_points (
    id TEXT, essai_id TEXT, sieve_mm TEXT, percent_passing TEXT, created_at TEXT, 
    methode TEXT, meta TEXT, created_by_batch TEXT, deleted_by_batch TEXT, deleted_at TEXT
);
\copy temp_granulometrie_points FROM '/tmp/csv/granulometrie_points.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.granulometrie_points (id, essai_id, sieve_mm, percent_passing, methode, meta)
SELECT DISTINCT
    COALESCE(NULLIF(TRIM(id), ''), gen_random_uuid()::text)::uuid,
    CASE WHEN TRIM(COALESCE(essai_id, '')) = '' THEN NULL ELSE essai_id::uuid END,
    CASE WHEN TRIM(COALESCE(sieve_mm, '')) = '' THEN NULL ELSE sieve_mm::numeric END,
    CASE WHEN TRIM(COALESCE(percent_passing, '')) = '' THEN NULL ELSE percent_passing::numeric END,
    NULLIF(TRIM(methode), ''),
    NULLIF(TRIM(meta), '')
FROM temp_granulometrie_points;

-- ESSAIS_CLASSIF
\echo '13/16 - Import essais_classif...'
CREATE TEMP TABLE temp_essais_classif (
    id TEXT, essai_id TEXT, systeme TEXT, classe TEXT, reason TEXT, version TEXT, 
    computed TEXT, source TEXT, meta TEXT, created_at TEXT, updated_at TEXT, 
    created_by TEXT, updated_by TEXT, created_by_batch TEXT, updated_by_batch TEXT, 
    deleted_by_batch TEXT, deleted_at TEXT
);
\copy temp_essais_classif FROM '/tmp/csv/essais_classif.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.essais_classif (id, essai_id, systeme, classe, reason, version, computed, source, meta)
SELECT DISTINCT
    COALESCE(NULLIF(TRIM(id), ''), gen_random_uuid()::text)::uuid,
    CASE WHEN TRIM(COALESCE(essai_id, '')) = '' THEN NULL ELSE essai_id::uuid END,
    NULLIF(TRIM(systeme), ''),
    NULLIF(TRIM(classe), ''),
    NULLIF(TRIM(reason), ''),
    NULLIF(TRIM(version), ''),
    CASE WHEN TRIM(COALESCE(computed, '')) IN ('true', 'True', '1') THEN true ELSE false END,
    NULLIF(TRIM(source), ''),
    NULLIF(TRIM(meta), '')
FROM temp_essais_classif;

-- RAW_LAB_ATTERBERG
\echo '14/16 - Import raw_lab_atterberg...'
CREATE TEMP TABLE temp_raw_lab_atterberg (
    id TEXT, code_site TEXT, depth_m TEXT, test_type TEXT, tare_no TEXT, nb_coups TEXT, 
    poids_total_humide_g TEXT, poids_total_sec_g TEXT, poids_tare_g TEXT, poids_eau_g TEXT, 
    poids_sol_sec_g TEXT, teneur_eau_pct TEXT, echantillon_id TEXT, created_at TEXT
);
\copy temp_raw_lab_atterberg FROM '/tmp/csv/raw_lab_atterberg.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.raw_lab_atterberg (
    id, code_site, depth_m, test_type, tare_no, nb_coups,
    poids_total_humide_g, poids_total_sec_g, poids_tare_g, poids_eau_g,
    poids_sol_sec_g, teneur_eau_pct, echantillon_id
)
SELECT DISTINCT
    gen_random_uuid(),
    NULLIF(TRIM(code_site), ''),
    CASE WHEN TRIM(COALESCE(depth_m, '')) = '' THEN NULL ELSE depth_m::numeric END,
    NULLIF(TRIM(test_type), ''),
    NULLIF(TRIM(tare_no), ''),
    CASE WHEN TRIM(COALESCE(nb_coups, '')) = '' THEN NULL ELSE nb_coups::integer END,
    CASE WHEN TRIM(COALESCE(poids_total_humide_g, '')) = '' THEN NULL ELSE poids_total_humide_g::numeric END,
    CASE WHEN TRIM(COALESCE(poids_total_sec_g, '')) = '' THEN NULL ELSE poids_total_sec_g::numeric END,
    CASE WHEN TRIM(COALESCE(poids_tare_g, '')) = '' THEN NULL ELSE poids_tare_g::numeric END,
    CASE WHEN TRIM(COALESCE(poids_eau_g, '')) = '' THEN NULL ELSE poids_eau_g::numeric END,
    CASE WHEN TRIM(COALESCE(poids_sol_sec_g, '')) = '' THEN NULL ELSE poids_sol_sec_g::numeric END,
    CASE WHEN TRIM(COALESCE(teneur_eau_pct, '')) = '' THEN NULL ELSE teneur_eau_pct::numeric END,
    CASE 
        WHEN TRIM(COALESCE(echantillon_id, '')) = '' THEN NULL 
        WHEN EXISTS (SELECT 1 FROM public.echantillons WHERE id = echantillon_id::uuid) THEN echantillon_id::uuid
        ELSE NULL 
    END
FROM temp_raw_lab_atterberg;

-- STATISTIQUES FINALES COMPLÈTES
\echo '📊 STATISTIQUES FINALES - TOUTES LES TABLES:'

SELECT 
    'sondages' as table_name, COUNT(*) as rows FROM public.sondages
UNION ALL
SELECT 'echantillons', COUNT(*) FROM public.echantillons
UNION ALL
SELECT 'essais_atterberg', COUNT(*) FROM public.essais_atterberg
UNION ALL
SELECT 'essais_geotechniques', COUNT(*) FROM public.essais_geotechniques
UNION ALL
SELECT 'essais_physiques', COUNT(*) FROM public.essais_physiques
UNION ALL
SELECT 'essais_vbs', COUNT(*) FROM public.essais_vbs
UNION ALL
SELECT 'essais_proctor', COUNT(*) FROM public.essais_proctor
UNION ALL
SELECT 'essais_classif', COUNT(*) FROM public.essais_classif
UNION ALL
SELECT 'granulo_points', COUNT(*) FROM public.granulo_points
UNION ALL
SELECT 'granulometrie_points', COUNT(*) FROM public.granulometrie_points
UNION ALL
SELECT 'raw_lab_ags', COUNT(*) FROM public.raw_lab_ags
UNION ALL
SELECT 'raw_lab_agt', COUNT(*) FROM public.raw_lab_agt
UNION ALL
SELECT 'raw_lab_atterberg', COUNT(*) FROM public.raw_lab_atterberg
UNION ALL
SELECT 'ref_types_essais', COUNT(*) FROM public.ref_types_essais
ORDER BY table_name;

\echo '✅ IMPORT COMPLET - TOUTES LES 14 TABLES IMPORTÉES AVEC SUCCÈS';
