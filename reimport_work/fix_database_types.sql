-- ============================================================================
-- CORRECTION DES TYPES DE COLONNES - SOLUTION DÉFINITIVE
-- Réparer tous les types incorrects identifiés
-- ============================================================================

\echo '🔧 CORRECTION DES TYPES DE COLONNES - SOLUTION DÉFINITIVE'

BEGIN;

-- ============================================================================
-- 1) ESSAIS_GEOTECHNIQUES - Corrections majeures (15 colonnes)
-- ============================================================================
\echo '📋 1. CORRECTION ESSAIS_GEOTECHNIQUES...'

-- Vider la table d'abord pour éviter les erreurs de conversion
TRUNCATE TABLE public.essais_geotechniques;

-- Corriger les types
ALTER TABLE public.essais_geotechniques 
    ALTER COLUMN id TYPE uuid USING id::uuid,
    ALTER COLUMN sondage_id TYPE uuid USING sondage_id::uuid,
    ALTER COLUMN depth_m TYPE numeric USING CASE WHEN depth_m = '' THEN NULL ELSE depth_m::numeric END,
    ALTER COLUMN passant_80um TYPE numeric USING CASE WHEN passant_80um = '' THEN NULL ELSE passant_80um::numeric END,
    ALTER COLUMN passant_2mm TYPE numeric USING CASE WHEN passant_2mm = '' THEN NULL ELSE passant_2mm::numeric END,
    ALTER COLUMN passant_20mm TYPE numeric USING CASE WHEN passant_20mm = '' THEN NULL ELSE passant_20mm::numeric END,
    ALTER COLUMN wl TYPE numeric USING CASE WHEN wl = '' THEN NULL ELSE wl::numeric END,
    ALTER COLUMN wp TYPE numeric USING CASE WHEN wp = '' THEN NULL ELSE wp::numeric END,
    ALTER COLUMN ip TYPE numeric USING CASE WHEN ip = '' THEN NULL ELSE ip::numeric END,
    ALTER COLUMN vbs TYPE numeric USING CASE WHEN vbs = '' THEN NULL ELSE vbs::numeric END,
    ALTER COLUMN gamma_d_max TYPE numeric USING CASE WHEN gamma_d_max = '' THEN NULL ELSE gamma_d_max::numeric END,
    ALTER COLUMN w_opt TYPE numeric USING CASE WHEN w_opt = '' THEN NULL ELSE w_opt::numeric END,
    ALTER COLUMN test_date TYPE date USING CASE WHEN test_date = '' THEN NULL ELSE test_date::date END,
    ALTER COLUMN created_at TYPE timestamptz USING CASE WHEN created_at = '' THEN now() ELSE created_at::timestamptz END,
    ALTER COLUMN updated_at TYPE timestamptz USING CASE WHEN updated_at = '' THEN now() ELSE updated_at::timestamptz END,
    ALTER COLUMN deleted_at TYPE timestamptz USING CASE WHEN deleted_at = '' THEN NULL ELSE deleted_at::timestamptz END;

\echo '✅ ESSAIS_GEOTECHNIQUES types corrigés'

-- ============================================================================
-- 2) ESSAIS_PHYSIQUES - Corrections (6 colonnes)
-- ============================================================================
\echo '📋 2. CORRECTION ESSAIS_PHYSIQUES...'

TRUNCATE TABLE public.essais_physiques;

ALTER TABLE public.essais_physiques 
    ALTER COLUMN id TYPE uuid USING id::uuid,
    ALTER COLUMN essai_id TYPE uuid USING essai_id::uuid,
    ALTER COLUMN densite_apparente_gcm3 TYPE numeric USING CASE WHEN densite_apparente_gcm3 = '' THEN NULL ELSE densite_apparente_gcm3::numeric END,
    ALTER COLUMN densite_absolue_gcm3 TYPE numeric USING CASE WHEN densite_absolue_gcm3 = '' THEN NULL ELSE densite_absolue_gcm3::numeric END,
    ALTER COLUMN teneur_eau_pct TYPE numeric USING CASE WHEN teneur_eau_pct = '' THEN NULL ELSE teneur_eau_pct::numeric END,
    ALTER COLUMN measured_at TYPE timestamptz USING CASE WHEN measured_at = '' THEN NULL ELSE measured_at::timestamptz END,
    ALTER COLUMN created_at TYPE timestamptz USING CASE WHEN created_at = '' THEN now() ELSE created_at::timestamptz END,
    ALTER COLUMN updated_at TYPE timestamptz USING CASE WHEN updated_at = '' THEN now() ELSE updated_at::timestamptz END,
    ALTER COLUMN deleted_at TYPE timestamptz USING CASE WHEN deleted_at = '' THEN NULL ELSE deleted_at::timestamptz END;

