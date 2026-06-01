\set ON_ERROR_STOP 1
BEGIN;

UPDATE atlas.ai_interpolation_values iv
SET variance = sub.loo_var
FROM (
    SELECT DISTINCT ON (parameter_id)
           parameter_id,
           POWER((meta->>'loo_rmse')::float, 2) AS loo_var
    FROM atlas.ai_interpolation_runs
    WHERE method = 'regression_kriging_scorpan'
      AND status = 'finished'
      AND meta->>'loo_rmse' IS NOT NULL
      AND (meta->>'loo_rmse')::float > 0
    ORDER BY parameter_id, created_at DESC
) sub
WHERE iv.parameter_id = sub.parameter_id
  AND iv.method = 'regression_kriging_scorpan'
  AND iv.variance IS NULL
  AND COALESCE(iv.is_superseded, false) = false;

DO

DECLARE
    n_updated INTEGER;
    n_still_null INTEGER;
BEGIN
    SELECT COUNT(*) INTO n_updated
    FROM atlas.ai_interpolation_values
    WHERE method = 'regression_kriging_scorpan'
      AND variance IS NOT NULL
      AND COALESCE(is_superseded, false) = false;

    SELECT COUNT(*) INTO n_still_null
    FROM atlas.ai_interpolation_values
    WHERE method = 'regression_kriging_scorpan'
      AND variance IS NULL
      AND COALESCE(is_superseded, false) = false;

    RAISE NOTICE 'Variance RK peuplee: % valeurs | Encore NULL: %', n_updated, n_still_null;
END
;

COMMIT;