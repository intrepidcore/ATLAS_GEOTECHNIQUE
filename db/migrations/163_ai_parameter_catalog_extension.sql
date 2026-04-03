BEGIN;

-- Extension du catalogue paramètres pour piloter le pipeline sans hardcoding.
-- Idempotent: ajoute uniquement les colonnes manquantes.

-- Source / mapping (stats_col côté mailles_geotechnique_stats_wgs84)
ALTER TABLE atlas.ai_parameter_catalog
  ADD COLUMN IF NOT EXISTS source_table TEXT;

ALTER TABLE atlas.ai_parameter_catalog
  ADD COLUMN IF NOT EXISTS source_column TEXT;

-- Préférences domaines / dérive
ALTER TABLE atlas.ai_parameter_catalog
  ADD COLUMN IF NOT EXISTS domain_type_pref TEXT;

ALTER TABLE atlas.ai_parameter_catalog
  ADD COLUMN IF NOT EXISTS drift_strategy TEXT;

-- Contraintes physiques (0–100, 0–15, etc.)
ALTER TABLE atlas.ai_parameter_catalog
  ADD COLUMN IF NOT EXISTS physical_min DOUBLE PRECISION;

ALTER TABLE atlas.ai_parameter_catalog
  ADD COLUMN IF NOT EXISTS physical_max DOUBLE PRECISION;

-- Gestion horizon / stratification (utilisé plus tard par KED / dérivés)
ALTER TABLE atlas.ai_parameter_catalog
  ADD COLUMN IF NOT EXISTS depth_stratified BOOLEAN NOT NULL DEFAULT FALSE;

-- Param dérivé (calculé depuis d'autres paramètres)
ALTER TABLE atlas.ai_parameter_catalog
  ADD COLUMN IF NOT EXISTS is_derived BOOLEAN NOT NULL DEFAULT FALSE;

-- Liste des paramètres dont ce param est dérivé
ALTER TABLE atlas.ai_parameter_catalog
  ADD COLUMN IF NOT EXISTS derived_from TEXT[] NOT NULL DEFAULT '{}'::text[];

-- Seed minimal "scaling universel" pour les paramètres KED Tier 1/2 actuels.
-- 8 paramètres demandés par la roadmap_2 (RGA interprété ici comme ai_rga_score_infer).
UPDATE atlas.ai_parameter_catalog
SET
  source_table = COALESCE(source_table, 'mailles_geotechnique_stats_wgs84'),
  is_derived = COALESCE(is_derived, FALSE)
WHERE parameter_id IN (
  'eg_avg',
  'vbs_avg',
  'wl_avg',
  'wp_avg',
  'ip_avg',
  'passant_2mm_avg',
  'passant_80um_avg',
  'ai_rga_score_infer'
);

-- Source_column (stats col) pour les paramètres mesurés / interpolés
UPDATE atlas.ai_parameter_catalog
SET source_column = parameter_id,
    domain_type_pref = 'pedologie'
WHERE parameter_id IN (
  'eg_avg',
  'vbs_avg',
  'wl_avg',
  'wp_avg',
  'ip_avg',
  'passant_2mm_avg',
  'passant_80um_avg'
);

-- Mapping kriging proxy -> stats col (nécessaire sans hardcoding)
UPDATE atlas.ai_parameter_catalog
SET source_table = 'mailles_geotechnique_stats_wgs84',
    source_column = CASE
      WHEN parameter_id = 'kriging_vbs' THEN 'vbs_avg'
      WHEN parameter_id = 'kriging_ip' THEN 'ip_avg'
      ELSE source_column
    END,
    domain_type_pref = 'geologie'
WHERE parameter_id IN ('kriging_vbs', 'kriging_ip');

-- Contraintes physiques (valeurs robustes pour scaling/clipping universel)
UPDATE atlas.ai_parameter_catalog
SET
  physical_min = CASE
    WHEN parameter_id = 'vbs_avg' THEN 0
    WHEN parameter_id IN ('wl_avg','wp_avg','ip_avg') THEN 0
    WHEN parameter_id IN ('eg_avg') THEN 0
    WHEN parameter_id IN ('passant_2mm_avg','passant_80um_avg') THEN 0
    WHEN parameter_id = 'ai_rga_score_infer' THEN 0
    ELSE physical_min
  END,
  physical_max = CASE
    WHEN parameter_id = 'vbs_avg' THEN 15
    WHEN parameter_id IN ('wl_avg','wp_avg','ip_avg') THEN 100
    WHEN parameter_id IN ('eg_avg') THEN 20
    WHEN parameter_id IN ('passant_2mm_avg','passant_80um_avg') THEN 100
    WHEN parameter_id = 'ai_rga_score_infer' THEN 100
    ELSE physical_max
  END
WHERE parameter_id IN (
  'eg_avg',
  'vbs_avg',
  'wl_avg',
  'wp_avg',
  'ip_avg',
  'passant_2mm_avg',
  'passant_80um_avg',
  'kriging_vbs',
  'kriging_ip',
  'ai_rga_score_infer'
);

-- Dérivé : RGA
UPDATE atlas.ai_parameter_catalog
SET
  is_derived = TRUE,
  derived_from = ARRAY['vbs_avg','ip_avg','eg_avg','wl_avg','wp_avg']
WHERE parameter_id = 'ai_rga_score_infer';

COMMIT;

