-- ============================================================================
-- Migration : Correction des types de colonnes dans la table echantillons
-- Date : 2025-11-07
-- ============================================================================

BEGIN;

SELECT 'Migration de la table echantillons...' as info;

-- Supprimer temporairement la vue matérialisée
DROP MATERIALIZED VIEW IF EXISTS mv_mailles_geotech CASCADE;

-- Créer colonnes temporaires
ALTER TABLE echantillons ADD COLUMN id_uuid UUID;
ALTER TABLE echantillons ADD COLUMN sondage_id_uuid UUID;
ALTER TABLE echantillons ADD COLUMN created_at_ts TIMESTAMPTZ;
ALTER TABLE echantillons ADD COLUMN updated_at_ts TIMESTAMPTZ;
ALTER TABLE echantillons ADD COLUMN deleted_at_ts TIMESTAMPTZ;
ALTER TABLE echantillons ADD COLUMN depth_m_min_num NUMERIC;
ALTER TABLE echantillons ADD COLUMN depth_m_max_num NUMERIC;
ALTER TABLE echantillons ADD COLUMN rho_s_gcm3_num NUMERIC;
ALTER TABLE echantillons ADD COLUMN water_content_w_num NUMERIC;

-- Nettoyer 'nan'
UPDATE echantillons SET created_at = NULL WHERE lower(trim(created_at)) IN ('nan', '');
UPDATE echantillons SET updated_at = NULL WHERE lower(trim(updated_at)) IN ('nan', '');
UPDATE echantillons SET deleted_at = NULL WHERE lower(trim(deleted_at)) IN ('nan', '');

-- Convertir
UPDATE echantillons SET
    id_uuid = CASE WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid ELSE NULL END,
    sondage_id_uuid = CASE WHEN sondage_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN sondage_id::uuid ELSE NULL END,
    created_at_ts = COALESCE(CASE WHEN created_at ~ '^\d{4}-\d{2}-\d{2}' THEN created_at::timestamptz ELSE NULL END, NOW()),
    updated_at_ts = CASE WHEN updated_at ~ '^\d{4}-\d{2}-\d{2}' THEN updated_at::timestamptz ELSE NULL END,
    deleted_at_ts = CASE WHEN deleted_at ~ '^\d{4}-\d{2}-\d{2}' THEN deleted_at::timestamptz ELSE NULL END,
    depth_m_min_num = CASE WHEN depth_m_min ~ '^-?\d+\.?\d*$' THEN depth_m_min::numeric ELSE NULL END,
    depth_m_max_num = CASE WHEN depth_m_max ~ '^-?\d+\.?\d*$' THEN depth_m_max::numeric ELSE NULL END,
    rho_s_gcm3_num = CASE WHEN rho_s_gcm3 ~ '^-?\d+\.?\d*$' THEN rho_s_gcm3::numeric ELSE NULL END,
    water_content_w_num = CASE WHEN water_content_w ~ '^-?\d+\.?\d*$' THEN water_content_w::numeric ELSE NULL END;

-- Vérification
SELECT COUNT(*) as total, COUNT(id_uuid) as id_ok, COUNT(sondage_id_uuid) as sondage_id_ok FROM echantillons;

-- Basculer
ALTER TABLE echantillons DROP CONSTRAINT IF EXISTS echantillons_pkey CASCADE;
ALTER TABLE echantillons DROP CONSTRAINT IF EXISTS fk_echantillons_sondage CASCADE;

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

-- Index
CREATE INDEX IF NOT EXISTS idx_echantillons_sondage_id ON echantillons(sondage_id);
CREATE INDEX IF NOT EXISTS idx_echantillons_deleted_at ON echantillons(deleted_at) WHERE deleted_at IS NOT NULL;

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

-- Recréer la vue
CREATE MATERIALIZED VIEW mv_mailles_geotech AS 
SELECT 
    m.id, m.code, m.geom, m.geom_4326,
    m.adm1_name, m.adm2_name, m.adm3_name,
    COUNT(DISTINCT s.id) as nb_sondages_real,
    0 as nb_sondages_spread,
    CASE WHEN COUNT(DISTINCT s.id) > 0 THEN true ELSE false END as has_data
FROM mailles m
LEFT JOIN sondages s ON ST_Contains(m.geom, s.geom) AND s.deleted_at IS NULL
GROUP BY m.id, m.code, m.geom, m.geom_4326, m.adm1_name, m.adm2_name, m.adm3_name;

CREATE INDEX idx_mv_mailles_geotech_geom_4326 ON mv_mailles_geotech USING GIST(geom_4326);
CREATE UNIQUE INDEX mv_mailles_geotech_id_idx ON mv_mailles_geotech(id);

COMMIT;

SELECT '✅ echantillons migrée' as info;
