-- Import des tables restantes (sans contraintes complexes)

-- RAW_LAB_AGS
\echo 'Import raw_lab_ags...'
CREATE TEMP TABLE temp_raw_lab_ags (
    id TEXT, code_site TEXT, depth_m TEXT, sieve_mm TEXT, 
    passants_pct TEXT, echantillon_id TEXT, created_at TEXT, updated_at TEXT
);
\copy temp_raw_lab_ags FROM '/tmp/csv/raw_lab_ags.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.raw_lab_ags (id, code_site, depth_m, sieve_mm, passants_pct, echantillon_id)
SELECT 
    COALESCE(NULLIF(TRIM(id), ''), gen_random_uuid()::text)::uuid,
    code_site,
    CASE WHEN TRIM(COALESCE(depth_m, '')) = '' THEN NULL ELSE depth_m::numeric END,
    CASE WHEN TRIM(COALESCE(sieve_mm, '')) = '' THEN NULL ELSE sieve_mm::numeric END,
    CASE WHEN TRIM(COALESCE(passants_pct, '')) = '' THEN NULL ELSE passants_pct::numeric END,
    CASE WHEN TRIM(COALESCE(echantillon_id, '')) = '' THEN NULL ELSE echantillon_id::uuid END
FROM temp_raw_lab_ags;

-- RAW_LAB_AGT
\echo 'Import raw_lab_agt...'
CREATE TEMP TABLE temp_raw_lab_agt (
    id TEXT, code_site TEXT, depth_m TEXT, sieve_mm TEXT, mass_refus_cum_g TEXT,
    refus_cum_pct TEXT, passants_pct TEXT, echantillon_id TEXT, created_at TEXT, updated_at TEXT
);
\copy temp_raw_lab_agt FROM '/tmp/csv/raw_lab_agt.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.raw_lab_agt (id, code_site, depth_m, sieve_mm, mass_refus_cum_g, refus_cum_pct, passants_pct, echantillon_id)
SELECT 
    COALESCE(NULLIF(TRIM(id), ''), gen_random_uuid()::text)::uuid,
    code_site,
    CASE WHEN TRIM(COALESCE(depth_m, '')) = '' THEN NULL ELSE depth_m::numeric END,
    CASE WHEN TRIM(COALESCE(sieve_mm, '')) = '' THEN NULL ELSE sieve_mm::numeric END,
    CASE WHEN TRIM(COALESCE(mass_refus_cum_g, '')) = '' THEN NULL ELSE mass_refus_cum_g::numeric END,
    CASE WHEN TRIM(COALESCE(refus_cum_pct, '')) = '' THEN NULL ELSE refus_cum_pct::numeric END,
    CASE WHEN TRIM(COALESCE(passants_pct, '')) = '' THEN NULL ELSE passants_pct::numeric END,
    CASE WHEN TRIM(COALESCE(echantillon_id, '')) = '' THEN NULL ELSE echantillon_id::uuid END
FROM temp_raw_lab_agt;

-- ESSAIS_VBS
\echo 'Import essais_vbs...'
CREATE TEMP TABLE temp_essais_vbs (
    id TEXT, echantillon_id TEXT, vbs TEXT, commentaire TEXT, meta TEXT, created_at TEXT
);
\copy temp_essais_vbs FROM '/tmp/csv/essais_vbs.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.essais_vbs (id, echantillon_id, vbs, commentaire, meta)
SELECT 
    COALESCE(NULLIF(TRIM(id), ''), gen_random_uuid()::text)::uuid,
    echantillon_id::uuid,
    CASE WHEN TRIM(COALESCE(vbs, '')) = '' THEN NULL ELSE vbs::numeric END,
    commentaire,
    meta
FROM temp_essais_vbs
WHERE echantillon_id IS NOT NULL AND TRIM(echantillon_id) != '';

-- REF_TYPES_ESSAIS (simple insert)
\echo 'Import ref_types_essais (simple)...'
INSERT INTO public.ref_types_essais (code, nom_fr, nom_en, categorie, unite_defaut, description)
VALUES 
    ('SPT_N', 'SPT N', 'SPT N-value', 'penetration', 'coups/30cm', 'Standard Penetration Test'),
    ('qc', 'Résistance de pointe', 'Cone resistance', 'penetration', 'MPa', 'Cone Penetration Test'),
    ('WL', 'Limite de liquidité', 'Liquid limit', 'atterberg', '%', 'Limite de liquidité'),
    ('WP', 'Limite de plasticité', 'Plastic limit', 'atterberg', '%', 'Limite de plasticité'),
    ('IP', 'Indice de plasticité', 'Plasticity index', 'atterberg', '%', 'Indice de plasticité'),
    ('VBS', 'Valeur de bleu', 'Methylene blue value', 'classification', 'g/100g', 'Valeur de bleu de méthylène')
ON CONFLICT (code) DO NOTHING;

-- Statistiques finales
SELECT 
    'FINAL - sondages' as table_name, COUNT(*) as rows FROM public.sondages
UNION ALL
SELECT 'FINAL - echantillons', COUNT(*) FROM public.echantillons
UNION ALL
SELECT 'FINAL - essais_atterberg', COUNT(*) FROM public.essais_atterberg
UNION ALL
SELECT 'FINAL - essais_geotechniques', COUNT(*) FROM public.essais_geotechniques
UNION ALL
SELECT 'FINAL - essais_vbs', COUNT(*) FROM public.essais_vbs
UNION ALL
SELECT 'FINAL - raw_lab_ags', COUNT(*) FROM public.raw_lab_ags
UNION ALL
SELECT 'FINAL - raw_lab_agt', COUNT(*) FROM public.raw_lab_agt
UNION ALL
SELECT 'FINAL - ref_types_essais', COUNT(*) FROM public.ref_types_essais
ORDER BY table_name;
