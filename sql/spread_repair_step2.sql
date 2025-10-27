 -- ÉTAPE 2 : Créer mv_adm3_maille_map (calcul spatial lourd, peut prendre 1-2 min)
SELECT 'Étape 2/4 : Création mv_adm3_maille_map...' AS status;

DROP MATERIALIZED VIEW IF EXISTS mv_adm3_maille_map CASCADE;

CREATE MATERIALIZED VIEW mv_adm3_maille_map AS
WITH a AS (
  SELECT
    adm3_pcode AS adm3_code,
    geom
  FROM adm3
),
pairs AS (
  SELECT
    a.adm3_code,
    m.id   AS maille_id,
    m.code AS maille_code,
    ST_Area( ST_Intersection( ST_Transform(a.geom, ST_SRID(m.geom)), m.geom ) ) / NULLIF(ST_Area(m.geom),0) AS overlap_ratio
  FROM a
  JOIN mailles m
    ON ST_Intersects( ST_Buffer(ST_Transform(a.geom, ST_SRID(m.geom)), 1.0), m.geom )
)
SELECT *
FROM pairs
WHERE overlap_ratio IS NULL OR overlap_ratio > 0.001;

CREATE INDEX ON mv_adm3_maille_map (adm3_code);
CREATE INDEX ON mv_adm3_maille_map (maille_id);
ANALYZE mv_adm3_maille_map;

SELECT 'Total associations:' AS label, COUNT(*) AS count FROM mv_adm3_maille_map;
SELECT 'Mailles Davie:' AS label, COUNT(*) AS count FROM mv_adm3_maille_map WHERE adm3_code='TG030805';

SELECT 'Étape 2/4 : ✅ Terminée' AS status;
