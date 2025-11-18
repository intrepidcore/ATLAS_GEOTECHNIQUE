-- ============================================================================
-- Migration 028: Vue consolidée atlas.v_echantillons_essais
-- Date: 2025-11-18
-- Description: 
--   - Recréer la vue atlas.v_echantillons_essais comme synthèse de TOUTES les tables essais_*
--   - Cette vue remplace essais_geotechniques comme tableau de bord
--   - Source of truth = essais_atterberg, essais_vbs, essais_classif, essais_physiques, granulo_points
-- ============================================================================

BEGIN;

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration 028: Vue consolidée atlas.v_echantillons_essais';
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- 1. SUPPRIMER L'ANCIENNE VUE
-- ============================================================================

DROP VIEW IF EXISTS atlas.v_echantillons_essais CASCADE;

DO $$ BEGIN
  RAISE NOTICE '✓ Ancienne vue supprimée';
END $$;

-- ============================================================================
-- 2. CRÉER LA NOUVELLE VUE CONSOLIDÉE
-- ============================================================================

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
  c.type_sol,
  c.cg                     AS potentiel_gonflement,
  c.cg_qual                AS gonflement_qual,
  
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

WHERE s.meta->>'code' IS NOT NULL

ORDER BY s.meta->>'code', e.depth_m;

COMMENT ON VIEW atlas.v_echantillons_essais IS 
'Vue consolidée de TOUS les essais géotechniques par échantillon. 
Source of truth: essais_atterberg, essais_vbs, essais_classif, essais_physiques, essais_proctor, granulo_points.
Cette vue remplace essais_geotechniques comme tableau de bord.';

DO $$ BEGIN
  RAISE NOTICE '✓ Vue atlas.v_echantillons_essais créée';
END $$;

-- ============================================================================
-- 3. CRÉER UNE VUE SIMPLIFIÉE POUR L'UI
-- ============================================================================

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

DO $$ BEGIN
  RAISE NOTICE '✓ Vue atlas.v_essais_summary créée';
END $$;

-- ============================================================================
-- 4. STATISTIQUES FINALES
-- ============================================================================

DO $$
DECLARE
  v_echantillons INTEGER;
  v_with_atterberg INTEGER;
  v_with_vbs INTEGER;
  v_with_classif INTEGER;
  v_with_amessefe INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_echantillons FROM atlas.v_echantillons_essais;
  SELECT COUNT(*) INTO v_with_atterberg FROM atlas.v_echantillons_essais WHERE wl IS NOT NULL;
  SELECT COUNT(*) INTO v_with_vbs FROM atlas.v_echantillons_essais WHERE vbs IS NOT NULL;
  SELECT COUNT(*) INTO v_with_classif FROM atlas.v_echantillons_essais WHERE hrb IS NOT NULL OR unified IS NOT NULL;
  SELECT COUNT(*) INTO v_with_amessefe FROM atlas.v_echantillons_essais WHERE class_chassagneux IS NOT NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration 028 terminée avec succès';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '  Total échantillons          : %', v_echantillons;
  RAISE NOTICE '  Avec Atterberg              : %', v_with_atterberg;
  RAISE NOTICE '  Avec VBS                    : %', v_with_vbs;
  RAISE NOTICE '  Avec classif HRB/Unified    : %', v_with_classif;
  RAISE NOTICE '  Avec classif AMESSEFE       : %', v_with_amessefe;
  RAISE NOTICE '';
  RAISE NOTICE 'Vues créées :';
  RAISE NOTICE '  ✓ atlas.v_echantillons_essais (vue détaillée par échantillon)';
  RAISE NOTICE '  ✓ atlas.v_essais_summary (vue résumée par sondage)';
  RAISE NOTICE '';
  RAISE NOTICE 'Architecture finale :';
  RAISE NOTICE '  SOURCE OF TRUTH → essais_atterberg, essais_vbs, essais_classif, etc.';
  RAISE NOTICE '  VUE DE SYNTHÈSE → atlas.v_echantillons_essais';
  RAISE NOTICE '============================================================================';
END $$;

COMMIT;
