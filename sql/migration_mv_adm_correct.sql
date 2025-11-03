-- ============================================================================
-- MIGRATION FINALE: MV avec ADM (version corrigée pour structure réelle)
-- ============================================================================
-- Structure réelle:
-- - mailles_geotechnique_stats est une MV (pas une table)
-- - mailles a déjà geom_4326
-- - On ajoute juste adm1/2/3_name
-- ============================================================================

BEGIN;

-- 1) Supprimer l'ancienne MV
DROP MATERIALIZED VIEW IF EXISTS public.mailles_geotechnique_stats_wgs84 CASCADE;

-- 2) Recréer avec colonnes ADM
CREATE MATERIALIZED VIEW public.mailles_geotechnique_stats_wgs84 AS
SELECT 
  m.id,
  m.code,
  m.geom_4326 AS geom,
  ST_SimplifyPreserveTopology(m.geom_4326, 0.0003) AS geom_simplified,
  m.adm1_name,  -- ← AJOUT
  m.adm2_name,  -- ← AJOUT
  m.adm3_name,  -- ← AJOUT
  s.passant_80um_avg,
  s.passant_2mm_avg,
  s.passant_20mm_avg,
  s.wl_avg,
  s.wp_avg,
  s.ip_avg,
  s.vbs_avg,
  s.gamma_d_max_avg,
  s.w_opt_avg,
  s.eg_avg,
  s.n_sondages,
  s.n_essais_geo
FROM mailles m
JOIN mailles_geotechnique_stats s ON s.code = m.code
WHERE s.n_sondages > 0;

-- 3) Index pour performances
CREATE UNIQUE INDEX mailles_geotechnique_stats_wgs84_code_uq
  ON public.mailles_geotechnique_stats_wgs84 (code);

CREATE INDEX mailles_geotechnique_stats_wgs84_adm1_idx
  ON public.mailles_geotechnique_stats_wgs84 (adm1_name)
  WHERE adm1_name IS NOT NULL;

CREATE INDEX mailles_geotechnique_stats_wgs84_adm2_idx
  ON public.mailles_geotechnique_stats_wgs84 (adm2_name)
  WHERE adm2_name IS NOT NULL;

CREATE INDEX mailles_geotechnique_stats_wgs84_adm3_idx
  ON public.mailles_geotechnique_stats_wgs84 (adm3_name)
  WHERE adm3_name IS NOT NULL;

CREATE INDEX mailles_geotechnique_stats_wgs84_geom_gist
  ON public.mailles_geotechnique_stats_wgs84 USING GIST (geom);

CREATE INDEX mailles_geotechnique_stats_wgs84_geom_s_gist
  ON public.mailles_geotechnique_stats_wgs84 USING GIST (geom_simplified);

-- Index partiels sur paramètres fréquents
CREATE INDEX mailles_geotechnique_stats_wgs84_passant_80um_idx
  ON public.mailles_geotechnique_stats_wgs84 (passant_80um_avg)
  WHERE passant_80um_avg IS NOT NULL;

CREATE INDEX mailles_geotechnique_stats_wgs84_ip_avg_idx
  ON public.mailles_geotechnique_stats_wgs84 (ip_avg)
  WHERE ip_avg IS NOT NULL;

CREATE INDEX mailles_geotechnique_stats_wgs84_vbs_avg_idx
  ON public.mailles_geotechnique_stats_wgs84 (vbs_avg)
  WHERE vbs_avg IS NOT NULL;

COMMIT;

-- 4) Vérifications
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

\echo '=== Test requête avec filtre ADM ==='
SELECT COUNT(*) as n_plateaux
FROM mailles_geotechnique_stats_wgs84
WHERE adm1_name = 'Plateaux' AND passant_80um_avg IS NOT NULL;
