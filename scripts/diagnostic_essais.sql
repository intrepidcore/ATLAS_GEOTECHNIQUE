-- Diagnostic: Pourquoi GRANULO-PITIAH a 0 essais?

-- 1. Vérifier si le sondage existe
SELECT id, code, source, created_at 
FROM sondages 
WHERE code LIKE '%PITIAH%' OR code LIKE '%GRANULO%';

-- 2. Compter les essais liés à ce sondage
SELECT 
    s.id as sondage_id,
    s.code as sondage_code,
    COUNT(e.id) as n_essais_lies
FROM sondages s
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
WHERE s.code LIKE '%PITIAH%' OR s.code LIKE '%GRANULO%'
GROUP BY s.id, s.code;

-- 3. Chercher des essais avec code similaire mais pas de lien
SELECT 
    e.id,
    e.type_essai,
    e.sondage_id,
    e.code_sondage,
    e.created_at
FROM essais e
WHERE e.code_sondage LIKE '%PITIAH%' OR e.code_sondage LIKE '%GRANULO%'
ORDER BY e.created_at DESC
LIMIT 20;

-- 4. Vérifier les essais orphelins (sans sondage_id)
SELECT 
    COUNT(*) as n_orphelins,
    type_essai
FROM essais
WHERE sondage_id IS NULL AND deleted_at IS NULL
GROUP BY type_essai;

-- 5. Suggestions: Trouver les essais à lier
SELECT 
    e.id as essai_id,
    e.type_essai,
    e.code_sondage as essai_code,
    s.id as sondage_id,
    s.code as sondage_code,
    similarity(e.code_sondage, s.code) as sim
FROM essais e
CROSS JOIN sondages s
WHERE e.sondage_id IS NULL 
  AND e.deleted_at IS NULL
  AND similarity(e.code_sondage, s.code) > 0.5
ORDER BY sim DESC
LIMIT 50;
