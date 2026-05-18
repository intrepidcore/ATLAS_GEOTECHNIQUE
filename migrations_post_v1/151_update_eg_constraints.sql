-- Migration 151b: Update physical constraints for EG in catalog
\set ON_ERROR_STOP 1
BEGIN;

UPDATE atlas.ai_parameter_catalog
SET physical_min = 0.0, physical_max = 20.0
WHERE parameter_id IN ('eg_rk_h1', 'eg_rk_h2', 'eg_rk_h3')
  AND (physical_min IS NULL OR physical_max IS NULL);

-- Also update the existing RK params if needed
UPDATE atlas.ai_parameter_catalog
SET physical_min = COALESCE(physical_min, 0.0),
    physical_max = CASE 
        WHEN parameter_id LIKE 'vbs_%' THEN 20.0
        WHEN parameter_id LIKE 'ip_%' THEN 80.0
        WHEN parameter_id LIKE 'wl_%' THEN 120.0
        WHEN parameter_id LIKE 'wp_%' THEN 60.0
        ELSE physical_max
    END
WHERE parameter_id LIKE '%_rk_%'
  AND (physical_min IS NULL OR physical_max IS NULL);

COMMIT;

-- Verify
SELECT parameter_id, physical_min, physical_max
FROM atlas.ai_parameter_catalog
WHERE parameter_id LIKE '%_rk_%'
ORDER BY parameter_id;