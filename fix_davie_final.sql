-- Diagnostic et fix Davie
SELECT 
  id,
  meta->>'code' AS code,
  meta->>'localite' AS localite,
  meta->>'adm3_code' AS adm3_from_meta,
  geom IS NOT NULL AS has_geom,
  loc_mode
FROM sondages;

-- Le problème : adm3_code est dans meta, pas en colonne directe
-- La fonction geocode_adm3_spread met à jour meta->>'adm3_code'
-- Vérifions si c'est bien fait

-- Forcer la mise à jour pour Davie
UPDATE sondages
SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{adm3_code}', '"TG030805"'),
    geom = NULL,
    loc_mode = 'spread'
WHERE meta->>'localite' = 'Davie';

-- Vérifier
SELECT 
  id,
  meta->>'code' AS code,
  meta->>'adm3_code' AS adm3,
  geom IS NOT NULL AS has_geom,
  loc_mode
FROM sondages
WHERE meta->>'localite' = 'Davie';

-- Refresh
REFRESH MATERIALIZED VIEW mv_mailles_geotech;

-- Vérifier associations
SELECT COUNT(*) AS associations FROM v_maille_sondages_all;

SELECT 
  COUNT(*) AS mailles_avec_donnees,
  SUM(n_sondages) AS total_sondages
FROM mv_mailles_geotech
WHERE has_data;
