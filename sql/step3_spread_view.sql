-- ÉTAPE 3 : Vue spread (utilise la map matérialisée)

CREATE OR REPLACE VIEW v_sondages_spread AS
SELECT
  map.maille_id,
  s.id AS sondage_id,
  e.id AS echantillon_id,
  s.meta->>'code' AS code_site,
  e.depth_m,
  s.meta->>'adm3_code' AS adm3_code
FROM sondages s
JOIN echantillons e ON e.sondage_id = s.id
JOIN mv_adm3_maille_map map ON map.adm3_code = s.meta->>'adm3_code'
WHERE s.geom IS NULL;

-- Test
SELECT 'Vue spread créée' AS status;
SELECT COUNT(*) AS nb_lignes_spread FROM v_sondages_spread;
SELECT code_site, COUNT(DISTINCT maille_id) AS nb_mailles_spread
FROM v_sondages_spread
GROUP BY 1;
