-- Debug : pourquoi certaines localités ne matchent pas ?

SELECT '=== Test Apeheme ===' AS test;
SELECT * FROM match_adm3_strict('Apeheme');

SELECT '=== Test Dzogbecope ===' AS test;
SELECT * FROM match_adm3_strict('Dzogbecope');

SELECT '=== Test Konsogou T1 ===' AS test;
SELECT * FROM match_adm3_strict('Konsogou T1');

SELECT '=== Test Kontongbongue ===' AS test;
SELECT * FROM match_adm3_strict('Kontongbongue');

SELECT '=== Test Nassablé ===' AS test;
SELECT * FROM match_adm3_strict('Nassablé');

-- Vérifier les sondages
SELECT 
  meta->>'code' AS code,
  meta->>'localite' AS localite,
  (meta->>'adm3_code') IS NULL AS needs_match
FROM sondages
ORDER BY meta->>'code';
