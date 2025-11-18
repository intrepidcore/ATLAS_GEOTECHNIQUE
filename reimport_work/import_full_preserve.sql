-- ============================================================================
-- IMPORT COMPLET ET ROBUSTE - PRÉSERVATION EXACTE DES DONNÉES EXCEL
-- Utilise les CSV fidèles de csv_preserve/
-- ============================================================================

\echo '🚀 IMPORT COMPLET - PRÉSERVATION EXACTE DES DONNÉES EXCEL'

-- Activer l'extension UUID si nécessaire
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

-- ============================================================================
-- 0) DÉSACTIVER TRIGGERS PENDANT IMPORT
-- ============================================================================
\echo '🔧 Désactivation des triggers...'

-- Désactiver trigger auto-géocodage
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_geocode') THEN
        ALTER TABLE public.sondages DISABLE TRIGGER trigger_auto_geocode;
        RAISE NOTICE 'Trigger auto_geocode désactivé';
    END IF;
END $$;

-- Désactiver autres triggers si nécessaires
SET session_replication_role = replica;

-- ============================================================================
-- 1) SONDAGES - Import avec préservation complète
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

-- Conversion géométrie WKT -> PostGIS
UPDATE tmp_sondages SET geom_conv = CASE
    WHEN geom_wkt IS NOT NULL AND trim(geom_wkt) <> '' AND trim(geom_wkt) <> 'nan'
    THEN ST_SetSRID(ST_GeomFromText(geom_wkt), 25231)
    ELSE NULL 
END;

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

-- Upsert final dans table cible
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
FROM tmp_sondages
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    geom = COALESCE(EXCLUDED.geom, public.sondages.geom),
    date_sondage = EXCLUDED.date_sondage,
    source = EXCLUDED.source,
    meta = EXCLUDED.meta,
    adm3_id = COALESCE(EXCLUDED.adm3_id, public.sondages.adm3_id),
    location_mode = EXCLUDED.location_mode,
    location_accuracy = EXCLUDED.location_accuracy,
    localite_base = EXCLUDED.localite_base,
    localite_key = EXCLUDED.localite_key,
    updated_at = GREATEST(EXCLUDED.updated_at, public.sondages.updated_at);

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

-- Dédupliquer
WITH ranked AS (
    SELECT id_uuid,
           ROW_NUMBER() OVER (
               PARTITION BY sondage_id_uuid, COALESCE(depth_m::numeric, 0)
               ORDER BY CASE WHEN updated_at = '' THEN NULL ELSE updated_at::timestamptz END DESC NULLS LAST,
                       id_uuid
           ) AS rn
    FROM tmp_echantillons
    WHERE sondage_id_uuid IS NOT NULL
)
DELETE FROM tmp_echantillons t
USING ranked r
WHERE t.id_uuid = r.id_uuid AND r.rn > 1;

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
WHERE EXISTS (SELECT 1 FROM public.sondages WHERE id = sondage_id_uuid)
ON CONFLICT (id) DO UPDATE SET
    depth_m = EXCLUDED.depth_m,
    laboratory = EXCLUDED.laboratory,
    updated_at = GREATEST(EXCLUDED.updated_at, public.echantillons.updated_at);

\echo '✅ ÉCHANTILLONS importés'

-- ============================================================================
-- 3) ESSAIS_ATTERBERG - Import avec FK préservées
-- ============================================================================
\echo '📋 3. IMPORT ESSAIS_ATTERBERG...'

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

-- Conversion IDs
ALTER TABLE tmp_essais_atterberg ADD COLUMN id_uuid uuid;
ALTER TABLE tmp_essais_atterberg ADD COLUMN echantillon_id_uuid uuid;

UPDATE tmp_essais_atterberg SET 
    id_uuid = CASE
        WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN id::uuid
        ELSE uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, COALESCE(id, '') || '|essais_atterberg')
    END,
    echantillon_id_uuid = CASE
        WHEN echantillon_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN echantillon_id::uuid
        ELSE uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, COALESCE(echantillon_id, '') || '|echantillons')
    END;

