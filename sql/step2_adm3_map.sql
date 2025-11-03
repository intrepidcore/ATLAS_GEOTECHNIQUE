-- ÉTAPE 2 : Carte ADM3 → mailles (avec transformation SRID)

DROP MATERIALIZED VIEW IF EXISTS mv_adm3_maille_map CASCADE;

CREATE MATERIALIZED VIEW mv_adm3_maille_map AS
SELECT
  a.adm3_fr AS adm3_code,
  a.adm3_pcode,
  m.id AS maille_id
FROM adm3 a
JOIN mailles m ON ST_Intersects(
  ST_Transform(m.geom, 4326),  -- mailles en 25231 → 4326 pour matcher adm3
  a.geom
);

CREATE INDEX IF NOT EXISTS idx_mv_map_adm3_fr ON mv_adm3_maille_map(adm3_code);
CREATE INDEX IF NOT EXISTS idx_mv_map_adm3_pcode ON mv_adm3_maille_map(adm3_pcode);
CREATE INDEX IF NOT EXISTS idx_mv_map_maille ON mv_adm3_maille_map(maille_id);

-- Test
SELECT 'Carte ADM3→mailles créée' AS status;
SELECT adm3_code, COUNT(*) AS nb_mailles
FROM mv_adm3_maille_map
GROUP BY 1
ORDER BY 2 DESC
LIMIT 5;
