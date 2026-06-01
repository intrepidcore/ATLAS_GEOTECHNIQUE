\set ON_ERROR_STOP 1
-- Migration 175 — BLOC E : Backfill ai_interpolation_runs + ai_prediction_runs
-- Intrepid Core Engineering Standards
-- Règles : DB-11 (atomique/idempotent), DB-10 (inspecter avant écrire)
--
-- Problème : Les scripts L1-L4 (run_ked, ked_rk_fusion, mtgp, vfs) ont bien
-- écrit les valeurs dans ai_interpolation_values avec leurs run_id, MAIS les
-- lignes correspondantes dans ai_interpolation_runs n'ont pas été committées
-- (transaction rollback sur exception ou script interrompu).
--
-- Solution : Reconstruire ai_interpolation_runs à partir des run_id distincts
-- déjà présents dans ai_interpolation_values + calculer les métriques agrégées
-- (n_mailles, mean, std) directement depuis la DB.
--
-- Idempotence : ON CONFLICT (id) DO NOTHING — sûr à rejouer.

BEGIN;

-- ── 1. Backfill ai_interpolation_runs depuis ai_interpolation_values ──────────
INSERT INTO atlas.ai_interpolation_runs
  (id, run_type, parameter_id, method, model_version, status, metrics,
   started_at, finished_at, created_at)
SELECT
  v.run_id                          AS id,
  'kriging'                         AS run_type,
  v.parameter_id,
  v.method,
  'v2'                              AS model_version,
  'finished'                        AS status,
  jsonb_build_object(
    'n_mailles',  COUNT(*),
    'mean_value', ROUND(AVG(v.value)::numeric, 4),
    'std_value',  ROUND(STDDEV(v.value)::numeric, 4),
    'min_value',  ROUND(MIN(v.value)::numeric, 4),
    'max_value',  ROUND(MAX(v.value)::numeric, 4),
    'mean_variance', ROUND(AVG(v.variance)::numeric, 6),
    'n_neg_variance', COUNT(*) FILTER (WHERE v.variance < 0),
    'backfilled_at', now()::text,
    'source', 'migration_175_backfill'
  )                                 AS metrics,
  now() - interval '1 day'         AS started_at,
  now() - interval '1 day'         AS finished_at,
  now()                             AS created_at
FROM atlas.ai_interpolation_values v
WHERE v.run_id IS NOT NULL
GROUP BY v.run_id, v.parameter_id, v.method
ON CONFLICT (id) DO NOTHING;

-- ── 2. Vérification post-insert ───────────────────────────────────────────────
DO $$
DECLARE
  v_runs_inserted integer;
  v_values_total  integer;
BEGIN
  SELECT COUNT(*) INTO v_runs_inserted FROM atlas.ai_interpolation_runs;
  SELECT COUNT(DISTINCT run_id) INTO v_values_total
    FROM atlas.ai_interpolation_values WHERE run_id IS NOT NULL;

  RAISE NOTICE 'ai_interpolation_runs : % lignes insérées (attendu ~%)',
    v_runs_inserted, v_values_total;

  IF v_runs_inserted = 0 THEN
    RAISE EXCEPTION 'Backfill échoué : 0 lignes dans ai_interpolation_runs';
  END IF;
END $$;

-- ── 3. Backfill ai_prediction_runs (VfS / MTGP / Fusion) ─────────────────────
-- Schema réel : id, run_type, target_id, model_version, status, metrics,
--               started_at, finished_at, created_at
INSERT INTO atlas.ai_prediction_runs
  (id, run_type, target_id, model_version, status, metrics,
   started_at, finished_at, created_at)
SELECT
  v.run_id::uuid                  AS id,
  CASE
    WHEN v.method = 'mtgp_icm_gpflow'        THEN 'mtgp'
    WHEN v.method = 'maille_spectral_vfs'    THEN 'vfs'
    WHEN v.method = 'ked_rk_fusion_bayesian' THEN 'fusion_blup'
    ELSE v.method
  END                             AS run_type,
  v.parameter_id                  AS target_id,
  'v2'                            AS model_version,
  'finished'                      AS status,
  jsonb_build_object(
    'n_predictions', COUNT(*),
    'mean_value',    ROUND(AVG(v.value)::numeric, 4),
    'backfilled_at', now()::text,
    'source', 'migration_175_backfill'
  )                               AS metrics,
  now() - interval '1 day'       AS started_at,
  now() - interval '1 day'       AS finished_at,
  now()                           AS created_at
FROM atlas.ai_interpolation_values v
WHERE v.run_id IS NOT NULL
  AND v.method IN ('mtgp_icm_gpflow', 'maille_spectral_vfs', 'ked_rk_fusion_bayesian')
GROUP BY v.run_id, v.parameter_id, v.method
ON CONFLICT (id) DO NOTHING;

-- ── 4. Sommaire ───────────────────────────────────────────────────────────────
DO $$
DECLARE r1 int; r2 int; r3 int;
BEGIN
  SELECT COUNT(*) INTO r1 FROM atlas.ai_interpolation_runs;
  SELECT COUNT(*) INTO r2 FROM atlas.ai_prediction_runs;
  SELECT COUNT(*) INTO r3 FROM atlas.ai_interpolation_values;
  RAISE NOTICE '=== Migration 175 OK ===';
  RAISE NOTICE '  ai_interpolation_runs  : % runs tracés', r1;
  RAISE NOTICE '  ai_prediction_runs     : % runs tracés', r2;
  RAISE NOTICE '  ai_interpolation_values: % valeurs couvertes', r3;
END $$;

COMMIT;