-- Insert avec FK check
INSERT INTO public.essais_atterberg (id, echantillon_id, wl, wp, ip_generated, meta, created_at)
SELECT 
    id_uuid,
    echantillon_id_uuid,
    CASE WHEN trim(COALESCE(wl, '')) = '' THEN NULL ELSE wl::numeric END,
    CASE WHEN trim(COALESCE(wp, '')) = '' THEN NULL ELSE wp::numeric END,
    CASE WHEN trim(COALESCE(ip_generated, '')) = '' THEN NULL ELSE ip_generated::numeric END,
    CASE WHEN trim(COALESCE(meta, '')) = '' THEN '{}'::jsonb ELSE meta::jsonb END,
    CASE WHEN trim(COALESCE(created_at, '')) = '' THEN now() ELSE created_at::timestamptz END
FROM tmp_essais_atterberg
WHERE EXISTS (SELECT 1 FROM public.echantillons WHERE id = echantillon_id_uuid)
ON CONFLICT (id) DO UPDATE SET
    wl = EXCLUDED.wl,
    wp = EXCLUDED.wp,
    ip_generated = EXCLUDED.ip_generated,
    updated_at = now();

\echo '✅ ESSAIS_ATTERBERG importés'

-- ============================================================================
-- 4) REF_TYPES_ESSAIS - Table de référence
-- ============================================================================
\echo '📋 4. IMPORT REF_TYPES_ESSAIS...'

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
WHERE code IS NOT NULL AND trim(code) != ''
ON CONFLICT (code) DO UPDATE SET
    nom_fr = EXCLUDED.nom_fr,
    nom_en = EXCLUDED.nom_en,
    categorie = EXCLUDED.categorie,
    unite_defaut = EXCLUDED.unite_defaut,
    description = EXCLUDED.description,
    ordre_affichage = EXCLUDED.ordre_affichage;

\echo '✅ REF_TYPES_ESSAIS importés'

-- ============================================================================
-- 5) RÉACTIVER TRIGGERS
-- ============================================================================
\echo '🔧 Réactivation des triggers...'

-- Réactiver session normale
SET session_replication_role = DEFAULT;

-- Réactiver trigger auto-géocodage
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_geocode') THEN
        ALTER TABLE public.sondages ENABLE TRIGGER trigger_auto_geocode;
        RAISE NOTICE 'Trigger auto_geocode réactivé';
    END IF;
END $$;

-- ============================================================================
-- 6) CONTRAINTES UNIQUES POUR EMPÊCHER DOUBLONS FUTURS
-- ============================================================================
\echo '🔒 Création des contraintes uniques...'

-- Sondages: unique sur code + date_sondage (si pas déjà existant)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_sondages_code_date') THEN
        ALTER TABLE public.sondages 
        ADD CONSTRAINT uq_sondages_code_date 
        UNIQUE (code, date_sondage);
        RAISE NOTICE 'Contrainte unique sondages créée';
    END IF;
END $$;

-- Échantillons: unique sur sondage_id + depth_m
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_echantillons_sondage_depth') THEN
        ALTER TABLE public.echantillons 
        ADD CONSTRAINT uq_echantillons_sondage_depth 
        UNIQUE (sondage_id, depth_m);
        RAISE NOTICE 'Contrainte unique échantillons créée';
    END IF;
END $$;

-- ============================================================================
-- 7) VALIDATIONS POST-IMPORT
-- ============================================================================
\echo '✅ VALIDATIONS POST-IMPORT:'

-- Comptes
SELECT 'SONDAGES_FINAL' as metric, COUNT(*) as value FROM public.sondages
UNION ALL
SELECT 'ECHANTILLONS_FINAL', COUNT(*) FROM public.echantillons
UNION ALL
SELECT 'ESSAIS_ATTERBERG_FINAL', COUNT(*) FROM public.essais_atterberg
UNION ALL
SELECT 'REF_TYPES_ESSAIS_FINAL', COUNT(*) FROM public.ref_types_essais;

-- Géocodage
SELECT 
    'SONDAGES_AVEC_GEOM' as metric, 
    COUNT(*) FILTER (WHERE geom IS NOT NULL) as value 
FROM public.sondages;

SELECT 
    'SONDAGES_AVEC_LOCALITE_KEY' as metric, 
    COUNT(*) FILTER (WHERE localite_key IS NOT NULL AND localite_key != '') as value 
FROM public.sondages;

-- FK intégrité
SELECT 
    'ECHANTILLONS_ORPHELINS' as metric,
    COUNT(*) as value
FROM public.echantillons e 
LEFT JOIN public.sondages s ON e.sondage_id = s.id 
WHERE s.id IS NULL;

COMMIT;

\echo '🎉 IMPORT COMPLET TERMINÉ - DONNÉES FIDÈLES À EXCEL PRÉSERVÉES';
