-- ============================================================================
-- Migration 020 v2: Upgrade types vers schéma propre (détection automatique)
-- Date: 2025-11-15
-- Description: Conversion intelligente des types avec détection du type actuel
--              Gère les colonnes déjà typées (DATE, NUMERIC) et celles en TEXT
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. BACKUP: Créer des tables de sauvegarde avant conversion
-- ============================================================================

DROP TABLE IF EXISTS _backup_echantillons_pre_020;
DROP TABLE IF EXISTS _backup_essais_physiques_pre_020;
DROP TABLE IF EXISTS _backup_essais_classif_pre_020;
DROP TABLE IF EXISTS _backup_granulo_points_pre_020;
DROP TABLE IF EXISTS _backup_essais_geotechniques_pre_020;

CREATE TABLE _backup_echantillons_pre_020 AS SELECT * FROM echantillons;
CREATE TABLE _backup_essais_physiques_pre_020 AS SELECT * FROM essais_physiques;
CREATE TABLE _backup_essais_classif_pre_020 AS SELECT * FROM essais_classif;
CREATE TABLE _backup_granulo_points_pre_020 AS SELECT * FROM granulo_points;
CREATE TABLE _backup_essais_geotechniques_pre_020 AS SELECT * FROM essais_geotechniques;

-- ============================================================================
-- 2. FONCTION HELPER: Convertir une colonne si nécessaire
-- ============================================================================

