-- ÉTAPE 3 : Créer v_maille_sondages_all (union réel ∪ spread)
SELECT 'Étape 3/4 : Création v_maille_sondages_all...' AS status;

DROP VIEW IF EXISTS v_maille_sondages_all CASCADE;

CREATE OR REPLACE VIEW v_maille_sondages_all AS
-- RÉEL (GPS)
SELECT
  m.id   AS maille_id,
  m.code AS maille_code,
  s.id   AS sondage_id,
  'real'::text AS source
FROM mailles m
JOIN sondages s
  ON s.geom IS NOT NULL
 AND ST_Within(s.geom, m.geom)

UNION ALL

-- SPREAD (ADM3→mailles)
SELECT
  m.id   AS maille_id,
  m.code AS maille_code,
  s.id   AS sondage_id,
  'spread'::text AS source
FROM sondages s
JOIN mv_adm3_maille_map map
  ON TRIM(UPPER(COALESCE(s.meta->>'adm3_code', ''))) = TRIM(UPPER(map.adm3_code))
JOIN mailles m
  ON m.id = map.maille_id
WHERE s.geom IS NULL
  AND COALESCE(s.loc_mode,'spread') = 'spread';

SELECT 'Associations totales:' AS label, COUNT(*) AS count FROM v_maille_sondages_all;
SELECT 'Par source:' AS label, source, COUNT(*) AS count FROM v_maille_sondages_all GROUP BY source;

SELECT 'Étape 3/4 : ✅ Terminée' AS status;
