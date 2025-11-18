-- ============================================================================
-- IMPORT COMPLET ET ROBUSTE - VERSION CORRIGÉE
-- Gestion des géométries invalides et erreurs
-- ============================================================================

\echo '🚀 IMPORT COMPLET - VERSION CORRIGÉE AVEC GESTION D''ERREURS'

-- Activer l'extension UUID si nécessaire
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

-- ============================================================================
-- 0) DÉSACTIVER TRIGGERS PENDANT IMPORT
-- ============================================================================
\echo '🔧 Désactivation des triggers...'

-- Désactiver session normale pour éviter les triggers
SET session_replication_role = replica;

-- ============================================================================
-- 1) SONDAGES - Import avec gestion des géométries invalides
-- ============================================================================
\echo '📋 1. IMPORT SONDAGES...'

-- Créer table temporaire
CREATE TEMP TABLE tmp_sondages (
    id text,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    created_at text,
    updated_at text,
    deleted_at text,
    location_accuracy text,
    is_geocoded text,
    date text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    adm3_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real text,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    geom_wkt text
);

-- Import CSV avec colonnes exactes
\copy tmp_sondages FROM '/tmp/csv_preserve/sondages.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- Ajouter colonnes de conversion
ALTER TABLE tmp_sondages ADD COLUMN id_uuid uuid;
ALTER TABLE tmp_sondages ADD COLUMN geom_conv geometry(POINT,25231);

-- Conversion ID déterministe
UPDATE tmp_sondages SET id_uuid = CASE
    WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
    THEN id::uuid
    ELSE uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, COALESCE(id, '') || '|sondages')
END;

-- Conversion géométrie WKT -> PostGIS avec gestion d'erreurs
UPDATE tmp_sondages SET geom_conv = CASE
    WHEN geom_wkt IS NOT NULL 
         AND trim(geom_wkt) <> '' 
         AND trim(geom_wkt) <> 'nan'
         AND geom_wkt ~* '^POINT\s*\('  -- Vérifier que c'est un POINT valide
    THEN (
        SELECT ST_SetSRID(ST_GeomFromText(geom_wkt), 25231)
        WHERE ST_IsValid(ST_GeomFromText(geom_wkt))  -- Vérifier validité
    )
    ELSE NULL 
END;

-- Nettoyer les géométries invalides qui ont causé des erreurs
UPDATE tmp_sondages SET geom_conv = NULL 
WHERE geom_wkt IS NOT NULL 
  AND trim(geom_wkt) != '' 
  AND trim(geom_wkt) != 'nan'
  AND geom_conv IS NULL;

-- Dédupliquer dans temp table (garder le plus récent)
WITH ranked AS (
    SELECT id_uuid,
           ROW_NUMBER() OVER (
               PARTITION BY COALESCE(NULLIF(trim(code), ''), 'NO_CODE'), 
                           COALESCE(date_sondage, 'NO_DATE')
               ORDER BY CASE WHEN updated_at = '' THEN NULL ELSE updated_at::timestamptz END DESC NULLS LAST,
                       CASE WHEN created_at = '' THEN NULL ELSE created_at::timestamptz END DESC NULLS LAST,
                       id_uuid
           ) AS rn
    FROM tmp_sondages
)
DELETE FROM tmp_sondages t
USING ranked r
WHERE t.id_uuid = r.id_uuid AND r.rn > 1;

-- Vider la table cible d'abord
DELETE FROM public.sondages;

