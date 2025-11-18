-- ============================================================================
-- Migration 023: Correction des tables RAW (types + contraintes)
-- ============================================================================
-- Description: Convertit les colonnes TEXT en types appropriés et ajoute
--              les contraintes UNIQUE nécessaires pour les ON CONFLICT
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLE raw_lab_agt
-- ============================================================================

-- Convertir les types
ALTER TABLE raw_lab_agt 
    ALTER COLUMN id TYPE uuid USING COALESCE(NULLIF(id, '')::uuid, gen_random_uuid()),
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE raw_lab_agt
    ALTER COLUMN depth_m TYPE numeric USING NULLIF(depth_m, '')::numeric,
    ALTER COLUMN sieve_mm TYPE numeric USING NULLIF(sieve_mm, '')::numeric,
    ALTER COLUMN mass_refus_cum_g TYPE numeric USING NULLIF(mass_refus_cum_g, '')::numeric,
    ALTER COLUMN refus_cum_pct TYPE numeric USING NULLIF(refus_cum_pct, '')::numeric,
    ALTER COLUMN passants_pct TYPE numeric USING NULLIF(passants_pct, '')::numeric;

ALTER TABLE raw_lab_agt
    ALTER COLUMN echantillon_id TYPE uuid USING NULLIF(echantillon_id, '')::uuid,
    ALTER COLUMN created_at TYPE timestamptz USING COALESCE(NULLIF(created_at, '')::timestamptz, now()),
    ALTER COLUMN updated_at TYPE timestamptz USING NULLIF(updated_at, '')::timestamptz;

-- Ajouter contrainte UNIQUE pour ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS raw_lab_agt_code_depth_sieve_unique 
    ON raw_lab_agt(code_site, depth_m, sieve_mm);

-- ============================================================================
-- 2. TABLE raw_lab_ags
-- ============================================================================

-- Convertir les types
ALTER TABLE raw_lab_ags 
    ALTER COLUMN id TYPE uuid USING COALESCE(NULLIF(id, '')::uuid, gen_random_uuid()),
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE raw_lab_ags
    ALTER COLUMN depth_m TYPE numeric USING NULLIF(depth_m, '')::numeric,
    ALTER COLUMN sieve_mm TYPE numeric USING NULLIF(sieve_mm, '')::numeric,
    ALTER COLUMN passants_pct TYPE numeric USING NULLIF(passants_pct, '')::numeric;

ALTER TABLE raw_lab_ags
    ALTER COLUMN echantillon_id TYPE uuid USING NULLIF(echantillon_id, '')::uuid,
    ALTER COLUMN created_at TYPE timestamptz USING COALESCE(NULLIF(created_at, '')::timestamptz, now()),
    ALTER COLUMN updated_at TYPE timestamptz USING NULLIF(updated_at, '')::timestamptz;

-- Ajouter contrainte UNIQUE pour ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS raw_lab_ags_code_depth_sieve_unique 
    ON raw_lab_ags(code_site, depth_m, sieve_mm);

-- ============================================================================
-- 3. TABLE raw_lab_atterberg
-- ============================================================================

-- Convertir les types
ALTER TABLE raw_lab_atterberg 
    ALTER COLUMN id TYPE uuid USING COALESCE(NULLIF(id, '')::uuid, gen_random_uuid()),
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE raw_lab_atterberg
    ALTER COLUMN depth_m TYPE numeric USING NULLIF(depth_m, '')::numeric,
    ALTER COLUMN nb_coups TYPE integer USING NULLIF(nb_coups, '')::integer,
    ALTER COLUMN poids_total_humide_g TYPE numeric USING NULLIF(poids_total_humide_g, '')::numeric,
    ALTER COLUMN poids_total_sec_g TYPE numeric USING NULLIF(poids_total_sec_g, '')::numeric,
    ALTER COLUMN poids_tare_g TYPE numeric USING NULLIF(poids_tare_g, '')::numeric,
    ALTER COLUMN poids_eau_g TYPE numeric USING NULLIF(poids_eau_g, '')::numeric,
    ALTER COLUMN poids_sol_sec_g TYPE numeric USING NULLIF(poids_sol_sec_g, '')::numeric,
    ALTER COLUMN teneur_eau_pct TYPE numeric USING NULLIF(teneur_eau_pct, '')::numeric;

ALTER TABLE raw_lab_atterberg
    ALTER COLUMN echantillon_id TYPE uuid USING NULLIF(echantillon_id, '')::uuid,
    ALTER COLUMN created_at TYPE timestamptz USING COALESCE(NULLIF(created_at, '')::timestamptz, now());

-- Pas de contrainte UNIQUE ici car INSERT simple sans ON CONFLICT

-- ============================================================================
-- 4. VALIDATION
-- ============================================================================

DO $$
DECLARE
    v_agt_count int;
    v_ags_count int;
    v_att_count int;
BEGIN
    SELECT COUNT(*) INTO v_agt_count FROM raw_lab_agt;
    SELECT COUNT(*) INTO v_ags_count FROM raw_lab_ags;
    SELECT COUNT(*) INTO v_att_count FROM raw_lab_atterberg;
    
    RAISE NOTICE '✓ Migration 023 terminée';
    RAISE NOTICE '  - raw_lab_agt: % lignes', v_agt_count;
    RAISE NOTICE '  - raw_lab_ags: % lignes', v_ags_count;
    RAISE NOTICE '  - raw_lab_atterberg: % lignes', v_att_count;
END $$;

COMMIT;
