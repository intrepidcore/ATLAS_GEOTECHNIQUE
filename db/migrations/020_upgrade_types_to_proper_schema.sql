-- ============================================================================
-- Migration 020: Upgrade types TEXT → NUMERIC/JSONB/UUID pour tables géotechniques
-- Date: 2025-11-15
-- Description: Conversion des types TEXT vers les types appropriés pour toutes
--              les tables géotechniques (echantillons, essais_*, granulo_points)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. BACKUP: Créer des tables de sauvegarde avant conversion
-- ============================================================================

CREATE TABLE IF NOT EXISTS _backup_echantillons_pre_020 AS SELECT * FROM echantillons;
CREATE TABLE IF NOT EXISTS _backup_essais_physiques_pre_020 AS SELECT * FROM essais_physiques;
CREATE TABLE IF NOT EXISTS _backup_essais_classif_pre_020 AS SELECT * FROM essais_classif;
CREATE TABLE IF NOT EXISTS _backup_granulo_points_pre_020 AS SELECT * FROM granulo_points;
CREATE TABLE IF NOT EXISTS _backup_essais_geotechniques_pre_020 AS SELECT * FROM essais_geotechniques;

-- ============================================================================
-- 2. TABLE: echantillons - Conversion types
-- ============================================================================

-- Supprimer les contraintes existantes si elles existent
ALTER TABLE echantillons DROP CONSTRAINT IF EXISTS echantillons_sondage_id_fkey;
ALTER TABLE echantillons DROP CONSTRAINT IF EXISTS fk_echantillons_sondage;

-- Convertir les colonnes une par une
ALTER TABLE echantillons 
    ALTER COLUMN id TYPE UUID USING id::uuid,
    ALTER COLUMN sondage_id TYPE UUID USING sondage_id::uuid,
    ALTER COLUMN depth_m TYPE NUMERIC USING NULLIF(depth_m, '')::numeric,
    ALTER COLUMN date TYPE DATE USING NULLIF(date, '')::date,
    ALTER COLUMN rho_s_gcm3 TYPE NUMERIC USING NULLIF(rho_s_gcm3, '')::numeric,
    ALTER COLUMN water_content_w TYPE NUMERIC USING NULLIF(water_content_w, '')::numeric,
    ALTER COLUMN is_index TYPE NUMERIC USING NULLIF(is_index, '')::numeric,
    ALTER COLUMN eg TYPE NUMERIC USING NULLIF(eg, '')::numeric,
    ALTER COLUMN meta TYPE JSONB USING COALESCE(NULLIF(meta, '')::jsonb, '{}'::jsonb),
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING COALESCE(NULLIF(created_at, '')::timestamptz, now()),
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING NULLIF(updated_at, '')::timestamptz;

-- Ajouter contraintes
ALTER TABLE echantillons
    ADD CONSTRAINT echantillons_depth_check CHECK (depth_m >= 0),
    ADD CONSTRAINT echantillons_rho_s_check CHECK (rho_s_gcm3 IS NULL OR (rho_s_gcm3 >= 2.0 AND rho_s_gcm3 <= 3.5)),
    ADD CONSTRAINT echantillons_water_check CHECK (water_content_w IS NULL OR (water_content_w >= 0 AND water_content_w <= 100)),
    ADD CONSTRAINT echantillons_is_index_check CHECK (is_index IS NULL OR (is_index >= 0 AND is_index <= 1)),
    ADD CONSTRAINT echantillons_eg_check CHECK (eg IS NULL OR (eg >= 0 AND eg <= 50));

-- Recréer foreign key
ALTER TABLE echantillons
    ADD CONSTRAINT echantillons_sondage_id_fkey FOREIGN KEY (sondage_id) REFERENCES sondages(id) ON DELETE CASCADE;

-- Créer contrainte unique si elle n'existe pas
ALTER TABLE echantillons DROP CONSTRAINT IF EXISTS echantillons_sondage_depth_date_unique;
ALTER TABLE echantillons
    ADD CONSTRAINT echantillons_sondage_depth_date_unique UNIQUE (sondage_id, depth_m, date);

