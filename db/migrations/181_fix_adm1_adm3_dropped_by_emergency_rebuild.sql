-- ============================================================================
-- MIGRATION 181 : FIX ADM1/ADM3 ÉCRASÉS PAR LE REBUILD D'URGENCE (153_full_rebuild.sql)
-- ============================================================================
-- Contexte :
-- La migration 111_fix_api_bindings.sql avait correctement peuplé
-- atlas.mailles.adm1_name / adm3_name par jointure spatiale (centroïde de la
-- maille intersecté avec public.adm1 / public.adm3).
--
-- Mais migrations_post_v1/153_full_rebuild.sql (reconstruction d'urgence après
-- suppression en cascade) a recréé atlas.v_mailles_with_location_counts en
-- codant en dur :
--     NULL as adm1_name,
--     NULL as adm3_name,
-- au lieu de lire mv.adm1_name / mv.adm3_name depuis atlas.mailles. Cette vue
-- alimente la vue matérialisée atlas.mv_mailles_geotech, consommée par
-- get_coverage_mailles() (services/api-geo/src/routes.rs) pour le tooltip de
-- survol des mailles sur la carte. Résultat observé : le tooltip n'affiche
-- que adm2_name (préfecture, ex. "Zio") — région et commune disparaissent.
--
-- Cette migration :
--   1) Re-backfill atlas.mailles.adm1_name/adm2_name/adm3_name (idempotent,
--      ne touche que les lignes NULL — aucune perte de donnée existante)
--   2) Recrée v_mailles_with_location_counts pour lire les vraies colonnes
--      au lieu de NULL
--   3) Rafraîchit mv_mailles_geotech
--
-- Aucune géométrie n'est modifiée (uniquement les colonnes texte ADM) —
-- la règle de backup avant UPDATE géométrie (atlas.zones_etude) ne s'applique
-- pas ici. Par précaution, un export de sauvegarde des colonnes ADM est
-- néanmoins inclus en étape 0.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Sauvegarde légère avant modification (texte uniquement, pas de géométrie)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS atlas._backup_mailles_adm_181 AS
SELECT code, adm1_name, adm2_name, adm3_name, now() AS backed_up_at
FROM atlas.mailles;

-- ---------------------------------------------------------------------------
-- 1) Backfill défensif — ne complète QUE les valeurs manquantes
-- ---------------------------------------------------------------------------

UPDATE atlas.mailles m
SET adm1_name = a.adm1_fr
FROM public.adm1 a
WHERE m.adm1_name IS NULL
  AND a.geom IS NOT NULL
  AND ST_Intersects(ST_Transform(ST_Centroid(m.geom), 4326), a.geom);

UPDATE atlas.mailles m
SET adm2_name = a.adm2_fr
FROM public.adm2 a
WHERE m.adm2_name IS NULL
  AND a.geom IS NOT NULL
  AND ST_Intersects(ST_Transform(ST_Centroid(m.geom), 4326), a.geom);

UPDATE atlas.mailles m
SET adm3_name = a.adm3_fr
FROM public.adm3 a
WHERE m.adm3_name IS NULL
  AND a.geom IS NOT NULL
  AND ST_Intersects(ST_Transform(ST_Centroid(m.geom), 4326), a.geom);

