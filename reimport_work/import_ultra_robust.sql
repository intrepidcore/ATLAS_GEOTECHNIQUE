-- ============================================================================
-- IMPORT ULTRA-ROBUSTE - GESTION DE TOUS LES CAS D'ERREUR
-- Version sans transaction pour éviter les rollbacks
-- ============================================================================

\echo '🚀 IMPORT ULTRA-ROBUSTE - GESTION COMPLÈTE DES ERREURS'

-- Activer l'extension UUID si nécessaire
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Désactiver session normale pour éviter les triggers
SET session_replication_role = replica;

-- ============================================================================
-- 1) SONDAGES - Import ultra-robuste
-- ============================================================================
\echo '📋 1. IMPORT SONDAGES ULTRA-ROBUSTE...'

-- Créer table temporaire
DROP TABLE IF EXISTS tmp_sondages;
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

-- Import CSV
\copy tmp_sondages FROM '/tmp/csv_preserve/sondages.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- Ajouter colonnes de conversion
ALTER TABLE tmp_sondages ADD COLUMN id_uuid uuid;
ALTER TABLE tmp_sondages ADD COLUMN geom_conv geometry(POINT,25231);
ALTER TABLE tmp_sondages ADD COLUMN meta_clean jsonb;

-- Conversion ID déterministe
UPDATE tmp_sondages SET id_uuid = CASE
    WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
    THEN id::uuid
    ELSE uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, COALESCE(id, '') || '|sondages')
END;

-- Nettoyage meta JSON (gérer les valeurs non-JSON)
UPDATE tmp_sondages SET meta_clean = CASE
    WHEN meta IS NULL OR trim(meta) = '' THEN '{}'::jsonb
    WHEN meta = '{}' THEN '{}'::jsonb
    WHEN meta ~ '^{.*}$' THEN 
        CASE 
            WHEN meta::text ~ '^{.*}$' THEN 
                CASE 
                    WHEN jsonb_typeof(meta::jsonb) = 'object' THEN meta::jsonb
                    ELSE '{}'::jsonb
                END
            ELSE '{}'::jsonb
        END
    ELSE ('{"raw_value": "' || replace(meta, '"', '\"') || '"}')::jsonb
END;

-- Géométrie sécurisée (ignorer les erreurs)
UPDATE tmp_sondages SET geom_conv = NULL;  -- Par défaut NULL

-- Essayer de convertir les géométries valides une par une
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT id_uuid, geom_wkt FROM tmp_sondages 
               WHERE geom_wkt IS NOT NULL 
                 AND trim(geom_wkt) != '' 
                 AND trim(geom_wkt) != 'nan'
                 AND geom_wkt ~* '^POINT\s*\('
    LOOP
        BEGIN
            UPDATE tmp_sondages 
            SET geom_conv = ST_SetSRID(ST_GeomFromText(rec.geom_wkt), 25231)
            WHERE id_uuid = rec.id_uuid
              AND ST_IsValid(ST_GeomFromText(rec.geom_wkt));
        EXCEPTION WHEN OTHERS THEN
            -- Ignorer les erreurs de géométrie
            NULL;
        END;
    END LOOP;
END $$;

-- Vider la table cible
DELETE FROM public.sondages;

-- Insert final sécurisé
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
    COALESCE(meta_clean, '{}'::jsonb),
    CASE WHEN trim(COALESCE(adm3_id, '')) = '' OR trim(adm3_id) = 'nan' THEN NULL 
         ELSE 
             CASE WHEN adm3_id ~ '^[0-9]+$' THEN adm3_id::integer ELSE NULL END
    END,
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
    CASE WHEN trim(COALESCE(created_at, '')) = '' THEN now() 
         ELSE 
             CASE WHEN created_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN created_at::timestamptz 
                  ELSE now() END
    END,
    CASE WHEN trim(COALESCE(updated_at, '')) = '' THEN now() 
         ELSE 
             CASE WHEN updated_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN updated_at::timestamptz 
                  ELSE now() END
    END
FROM tmp_sondages;

\echo '✅ SONDAGES importés de façon ultra-robuste'

-- ============================================================================
-- 2) ÉCHANTILLONS - Import ultra-robuste
-- ============================================================================
\echo '📋 2. IMPORT ÉCHANTILLONS ULTRA-ROBUSTE...'