-- ============================================================================
-- 3. TABLE: essais_physiques - Conversion types
-- ============================================================================

-- Supprimer contraintes existantes
ALTER TABLE essais_physiques DROP CONSTRAINT IF EXISTS essais_physiques_essai_unique;

-- Convertir colonnes
ALTER TABLE essais_physiques
    ALTER COLUMN id TYPE UUID USING id::uuid,
    ALTER COLUMN essai_id TYPE UUID USING essai_id::uuid,
    ALTER COLUMN densite_apparente_gcm3 TYPE NUMERIC USING NULLIF(densite_apparente_gcm3, '')::numeric,
    ALTER COLUMN densite_absolue_gcm3 TYPE NUMERIC USING NULLIF(densite_absolue_gcm3, '')::numeric,
    ALTER COLUMN teneur_eau_pct TYPE NUMERIC USING NULLIF(teneur_eau_pct, '')::numeric,
    ALTER COLUMN measured_at TYPE DATE USING NULLIF(measured_at, '')::date,
    ALTER COLUMN meta TYPE JSONB USING COALESCE(NULLIF(meta, '')::jsonb, '{}'::jsonb),
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING COALESCE(NULLIF(created_at, '')::timestamptz, now()),
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING NULLIF(updated_at, '')::timestamptz,
    ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING NULLIF(deleted_at, '')::timestamptz,
    ALTER COLUMN created_by TYPE UUID USING NULLIF(created_by, '')::uuid,
    ALTER COLUMN updated_by TYPE UUID USING NULLIF(updated_by, '')::uuid;

-- Ajouter contraintes
ALTER TABLE essais_physiques
    ADD CONSTRAINT essais_physiques_densite_app_check CHECK (densite_apparente_gcm3 IS NULL OR (densite_apparente_gcm3 > 0 AND densite_apparente_gcm3 < 5)),
    ADD CONSTRAINT essais_physiques_densite_abs_check CHECK (densite_absolue_gcm3 IS NULL OR (densite_absolue_gcm3 > 0 AND densite_absolue_gcm3 < 5)),
    ADD CONSTRAINT essais_physiques_teneur_eau_check CHECK (teneur_eau_pct IS NULL OR (teneur_eau_pct >= 0 AND teneur_eau_pct <= 100));

-- Recréer contrainte unique
ALTER TABLE essais_physiques
    ADD CONSTRAINT essais_physiques_essai_unique UNIQUE (essai_id);

-- Créer foreign key vers essais_geotechniques
ALTER TABLE essais_physiques DROP CONSTRAINT IF EXISTS essais_physiques_essai_id_fkey;
ALTER TABLE essais_physiques
    ADD CONSTRAINT essais_physiques_essai_id_fkey FOREIGN KEY (essai_id) REFERENCES essais_geotechniques(id) ON DELETE CASCADE;

-- ============================================================================
-- 4. TABLE: essais_classif - Conversion types
-- ============================================================================

-- Supprimer contraintes existantes
ALTER TABLE essais_classif DROP CONSTRAINT IF EXISTS essais_classif_essai_systeme_unique;

-- Convertir colonnes
ALTER TABLE essais_classif
    ALTER COLUMN id TYPE UUID USING id::uuid,
    ALTER COLUMN essai_id TYPE UUID USING essai_id::uuid,
    ALTER COLUMN computed TYPE BOOLEAN USING CASE WHEN computed = 'true' OR computed = 't' THEN TRUE ELSE FALSE END,
    ALTER COLUMN meta TYPE JSONB USING COALESCE(NULLIF(meta, '')::jsonb, '{}'::jsonb),
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING COALESCE(NULLIF(created_at, '')::timestamptz, now()),
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING NULLIF(updated_at, '')::timestamptz,
    ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING NULLIF(deleted_at, '')::timestamptz,
    ALTER COLUMN created_by TYPE UUID USING NULLIF(created_by, '')::uuid,
    ALTER COLUMN updated_by TYPE UUID USING NULLIF(updated_by, '')::uuid;

