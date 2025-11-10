-- ============================================================================
-- Migration Complète : Correction de TOUS les types de colonnes
-- Date : 2025-11-07
-- Description : Convertir toutes les colonnes TEXT vers leurs types appropriés
-- ============================================================================

BEGIN;

SELECT '🔧 Début de la migration complète des types...' as info;

-- ============================================================================
-- PARTIE 1 : TABLE adm3 (PRIORITAIRE - utilisée par l'API)
-- ============================================================================

SELECT '📋 Migration de la table adm3...' as info;

-- Créer colonnes temporaires
ALTER TABLE adm3 ADD COLUMN gid_int INTEGER;

-- Convertir gid
UPDATE adm3 SET gid_int = CASE WHEN gid ~ '^\d+$' THEN gid::integer ELSE NULL END;

-- Basculer
ALTER TABLE adm3 DROP CONSTRAINT IF EXISTS adm3_pkey CASCADE;
ALTER TABLE adm3 RENAME COLUMN gid TO gid_old;
ALTER TABLE adm3 RENAME COLUMN gid_int TO gid;
ALTER TABLE adm3 ADD PRIMARY KEY (gid);
ALTER TABLE adm3 DROP COLUMN gid_old;

-- Index pour recherches
CREATE INDEX IF NOT EXISTS idx_adm3_adm3_fr ON adm3(adm3_fr);
CREATE INDEX IF NOT EXISTS idx_adm3_adm3_pcode ON adm3(adm3_pcode);

SELECT '✅ adm3 migrée' as info;

-- ============================================================================
-- PARTIE 2 : TABLE echantillons
-- ============================================================================

SELECT '📋 Migration de la table echantillons...' as info;

-- Supprimer la vue matérialisée si elle dépend de echantillons
DROP MATERIALIZED VIEW IF EXISTS mv_mailles_geotech CASCADE;

-- IDs et relations
ALTER TABLE echantillons ADD COLUMN id_uuid UUID;
ALTER TABLE echantillons ADD COLUMN sondage_id_uuid UUID;
ALTER TABLE echantillons ADD COLUMN created_at_ts TIMESTAMPTZ;
ALTER TABLE echantillons ADD COLUMN updated_at_ts TIMESTAMPTZ;
ALTER TABLE echantillons ADD COLUMN deleted_at_ts TIMESTAMPTZ;

-- Colonnes numériques
ALTER TABLE echantillons ADD COLUMN depth_m_min_num NUMERIC;
ALTER TABLE echantillons ADD COLUMN depth_m_max_num NUMERIC;
ALTER TABLE echantillons ADD COLUMN rho_s_gcm3_num NUMERIC;
ALTER TABLE echantillons ADD COLUMN water_content_w_num NUMERIC;

-- Convertir les données
UPDATE echantillons SET
    id_uuid = CASE WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid ELSE NULL END,
    sondage_id_uuid = CASE WHEN sondage_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN sondage_id::uuid ELSE NULL END,
    created_at_ts = CASE WHEN created_at ~ '^\d{4}-\d{2}-\d{2}' THEN created_at::timestamptz ELSE NOW() END,
    updated_at_ts = CASE WHEN updated_at ~ '^\d{4}-\d{2}-\d{2}' THEN updated_at::timestamptz ELSE NULL END,
    deleted_at_ts = CASE WHEN deleted_at ~ '^\d{4}-\d{2}-\d{2}' THEN deleted_at::timestamptz ELSE NULL END,
    depth_m_min_num = CASE WHEN depth_m_min ~ '^-?\d+\.?\d*$' THEN depth_m_min::numeric ELSE NULL END,
    depth_m_max_num = CASE WHEN depth_m_max ~ '^-?\d+\.?\d*$' THEN depth_m_max::numeric ELSE NULL END,
    rho_s_gcm3_num = CASE WHEN rho_s_gcm3 ~ '^-?\d+\.?\d*$' THEN rho_s_gcm3::numeric ELSE NULL END,
    water_content_w_num = CASE WHEN water_content_w ~ '^-?\d+\.?\d*$' THEN water_content_w::numeric ELSE NULL END;

-- Basculer
ALTER TABLE echantillons DROP CONSTRAINT IF EXISTS echantillons_pkey CASCADE;
ALTER TABLE echantillons RENAME COLUMN id TO id_old;
ALTER TABLE echantillons RENAME COLUMN sondage_id TO sondage_id_old;
ALTER TABLE echantillons RENAME COLUMN created_at TO created_at_old;
ALTER TABLE echantillons RENAME COLUMN updated_at TO updated_at_old;
ALTER TABLE echantillons RENAME COLUMN deleted_at TO deleted_at_old;
ALTER TABLE echantillons RENAME COLUMN depth_m_min TO depth_m_min_old;
ALTER TABLE echantillons RENAME COLUMN depth_m_max TO depth_m_max_old;
ALTER TABLE echantillons RENAME COLUMN rho_s_gcm3 TO rho_s_gcm3_old;
ALTER TABLE echantillons RENAME COLUMN water_content_w TO water_content_w_old;

ALTER TABLE echantillons RENAME COLUMN id_uuid TO id;
ALTER TABLE echantillons RENAME COLUMN sondage_id_uuid TO sondage_id;
ALTER TABLE echantillons RENAME COLUMN created_at_ts TO created_at;
ALTER TABLE echantillons RENAME COLUMN updated_at_ts TO updated_at;
ALTER TABLE echantillons RENAME COLUMN deleted_at_ts TO deleted_at;
ALTER TABLE echantillons RENAME COLUMN depth_m_min_num TO depth_m_min;
ALTER TABLE echantillons RENAME COLUMN depth_m_max_num TO depth_m_max;
ALTER TABLE echantillons RENAME COLUMN rho_s_gcm3_num TO rho_s_gcm3;
ALTER TABLE echantillons RENAME COLUMN water_content_w_num TO water_content_w;

-- Contraintes
ALTER TABLE echantillons ADD PRIMARY KEY (id);
ALTER TABLE echantillons ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE echantillons ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE echantillons ADD CONSTRAINT fk_echantillons_sondage FOREIGN KEY (sondage_id) REFERENCES sondages(id) ON DELETE CASCADE;

-- Nettoyer
ALTER TABLE echantillons DROP COLUMN id_old;
ALTER TABLE echantillons DROP COLUMN sondage_id_old;
ALTER TABLE echantillons DROP COLUMN created_at_old;
ALTER TABLE echantillons DROP COLUMN updated_at_old;
ALTER TABLE echantillons DROP COLUMN deleted_at_old;
ALTER TABLE echantillons DROP COLUMN depth_m_min_old;
ALTER TABLE echantillons DROP COLUMN depth_m_max_old;
ALTER TABLE echantillons DROP COLUMN rho_s_gcm3_old;
ALTER TABLE echantillons DROP COLUMN water_content_w_old;

SELECT '✅ echantillons migrée' as info;

-- ============================================================================
-- PARTIE 3 : TABLES essais_* (pattern similaire)
-- ============================================================================

SELECT '📋 Migration des tables essais...' as info;

-- essais_atterberg
ALTER TABLE essais_atterberg ADD COLUMN id_uuid UUID;
ALTER TABLE essais_atterberg ADD COLUMN echantillon_id_uuid UUID;
ALTER TABLE essais_atterberg ADD COLUMN created_at_ts TIMESTAMPTZ;
ALTER TABLE essais_atterberg ADD COLUMN wl_num NUMERIC;
ALTER TABLE essais_atterberg ADD COLUMN wp_num NUMERIC;
ALTER TABLE essais_atterberg ADD COLUMN ip_generated_num NUMERIC;

UPDATE essais_atterberg SET
    id_uuid = CASE WHEN id ~ '^[0-9a-f-]{36}$' THEN id::uuid ELSE NULL END,
    echantillon_id_uuid = CASE WHEN echantillon_id ~ '^[0-9a-f-]{36}$' THEN echantillon_id::uuid ELSE NULL END,
    created_at_ts = CASE WHEN created_at ~ '^\d{4}-\d{2}-\d{2}' THEN created_at::timestamptz ELSE NOW() END,
    wl_num = CASE WHEN wl ~ '^-?\d+\.?\d*$' THEN wl::numeric ELSE NULL END,
    wp_num = CASE WHEN wp ~ '^-?\d+\.?\d*$' THEN wp::numeric ELSE NULL END,
    ip_generated_num = CASE WHEN ip_generated ~ '^-?\d+\.?\d*$' THEN ip_generated::numeric ELSE NULL END;

ALTER TABLE essais_atterberg DROP CONSTRAINT IF EXISTS essais_atterberg_pkey CASCADE;
ALTER TABLE essais_atterberg RENAME COLUMN id TO id_old;
ALTER TABLE essais_atterberg RENAME COLUMN echantillon_id TO echantillon_id_old;
ALTER TABLE essais_atterberg RENAME COLUMN created_at TO created_at_old;
ALTER TABLE essais_atterberg RENAME COLUMN wl TO wl_old;
ALTER TABLE essais_atterberg RENAME COLUMN wp TO wp_old;
ALTER TABLE essais_atterberg RENAME COLUMN ip_generated TO ip_generated_old;

ALTER TABLE essais_atterberg RENAME COLUMN id_uuid TO id;
ALTER TABLE essais_atterberg RENAME COLUMN echantillon_id_uuid TO echantillon_id;
ALTER TABLE essais_atterberg RENAME COLUMN created_at_ts TO created_at;
ALTER TABLE essais_atterberg RENAME COLUMN wl_num TO wl;
ALTER TABLE essais_atterberg RENAME COLUMN wp_num TO wp;
ALTER TABLE essais_atterberg RENAME COLUMN ip_generated_num TO ip_generated;

ALTER TABLE essais_atterberg ADD PRIMARY KEY (id);
ALTER TABLE essais_atterberg ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE essais_atterberg ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE essais_atterberg DROP COLUMN id_old;
ALTER TABLE essais_atterberg DROP COLUMN echantillon_id_old;
ALTER TABLE essais_atterberg DROP COLUMN created_at_old;
ALTER TABLE essais_atterberg DROP COLUMN wl_old;
ALTER TABLE essais_atterberg DROP COLUMN wp_old;
ALTER TABLE essais_atterberg DROP COLUMN ip_generated_old;

SELECT '✅ essais_atterberg migrée' as info;

-- essais_vbs
ALTER TABLE essais_vbs ADD COLUMN id_uuid UUID;
ALTER TABLE essais_vbs ADD COLUMN echantillon_id_uuid UUID;
ALTER TABLE essais_vbs ADD COLUMN created_at_ts TIMESTAMPTZ;
ALTER TABLE essais_vbs ADD COLUMN vbs_num NUMERIC;

UPDATE essais_vbs SET
    id_uuid = CASE WHEN id ~ '^[0-9a-f-]{36}$' THEN id::uuid ELSE NULL END,
    echantillon_id_uuid = CASE WHEN echantillon_id ~ '^[0-9a-f-]{36}$' THEN echantillon_id::uuid ELSE NULL END,
    created_at_ts = CASE WHEN created_at ~ '^\d{4}-\d{2}-\d{2}' THEN created_at::timestamptz ELSE NOW() END,
    vbs_num = CASE WHEN vbs ~ '^-?\d+\.?\d*$' THEN vbs::numeric ELSE NULL END;

ALTER TABLE essais_vbs DROP CONSTRAINT IF EXISTS essais_vbs_pkey CASCADE;
ALTER TABLE essais_vbs RENAME COLUMN id TO id_old;
ALTER TABLE essais_vbs RENAME COLUMN echantillon_id TO echantillon_id_old;
ALTER TABLE essais_vbs RENAME COLUMN created_at TO created_at_old;
ALTER TABLE essais_vbs RENAME COLUMN vbs TO vbs_old;

ALTER TABLE essais_vbs RENAME COLUMN id_uuid TO id;
ALTER TABLE essais_vbs RENAME COLUMN echantillon_id_uuid TO echantillon_id;
ALTER TABLE essais_vbs RENAME COLUMN created_at_ts TO created_at;
ALTER TABLE essais_vbs RENAME COLUMN vbs_num TO vbs;

ALTER TABLE essais_vbs ADD PRIMARY KEY (id);
ALTER TABLE essais_vbs ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE essais_vbs ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE essais_vbs DROP COLUMN id_old;
ALTER TABLE essais_vbs DROP COLUMN echantillon_id_old;
ALTER TABLE essais_vbs DROP COLUMN created_at_old;
ALTER TABLE essais_vbs DROP COLUMN vbs_old;

SELECT '✅ essais_vbs migrée' as info;

-- granulo_points
ALTER TABLE granulo_points ADD COLUMN id_uuid UUID;
ALTER TABLE granulo_points ADD COLUMN echantillon_id_uuid UUID;
ALTER TABLE granulo_points ADD COLUMN created_at_ts TIMESTAMPTZ;
ALTER TABLE granulo_points ADD COLUMN sieve_mm_num NUMERIC;
ALTER TABLE granulo_points ADD COLUMN passing_pct_num NUMERIC;

UPDATE granulo_points SET
    id_uuid = CASE WHEN id ~ '^[0-9a-f-]{36}$' THEN id::uuid ELSE NULL END,
    echantillon_id_uuid = CASE WHEN echantillon_id ~ '^[0-9a-f-]{36}$' THEN echantillon_id::uuid ELSE NULL END,
    created_at_ts = CASE WHEN created_at ~ '^\d{4}-\d{2}-\d{2}' THEN created_at::timestamptz ELSE NOW() END,
    sieve_mm_num = CASE WHEN sieve_mm ~ '^-?\d+\.?\d*$' THEN sieve_mm::numeric ELSE NULL END,
    passing_pct_num = CASE WHEN passing_pct ~ '^-?\d+\.?\d*$' THEN passing_pct::numeric ELSE NULL END;

ALTER TABLE granulo_points DROP CONSTRAINT IF EXISTS granulo_points_pkey CASCADE;
ALTER TABLE granulo_points RENAME COLUMN id TO id_old;
ALTER TABLE granulo_points RENAME COLUMN echantillon_id TO echantillon_id_old;
ALTER TABLE granulo_points RENAME COLUMN created_at TO created_at_old;
ALTER TABLE granulo_points RENAME COLUMN sieve_mm TO sieve_mm_old;
ALTER TABLE granulo_points RENAME COLUMN passing_pct TO passing_pct_old;

ALTER TABLE granulo_points RENAME COLUMN id_uuid TO id;
ALTER TABLE granulo_points RENAME COLUMN echantillon_id_uuid TO echantillon_id;
ALTER TABLE granulo_points RENAME COLUMN created_at_ts TO created_at;
ALTER TABLE granulo_points RENAME COLUMN sieve_mm_num TO sieve_mm;
ALTER TABLE granulo_points RENAME COLUMN passing_pct_num TO passing_pct;

ALTER TABLE granulo_points ADD PRIMARY KEY (id);
ALTER TABLE granulo_points ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE granulo_points ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE granulo_points DROP COLUMN id_old;
ALTER TABLE granulo_points DROP COLUMN echantillon_id_old;
ALTER TABLE granulo_points DROP COLUMN created_at_old;
ALTER TABLE granulo_points DROP COLUMN sieve_mm_old;
ALTER TABLE granulo_points DROP COLUMN passing_pct_old;

SELECT '✅ granulo_points migrée' as info;

-- ============================================================================
-- PARTIE 4 : TABLE mailles
-- ============================================================================

SELECT '📋 Migration de la table mailles...' as info;

ALTER TABLE mailles ADD COLUMN id_uuid UUID;
ALTER TABLE mailles ADD COLUMN updated_at_ts TIMESTAMPTZ;

UPDATE mailles SET
    id_uuid = CASE WHEN id ~ '^[0-9a-f-]{36}$' THEN id::uuid ELSE NULL END,
    updated_at_ts = CASE WHEN updated_at ~ '^\d{4}-\d{2}-\d{2}' THEN updated_at::timestamptz ELSE NOW() END;

ALTER TABLE mailles DROP CONSTRAINT IF EXISTS mailles_pkey CASCADE;
ALTER TABLE mailles RENAME COLUMN id TO id_old;
ALTER TABLE mailles RENAME COLUMN updated_at TO updated_at_old;

ALTER TABLE mailles RENAME COLUMN id_uuid TO id;
ALTER TABLE mailles RENAME COLUMN updated_at_ts TO updated_at;

ALTER TABLE mailles ADD PRIMARY KEY (id);
ALTER TABLE mailles ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE mailles ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE mailles DROP COLUMN id_old;
ALTER TABLE mailles DROP COLUMN updated_at_old;

SELECT '✅ mailles migrée' as info;

-- ============================================================================
-- PARTIE 5 : RECRÉER LA VUE MATÉRIALISÉE
-- ============================================================================

SELECT '📋 Recréation de la vue matérialisée...' as info;

CREATE MATERIALIZED VIEW mv_mailles_geotech AS 
SELECT 
    m.id, 
    m.code, 
    m.geom, 
    m.geom_4326,
    m.adm1_name, 
    m.adm2_name, 
    m.adm3_name,
    COUNT(DISTINCT s.id) as nb_sondages_real,
    0 as nb_sondages_spread,
    CASE WHEN COUNT(DISTINCT s.id) > 0 THEN true ELSE false END as has_data
FROM mailles m
LEFT JOIN sondages s ON ST_Contains(m.geom, s.geom) AND s.deleted_at IS NULL
GROUP BY m.id, m.code, m.geom, m.geom_4326, m.adm1_name, m.adm2_name, m.adm3_name;

CREATE INDEX idx_mv_mailles_geotech_geom_4326 ON mv_mailles_geotech USING GIST(geom_4326);
CREATE UNIQUE INDEX mv_mailles_geotech_id_idx ON mv_mailles_geotech(id);

SELECT '✅ Vue matérialisée recréée' as info;

-- ============================================================================
-- PARTIE 6 : VACUUM ET STATISTIQUES
-- ============================================================================

COMMIT;

-- VACUUM doit être hors transaction
VACUUM ANALYZE adm3;
VACUUM ANALYZE echantillons;
VACUUM ANALYZE essais_atterberg;
VACUUM ANALYZE essais_vbs;
VACUUM ANALYZE granulo_points;
VACUUM ANALYZE mailles;
VACUUM ANALYZE sondages;

SELECT '✅ Migration complète terminée avec succès!' as info;
SELECT 'Tables migrées: adm3, echantillons, essais_atterberg, essais_vbs, granulo_points, mailles' as resume;
