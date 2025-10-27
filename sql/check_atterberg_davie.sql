-- Vérifier les essais Atterberg pour Davie
SELECT a.id, a.echantillon_id, a.wl, a.wp, a.ip_generated, e.depth_m
FROM essais_atterberg a
JOIN echantillons e ON e.id = a.echantillon_id
JOIN sondages s ON s.id = e.sondage_id
WHERE s.meta->>'code' = 'DAVIE'
ORDER BY e.depth_m;
