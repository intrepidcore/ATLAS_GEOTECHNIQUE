-- Vérification finale
SELECT
 COUNT(*) AS mailles_total,
 COUNT(*) FILTER (WHERE has_data) AS mailles_avec_donnees,
 SUM(nb_sondages_real)  AS sondages_real,
 SUM(nb_sondages_spread) AS sondages_spread
FROM mv_mailles_geotech;

-- Voir exemples
SELECT code, nb_sondages_real, nb_sondages_spread, has_data, adm3_name
FROM mv_mailles_geotech
WHERE has_data = true
LIMIT 10;

-- Vérifier associations
SELECT COUNT(*) FROM v_maille_sondages_all;

-- Vérifier mapping Davie
SELECT COUNT(*) FROM mv_adm3_maille_map WHERE adm3_code = 'TG030805';
