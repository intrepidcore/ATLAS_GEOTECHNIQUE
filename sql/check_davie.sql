-- Vérifier les échantillons Davie
SELECT e.id, e.depth_m, s.meta->>'code' as code
FROM echantillons e
JOIN sondages s ON s.id = e.sondage_id
WHERE s.meta->>'code' = 'DAVIE';
