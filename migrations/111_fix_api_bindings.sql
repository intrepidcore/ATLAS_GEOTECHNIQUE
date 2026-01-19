-- ============================================================================
-- MIGRATION 111 : FIX APPLICATIF (ADM, VUES 28KM, ROUTAGE API)
-- Objectif : 
-- 1) Remplir les données administratives (ADM1/ADM2/ADM3) dans atlas.mailles
-- 2) Corriger la vue 28km pour gérer le MultiPolygon (et produire un GeoJSON sérialisable)
-- 3) Rediriger l'API qui tape "public.mailles" (legacy) vers "atlas.mailles" (V2)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Sécuriser le schéma atlas.mailles (colonnes ADM)
-- ---------------------------------------------------------------------------

ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS adm1_name text;
ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS adm3_name text;

-- ---------------------------------------------------------------------------
-- 1) POPULATION DES DONNÉES ADMINISTRATIVES (pour les filtres UI)
-- ---------------------------------------------------------------------------

-- Les tables admin du projet existent en public.* en SRID 4326.
-- On fait les intersects sur un point interne (centroid) transformé en 4326.

UPDATE atlas.mailles m
SET adm1_name = a.adm1_fr
FROM public.adm1 a
WHERE a.geom IS NOT NULL
  AND ST_Intersects(ST_Transform(ST_Centroid(m.geom), 4326), a.geom);

UPDATE atlas.mailles m
SET adm2_name = a.adm2_fr
FROM public.adm2 a
WHERE a.geom IS NOT NULL
  AND ST_Intersects(ST_Transform(ST_Centroid(m.geom), 4326), a.geom);

UPDATE atlas.mailles m
SET adm3_name = a.adm3_fr
FROM public.adm3 a
WHERE a.geom IS NOT NULL
  AND ST_Intersects(ST_Transform(ST_Centroid(m.geom), 4326), a.geom);

-- ---------------------------------------------------------------------------
-- 2) CORRECTION VUE 28KM CLIP (robuste MultiPolygon)
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS atlas.v_coverage_mailles_28km_clip CASCADE;

-- NB: adm0_raw est en 4326 Polygon; on le transforme en 25231 pour le clipping,
-- puis on renvoie la geom finale en 4326 MultiPolygon.
CREATE OR REPLACE VIEW atlas.v_coverage_mailles_28km_clip AS
WITH adm0 AS (
  SELECT ST_Transform(ST_Union(geom), 25231) AS geom
  FROM public.adm0_raw
),
clipped AS (
  SELECT
    m28.id_m28,
    m28.code_m28,
    m28.code_lisible,
    m28.profil_num,
    ST_Multi(
      ST_CollectionExtract(
        ST_MakeValid(
          ST_SnapToGrid(
            ST_Intersection(m28.geom, adm0.geom),
            0.001
          )
        ),
        3
      )
    )::geometry(MultiPolygon,25231) AS geom_25231
  FROM atlas.maille_28km m28
  CROSS JOIN adm0
  WHERE ST_Intersects(m28.geom, adm0.geom)
)
SELECT
  c.id_m28,
  c.code_m28,
  c.code_lisible,
  c.profil_num,
  ST_Transform(c.geom_25231, 4326)::geometry(MultiPolygon,4326) AS geom,
  COALESCE(stats.n_sondages, 0) AS n_sondages,
  COALESCE(stats.n_sondages_exact, 0) AS n_sondages_exact,
  COALESCE(stats.n_sondages_random, 0) AS n_sondages_random
FROM clipped c
LEFT JOIN (
  SELECT
    s.id_m28,
    COUNT(*)::bigint AS n_sondages,
    SUM(CASE WHEN s.location_mode = 'exact' THEN 1 ELSE 0 END)::bigint AS n_sondages_exact,
    SUM(CASE WHEN s.location_mode IN ('adm_random_cell','adm_spread','random') THEN 1 ELSE 0 END)::bigint AS n_sondages_random
  FROM atlas.sondages s
  WHERE s.deleted_at IS NULL
    AND s.id_m28 IS NOT NULL
  GROUP BY s.id_m28
) stats ON stats.id_m28 = c.id_m28;

-- ---------------------------------------------------------------------------
-- 3) SWITCH DB : public.mailles -> atlas.mailles
-- ---------------------------------------------------------------------------

-- L'API historique interroge parfois la table non qualifiée "mailles"
-- (ou explicitement public.mailles). On archive la legacy et on crée une vue
-- de compatibilité qui pointe vers atlas.mailles.

ALTER TABLE IF EXISTS public.mailles RENAME TO mailles_legacy_v1_archive;

CREATE OR REPLACE VIEW public.mailles AS
SELECT
  m.id::text AS id,
  m.geom,
  ST_Transform(m.geom, 4326) AS geom_4326,
  m.code,
  m.stats::text AS stats,
  m.updated_at::text AS updated_at,
  NULL::text AS adm1_code,
  m.adm1_name,
  NULL::text AS adm2_code,
  m.adm2_name,
  NULL::text AS adm3_code,
  m.adm3_name
FROM atlas.mailles m;

-- ---------------------------------------------------------------------------
-- 4) RAFRAÎCHISSEMENT FINAL
-- ---------------------------------------------------------------------------

REFRESH MATERIALIZED VIEW atlas.mv_mailles_geotech;

COMMIT;
