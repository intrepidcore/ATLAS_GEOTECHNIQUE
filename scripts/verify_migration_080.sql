
-- Vérification des comptes
SELECT 'maille_28km' as table_name, count(*) as count FROM atlas.maille_28km
UNION ALL
SELECT 'mailles_linked', count(*) FROM atlas.mailles WHERE id_m28 IS NOT NULL
UNION ALL
SELECT 'sondages_linked', count(*) FROM atlas.sondages WHERE id_m28 IS NOT NULL;

-- Vérification des profils
SELECT profil_num, count(*) as count_mailles, min(pk_min_km) as pk_min, max(pk_max_km) as pk_max 
FROM atlas.maille_28km 
GROUP BY profil_num 
ORDER BY profil_num;

-- Vérification d'un exemple de lien
SELECT s.id, s.grid_code, m2.code as m2_code, m28.code_m28, m28.profil_num
FROM atlas.sondages s
JOIN atlas.mailles m2 ON s.grid_code = m2.code
JOIN atlas.maille_28km m28 ON s.id_m28 = m28.id_m28
LIMIT 5;