-- Insert final dans table cible (sans ON CONFLICT pour éviter erreurs)
INSERT INTO public.sondages (
    id, code, geom, date_sondage, source, meta, adm3_id, location_mode, 
    location_accuracy, operator, notes, type_sol, adm1_name, adm2_name, adm3_name,
    maille_code, localite_base, localite_key, created_at, updated_at
)
SELECT 
    id_uuid,
    COALESCE(NULLIF(trim(code), ''), 'IMPORT-' || substring(id_uuid::text, 1, 8)),
    geom_conv,
    NULLIF(trim(date_sondage), ''),
    COALESCE(NULLIF(trim(source), ''), 'reimport'),
    CASE WHEN trim(COALESCE(meta, '')) = '' THEN '{}'::jsonb ELSE meta::jsonb END,
    CASE WHEN trim(COALESCE(adm3_id, '')) = '' THEN NULL ELSE adm3_id::integer END,
    COALESCE(NULLIF(trim(location_mode), ''), 'unknown'),
    NULLIF(trim(location_accuracy), ''),
    NULLIF(trim(operator), ''),
    NULLIF(trim(notes), ''),
    NULLIF(trim(type_sol), ''),
    NULLIF(trim(adm1_name), ''),
    NULLIF(trim(adm2_name), ''),
    NULLIF(trim(adm3_name), ''),
    NULLIF(trim(maille_code), ''),
    NULLIF(trim(localite_base), ''),
    NULLIF(trim(localite_key), ''),
    CASE WHEN trim(COALESCE(created_at, '')) = '' THEN now() ELSE created_at::timestamptz END,
    CASE WHEN trim(COALESCE(updated_at, '')) = '' THEN now() ELSE updated_at::timestamptz END
FROM tmp_sondages;

\echo '✅ SONDAGES importés'

-- ============================================================================
-- 2) ÉCHANTILLONS - Import avec FK préservées
-- ============================================================================
\echo '📋 2. IMPORT ÉCHANTILLONS...'

CREATE TEMP TABLE tmp_echantillons (
    id text,
    sondage_id text,
    depth_m text,
    date text,
    laboratory text,
    norm text,
    rho_s_gcm3 text,
    water_content_w text,
    is_index text,
    eg text,
    meta text,
    created_at text,
    updated_at text
);

\copy tmp_echantillons FROM '/tmp/csv_preserve/echantillons.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- Conversion IDs
ALTER TABLE tmp_echantillons ADD COLUMN id_uuid uuid;
ALTER TABLE tmp_echantillons ADD COLUMN sondage_id_uuid uuid;

UPDATE tmp_echantillons SET 
    id_uuid = CASE
        WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN id::uuid
        ELSE uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, COALESCE(id, '') || '|echantillons')
    END,
    sondage_id_uuid = CASE
        WHEN sondage_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN sondage_id::uuid
        ELSE uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, COALESCE(sondage_id, '') || '|sondages')
    END;

-- Vider la table cible
DELETE FROM public.echantillons;

-- Insert avec vérification FK
INSERT INTO public.echantillons (
    id, sondage_id, depth_m, date, laboratory, norm, 
    rho_s_gcm3, water_content_w, is_index, eg, meta, created_at, updated_at
)
SELECT 
    id_uuid,
    sondage_id_uuid,
    CASE WHEN trim(COALESCE(depth_m, '')) = '' THEN NULL ELSE depth_m::numeric END,
    CASE WHEN trim(COALESCE(date, '')) = '' THEN NULL ELSE date::date END,
    NULLIF(trim(laboratory), ''),
    NULLIF(trim(norm), ''),
    CASE WHEN trim(COALESCE(rho_s_gcm3, '')) = '' THEN NULL ELSE rho_s_gcm3::numeric END,
    CASE WHEN trim(COALESCE(water_content_w, '')) = '' THEN NULL ELSE water_content_w::numeric END,
    CASE WHEN trim(COALESCE(is_index, '')) IN ('true', 'True', '1') THEN true ELSE false END,
    NULLIF(trim(eg), ''),
    CASE WHEN trim(COALESCE(meta, '')) = '' THEN '{}'::jsonb ELSE meta::jsonb END,
    CASE WHEN trim(COALESCE(created_at, '')) = '' THEN now() ELSE created_at::timestamptz END,
    CASE WHEN trim(COALESCE(updated_at, '')) = '' THEN now() ELSE updated_at::timestamptz END
FROM tmp_echantillons
WHERE EXISTS (SELECT 1 FROM public.sondages WHERE id = sondage_id_uuid);