-- Ajouter contraintes
ALTER TABLE essais_classif
    ADD CONSTRAINT essais_classif_systeme_check CHECK (systeme IN ('AASHTO', 'USCS', 'GTR', 'LPC', 'HRB'));

-- Recréer contrainte unique
ALTER TABLE essais_classif
    ADD CONSTRAINT essais_classif_essai_systeme_unique UNIQUE (essai_id, systeme);

-- Créer foreign key
ALTER TABLE essais_classif DROP CONSTRAINT IF EXISTS essais_classif_essai_id_fkey;
ALTER TABLE essais_classif
    ADD CONSTRAINT essais_classif_essai_id_fkey FOREIGN KEY (essai_id) REFERENCES essais_geotechniques(id) ON DELETE CASCADE;

-- ============================================================================
-- 5. TABLE: granulo_points - Conversion types (déjà partiellement NUMERIC)
-- ============================================================================

-- Supprimer contraintes existantes
ALTER TABLE granulo_points DROP CONSTRAINT IF EXISTS granulo_points_echantillon_method_sieve_unique;

-- Convertir colonnes restantes
ALTER TABLE granulo_points
    ALTER COLUMN id TYPE UUID USING id::uuid,
    ALTER COLUMN echantillon_id TYPE UUID USING echantillon_id::uuid,
    ALTER COLUMN meta TYPE JSONB USING COALESCE(NULLIF(meta, '')::jsonb, '{}'::jsonb),
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING COALESCE(NULLIF(created_at, '')::timestamptz, now());

-- Ajouter contraintes
ALTER TABLE granulo_points
    ADD CONSTRAINT granulo_points_method_check CHECK (method IN ('tamisage', 'sedimento')),
    ADD CONSTRAINT granulo_points_sieve_check CHECK (sieve_mm > 0),
    ADD CONSTRAINT granulo_points_passing_check CHECK (passing_pct >= 0 AND passing_pct <= 100);

-- Recréer contrainte unique
ALTER TABLE granulo_points
    ADD CONSTRAINT granulo_points_echantillon_method_sieve_unique UNIQUE (echantillon_id, method, sieve_mm);

-- Créer foreign key
ALTER TABLE granulo_points DROP CONSTRAINT IF EXISTS granulo_points_echantillon_id_fkey;
ALTER TABLE granulo_points
    ADD CONSTRAINT granulo_points_echantillon_id_fkey FOREIGN KEY (echantillon_id) REFERENCES echantillons(id) ON DELETE CASCADE;

-- ============================================================================
-- 6. TABLE: essais_geotechniques - Conversion types (pour cohérence)
-- ============================================================================

ALTER TABLE essais_geotechniques
    ALTER COLUMN id TYPE UUID USING id::uuid,
    ALTER COLUMN sondage_id TYPE UUID USING sondage_id::uuid,
    ALTER COLUMN depth_m TYPE NUMERIC USING NULLIF(depth_m, '')::numeric,
    ALTER COLUMN passant_80um TYPE NUMERIC USING NULLIF(passant_80um, '')::numeric,
    ALTER COLUMN passant_2mm TYPE NUMERIC USING NULLIF(passant_2mm, '')::numeric,
    ALTER COLUMN passant_20mm TYPE NUMERIC USING NULLIF(passant_20mm, '')::numeric,
    ALTER COLUMN wl TYPE NUMERIC USING NULLIF(wl, '')::numeric,
    ALTER COLUMN wp TYPE NUMERIC USING NULLIF(wp, '')::numeric,
    ALTER COLUMN ip TYPE NUMERIC USING NULLIF(ip, '')::numeric,
    ALTER COLUMN vbs TYPE NUMERIC USING NULLIF(vbs, '')::numeric,
    ALTER COLUMN gamma_d_max TYPE NUMERIC USING NULLIF(gamma_d_max, '')::numeric,
    ALTER COLUMN w_opt TYPE NUMERIC USING NULLIF(w_opt, '')::numeric,
    ALTER COLUMN eg TYPE NUMERIC USING NULLIF(eg, '')::numeric,
    ALTER COLUMN test_date TYPE DATE USING NULLIF(test_date, '')::date,
    ALTER COLUMN meta TYPE JSONB USING COALESCE(NULLIF(meta, '')::jsonb, '{}'::jsonb),
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING COALESCE(NULLIF(created_at, '')::timestamptz, now()),
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING NULLIF(updated_at, '')::timestamptz,
    ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING NULLIF(deleted_at, '')::timestamptz,
    ALTER COLUMN created_by TYPE UUID USING NULLIF(created_by, '')::uuid,
    ALTER COLUMN updated_by TYPE UUID USING NULLIF(updated_by, '')::uuid;

