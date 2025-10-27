-- Vérifier tous les codes de sondages
SELECT 
    meta->>'code' as code,
    meta->>'localite' as localite,
    meta->>'adm3_code' as adm3,
    (SELECT COUNT(*) FROM echantillons e WHERE e.sondage_id = s.id) as nb_echantillons,
    (SELECT COUNT(*) FROM echantillons e 
     JOIN essais_atterberg a ON a.echantillon_id = e.id 
     WHERE e.sondage_id = s.id) as nb_atterberg,
    (SELECT COUNT(*) FROM echantillons e 
     JOIN essais_vbs v ON v.echantillon_id = e.id 
     WHERE e.sondage_id = s.id) as nb_vbs
FROM sondages s
ORDER BY meta->>'code';