\echo '✅ ÉCHANTILLONS importés'

-- ============================================================================
-- 3) REF_TYPES_ESSAIS - Table de référence
-- ============================================================================
\echo '📋 3. IMPORT REF_TYPES_ESSAIS...'

CREATE TEMP TABLE tmp_ref_types_essais (
    code text,
    nom_fr text,
    nom_en text,
    categorie text,
    unite_defaut text,
    description text,
    ordre_affichage text
);

\copy tmp_ref_types_essais FROM '/tmp/csv_preserve/ref_types_essais.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- Vider la table
DELETE FROM public.ref_types_essais;

INSERT INTO public.ref_types_essais (code, nom_fr, nom_en, categorie, unite_defaut, description, ordre_affichage)
SELECT 
    code,
    nom_fr,
    nom_en,
    categorie,
    unite_defaut,
    description,
    CASE WHEN trim(COALESCE(ordre_affichage, '')) = '' THEN NULL ELSE ordre_affichage::integer END
FROM tmp_ref_types_essais
WHERE code IS NOT NULL AND trim(code) != '';

\echo '✅ REF_TYPES_ESSAIS importés'

-- ============================================================================
-- 4) RÉACTIVER TRIGGERS ET SESSION NORMALE
-- ============================================================================
\echo '🔧 Réactivation des triggers...'

-- Réactiver session normale
SET session_replication_role = DEFAULT;

-- ============================================================================
-- 5) METTRE À JOUR LE GÉOCODAGE
-- ============================================================================
\echo '🗺️ Mise à jour du géocodage...'

-- Marquer comme géocodés les sondages avec géométrie
UPDATE public.sondages 
SET is_geocoded = true 
WHERE geom IS NOT NULL AND is_geocoded = false;

-- Essayer de géocoder via adm3_id si la table existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'atlas' AND table_name = 'adm3') THEN
        UPDATE public.sondages 
        SET geom = (
            SELECT ST_Centroid(geom) 
            FROM atlas.adm3 
            WHERE gid = sondages.adm3_id
        ),
        location_mode = 'centroid',
        location_accuracy = 'adm3_centroid',
        is_geocoded = true
        WHERE adm3_id IS NOT NULL 
          AND geom IS NULL
          AND EXISTS (SELECT 1 FROM atlas.adm3 WHERE gid = sondages.adm3_id);
        
        RAISE NOTICE 'Géocodage automatique appliqué via atlas.adm3';
    ELSE
        RAISE NOTICE 'Table atlas.adm3 non trouvée - géocodage automatique non appliqué';
    END IF;
END $$;

-- ============================================================================
-- 6) VALIDATIONS FINALES
-- ============================================================================
\echo '✅ VALIDATIONS FINALES:'

-- Comptes
SELECT 'SONDAGES_FINAL' as metric, COUNT(*) as value FROM public.sondages
UNION ALL
SELECT 'ECHANTILLONS_FINAL', COUNT(*) FROM public.echantillons
UNION ALL
SELECT 'REF_TYPES_ESSAIS_FINAL', COUNT(*) FROM public.ref_types_essais;

-- Géocodage
SELECT 
    'GÉOCODAGE_STATS' as metric,
    CONCAT(
        'Total: ', COUNT(*), 
        ', Avec géom: ', COUNT(*) FILTER (WHERE geom IS NOT NULL),
        ', Géocodés: ', COUNT(*) FILTER (WHERE is_geocoded = true),
        ', Localite_key: ', COUNT(*) FILTER (WHERE localite_key IS NOT NULL AND localite_key != '')
    ) as value
FROM public.sondages;

-- FK intégrité
SELECT 
    'ECHANTILLONS_ORPHELINS' as metric,
    COUNT(*) as value
FROM public.echantillons e 
LEFT JOIN public.sondages s ON e.sondage_id = s.id 
WHERE s.id IS NULL;

COMMIT;

\echo '🎉 IMPORT CORRIGÉ TERMINÉ - DONNÉES PRÉSERVÉES AVEC GESTION D''ERREURS';
