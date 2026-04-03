BEGIN;

-- Densité de données : nombre de sondages distincts dans un rayon de 20 km (géodésique)
-- autour du centroïde de chaque maille. Utilisé par /thematic/data?parameter=data_density.
DROP MATERIALIZED VIEW IF EXISTS atlas.mv_maille_n_sondages_20km CASCADE;

CREATE MATERIALIZED VIEW atlas.mv_maille_n_sondages_20km AS
SELECT
  m.code,
  (
    SELECT COUNT(DISTINCT s.id)::integer
    FROM atlas.sondages s
    WHERE s.deleted_at IS NULL
      AND s.geom IS NOT NULL
      AND ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 4326)::geography,
        s.geom::geography,
        20000.0
      )
  ) AS n_sondages_20km
FROM atlas.mailles m
WHERE m.geom IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_maille_n_sondages_20km_code
  ON atlas.mv_maille_n_sondages_20km (code);

COMMENT ON MATERIALIZED VIEW atlas.mv_maille_n_sondages_20km IS
  'Nombre de sondages dans 20 km (ST_DWithin géographique) par maille — rafraîchir après imports massifs (REFRESH MATERIALIZED VIEW CONCURRENTLY si besoin).';

COMMIT;