-- Ajouter contraintes
ALTER TABLE essais_geotechniques
    ADD CONSTRAINT essais_geotechniques_depth_check CHECK (depth_m >= 0),
    ADD CONSTRAINT essais_geotechniques_passant_check CHECK (
        (passant_80um IS NULL OR (passant_80um >= 0 AND passant_80um <= 100)) AND
        (passant_2mm IS NULL OR (passant_2mm >= 0 AND passant_2mm <= 100)) AND
        (passant_20mm IS NULL OR (passant_20mm >= 0 AND passant_20mm <= 100))
    ),
    ADD CONSTRAINT essais_geotechniques_atterberg_check CHECK (
        (wl IS NULL OR (wl >= 0 AND wl <= 200)) AND
        (wp IS NULL OR (wp >= 0 AND wp <= 200)) AND
        (ip IS NULL OR ip >= 0)
    ),
    ADD CONSTRAINT essais_geotechniques_vbs_check CHECK (vbs IS NULL OR (vbs >= 0 AND vbs <= 20)),
    ADD CONSTRAINT essais_geotechniques_proctor_check CHECK (
        (gamma_d_max IS NULL OR (gamma_d_max >= 10 AND gamma_d_max <= 30)) AND
        (w_opt IS NULL OR (w_opt >= 0 AND w_opt <= 50))
    ),
    ADD CONSTRAINT essais_geotechniques_eg_check CHECK (eg IS NULL OR (eg >= 0 AND eg <= 50));

-- Recréer foreign key
ALTER TABLE essais_geotechniques DROP CONSTRAINT IF EXISTS essais_geotechniques_sondage_id_fkey;
ALTER TABLE essais_geotechniques
    ADD CONSTRAINT essais_geotechniques_sondage_id_fkey FOREIGN KEY (sondage_id) REFERENCES sondages(id) ON DELETE CASCADE;

-- ============================================================================
-- 7. INDEXES: Recréer les indexes optimisés
-- ============================================================================

-- echantillons
CREATE INDEX IF NOT EXISTS idx_echantillons_sondage ON echantillons(sondage_id);
CREATE INDEX IF NOT EXISTS idx_echantillons_depth ON echantillons(depth_m);
CREATE INDEX IF NOT EXISTS idx_echantillons_date ON echantillons(date) WHERE date IS NOT NULL;

-- essais_physiques
CREATE INDEX IF NOT EXISTS idx_physiques_essai ON essais_physiques(essai_id);
CREATE INDEX IF NOT EXISTS idx_physiques_created_batch ON essais_physiques(created_by_batch) WHERE created_by_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_physiques_deleted_batch ON essais_physiques(deleted_by_batch) WHERE deleted_by_batch IS NOT NULL;

-- essais_classif
CREATE INDEX IF NOT EXISTS idx_classif_essai ON essais_classif(essai_id);
CREATE INDEX IF NOT EXISTS idx_classif_systeme ON essais_classif(systeme);
CREATE INDEX IF NOT EXISTS idx_classif_classe ON essais_classif(classe);
CREATE INDEX IF NOT EXISTS idx_classif_created_batch ON essais_classif(created_by_batch) WHERE created_by_batch IS NOT NULL;

