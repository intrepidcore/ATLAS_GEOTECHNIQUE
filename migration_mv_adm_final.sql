-- ============================================================================
-- MIGRATION FINALE: MV avec ADM sans doublon geom
-- ============================================================================
-- Objectif: Recréer la MV avec adm1/2/3_name + geom unique en 4326
-- Méthode: Construction dynamique excluant geom de s.* si présent
-- ============================================================================

BEGIN;

-- 1) Construire et créer une nouvelle MV sans doublon 'geom'
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(format('s.%I', c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name   = 'mailles_geotechnique_stats'
    AND c.column_name <> 'geom';  -- on exclut geom s'il existe

  -- Si la table n'avait pas 'geom', on aura bien toutes les colonnes.
  EXECUTE format($SQL$
    DROP MATERIALIZED VIEW IF EXISTS public.mailles_geotechnique_stats_wgs84_new CASCADE;

    CREATE MATERIALIZED VIEW public.mailles_geotechnique_stats_wgs84_new AS
    SELECT
      %s,                                -- toutes les colonnes de s sauf 'geom'
      m.adm1_name,
      m.adm2_name,
      m.adm3_name,
      -- géo en 4326 (robuste si SRID inconnu/25231/4326)
      (
        CASE
          WHEN ST_SRID(m.geom) = 0
            THEN ST_Transform(ST_SetSRID(m.geom, 25231), 4326)
          WHEN ST_SRID(m.geom) <> 4326
            THEN ST_Transform(m.geom, 4326)
          ELSE m.geom
        END
      )::geometry(MultiPolygon,4326) AS geom,

      ST_SimplifyPreserveTopology(
        (
          CASE
            WHEN ST_SRID(m.geom) = 0
              THEN ST_Transform(ST_SetSRID(m.geom, 25231), 4326)
            WHEN ST_SRID(m.geom) <> 4326
              THEN ST_Transform(m.geom, 4326)
            ELSE m.geom
          END
        ),
        0.001
      )::geometry(MultiPolygon,4326) AS geom_simplified
    FROM public.mailles_geotechnique_stats s
    JOIN public.mailles m ON m.code = s.code
    ;
  $SQL$, cols);
END$$;

-- 2) Indexes (pour filtres & spatial & refresh concurrent)
CREATE UNIQUE INDEX IF NOT EXISTS mailles_geotechnique_stats_wgs84_new_code_uq
  ON public.mailles_geotechnique_stats_wgs84_new (code);

CREATE INDEX IF NOT EXISTS mailles_geotechnique_stats_wgs84_new_adm1_idx
  ON public.mailles_geotechnique_stats_wgs84_new (adm1_name);
CREATE INDEX IF NOT EXISTS mailles_geotechnique_stats_wgs84_new_adm2_idx
  ON public.mailles_geotechnique_stats_wgs84_new (adm2_name);
CREATE INDEX IF NOT EXISTS mailles_geotechnique_stats_wgs84_new_adm3_idx
  ON public.mailles_geotechnique_stats_wgs84_new (adm3_name);

CREATE INDEX IF NOT EXISTS mailles_geotechnique_stats_wgs84_new_geom_gist
  ON public.mailles_geotechnique_stats_wgs84_new USING GIST (geom);
CREATE INDEX IF NOT EXISTS mailles_geotechnique_stats_wgs84_new_geom_s_gist
  ON public.mailles_geotechnique_stats_wgs84_new USING GIST (geom_simplified);

-- 3) Swap clean
DROP MATERIALIZED VIEW IF EXISTS public.mailles_geotechnique_stats_wgs84 CASCADE;
ALTER MATERIALIZED VIEW public.mailles_geotechnique_stats_wgs84_new
  RENAME TO mailles_geotechnique_stats_wgs84;

COMMIT;

-- 4) Vérifications rapides
\echo '=== Vérification SRID ==='
SELECT COUNT(*) AS n, MIN(ST_SRID(geom)) AS srid_min, MAX(ST_SRID(geom)) AS srid_max 
FROM mailles_geotechnique_stats_wgs84;

\echo '=== Couverture ADM ==='
SELECT 
  COUNT(*) as total,
  COUNT(adm1_name) as avec_adm1,
  COUNT(adm2_name) as avec_adm2,
  COUNT(adm3_name) as avec_adm3,
  COUNT(geom) as avec_geom
FROM mailles_geotechnique_stats_wgs84;

\echo '=== Distribution par région ==='
SELECT adm1_name, COUNT(*) as n_mailles
FROM mailles_geotechnique_stats_wgs84
WHERE adm1_name IS NOT NULL
GROUP BY adm1_name
ORDER BY n_mailles DESC;

\echo '=== Test NULL géométrie ==='
SELECT COUNT(*) as geom_null FROM mailles_geotechnique_stats_wgs84 WHERE geom IS NULL;