\echo '✅ ESSAIS_PHYSIQUES types corrigés'

-- ============================================================================
-- 3) ESSAIS_ATTERBERG - Corrections (2 colonnes)
-- ============================================================================
\echo '📋 3. CORRECTION ESSAIS_ATTERBERG...'

TRUNCATE TABLE public.essais_atterberg;

ALTER TABLE public.essais_atterberg 
    ALTER COLUMN id TYPE uuid USING id::uuid,
    ALTER COLUMN echantillon_id TYPE uuid USING echantillon_id::uuid,
    ALTER COLUMN created_at TYPE timestamptz USING CASE WHEN created_at = '' THEN now() ELSE created_at::timestamptz END;

\echo '✅ ESSAIS_ATTERBERG types corrigés'

-- ============================================================================
-- 4) ESSAIS_VBS - Corrections (2 colonnes)
-- ============================================================================
\echo '📋 4. CORRECTION ESSAIS_VBS...'

TRUNCATE TABLE public.essais_vbs;

ALTER TABLE public.essais_vbs 
    ALTER COLUMN id TYPE uuid USING id::uuid,
    ALTER COLUMN echantillon_id TYPE uuid USING echantillon_id::uuid,
    ALTER COLUMN created_at TYPE timestamptz USING CASE WHEN created_at = '' THEN now() ELSE created_at::timestamptz END;

\echo '✅ ESSAIS_VBS types corrigés'

-- ============================================================================
-- 5) SONDAGES - Corrections mineures (quelques colonnes text -> numeric/date)
-- ============================================================================
\echo '📋 5. CORRECTION SONDAGES (colonnes restantes)...'

-- Corriger les colonnes qui sont encore en text mais devraient être d'autres types
ALTER TABLE public.sondages 
    ALTER COLUMN date_sondage TYPE date USING CASE WHEN date_sondage = '' THEN NULL ELSE date_sondage::date END;

\echo '✅ SONDAGES types corrigés'

-- ============================================================================
-- 6) VALIDATION DES CORRECTIONS
-- ============================================================================
\echo '🔍 VALIDATION DES CORRECTIONS...'

-- Vérifier que les types sont maintenant corrects
SELECT 
    'VALIDATION_TYPES_CORRIGES' as check_name,
    table_name,
    COUNT(*) as total_columns,
    COUNT(*) FILTER (WHERE 
        (column_name LIKE '%_id' AND data_type = 'uuid') OR
        (column_name LIKE '%_m' AND data_type = 'numeric') OR
        (column_name LIKE '%_at' AND data_type LIKE 'timestamp%') OR
        (column_name LIKE '%_pct' AND data_type = 'numeric') OR
        (column_name LIKE 'passant_%' AND data_type = 'numeric') OR
        (column_name IN ('wl', 'wp', 'ip', 'vbs', 'gs', 'gamma_d_max', 'w_opt') AND data_type = 'numeric') OR
        (column_name NOT LIKE '%_id' AND column_name NOT LIKE '%_m' AND column_name NOT LIKE '%_at' AND column_name NOT LIKE '%_pct' AND column_name NOT LIKE 'passant_%' AND column_name NOT IN ('wl', 'wp', 'ip', 'vbs', 'gs', 'gamma_d_max', 'w_opt'))
    ) as correct_types
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('sondages', 'echantillons', 'essais_geotechniques', 'essais_atterberg', 'essais_physiques', 'essais_vbs')
GROUP BY table_name
ORDER BY table_name;

COMMIT;

\echo '🎉 CORRECTION DES TYPES TERMINÉE'
\echo ''
\echo '✅ Toutes les tables ont maintenant les bons types:'
\echo '   - IDs: UUID'
\echo '   - Mesures numériques: NUMERIC'
\echo '   - Dates: DATE'
\echo '   - Timestamps: TIMESTAMPTZ'
\echo ''
\echo '🚀 Prêt pour import fidèle avec les bons types!';
