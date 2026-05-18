-- Migration: Ajouter les colonnes RK dans la table mailles
-- Ces colonnes permettent à l'API thematic de lire les valeurs RK
\set ON_ERROR_STOP 1
BEGIN;

-- Colonnes RK (12 params × 3 horizons)
ALTER TABLE atlas.mailles 
    ADD COLUMN IF NOT EXISTS vbs_rk_h1 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS vbs_rk_h2 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS vbs_rk_h3 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS ip_rk_h1 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS ip_rk_h2 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS ip_rk_h3 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS wl_rk_h1 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS wl_rk_h2 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS wl_rk_h3 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS wp_rk_h1 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS wp_rk_h2 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS wp_rk_h3 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS eg_rk_h1 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS eg_rk_h2 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS eg_rk_h3 DOUBLE PRECISION;

-- Remplir depuis ai_interpolation_values
UPDATE atlas.mailles m SET
    vbs_rk_h1 = v.value
FROM atlas.ai_interpolation_values v
WHERE v.parameter_id = 'vbs_rk_h1' AND v.maille_id = m.id
    AND COALESCE(v.is_superseded, false) = false;

UPDATE atlas.mailles m SET
    vbs_rk_h2 = v.value
FROM atlas.ai_interpolation_values v
WHERE v.parameter_id = 'vbs_rk_h2' AND v.maille_id = m.id
    AND COALESCE(v.is_superseded, false) = false;

UPDATE atlas.mailles m SET
    vbs_rk_h3 = v.value
FROM atlas.ai_interpolation_values v
WHERE v.parameter_id = 'vbs_rk_h3' AND v.maille_id = m.id
    AND COALESCE(v.is_superseded, false) = false;

UPDATE atlas.mailles m SET
    ip_rk_h1 = v.value
FROM atlas.ai_interpolation_values v
WHERE v.parameter_id = 'ip_rk_h1' AND v.maille_id = m.id
    AND COALESCE(v.is_superseded, false) = false;

UPDATE atlas.mailles m SET
    ip_rk_h2 = v.value
FROM atlas.ai_interpolation_values v
WHERE v.parameter_id = 'ip_rk_h2' AND v.maille_id = m.id
    AND COALESCE(v.is_superseded, false) = false;

UPDATE atlas.mailles m SET
    ip_rk_h3 = v.value
FROM atlas.ai_interpolation_values v
WHERE v.parameter_id = 'ip_rk_h3' AND v.maille_id = m.id
    AND COALESCE(v.is_superseded, false) = false;

UPDATE atlas.mailles m SET
    wl_rk_h1 = v.value
FROM atlas.ai_interpolation_values v
WHERE v.parameter_id = 'wl_rk_h1' AND v.maille_id = m.id
    AND COALESCE(v.is_superseded, false) = false;

UPDATE atlas.mailles m SET
    wl_rk_h2 = v.value
FROM atlas.ai_interpolation_values v
WHERE v.parameter_id = 'wl_rk_h2' AND v.maille_id = m.id
    AND COALESCE(v.is_superseded, false) = false;

UPDATE atlas.mailles m SET
    wl_rk_h3 = v.value
FROM atlas.ai_interpolation_values v
WHERE v.parameter_id = 'wl_rk_h3' AND v.maille_id = m.id
    AND COALESCE(v.is_superseded, false) = false;

UPDATE atlas.mailles m SET
    wp_rk_h1 = v.value
FROM atlas.ai_interpolation_values v
WHERE v.parameter_id = 'wp_rk_h1' AND v.maille_id = m.id
    AND COALESCE(v.is_superseded, false) = false;

UPDATE atlas.mailles m SET
    wp_rk_h2 = v.value
FROM atlas.ai_interpolation_values v
WHERE v.parameter_id = 'wp_rk_h2' AND v.maille_id = m.id
    AND COALESCE(v.is_superseded, false) = false;

UPDATE atlas.mailles m SET
    wp_rk_h3 = v.value
FROM atlas.ai_interpolation_values v
WHERE v.parameter_id = 'wp_rk_h3' AND v.maille_id = m.id
    AND COALESCE(v.is_superseded, false) = false;

-- EG n'existe pas encore - leave as NULL
-- UPDATE atlas.mailles m SET eg_rk_h1 = ...

COMMIT;

-- Vérification
SELECT 
    'vbs_rk_h1' as col, COUNT(vbs_rk_h1) as cnt FROM atlas.mailles
UNION ALL
SELECT 'ip_rk_h1', COUNT(ip_rk_h1) FROM atlas.mailles
UNION ALL
SELECT 'wl_rk_h1', COUNT(wl_rk_h1) FROM atlas.mailles
UNION ALL
SELECT 'wp_rk_h1', COUNT(wp_rk_h1) FROM atlas.mailles;