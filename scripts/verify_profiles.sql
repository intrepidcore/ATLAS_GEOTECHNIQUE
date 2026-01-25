
SELECT profil_num, count(*) as count_mailles, min(pk_min_km) as pk_min, max(pk_max_km) as pk_max 
FROM atlas.maille_28km 
GROUP BY profil_num 
ORDER BY profil_num;
