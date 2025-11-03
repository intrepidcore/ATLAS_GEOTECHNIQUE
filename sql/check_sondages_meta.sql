-- Vérifier le contenu meta des sondages
SELECT 
  meta->>'code' AS code,
  meta->>'localite' AS localite,
  meta->>'adm3_code' AS adm3_code,
  meta
FROM sondages
ORDER BY meta->>'code';