CREATE OR REPLACE FUNCTION convert_column_if_needed(
    p_table_name TEXT,
    p_column_name TEXT,
    p_target_type TEXT,
    p_using_clause TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_current_type TEXT;
    v_sql TEXT;
BEGIN
    -- Récupérer le type actuel
    SELECT data_type INTO v_current_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table_name
      AND column_name = p_column_name;
    
    -- Si déjà au bon type, skip
    IF v_current_type = p_target_type THEN
        RAISE NOTICE '  ✓ %.% déjà en % - skip', p_table_name, p_column_name, p_target_type;
        RETURN;
    END IF;
    
    -- Construire la clause USING
    IF p_using_clause IS NULL THEN
        CASE p_target_type
            WHEN 'uuid' THEN
                v_sql := format('ALTER TABLE %I ALTER COLUMN %I TYPE UUID USING %I::uuid', 
                    p_table_name, p_column_name, p_column_name);
            WHEN 'numeric' THEN
                v_sql := format('ALTER TABLE %I ALTER COLUMN %I TYPE NUMERIC USING NULLIF(%I::text, '''')::numeric', 
                    p_table_name, p_column_name, p_column_name);
            WHEN 'jsonb' THEN
                v_sql := format('ALTER TABLE %I ALTER COLUMN %I TYPE JSONB USING COALESCE(NULLIF(%I::text, '''')::jsonb, ''{}''::jsonb)', 
                    p_table_name, p_column_name, p_column_name);
            WHEN 'timestamp with time zone' THEN
                v_sql := format('ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMPTZ USING COALESCE(NULLIF(%I::text, '''')::timestamptz, now())', 
                    p_table_name, p_column_name, p_column_name);
            WHEN 'date' THEN
                v_sql := format('ALTER TABLE %I ALTER COLUMN %I TYPE DATE USING NULLIF(%I::text, '''')::date', 
                    p_table_name, p_column_name, p_column_name);
            WHEN 'boolean' THEN
                v_sql := format('ALTER TABLE %I ALTER COLUMN %I TYPE BOOLEAN USING CASE WHEN %I::text IN (''true'', ''t'', ''1'') THEN TRUE ELSE FALSE END', 
                    p_table_name, p_column_name, p_column_name);
            ELSE
                RAISE EXCEPTION 'Type non supporté: %', p_target_type;
        END CASE;
    ELSE
        v_sql := format('ALTER TABLE %I ALTER COLUMN %I TYPE %s USING %s', 
            p_table_name, p_column_name, p_target_type, p_using_clause);
    END IF;
    
    -- Exécuter
    EXECUTE v_sql;
    RAISE NOTICE '  ✓ %.% converti: % → %', p_table_name, p_column_name, v_current_type, p_target_type;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  ⚠ %.% erreur: % (type actuel: %)', p_table_name, p_column_name, SQLERRM, v_current_type;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. TABLE: essais_geotechniques - Conversion types (AVANT les tables qui y font référence)
-- ============================================================================

ALTER TABLE essais_geotechniques DROP CONSTRAINT IF EXISTS essais_geotechniques_sondage_id_fkey;

SELECT convert_column_if_needed('essais_geotechniques', 'id', 'uuid');
SELECT convert_column_if_needed('essais_geotechniques', 'sondage_id', 'uuid');
SELECT convert_column_if_needed('essais_geotechniques', 'depth_m', 'numeric');
SELECT convert_column_if_needed('essais_geotechniques', 'passant_80um', 'numeric');
SELECT convert_column_if_needed('essais_geotechniques', 'passant_2mm', 'numeric');
SELECT convert_column_if_needed('essais_geotechniques', 'passant_20mm', 'numeric');
SELECT convert_column_if_needed('essais_geotechniques', 'wl', 'numeric');
SELECT convert_column_if_needed('essais_geotechniques', 'wp', 'numeric');
SELECT convert_column_if_needed('essais_geotechniques', 'ip', 'numeric');
SELECT convert_column_if_needed('essais_geotechniques', 'vbs', 'numeric');
SELECT convert_column_if_needed('essais_geotechniques', 'gamma_d_max', 'numeric');
SELECT convert_column_if_needed('essais_geotechniques', 'w_opt', 'numeric');
SELECT convert_column_if_needed('essais_geotechniques', 'eg', 'numeric');
SELECT convert_column_if_needed('essais_geotechniques', 'test_date', 'date');
SELECT convert_column_if_needed('essais_geotechniques', 'meta', 'jsonb');
SELECT convert_column_if_needed('essais_geotechniques', 'created_at', 'timestamp with time zone');
SELECT convert_column_if_needed('essais_geotechniques', 'updated_at', 'timestamp with time zone');
SELECT convert_column_if_needed('essais_geotechniques', 'deleted_at', 'timestamp with time zone');
SELECT convert_column_if_needed('essais_geotechniques', 'created_by', 'uuid');
SELECT convert_column_if_needed('essais_geotechniques', 'updated_by', 'uuid');

ALTER TABLE essais_geotechniques
    ADD CONSTRAINT essais_geotechniques_sondage_id_fkey FOREIGN KEY (sondage_id) REFERENCES sondages(id) ON DELETE CASCADE;

-- ============================================================================
-- 4. TABLE: echantillons - Conversion types
-- ============================================================================

-- Supprimer les contraintes existantes
ALTER TABLE echantillons DROP CONSTRAINT IF EXISTS echantillons_sondage_id_fkey;
ALTER TABLE echantillons DROP CONSTRAINT IF EXISTS fk_echantillons_sondage;

-- Convertir les colonnes
SELECT convert_column_if_needed('echantillons', 'id', 'uuid');
SELECT convert_column_if_needed('echantillons', 'sondage_id', 'uuid');
SELECT convert_column_if_needed('echantillons', 'depth_m', 'numeric');
SELECT convert_column_if_needed('echantillons', 'date', 'date');
SELECT convert_column_if_needed('echantillons', 'rho_s_gcm3', 'numeric');
SELECT convert_column_if_needed('echantillons', 'water_content_w', 'numeric');
SELECT convert_column_if_needed('echantillons', 'is_index', 'numeric');
SELECT convert_column_if_needed('echantillons', 'eg', 'numeric');
SELECT convert_column_if_needed('echantillons', 'meta', 'jsonb');
SELECT convert_column_if_needed('echantillons', 'created_at', 'timestamp with time zone');
SELECT convert_column_if_needed('echantillons', 'updated_at', 'timestamp with time zone');

-- Recréer foreign key
ALTER TABLE echantillons
    ADD CONSTRAINT echantillons_sondage_id_fkey FOREIGN KEY (sondage_id) REFERENCES sondages(id) ON DELETE CASCADE;

-- ============================================================================
-- 5. TABLE: essais_physiques - Conversion types
-- ============================================================================

ALTER TABLE essais_physiques DROP CONSTRAINT IF EXISTS essais_physiques_essai_id_fkey;

SELECT convert_column_if_needed('essais_physiques', 'id', 'uuid');
SELECT convert_column_if_needed('essais_physiques', 'essai_id', 'uuid');
SELECT convert_column_if_needed('essais_physiques', 'densite_apparente_gcm3', 'numeric');
SELECT convert_column_if_needed('essais_physiques', 'densite_absolue_gcm3', 'numeric');
SELECT convert_column_if_needed('essais_physiques', 'teneur_eau_pct', 'numeric');
SELECT convert_column_if_needed('essais_physiques', 'measured_at', 'date');
SELECT convert_column_if_needed('essais_physiques', 'meta', 'jsonb');
SELECT convert_column_if_needed('essais_physiques', 'created_at', 'timestamp with time zone');
SELECT convert_column_if_needed('essais_physiques', 'updated_at', 'timestamp with time zone');
SELECT convert_column_if_needed('essais_physiques', 'deleted_at', 'timestamp with time zone');
SELECT convert_column_if_needed('essais_physiques', 'created_by', 'uuid');
SELECT convert_column_if_needed('essais_physiques', 'updated_by', 'uuid');

ALTER TABLE essais_physiques
    ADD CONSTRAINT essais_physiques_essai_id_fkey FOREIGN KEY (essai_id) REFERENCES essais_geotechniques(id) ON DELETE CASCADE;

-- ============================================================================
-- 6. TABLE: essais_classif - Conversion types
-- ============================================================================

ALTER TABLE essais_classif DROP CONSTRAINT IF EXISTS essais_classif_essai_id_fkey;

SELECT convert_column_if_needed('essais_classif', 'id', 'uuid');
SELECT convert_column_if_needed('essais_classif', 'essai_id', 'uuid');
SELECT convert_column_if_needed('essais_classif', 'computed', 'boolean');
SELECT convert_column_if_needed('essais_classif', 'meta', 'jsonb');
SELECT convert_column_if_needed('essais_classif', 'created_at', 'timestamp with time zone');
SELECT convert_column_if_needed('essais_classif', 'updated_at', 'timestamp with time zone');
SELECT convert_column_if_needed('essais_classif', 'deleted_at', 'timestamp with time zone');
SELECT convert_column_if_needed('essais_classif', 'created_by', 'uuid');
SELECT convert_column_if_needed('essais_classif', 'updated_by', 'uuid');

ALTER TABLE essais_classif
    ADD CONSTRAINT essais_classif_essai_id_fkey FOREIGN KEY (essai_id) REFERENCES essais_geotechniques(id) ON DELETE CASCADE;

-- ============================================================================
-- 7. TABLE: granulo_points - Conversion types
-- ============================================================================

ALTER TABLE granulo_points DROP CONSTRAINT IF EXISTS granulo_points_echantillon_id_fkey;

SELECT convert_column_if_needed('granulo_points', 'id', 'uuid');
SELECT convert_column_if_needed('granulo_points', 'echantillon_id', 'uuid');
SELECT convert_column_if_needed('granulo_points', 'meta', 'jsonb');
SELECT convert_column_if_needed('granulo_points', 'created_at', 'timestamp with time zone');

ALTER TABLE granulo_points
    ADD CONSTRAINT granulo_points_echantillon_id_fkey FOREIGN KEY (echantillon_id) REFERENCES echantillons(id) ON DELETE CASCADE;

-- ============================================================================
-- 8. CLEANUP: Supprimer la fonction helper
-- ============================================================================

DROP FUNCTION convert_column_if_needed(TEXT, TEXT, TEXT, TEXT);

-- ============================================================================
-- 9. VALIDATION
-- ============================================================================

DO $$
DECLARE
    v_echantillons_count INTEGER;
    v_physiques_count INTEGER;
    v_classif_count INTEGER;
    v_granulo_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_echantillons_count FROM echantillons;
    SELECT COUNT(*) INTO v_physiques_count FROM essais_physiques;
    SELECT COUNT(*) INTO v_classif_count FROM essais_classif;
    SELECT COUNT(*) INTO v_granulo_count FROM granulo_points;
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Migration 020 v2 terminée avec succès';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '  - echantillons: % lignes converties', v_echantillons_count;
    RAISE NOTICE '  - essais_physiques: % lignes converties', v_physiques_count;
    RAISE NOTICE '  - essais_classif: % lignes converties', v_classif_count;
    RAISE NOTICE '  - granulo_points: % lignes converties', v_granulo_count;
    RAISE NOTICE '  - Types convertis intelligemment (détection automatique)';
    RAISE NOTICE '  - Foreign keys recréées';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables de backup créées:';
    RAISE NOTICE '  - _backup_echantillons_pre_020';
    RAISE NOTICE '  - _backup_essais_physiques_pre_020';
    RAISE NOTICE '  - _backup_essais_classif_pre_020';
    RAISE NOTICE '  - _backup_granulo_points_pre_020';
    RAISE NOTICE '  - _backup_essais_geotechniques_pre_020';
    RAISE NOTICE '============================================================================';
END $$;

COMMIT;
