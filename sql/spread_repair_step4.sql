-- ÉTAPE 4 : Créer mv_mailles_geotech (agrégat final)
SELECT 'Étape 4/4 : Création mv_mailles_geotech...' AS status;

DROP MATERIALIZED VIEW IF EXISTS mv_mailles_geotech;

CREATE MATERIALIZED VIEW mv_mailles_geotech AS
SELECT
  m.id,
  m.code,
  m.geom,
  m.adm1_name,
  m.adm2_name,
  m.adm3_name,
  COUNT(DISTINCT v.sondage_id) FILTER (WHERE v.source='real')   AS nb_sondages_real,
  COUNT(DISTINCT v.sondage_id) FILTER (WHERE v.source='spread') AS nb_sondages_spread,
  (COUNT(v.sondage_id) > 0) AS has_data
FROM mailles m
LEFT JOIN v_maille_sondages_all v ON v.maille_id = m.id
GROUP BY m.id, m.code, m.geom, m.adm1_name, m.adm2_name, m.adm3_name;

CREATE UNIQUE INDEX ON mv_mailles_geotech (id);
CREATE INDEX mv_mailles_geotech_has ON mv_mailles_geotech (has_data);
ANALYZE mv_mailles_geotech;

SELECT 'Résultat final:' AS label,
 COUNT(*) AS total,
 COUNT(*) FILTER (WHERE has_data) AS avec_donnees,
 SUM(nb_sondages_real)  AS sondages_real,
 SUM(nb_sondages_spread) AS sondages_spread
FROM mv_mailles_geotech;

SELECT 'Étape 4/4 : ✅ Terminée' AS status;
SELECT '🎉 SPREAD REPAIR COMPLET !' AS status;
