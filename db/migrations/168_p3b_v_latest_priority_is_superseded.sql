BEGIN;

ALTER TABLE atlas.ai_interpolation_values
  ADD COLUMN IF NOT EXISTS is_superseded boolean DEFAULT false;

CREATE OR REPLACE VIEW atlas.v_latest_ai_interpolation AS
 WITH ranked AS (
  SELECT
    iv.id,
    iv.maille_id,
    iv.zone_id,
    iv.kriging_domain_id,
    iv.parameter_id,
    iv.value,
    iv.variance,
    iv.confidence,
    iv.method,
    iv.variogram_id,
    iv.run_id,
    iv.created_at,
    row_number() OVER (
      PARTITION BY iv.maille_id, iv.parameter_id
      ORDER BY
        CASE
          -- Stratifie (kriging sur domaine "primary")
          WHEN iv.method ~~ 'ordinary_kriging%' AND iv.kriging_domain_id = mp.primary_kriging_domain_id THEN 1
          -- KED
          WHEN iv.method ~~ 'ked_pedologie%' THEN 2
          -- Global (kriging sur un autre domaine)
          WHEN iv.method ~~ 'ordinary_kriging%' THEN 3
          -- Regression ML
          WHEN iv.method ~~ 'regression_kriging%' THEN 4
          -- Deterministic / fallback
          ELSE 5
        END,
        CASE
          WHEN iv.kriging_domain_id IS NULL THEN 1
          WHEN iv.kriging_domain_id = mp.primary_kriging_domain_id THEN 0
          ELSE 1
        END,
        iv.created_at DESC
    ) AS rn
  FROM atlas.ai_interpolation_values iv
  LEFT JOIN atlas.v_maille_primary_kriging_domain mp ON mp.maille_id = iv.maille_id
  WHERE COALESCE(iv.is_superseded, false) = false
 )
 SELECT
  id,
  maille_id,
  zone_id,
  kriging_domain_id,
  parameter_id,
  value,
  variance,
  confidence,
  method,
  variogram_id,
  run_id,
  created_at
 FROM ranked
 WHERE rn = 1;

COMMIT;

