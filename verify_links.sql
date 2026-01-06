
SELECT s.id, s.grid_code, m2.code as m2_code, m28.code_m28, m28.profil_num
FROM atlas.sondages s
JOIN atlas.mailles m2 ON s.grid_code = m2.code
JOIN atlas.maille_28km m28 ON s.id_m28 = m28.id_m28
LIMIT 5;