-- granulo_points
CREATE INDEX IF NOT EXISTS idx_granulo_echantillon ON granulo_points(echantillon_id);
CREATE INDEX IF NOT EXISTS idx_granulo_method ON granulo_points(method);
CREATE INDEX IF NOT EXISTS idx_granulo_sieve ON granulo_points(sieve_mm);

-- essais_geotechniques
CREATE INDEX IF NOT EXISTS idx_essais_geotechniques_sondage ON essais_geotechniques(sondage_id);
CREATE INDEX IF NOT EXISTS idx_essais_geotechniques_depth ON essais_geotechniques(depth_m);

-- ============================================================================
-- 8. COMMENTS: Documenter les colonnes
-- ============================================================================

COMMENT ON TABLE echantillons IS 'Échantillons de sol prélevés à différentes profondeurs';
COMMENT ON COLUMN echantillons.rho_s_gcm3 IS 'Densité absolue des solides (g/cm³)';
COMMENT ON COLUMN echantillons.water_content_w IS 'Teneur en eau naturelle (%)';
COMMENT ON COLUMN echantillons.is_index IS 'Indice de gonflement Is (sans dimension)';
COMMENT ON COLUMN echantillons.eg IS 'Gonflement à l''œdomètre (%)';

COMMENT ON TABLE essais_physiques IS 'Propriétés physiques des essais (densités, teneur en eau)';
COMMENT ON COLUMN essais_physiques.densite_apparente_gcm3 IS 'Densité apparente (bulk density) en g/cm³';
COMMENT ON COLUMN essais_physiques.densite_absolue_gcm3 IS 'Densité absolue (particle density) en g/cm³';
COMMENT ON COLUMN essais_physiques.teneur_eau_pct IS 'Teneur en eau naturelle (%) = (m_eau / m_sec) * 100';

COMMENT ON TABLE essais_classif IS 'Classifications géotechniques multiples (AASHTO, USCS, GTR, etc.)';
COMMENT ON COLUMN essais_classif.systeme IS 'Système de classification: AASHTO, USCS, GTR, LPC, HRB';
COMMENT ON COLUMN essais_classif.classe IS 'Classe résultante (ex: A-7-5, CL, A1)';
COMMENT ON COLUMN essais_classif.computed IS 'TRUE si calculé automatiquement depuis WL/WP/granulo';

COMMENT ON TABLE granulo_points IS 'Points de courbes granulométriques (tamisage + sédimentométrie)';
COMMENT ON COLUMN granulo_points.method IS 'Méthode: tamisage (>80µm) ou sedimento (<80µm)';
COMMENT ON COLUMN granulo_points.sieve_mm IS 'Diamètre du tamis en mm (0.08 = 80µm)';
COMMENT ON COLUMN granulo_points.passing_pct IS 'Pourcentage de passant cumulé (%)';

-- ============================================================================
-- 9. VALIDATION: Vérifier les conversions
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
    
    RAISE NOTICE 'Migration 020 terminée avec succès';
    RAISE NOTICE '  - echantillons: % lignes converties', v_echantillons_count;
    RAISE NOTICE '  - essais_physiques: % lignes converties', v_physiques_count;
    RAISE NOTICE '  - essais_classif: % lignes converties', v_classif_count;
    RAISE NOTICE '  - granulo_points: % lignes converties', v_granulo_count;
    RAISE NOTICE '  - Types TEXT → NUMERIC/UUID/JSONB/TIMESTAMPTZ appliqués';
    RAISE NOTICE '  - Contraintes et foreign keys recréées';
    RAISE NOTICE '  - Indexes optimisés créés';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables de backup créées:';
    RAISE NOTICE '  - _backup_echantillons_pre_020';
    RAISE NOTICE '  - _backup_essais_physiques_pre_020';
    RAISE NOTICE '  - _backup_essais_classif_pre_020';
    RAISE NOTICE '  - _backup_granulo_points_pre_020';
    RAISE NOTICE '  - _backup_essais_geotechniques_pre_020';
END $$;

COMMIT;
