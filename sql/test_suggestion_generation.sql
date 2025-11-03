-- Test manuel de la génération de suggestions

-- Étape 1 : Sources
WITH src AS (
  SELECT id, meta->>'localite' AS localite, meta->>'adm2_code' AS adm2_code
  FROM sondages
  WHERE (meta->>'adm3_code') IS NULL 
    AND nullif(meta->>'localite','') IS NOT NULL
)
SELECT * FROM src;

-- Étape 2 : Test match pour chaque localité
SELECT 'Apeheme' AS localite, * FROM match_adm3_strict('Apeheme');
SELECT 'Davie' AS localite, * FROM match_adm3_strict('Davie');
SELECT 'Dzogbecope' AS localite, * FROM match_adm3_strict('Dzogbecope');
SELECT 'Konsogou T1' AS localite, * FROM match_adm3_strict('Konsogou T1');
SELECT 'Konsogou T2' AS localite, * FROM match_adm3_strict('Konsogou T2');
SELECT 'Kontongbongue' AS localite, * FROM match_adm3_strict('Kontongbongue');
SELECT 'Nassablé' AS localite, * FROM match_adm3_strict('Nassablé');
SELECT 'Tekpo' AS localite, * FROM match_adm3_strict('Tekpo');
