-- Vérifier colonnes mv_adm3_maille_map
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mv_adm3_maille_map'
ORDER BY ordinal_position;

-- Vérifier colonnes sondages
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sondages'
  AND column_name IN ('id','adm3_code','geom','loc_mode')
ORDER BY ordinal_position;

-- Vérifier colonnes mailles
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mailles'
  AND column_name IN ('id','code')
ORDER BY ordinal_position;
