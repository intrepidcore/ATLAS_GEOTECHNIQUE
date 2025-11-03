-- Test Nassablé
SELECT normalize_name('Nassablé') AS normalized;

-- Chercher dans adm3_names
SELECT code, name, name_norm, similarity(name_norm, normalize_name('Nassablé')) AS sim
FROM adm3_names
WHERE similarity(name_norm, normalize_name('Nassablé')) > 0.1
ORDER BY sim DESC
LIMIT 10;
