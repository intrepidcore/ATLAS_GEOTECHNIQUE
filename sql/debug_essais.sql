-- Debug: Vérifier la liaison échantillons → essais

-- 1. Échantillons du sondage Davie
SELECT '=== ÉCHANTILLONS DAVIE ===' as section;
SELECT e.id, e.depth_m, e.sondage_id, s.meta->>'code' as code
FROM echantillons e
JOIN sondages s ON s.id = e.sondage_id
WHERE s.meta->>'code' = 'DAVIE'
ORDER BY e.depth_m;

-- 2. Essais Atterberg pour Davie
SELECT '=== ESSAIS ATTERBERG DAVIE ===' as section;
SELECT a.id, a.echantillon_id, a.wl, a.wp, a.ip_generated, e.depth_m
FROM essais_atterberg a
JOIN echantillons e ON e.id = a.echantillon_id
JOIN sondages s ON s.id = e.sondage_id
WHERE s.meta->>'code' = 'DAVIE'
ORDER BY e.depth_m;

-- 3. Essais VBS pour Davie
SELECT '=== ESSAIS VBS DAVIE ===' as section;
SELECT v.id, v.echantillon_id, v.vbs, e.depth_m
FROM essais_vbs v
JOIN echantillons e ON e.id = v.echantillon_id
JOIN sondages s ON s.id = e.sondage_id
WHERE s.meta->>'code' = 'DAVIE'
ORDER BY e.depth_m;

-- 4. Tous les essais Atterberg (tous sondages)
SELECT '=== TOUS LES ESSAIS ATTERBERG ===' as section;
SELECT s.meta->>'code' as code, e.depth_m, a.wl, a.wp, a.ip_generated
FROM essais_atterberg a
JOIN echantillons e ON e.id = a.echantillon_id
JOIN sondages s ON s.id = e.sondage_id
ORDER BY s.meta->>'code', e.depth_m
LIMIT 10;

-- 5. Tous les essais VBS (tous sondages)
SELECT '=== TOUS LES ESSAIS VBS ===' as section;
SELECT s.meta->>'code' as code, e.depth_m, v.vbs
FROM essais_vbs v
JOIN echantillons e ON e.id = v.echantillon_id
JOIN sondages s ON s.id = e.sondage_id
ORDER BY s.meta->>'code', e.depth_m
LIMIT 10;

-- 6. Compter les essais par sondage
SELECT '=== COMPTAGE ESSAIS PAR SONDAGE ===' as section;
SELECT 
    s.meta->>'code' as code,
    COUNT(DISTINCT e.id) as nb_echantillons,
    COUNT(DISTINCT a.id) as nb_atterberg,
    COUNT(DISTINCT v.id) as nb_vbs
FROM sondages s
LEFT JOIN echantillons e ON e.sondage_id = s.id
LEFT JOIN essais_atterberg a ON a.echantillon_id = e.id
LEFT JOIN essais_vbs v ON v.echantillon_id = e.id
GROUP BY s.meta->>'code'
ORDER BY s.meta->>'code';
