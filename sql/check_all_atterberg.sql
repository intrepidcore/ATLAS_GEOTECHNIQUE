-- Vérifier tous les essais Atterberg
SELECT 
    s.meta->>'code' as code_sondage,
    e.depth_m,
    a.wl,
    a.wp,
    a.ip_generated
FROM essais_atterberg a
JOIN echantillons e ON e.id = a.echantillon_id
JOIN sondages s ON s.id = e.sondage_id
ORDER BY s.meta->>'code', e.depth_m;