-- ---------------------------------------------------------------------------
-- 2) Recréation de la vue de base — lecture des vraies colonnes ADM
--    (au lieu de NULL codé en dur par 153_full_rebuild.sql)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW atlas.v_mailles_with_location_counts AS
WITH location_counts AS (
    SELECT m.code,
        count(DISTINCT s.id) FILTER (WHERE (s.location_mode = ANY (ARRAY['exact'::text, 'gps'::text, 'manual'::text]))) AS n_sondages_exact,
        count(DISTINCT s.id) FILTER (WHERE (s.location_mode = ANY (ARRAY['adm_random_cell'::text, 'adm3'::text, 'adm2'::text, 'adm1'::text, 'random'::text]))) AS n_sondages_random
    FROM atlas.mailles m
    LEFT JOIN atlas.sondages s ON (st_contains(m.geom, st_transform(s.geom, 25231)) AND (s.deleted_at IS NULL) AND (s.geom IS NOT NULL))
    GROUP BY m.code
)
SELECT mv.id,
    mv.code,
    mv.geom,
    st_transform(mv.geom, 4326) as geom_4326,
    st_simplify(mv.geom, 100) as geom_simplified,
    mv.adm1_name,                       -- FIX 181 : était "NULL as adm1_name"
    mv.adm2_name,
    mv.adm3_name,                       -- FIX 181 : était "NULL as adm3_name"
    0 as n_sondages,
    0 as n_echantillons,
    0 as n_essais_atterberg,
    0 as n_essais_vbs,
    0 as n_essais_proctor,
    0 as n_essais_gonflement,
    0 as n_essais_granulo,
    0 as n_essais_classif,
    0 as n_essais_total,
    0 as depth_min_m,
    0 as depth_max_m,
    0 as depth_mean_m,
    NULL::numeric as wl_avg,
    NULL::numeric as wl_min,
    NULL::numeric as wl_max,
    NULL::numeric as wp_avg,
    NULL::numeric as wp_min,
    NULL::numeric as wp_max,
    NULL::numeric as ip_avg,
    NULL::numeric as ip_min,
    NULL::numeric as ip_max,
    NULL::numeric as ip_stddev,
    NULL::numeric as vbs_avg,
    NULL::numeric as vbs_min,
    NULL::numeric as vbs_max,
    NULL::numeric as vbs_stddev,
    0 as n_vbs_insensible,
    0 as n_vbs_peu_sensible,
    0 as n_vbs_sensible,
    0 as n_vbs_moyen_argileux,
    0 as n_vbs_argileux,
    0 as n_vbs_tres_argileux,
    NULL::numeric as gamma_d_max_avg,
    NULL::numeric as gamma_d_max_min,
    NULL::numeric as gamma_d_max_max,
    NULL::numeric as w_opt_avg,
    NULL::numeric as w_opt_min,
    NULL::numeric as w_opt_max,
    NULL::numeric as eg_avg,
    NULL::numeric as eg_min,
    NULL::numeric as eg_max,
    NULL::numeric as eg_stddev,
    0 as n_eg_negligeable,
    0 as n_eg_faible,
    0 as n_eg_moyen,
    0 as n_eg_fort,
    0 as n_eg_tres_fort,
    NULL::numeric as passant_80um_avg,
    NULL::numeric as passant_80um_min,
    NULL::numeric as passant_80um_max,
    NULL::numeric as passant_2mm_avg,
    NULL::numeric as passant_2mm_min,
    NULL::numeric as passant_2mm_max,
    NULL::numeric as passant_20mm_avg,
    0 as n_classif_hrb,
    0 as n_classif_unified,
    0 as n_classif_amessefe,
    false as has_data,
    false as has_exact_location,
    false as has_random_location,
    0 as n_sondages_exact,
    0 as n_sondages_random
FROM atlas.mailles mv
LEFT JOIN location_counts lc ON lc.code = mv.code;

-- ---------------------------------------------------------------------------
-- 3) Rafraîchissement de la vue matérialisée consommée par l'API
-- ---------------------------------------------------------------------------

REFRESH MATERIALIZED VIEW atlas.mv_mailles_geotech;

-- ---------------------------------------------------------------------------
-- 4) Vérification (à lire dans les logs de migration)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    v_total INT;
    v_adm1 INT;
    v_adm2 INT;
    v_adm3 INT;
BEGIN
    SELECT count(*) INTO v_total FROM atlas.mv_mailles_geotech;
    SELECT count(*) INTO v_adm1 FROM atlas.mv_mailles_geotech WHERE adm1_name IS NOT NULL;
    SELECT count(*) INTO v_adm2 FROM atlas.mv_mailles_geotech WHERE adm2_name IS NOT NULL;
    SELECT count(*) INTO v_adm3 FROM atlas.mv_mailles_geotech WHERE adm3_name IS NOT NULL;
    RAISE NOTICE 'Migration 181 — mv_mailles_geotech: % mailles total, adm1=% adm2=% adm3=%',
        v_total, v_adm1, v_adm2, v_adm3;
END $$;

COMMIT;
