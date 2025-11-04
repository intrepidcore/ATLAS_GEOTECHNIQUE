-- Assigne les ADM3 aux sondages importés via MD files
-- Utilise le nom de localité dans le code du sondage pour matcher avec adm3_tg.name

-- 1) Extraire la localité du code et matcher avec ADM3 (exact match)
WITH locality_mapping AS (
  SELECT 
    s.id AS sondage_id,
    s.code,
    -- Extraire la partie après le tiret (ex: BLEU-AKEPE -> AKEPE)
    UPPER(TRIM(SPLIT_PART(s.code, '-', 2))) AS locality,
    a.id AS adm3_id,
    a.name AS adm3_name,
    a.code AS adm3_code,
    a.adm2_name,
    a.adm1_name
  FROM sondages s
  CROSS JOIN adm3_tg a
  WHERE s.created_by_batch LIKE 'MD-2025%'
    AND s.adm3_name IS NULL
    AND UPPER(TRIM(SPLIT_PART(s.code, '-', 2))) = UPPER(a.name)
)
UPDATE sondages s
SET 
  adm3_name = lm.adm3_name,
  adm2_name = lm.adm2_name,
  adm1_name = lm.adm1_name
FROM locality_mapping lm
WHERE s.id = lm.sondage_id;

-- 2) Pour les sondages qui n'ont pas matché, essayer avec fuzzy matching (similarity > 0.7)
WITH fuzzy_mapping AS (
  SELECT DISTINCT ON (s.id)
    s.id AS sondage_id,
    s.code,
    UPPER(TRIM(SPLIT_PART(s.code, '-', 2))) AS locality,
    a.id AS adm3_id,
    a.name AS adm3_name,
    a.code AS adm3_code,
    a.adm2_name,
    a.adm1_name,
    similarity(UPPER(TRIM(SPLIT_PART(s.code, '-', 2))), UPPER(a.name)) AS sim
  FROM sondages s
  CROSS JOIN adm3_tg a
  WHERE s.created_by_batch LIKE 'MD-2025%'
    AND s.adm3_name IS NULL
    AND similarity(UPPER(TRIM(SPLIT_PART(s.code, '-', 2))), UPPER(a.name)) > 0.7
  ORDER BY s.id, sim DESC
)
UPDATE sondages s
SET 
  adm3_name = fm.adm3_name,
  adm2_name = fm.adm2_name,
  adm1_name = fm.adm1_name
FROM fuzzy_mapping fm
WHERE s.id = fm.sondage_id;

-- 3) Afficher les sondages qui n'ont toujours pas d'ADM3
SELECT 
  code,
  UPPER(TRIM(SPLIT_PART(code, '-', 2))) AS locality_extracted,
  created_by_batch
FROM sondages
WHERE created_by_batch LIKE 'MD-2025%'
  AND adm3_name IS NULL
ORDER BY code;
