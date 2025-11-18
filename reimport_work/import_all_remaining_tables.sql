-- ============================================================================
-- IMPORT COMPLET DE TOUTES LES TABLES RESTANTES
-- Solution propre et durable avec gestion d'erreurs
-- ============================================================================

\echo '🚀 Import complet de toutes les tables restantes...'

-- ============================================================================
-- 1. REF_TYPES_ESSAIS (table de référence)
-- ============================================================================
\echo '📋 Import ref_types_essais...'

CREATE TEMP TABLE temp_ref_types_essais AS 
SELECT * FROM (VALUES 
    ('code'::text, 'nom_fr'::text, 'nom_en'::text, 'categorie'::text, 'unite_defaut'::text, 'description'::text, 'ordre_affichage'::text, 'id'::text)
) t(code, nom_fr, nom_en, categorie, unite_defaut, description, ordre_affichage, id) WHERE false;

\copy temp_ref_types_essais FROM '/tmp/csv/ref_types_essais.csv' WITH (FORMAT csv, HEADER true);

-- Nettoyer et insérer
INSERT INTO public.ref_types_essais (code, nom_fr, nom_en, categorie, unite_defaut, description, ordre_affichage)
SELECT 
    code,
    nom_fr,
    nom_en, 
    categorie,
    unite_defaut,
    description,
    CASE WHEN TRIM(COALESCE(ordre_affichage, '')) = '' THEN NULL ELSE ordre_affichage::integer END
FROM temp_ref_types_essais
WHERE code IS NOT NULL AND TRIM(code) != ''
ON CONFLICT (code) DO UPDATE SET
    nom_fr = EXCLUDED.nom_fr,
    nom_en = EXCLUDED.nom_en,
    categorie = EXCLUDED.categorie,
    unite_defaut = EXCLUDED.unite_defaut,
    description = EXCLUDED.description,
    ordre_affichage = EXCLUDED.ordre_affichage;

-- ============================================================================
-- 2. ÉCHANTILLONS (dépend de sondages)
-- ============================================================================
\echo '📋 Import echantillons...'

CREATE TEMP TABLE temp_echantillons AS 
SELECT * FROM (VALUES 
    ('id'::text, 'sondage_id'::text, 'depth_m'::text, 'date'::text, 'laboratory'::text, 'norm'::text, 'rho_s_gcm3'::text, 'water_content_w'::text, 'is_index'::text, 'eg'::text, 'meta'::text, 'created_at'::text, 'updated_at'::text)
) t(id, sondage_id, depth_m, date, laboratory, norm, rho_s_gcm3, water_content_w, is_index, eg, meta, created_at, updated_at) WHERE false;

\copy temp_echantillons FROM '/tmp/csv/echantillons.csv' WITH (FORMAT csv, HEADER true);

-- Nettoyer et insérer seulement si sondage_id existe
INSERT INTO public.echantillons (
    id, sondage_id, depth_m, date, laboratory, norm, 
    rho_s_gcm3, water_content_w, is_index, eg, meta
)
SELECT 
    COALESCE(NULLIF(TRIM(id), ''), gen_random_uuid()::text)::uuid,
    sondage_id::uuid,
    CASE WHEN TRIM(COALESCE(depth_m, '')) = '' THEN NULL ELSE depth_m::numeric END,
    CASE WHEN TRIM(COALESCE(date, '')) = '' THEN NULL ELSE date::date END,
    laboratory,
    norm,
    CASE WHEN TRIM(COALESCE(rho_s_gcm3, '')) = '' THEN NULL ELSE rho_s_gcm3::numeric END,
    CASE WHEN TRIM(COALESCE(water_content_w, '')) = '' THEN NULL ELSE water_content_w::numeric END,
    CASE WHEN TRIM(COALESCE(is_index, '')) IN ('true', 'True', '1') THEN true ELSE false END,
    eg,
    meta
FROM temp_echantillons
WHERE sondage_id IS NOT NULL 
  AND TRIM(sondage_id) != ''
  AND EXISTS (SELECT 1 FROM public.sondages WHERE id = sondage_id::uuid)
ON CONFLICT (id) DO UPDATE SET
    depth_m = EXCLUDED.depth_m,
    laboratory = EXCLUDED.laboratory,
    updated_at = now();

