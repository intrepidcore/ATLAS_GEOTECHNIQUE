-- Migration 031: Mettre à jour vue consolidée avec essais_potentiel_gonflement
-- Date: 2025-11-19
-- Description: Ajouter LEFT JOIN sur essais_potentiel_gonflement dans atlas.v_echantillons_essais

BEGIN;

-- ============================================================================
-- 1. RECRÉER LA VUE AVEC POTENTIEL DE GONFLEMENT
-- ============================================================================

DROP VIEW IF EXISTS atlas.v_echantillons_essais CASCADE;

CREATE OR REPLACE VIEW atlas.v_echantillons_essais AS
SELECT
  -- Identifiants
  s.id                     AS sondage_id,
  e.id                     AS echantillon_id,
  s.meta->>'code'          AS code_site,
  s.meta->>'localite'      AS localite,
  e.depth_m,
  
  -- Atterberg (essais_atterberg)
  at.wl,
  at.wp,
  at.ip_generated              AS ip,
  
  -- VBS (essais_vbs)
  v.vbs,
  
  -- Classifications (essais_classif)
  c.hrb,
  c.unified,
  c.class_chassagneux,
  c.class_daksha,
  c.class_seed,
  c.class_vijay,
  
  -- Potentiel de gonflement (essais_potentiel_gonflement) - TABLE DÉDIÉE
  epg.cg                   AS potentiel_gonflement,
  epg.cg_qual              AS gonflement_qual,
  epg.type_sol,
  
  -- Physiques (essais_physiques)
  p.w                      AS teneur_eau,
  p.rho_s                  AS masse_volumique,
  
  -- Proctor (essais_proctor)
  pr.gamma_d_max,
  pr.w_opt,
  pr.proctor_type,
  
  -- Granulométrie (agrégation depuis granulo_points)
  (SELECT passing_pct FROM granulo_points WHERE echantillon_id = e.id AND sieve_mm = 0.08 LIMIT 1) AS passant_80um,
  (SELECT passing_pct FROM granulo_points WHERE echantillon_id = e.id AND sieve_mm = 2.0 LIMIT 1) AS passant_2mm,
  (SELECT passing_pct FROM granulo_points WHERE echantillon_id = e.id AND sieve_mm = 20.0 LIMIT 1) AS passant_20mm,
  
  -- Métadonnées
  s.source,
  s.operator,
  e.laboratory,
  e.date                   AS test_date,
  s.depth_m_min,
  s.depth_m_max,
  e.created_at,
  e.updated_at

FROM echantillons e
JOIN sondages s ON e.sondage_id = s.id
LEFT JOIN essais_atterberg at ON at.echantillon_id = e.id
LEFT JOIN essais_vbs v        ON v.echantillon_id = e.id
LEFT JOIN essais_classif c    ON c.echantillon_id = e.id
LEFT JOIN essais_physiques p  ON p.echantillon_id = e.id
LEFT JOIN essais_proctor pr   ON pr.echantillon_id = e.id
LEFT JOIN essais_potentiel_gonflement epg ON epg.echantillon_id = e.id

WHERE s.meta->>'code' IS NOT NULL

ORDER BY s.meta->>'code', e.depth_m;

COMMENT ON VIEW atlas.v_echantillons_essais IS 
'Vue consolidée de TOUS les essais géotechniques par échantillon. 
Source of truth: essais_atterberg, essais_vbs, essais_classif, essais_physiques, essais_proctor, essais_potentiel_gonflement, granulo_points.
Cette vue remplace essais_geotechniques comme tableau de bord.';

-- ============================================================================
-- 2. RECRÉER LA VUE SUMMARY
-- ============================================================================

DROP VIEW IF EXISTS atlas.v_essais_summary CASCADE;

CREATE OR REPLACE VIEW atlas.v_essais_summary AS
SELECT
  code_site,
  localite,
  COUNT(DISTINCT echantillon_id) AS nb_echantillons,
  COUNT(DISTINCT depth_m) AS nb_profondeurs,
  
  -- Compteurs par type d'essai
  COUNT(wl) AS nb_atterberg,
  COUNT(vbs) AS nb_vbs,
  COUNT(hrb) AS nb_classif_hrb,
  COUNT(class_chassagneux) AS nb_classif_amessefe,
  COUNT(teneur_eau) AS nb_teneur_eau,
  COUNT(gamma_d_max) AS nb_proctor,
  COUNT(passant_80um) AS nb_granulo,
  COUNT(potentiel_gonflement) AS nb_potentiel_gonflement,
  
  -- Profondeurs min/max
  MIN(depth_m) AS depth_min,
  MAX(depth_m) AS depth_max,
  
  -- Métadonnées
  source,
  operator,
  laboratory

FROM atlas.v_echantillons_essais
GROUP BY code_site, localite, source, operator, laboratory
ORDER BY code_site;

COMMENT ON VIEW atlas.v_essais_summary IS 
'Vue résumée : nombre d''essais par sondage et par type';

-- ============================================================================
-- 3. STATISTIQUES
-- ============================================================================

DO $$
DECLARE
    v_count_echantillons int;
    v_count_potentiel int;
BEGIN
    SELECT COUNT(*) INTO v_count_echantillons FROM atlas.v_echantillons_essais;
    SELECT COUNT(*) INTO v_count_potentiel FROM atlas.v_echantillons_essais WHERE potentiel_gonflement IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Migration 031: Vue consolidée mise à jour';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '  ✓ Vue atlas.v_echantillons_essais recréée avec LEFT JOIN essais_potentiel_gonflement';
    RAISE NOTICE '  ✓ Vue atlas.v_essais_summary recréée';
    RAISE NOTICE '';
    RAISE NOTICE 'Statistiques:';
    RAISE NOTICE '  • % échantillons dans la vue', v_count_echantillons;
    RAISE NOTICE '  • % avec potentiel de gonflement', v_count_potentiel;
    RAISE NOTICE '';
    RAISE NOTICE 'Nouvelles colonnes exposées:';
    RAISE NOTICE '  • potentiel_gonflement (cg) depuis essais_potentiel_gonflement';
    RAISE NOTICE '  • gonflement_qual (cg_qual) depuis essais_potentiel_gonflement';
    RAISE NOTICE '  • type_sol depuis essais_potentiel_gonflement';
    RAISE NOTICE '============================================================================';
END $$;

COMMIT;