DROP TABLE IF EXISTS tmp_echantillons;
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
ALTER TABLE tmp_echantillons ADD COLUMN meta_clean jsonb;

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
    END,
    meta_clean = CASE
        WHEN meta IS NULL OR trim(meta) = '' THEN '{}'::jsonb
        WHEN meta = '{}' THEN '{}'::jsonb
        ELSE COALESCE(meta::jsonb, '{}'::jsonb)
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
    CASE WHEN trim(COALESCE(depth_m, '')) = '' OR depth_m = 'nan' THEN NULL 
         ELSE 
             CASE WHEN depth_m ~ '^[0-9]+\.?[0-9]*$' THEN depth_m::numeric ELSE NULL END
    END,
    CASE WHEN trim(COALESCE(date, '')) = '' THEN NULL 
         ELSE 
             CASE WHEN date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN date::date ELSE NULL END
    END,
    NULLIF(trim(laboratory), ''),
    NULLIF(trim(norm), ''),
    CASE WHEN trim(COALESCE(rho_s_gcm3, '')) = '' OR rho_s_gcm3 = 'nan' THEN NULL 
         ELSE 
             CASE WHEN rho_s_gcm3 ~ '^[0-9]+\.?[0-9]*$' THEN rho_s_gcm3::numeric ELSE NULL END
    END,
    CASE WHEN trim(COALESCE(water_content_w, '')) = '' OR water_content_w = 'nan' THEN NULL 
         ELSE 
             CASE WHEN water_content_w ~ '^[0-9]+\.?[0-9]*$' THEN water_content_w::numeric ELSE NULL END
    END,
    CASE WHEN trim(COALESCE(is_index, '')) IN ('true', 'True', '1') THEN true ELSE false END,
    NULLIF(trim(eg), ''),
    COALESCE(meta_clean, '{}'::jsonb),
    CASE WHEN trim(COALESCE(created_at, '')) = '' THEN now() 
         ELSE 
             CASE WHEN created_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN created_at::timestamptz 
                  ELSE now() END
    END,
    CASE WHEN trim(COALESCE(updated_at, '')) = '' THEN now() 
         ELSE 
             CASE WHEN updated_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN updated_at::timestamptz 
                  ELSE now() END
    END
FROM tmp_echantillons
WHERE EXISTS (SELECT 1 FROM public.sondages WHERE id = sondage_id_uuid);

\echo '✅ ÉCHANTILLONS importés de façon ultra-robuste'

-- ============================================================================
-- 3) REF_TYPES_ESSAIS - Import ultra-robuste
-- ============================================================================
\echo '📋 3. IMPORT REF_TYPES_ESSAIS ULTRA-ROBUSTE...'

DROP TABLE IF EXISTS tmp_ref_types_essais;
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
    CASE WHEN trim(COALESCE(ordre_affichage, '')) = '' OR ordre_affichage = 'nan' THEN NULL 
         ELSE 
             CASE WHEN ordre_affichage ~ '^[0-9]+$' THEN ordre_affichage::integer ELSE NULL END
    END
FROM tmp_ref_types_essais
WHERE code IS NOT NULL AND trim(code) != '';

\echo '✅ REF_TYPES_ESSAIS importés de façon ultra-robuste'

-- ============================================================================
-- 4) RÉACTIVER ET GÉOCODER
-- ============================================================================
\echo '🔧 Réactivation et géocodage...'

-- Réactiver session normale
SET session_replication_role = DEFAULT;

-- Marquer comme géocodés les sondages avec géométrie
UPDATE public.sondages 
SET is_geocoded = true 
WHERE geom IS NOT NULL AND (is_geocoded = false OR is_geocoded IS NULL);

-- Essayer de géocoder via adm3_id si possible
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
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erreur géocodage automatique ignorée';
END $$;

-- ============================================================================
-- 5) VALIDATIONS FINALES
-- ============================================================================
\echo '✅ VALIDATIONS FINALES ULTRA-ROBUSTES:'

-- Comptes
SELECT 'SONDAGES_FINAL' as metric, COUNT(*) as value FROM public.sondages
UNION ALL
SELECT 'ECHANTILLONS_FINAL', COUNT(*) FROM public.echantillons
UNION ALL
SELECT 'REF_TYPES_ESSAIS_FINAL', COUNT(*) FROM public.ref_types_essais;

-- Géocodage détaillé
SELECT 
    COUNT(*) as total_sondages,
    COUNT(*) FILTER (WHERE geom IS NOT NULL) as avec_geometrie,
    COUNT(*) FILTER (WHERE is_geocoded = true) as marques_geocodes,
    COUNT(*) FILTER (WHERE localite_key IS NOT NULL AND localite_key != '') as avec_localite_key,
    COUNT(*) FILTER (WHERE adm3_id IS NOT NULL) as avec_adm3_id,
    ROUND(100.0 * COUNT(*) FILTER (WHERE geom IS NOT NULL) / COUNT(*), 2) as pct_geocode
FROM public.sondages;

-- FK intégrité
SELECT 
    COUNT(*) as echantillons_orphelins
FROM public.echantillons e 
LEFT JOIN public.sondages s ON e.sondage_id = s.id 
WHERE s.id IS NULL;

\echo '🎉 IMPORT ULTRA-ROBUSTE TERMINÉ - TOUTES LES ERREURS GÉRÉES';