-- ============================================================================
-- 3. ESSAIS ATTERBERG (dépend d'échantillons)
-- ============================================================================
\echo '📋 Import essais_atterberg...'

CREATE TEMP TABLE temp_essais_atterberg AS 
SELECT * FROM (VALUES 
    ('id'::text, 'echantillon_id'::text, 'wl'::text, 'wp'::text, 'ip_generated'::text, 'meta'::text, 'created_at'::text, 'ip_calculated'::text)
) t(id, echantillon_id, wl, wp, ip_generated, meta, created_at, ip_calculated) WHERE false;

\copy temp_essais_atterberg FROM '/tmp/csv/essais_atterberg.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.essais_atterberg (id, echantillon_id, wl, wp, ip_generated, meta)
SELECT 
    COALESCE(NULLIF(TRIM(id), ''), gen_random_uuid()::text)::uuid,
    echantillon_id::uuid,
    CASE WHEN TRIM(COALESCE(wl, '')) = '' THEN NULL ELSE wl::numeric END,
    CASE WHEN TRIM(COALESCE(wp, '')) = '' THEN NULL ELSE wp::numeric END,
    CASE WHEN TRIM(COALESCE(ip_generated, '')) = '' THEN NULL ELSE ip_generated::numeric END,
    meta
FROM temp_essais_atterberg
WHERE echantillon_id IS NOT NULL 
  AND TRIM(echantillon_id) != ''
  AND EXISTS (SELECT 1 FROM public.echantillons WHERE id = echantillon_id::uuid)
ON CONFLICT (id) DO UPDATE SET
    wl = EXCLUDED.wl,
    wp = EXCLUDED.wp,
    ip_generated = EXCLUDED.ip_generated;

-- ============================================================================
-- 4. AUTRES TABLES (pattern similaire)
-- ============================================================================

-- ESSAIS GÉOTECHNIQUES
\echo '📋 Import essais_geotechniques...'
CREATE TEMP TABLE temp_essais_geotechniques AS 
SELECT * FROM (VALUES 
    ('id'::text, 'sondage_id'::text, 'depth_m'::text, 'passant_80um'::text, 'passant_2mm'::text, 'passant_20mm'::text, 'wl'::text, 'wp'::text, 'ip'::text, 'vbs'::text, 'gamma_d_max'::text, 'w_opt'::text, 'proctor_type'::text, 'eg'::text, 'test_date'::text, 'laboratory'::text, 'norm'::text, 'meta'::text, 'created_at'::text, 'created_by'::text, 'updated_at'::text, 'updated_by'::text, 'created_by_batch'::text, 'updated_by_batch'::text, 'deleted_by_batch'::text, 'deleted_at'::text)
) t(id, sondage_id, depth_m, passant_80um, passant_2mm, passant_20mm, wl, wp, ip, vbs, gamma_d_max, w_opt, proctor_type, eg, test_date, laboratory, norm, meta, created_at, created_by, updated_at, updated_by, created_by_batch, updated_by_batch, deleted_by_batch, deleted_at) WHERE false;

\copy temp_essais_geotechniques FROM '/tmp/csv/essais_geotechniques.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO public.essais_geotechniques (
    id, sondage_id, depth_m, passant_80um, passant_2mm, passant_20mm,
    wl, wp, ip, vbs, gamma_d_max, w_opt, proctor_type, eg, 
    test_date, laboratory, norm, meta
)
SELECT 
    COALESCE(NULLIF(TRIM(id), ''), gen_random_uuid()::text)::uuid,
    sondage_id::uuid,
    CASE WHEN TRIM(COALESCE(depth_m, '')) = '' THEN NULL ELSE depth_m::numeric END,
    CASE WHEN TRIM(COALESCE(passant_80um, '')) = '' THEN NULL ELSE passant_80um::numeric END,
    CASE WHEN TRIM(COALESCE(passant_2mm, '')) = '' THEN NULL ELSE passant_2mm::numeric END,
    CASE WHEN TRIM(COALESCE(passant_20mm, '')) = '' THEN NULL ELSE passant_20mm::numeric END,
    CASE WHEN TRIM(COALESCE(wl, '')) = '' THEN NULL ELSE wl::numeric END,
    CASE WHEN TRIM(COALESCE(wp, '')) = '' THEN NULL ELSE wp::numeric END,
    CASE WHEN TRIM(COALESCE(ip, '')) = '' THEN NULL ELSE ip::numeric END,
    CASE WHEN TRIM(COALESCE(vbs, '')) = '' THEN NULL ELSE vbs::numeric END,
    CASE WHEN TRIM(COALESCE(gamma_d_max, '')) = '' THEN NULL ELSE gamma_d_max::numeric END,
    CASE WHEN TRIM(COALESCE(w_opt, '')) = '' THEN NULL ELSE w_opt::numeric END,
    proctor_type,
    eg,
    CASE WHEN TRIM(COALESCE(test_date, '')) = '' THEN NULL ELSE test_date::date END,
    laboratory,
    norm,
    meta
FROM temp_essais_geotechniques
WHERE sondage_id IS NOT NULL 
  AND TRIM(sondage_id) != ''
  AND EXISTS (SELECT 1 FROM public.sondages WHERE id = sondage_id::uuid)
ON CONFLICT (id) DO UPDATE SET
    depth_m = EXCLUDED.depth_m,
    passant_80um = EXCLUDED.passant_80um,
    updated_at = now();

-- ============================================================================
-- STATISTIQUES FINALES
-- ============================================================================
\echo '📊 Statistiques finales après import complet:'

SELECT 
    'sondages' as table_name, COUNT(*) as rows FROM public.sondages
UNION ALL
SELECT 'echantillons', COUNT(*) FROM public.echantillons
UNION ALL
SELECT 'essais_atterberg', COUNT(*) FROM public.essais_atterberg
UNION ALL
SELECT 'essais_geotechniques', COUNT(*) FROM public.essais_geotechniques
UNION ALL
SELECT 'ref_types_essais', COUNT(*) FROM public.ref_types_essais
ORDER BY table_name;

\echo '✅ Import complet terminé - Toutes les tables principales importées';
