-- ============================================================
-- compute_prec_dry_wet_single_band.sql
-- Atlas Géotechnique Togo — Calcul prec_dry / prec_wet
-- Intrepid Core Engineering Standards
--
-- Règle  : DB-11 (atomique, ON_ERROR_STOP=1)
-- Règle  : BM-SYNC-05 (idempotent — relancer est sûr)
-- Règle  : DATA-02 (validation physique obligatoire)
--
-- Contexte : worldclim_prec = 1 bande/tuile, 12 fichiers mensuels
--   → 24 540 tuiles ÷ 12 mois = 2 045 dalles spatiales par mois
--   → prec_dry  = MIN des 12 valeurs mensuelles au centroïde
--   → prec_wet  = MAX des 12 valeurs mensuelles au centroïde
--
-- Durée estimée : 10-20 min
-- ============================================================
\set ON_ERROR_STOP 1

BEGIN;

-- Étape 1 : construire les agrégats mensuels par maille
-- ST_Value(rast, 1, centroid) extrait la valeur de la bande 1 au centroïde
-- ARRAY_AGG avec ORDER BY rid garantit l'ordre chrono des 12 mois
CREATE TEMP TABLE IF NOT EXISTS _monthly_prec_calc AS
SELECT
    cf.maille_code,
    ARRAY_AGG(
        ST_Value(
            r.rast,
            1,
            ST_Transform(ST_Centroid(m.geom), 4326),
            false  -- ne pas lever d'exception si hors raster
        )
        ORDER BY r.rid
    ) AS monthly_values
FROM atlas.maille_climate_features cf
JOIN atlas.mailles m ON m.code = cf.maille_code
JOIN atlas.worldclim_prec r
    ON ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
WHERE cf.prec_wet IS NULL  -- idempotent : ne recalcule que ce qui manque
GROUP BY cf.maille_code;

-- Étape 2 : mettre à jour prec_dry et prec_wet
UPDATE atlas.maille_climate_features cf
SET
    prec_dry = (
        SELECT MIN(v)
        FROM UNNEST(t.monthly_values) AS v
        WHERE v IS NOT NULL AND v >= 0
    ),
    prec_wet = (
        SELECT MAX(v)
        FROM UNNEST(t.monthly_values) AS v
        WHERE v IS NOT NULL AND v >= 0
    ),
    updated_at = NOW()
FROM _monthly_prec_calc t
WHERE t.maille_code = cf.maille_code
  AND cf.prec_wet IS NULL;

-- Étape 3 : validation DATA-02
DO $$
DECLARE
    n_updated INTEGER;
    n_invalid_order INTEGER;
    n_invalid_neg   INTEGER;
BEGIN
    SELECT COUNT(*) INTO n_updated
    FROM atlas.maille_climate_features
    WHERE prec_wet IS NOT NULL;

    SELECT COUNT(*) INTO n_invalid_order
    FROM atlas.maille_climate_features
    WHERE prec_dry IS NOT NULL
      AND prec_wet IS NOT NULL
      AND prec_dry > prec_wet;

    SELECT COUNT(*) INTO n_invalid_neg
    FROM atlas.maille_climate_features
    WHERE prec_dry IS NOT NULL AND prec_dry < 0;

    RAISE NOTICE 'prec_dry/wet calculés : % mailles / 29407', n_updated;
    RAISE NOTICE 'Incohérences prec_dry > prec_wet : %', n_invalid_order;
    RAISE NOTICE 'Valeurs négatives prec_dry : %', n_invalid_neg;

    IF n_invalid_order > 0 THEN
        RAISE EXCEPTION 'Données invalides : % mailles avec prec_dry > prec_wet', n_invalid_order;
    END IF;
    IF n_invalid_neg > 0 THEN
        RAISE EXCEPTION 'Données invalides : % mailles avec prec_dry < 0', n_invalid_neg;
    END IF;
    IF n_updated < 29000 THEN
        RAISE WARNING 'Couverture incomplète : % / 29407 mailles', n_updated;
    END IF;
END $$;

COMMIT;

-- Rapport final
SELECT
    COUNT(*) AS total,
    COUNT(prec_dry) AS prec_dry_ok,
    COUNT(prec_wet) AS prec_wet_ok,
    ROUND(AVG(prec_dry)::numeric, 1) AS prec_dry_mean_mm,
    ROUND(MIN(prec_dry)::numeric, 1) AS prec_dry_min_mm,
    ROUND(MAX(prec_wet)::numeric, 1) AS prec_wet_max_mm
FROM atlas.maille_climate_features;
