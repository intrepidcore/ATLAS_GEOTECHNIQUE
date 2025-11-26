-- ============================================================================
-- Migration 044: Vue matérialisée complète pour cartes thématiques
-- Date: 2025-11-26
-- Description: 
--   Refonte de mv_mailles_geotech pour inclure TOUS les agrégats géotechniques
--   depuis les tables source of truth (essais_atterberg, essais_vbs, etc.)
--   
--   Cette vue alimente :
--   - Panneau "Stats globales"
--   - Panneau "Vue maille"
--   - Panneau "Cartes thématiques"
-- ============================================================================

BEGIN;

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration 044: Vue matérialisée géotechnique complète';
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- 1. SUPPRIMER L'ANCIENNE VUE
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS atlas.mv_mailles_geotech CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mailles_geotechnique_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mailles_geotechnique_stats_wgs84 CASCADE;

DO $$ BEGIN
  RAISE NOTICE '✓ Anciennes vues supprimées';
END $$;

-- ============================================================================
-- 2. CRÉER LA NOUVELLE VUE MATÉRIALISÉE COMPLÈTE
-- ============================================================================

CREATE MATERIALIZED VIEW atlas.mv_mailles_geotech AS
WITH 
-- CTE 1: Lier mailles → sondages (avec transformation SRID)
maille_sondages AS (
    SELECT 
        m.id AS maille_id,
        m.code,
        m.geom,
        m.geom_4326,
        m.adm1_name,
        m.adm2_name,
        m.adm3_name,
        s.id AS sondage_id,
        s.location_mode
    FROM mailles m
    LEFT JOIN sondages s 
        ON ST_Contains(m.geom, ST_Transform(s.geom, 25231))
        AND s.deleted_at IS NULL
        AND s.geom IS NOT NULL
),

-- CTE 2: Lier sondages → échantillons
maille_echantillons AS (
    SELECT 
        ms.maille_id,
        ms.sondage_id,
        e.id AS echantillon_id,
        e.depth_m
    FROM maille_sondages ms
    LEFT JOIN echantillons e ON e.sondage_id = ms.sondage_id
),

-- CTE 3: Agrégats Atterberg par maille
agg_atterberg AS (
    SELECT 
        me.maille_id,
        COUNT(ea.id) AS n_essais_atterberg,
        AVG(ea.wl) AS wl_avg,
        MIN(ea.wl) AS wl_min,
        MAX(ea.wl) AS wl_max,
        AVG(ea.wp) AS wp_avg,
        MIN(ea.wp) AS wp_min,
        MAX(ea.wp) AS wp_max,
        AVG(ea.ip_generated) AS ip_avg,
        MIN(ea.ip_generated) AS ip_min,
        MAX(ea.ip_generated) AS ip_max,
        STDDEV(ea.ip_generated) AS ip_stddev
    FROM maille_echantillons me
    LEFT JOIN essais_atterberg ea ON ea.echantillon_id = me.echantillon_id
    WHERE ea.id IS NOT NULL
    GROUP BY me.maille_id
),

-- CTE 4: Agrégats VBS par maille
agg_vbs AS (
    SELECT 
        me.maille_id,
        COUNT(ev.id) AS n_essais_vbs,
        AVG(ev.vbs) AS vbs_avg,
        MIN(ev.vbs) AS vbs_min,
        MAX(ev.vbs) AS vbs_max,
        STDDEV(ev.vbs) AS vbs_stddev,
        -- Comptage par classe VBS (seuils GTR)
        COUNT(CASE WHEN ev.vbs < 0.1 THEN 1 END) AS n_vbs_insensible,
        COUNT(CASE WHEN ev.vbs >= 0.1 AND ev.vbs < 1.5 THEN 1 END) AS n_vbs_peu_sensible,
        COUNT(CASE WHEN ev.vbs >= 1.5 AND ev.vbs < 2.5 THEN 1 END) AS n_vbs_sensible,
        COUNT(CASE WHEN ev.vbs >= 2.5 AND ev.vbs < 6 THEN 1 END) AS n_vbs_moyen_argileux,
        COUNT(CASE WHEN ev.vbs >= 6 AND ev.vbs < 8 THEN 1 END) AS n_vbs_argileux,
        COUNT(CASE WHEN ev.vbs >= 8 THEN 1 END) AS n_vbs_tres_argileux
    FROM maille_echantillons me
    LEFT JOIN essais_vbs ev ON ev.echantillon_id = me.echantillon_id
    WHERE ev.id IS NOT NULL
    GROUP BY me.maille_id
),

-- CTE 5: Agrégats Proctor par maille
agg_proctor AS (
    SELECT 
        me.maille_id,
        COUNT(ep.id) AS n_essais_proctor,
        AVG(ep.gamma_d_max) AS gamma_d_max_avg,
        MIN(ep.gamma_d_max) AS gamma_d_max_min,
        MAX(ep.gamma_d_max) AS gamma_d_max_max,
        AVG(ep.w_opt) AS w_opt_avg,
        MIN(ep.w_opt) AS w_opt_min,
        MAX(ep.w_opt) AS w_opt_max
    FROM maille_echantillons me
    LEFT JOIN essais_proctor ep ON ep.echantillon_id = me.echantillon_id
    WHERE ep.id IS NOT NULL
    GROUP BY me.maille_id
),

-- CTE 6: Agrégats Potentiel de Gonflement par maille
agg_gonflement AS (
    SELECT 
        me.maille_id,
        COUNT(eg.id) AS n_essais_gonflement,
        AVG(eg.cg) AS eg_avg,
        MIN(eg.cg) AS eg_min,
        MAX(eg.cg) AS eg_max,
        STDDEV(eg.cg) AS eg_stddev,
        -- Comptage par classe de gonflement
        COUNT(CASE WHEN eg.cg < 0.5 THEN 1 END) AS n_eg_negligeable,
        COUNT(CASE WHEN eg.cg >= 0.5 AND eg.cg < 2 THEN 1 END) AS n_eg_faible,
        COUNT(CASE WHEN eg.cg >= 2 AND eg.cg < 5 THEN 1 END) AS n_eg_moyen,
        COUNT(CASE WHEN eg.cg >= 5 AND eg.cg < 10 THEN 1 END) AS n_eg_fort,
        COUNT(CASE WHEN eg.cg >= 10 THEN 1 END) AS n_eg_tres_fort
    FROM maille_echantillons me
    LEFT JOIN essais_potentiel_gonflement eg ON eg.echantillon_id = me.echantillon_id
    WHERE eg.id IS NOT NULL
    GROUP BY me.maille_id
),

-- CTE 7: Agrégats Granulométrie par maille (1 essai = 1 échantillon avec points)
agg_granulo AS (
    SELECT 
        me.maille_id,
        COUNT(DISTINCT gp.echantillon_id) AS n_essais_granulo,
        -- Passant 80µm (fines)
        AVG(gp.passing_pct) FILTER (WHERE gp.sieve_mm = 0.08) AS passant_80um_avg,
        MIN(gp.passing_pct) FILTER (WHERE gp.sieve_mm = 0.08) AS passant_80um_min,
        MAX(gp.passing_pct) FILTER (WHERE gp.sieve_mm = 0.08) AS passant_80um_max,
        -- Passant 2mm (sable + fines)
        AVG(gp.passing_pct) FILTER (WHERE gp.sieve_mm = 2.0) AS passant_2mm_avg,
        MIN(gp.passing_pct) FILTER (WHERE gp.sieve_mm = 2.0) AS passant_2mm_min,
        MAX(gp.passing_pct) FILTER (WHERE gp.sieve_mm = 2.0) AS passant_2mm_max,
        -- Passant 20mm
        AVG(gp.passing_pct) FILTER (WHERE gp.sieve_mm = 20.0) AS passant_20mm_avg
    FROM maille_echantillons me
    LEFT JOIN granulo_points gp ON gp.echantillon_id = me.echantillon_id
    WHERE gp.id IS NOT NULL
    GROUP BY me.maille_id
),

-- CTE 8: Agrégats Classifications par maille
agg_classif AS (
    SELECT 
        me.maille_id,
        COUNT(ec.id) AS n_essais_classif,
        COUNT(ec.hrb) AS n_classif_hrb,
        COUNT(ec.unified) AS n_classif_unified,
        COUNT(ec.class_chassagneux) AS n_classif_amessefe
    FROM maille_echantillons me
    LEFT JOIN essais_classif ec ON ec.echantillon_id = me.echantillon_id
    WHERE ec.id IS NOT NULL
    GROUP BY me.maille_id
)

-- REQUÊTE FINALE: Joindre tous les agrégats
SELECT 
    -- Identifiants et géométrie
    ms.maille_id AS id,
    ms.code,
    ms.geom,
    ms.geom_4326,
    ST_Simplify(ms.geom_4326, 0.001) AS geom_simplified,
    ms.adm1_name,
    ms.adm2_name,
    ms.adm3_name,
    
    -- Compteurs de base (instrumentation)
    COUNT(DISTINCT ms.sondage_id) FILTER (WHERE ms.sondage_id IS NOT NULL) AS n_sondages,
    COUNT(DISTINCT me.echantillon_id) FILTER (WHERE me.echantillon_id IS NOT NULL) AS n_echantillons,
    
    -- Compteurs par type d'essai
    COALESCE(aa.n_essais_atterberg, 0) AS n_essais_atterberg,
    COALESCE(av.n_essais_vbs, 0) AS n_essais_vbs,
    COALESCE(ap.n_essais_proctor, 0) AS n_essais_proctor,
    COALESCE(ag.n_essais_gonflement, 0) AS n_essais_gonflement,
    COALESCE(agr.n_essais_granulo, 0) AS n_essais_granulo,
    COALESCE(ac.n_essais_classif, 0) AS n_essais_classif,
    
    -- Total essais
    (COALESCE(aa.n_essais_atterberg, 0) + COALESCE(av.n_essais_vbs, 0) + 
     COALESCE(ap.n_essais_proctor, 0) + COALESCE(ag.n_essais_gonflement, 0) + 
     COALESCE(agr.n_essais_granulo, 0) + COALESCE(ac.n_essais_classif, 0)) AS n_essais_total,
    
    -- Profondeurs
    MIN(me.depth_m) AS depth_min_m,
    MAX(me.depth_m) AS depth_max_m,
    AVG(me.depth_m) AS depth_mean_m,
    
    -- Atterberg
    aa.wl_avg, aa.wl_min, aa.wl_max,
    aa.wp_avg, aa.wp_min, aa.wp_max,
    aa.ip_avg, aa.ip_min, aa.ip_max, aa.ip_stddev,
    
    -- VBS
    av.vbs_avg, av.vbs_min, av.vbs_max, av.vbs_stddev,
    av.n_vbs_insensible, av.n_vbs_peu_sensible, av.n_vbs_sensible,
    av.n_vbs_moyen_argileux, av.n_vbs_argileux, av.n_vbs_tres_argileux,
    
    -- Proctor
    ap.gamma_d_max_avg, ap.gamma_d_max_min, ap.gamma_d_max_max,
    ap.w_opt_avg, ap.w_opt_min, ap.w_opt_max,
    
    -- Gonflement
    ag.eg_avg, ag.eg_min, ag.eg_max, ag.eg_stddev,
    ag.n_eg_negligeable, ag.n_eg_faible, ag.n_eg_moyen, ag.n_eg_fort, ag.n_eg_tres_fort,
    
    -- Granulométrie
    agr.passant_80um_avg, agr.passant_80um_min, agr.passant_80um_max,
    agr.passant_2mm_avg, agr.passant_2mm_min, agr.passant_2mm_max,
    agr.passant_20mm_avg,
    
    -- Classifications
    ac.n_classif_hrb, ac.n_classif_unified, ac.n_classif_amessefe,
    
    -- Flags de qualité
    CASE 
        WHEN COUNT(DISTINCT ms.sondage_id) FILTER (WHERE ms.sondage_id IS NOT NULL) > 0 THEN true 
        ELSE false 
    END AS has_data,
    CASE 
        WHEN COUNT(DISTINCT ms.sondage_id) FILTER (WHERE ms.location_mode = 'exact') > 0 THEN true 
        ELSE false 
    END AS has_exact_location,
    CASE 
        WHEN COUNT(DISTINCT ms.sondage_id) FILTER (WHERE ms.location_mode IN ('adm_random_cell', 'random')) > 0 THEN true 
        ELSE false 
    END AS has_random_location

FROM maille_sondages ms
LEFT JOIN maille_echantillons me ON me.maille_id = ms.maille_id AND me.sondage_id = ms.sondage_id
LEFT JOIN agg_atterberg aa ON aa.maille_id = ms.maille_id
LEFT JOIN agg_vbs av ON av.maille_id = ms.maille_id
LEFT JOIN agg_proctor ap ON ap.maille_id = ms.maille_id
LEFT JOIN agg_gonflement ag ON ag.maille_id = ms.maille_id
LEFT JOIN agg_granulo agr ON agr.maille_id = ms.maille_id
LEFT JOIN agg_classif ac ON ac.maille_id = ms.maille_id

GROUP BY 
    ms.maille_id, ms.code, ms.geom, ms.geom_4326, 
    ms.adm1_name, ms.adm2_name, ms.adm3_name,
    aa.n_essais_atterberg, aa.wl_avg, aa.wl_min, aa.wl_max,
    aa.wp_avg, aa.wp_min, aa.wp_max,
    aa.ip_avg, aa.ip_min, aa.ip_max, aa.ip_stddev,
    av.n_essais_vbs, av.vbs_avg, av.vbs_min, av.vbs_max, av.vbs_stddev,
    av.n_vbs_insensible, av.n_vbs_peu_sensible, av.n_vbs_sensible,
    av.n_vbs_moyen_argileux, av.n_vbs_argileux, av.n_vbs_tres_argileux,
    ap.n_essais_proctor, ap.gamma_d_max_avg, ap.gamma_d_max_min, ap.gamma_d_max_max,
    ap.w_opt_avg, ap.w_opt_min, ap.w_opt_max,
    ag.n_essais_gonflement, ag.eg_avg, ag.eg_min, ag.eg_max, ag.eg_stddev,
    ag.n_eg_negligeable, ag.n_eg_faible, ag.n_eg_moyen, ag.n_eg_fort, ag.n_eg_tres_fort,
    agr.n_essais_granulo, agr.passant_80um_avg, agr.passant_80um_min, agr.passant_80um_max,
    agr.passant_2mm_avg, agr.passant_2mm_min, agr.passant_2mm_max, agr.passant_20mm_avg,
    ac.n_essais_classif, ac.n_classif_hrb, ac.n_classif_unified, ac.n_classif_amessefe;

-- ============================================================================
-- 3. CRÉER LES INDEX
-- ============================================================================

CREATE UNIQUE INDEX mv_mailles_geotech_id_idx ON atlas.mv_mailles_geotech(id);
CREATE INDEX idx_mv_mailles_geotech_geom ON atlas.mv_mailles_geotech USING GIST(geom);
CREATE INDEX idx_mv_mailles_geotech_geom_4326 ON atlas.mv_mailles_geotech USING GIST(geom_4326);
CREATE INDEX idx_mv_mailles_geotech_code ON atlas.mv_mailles_geotech(code);
CREATE INDEX idx_mv_mailles_geotech_has_data ON atlas.mv_mailles_geotech(has_data) WHERE has_data = true;
CREATE INDEX idx_mv_mailles_geotech_n_sondages ON atlas.mv_mailles_geotech(n_sondages) WHERE n_sondages > 0;

-- Index pour les paramètres thématiques les plus utilisés
CREATE INDEX idx_mv_mailles_geotech_ip_avg ON atlas.mv_mailles_geotech(ip_avg) WHERE ip_avg IS NOT NULL;
CREATE INDEX idx_mv_mailles_geotech_vbs_avg ON atlas.mv_mailles_geotech(vbs_avg) WHERE vbs_avg IS NOT NULL;
CREATE INDEX idx_mv_mailles_geotech_eg_avg ON atlas.mv_mailles_geotech(eg_avg) WHERE eg_avg IS NOT NULL;

DO $$ BEGIN
  RAISE NOTICE '✓ Index créés';
END $$;

-- ============================================================================
-- 4. CRÉER UNE VUE ALIAS POUR COMPATIBILITÉ AVEC L'API THÉMATIQUE
-- ============================================================================

-- L'API thématique utilise mailles_geotechnique_stats_wgs84
CREATE OR REPLACE VIEW mailles_geotechnique_stats_wgs84 AS
SELECT 
    id,
    code,
    geom_4326 AS geom,
    geom_simplified,
    adm1_name,
    adm2_name,
    adm3_name,
    n_sondages,
    n_essais_total AS n_essais_geo,
    -- Atterberg
    wl_avg, wp_avg, ip_avg, ip_stddev, ip_min, ip_max,
    -- VBS
    vbs_avg, vbs_stddev, vbs_min, vbs_max,
    -- Proctor
    gamma_d_max_avg, gamma_d_max_min AS gamma_d_max_stddev, -- alias pour compat
    w_opt_avg, w_opt_min AS w_opt_stddev,
    -- Gonflement
    eg_avg, eg_stddev, eg_min, eg_max,
    -- Granulo
    passant_80um_avg, passant_2mm_avg, passant_20mm_avg,
    -- Comptages par classe
    n_vbs_insensible, n_vbs_peu_sensible, n_vbs_sensible,
    n_vbs_moyen_argileux, n_vbs_argileux, n_vbs_tres_argileux,
    n_eg_negligeable, n_eg_faible, n_eg_moyen, n_eg_fort, n_eg_tres_fort
FROM atlas.mv_mailles_geotech;

DO $$ BEGIN
  RAISE NOTICE '✓ Vue de compatibilité mailles_geotechnique_stats_wgs84 créée';
END $$;

-- ============================================================================
-- 5. COMMENTAIRES
-- ============================================================================

COMMENT ON MATERIALIZED VIEW atlas.mv_mailles_geotech IS 
'Vue matérialisée complète des statistiques géotechniques par maille (2x2km).
Source of truth: essais_atterberg, essais_vbs, essais_proctor, essais_potentiel_gonflement, granulo_points, essais_classif.
Utilisée par: Stats globales, Vue maille, Cartes thématiques.';

COMMENT ON COLUMN atlas.mv_mailles_geotech.n_sondages IS 'Nombre de sondages géocodés dans cette maille';
COMMENT ON COLUMN atlas.mv_mailles_geotech.n_echantillons IS 'Nombre d''échantillons distincts';
COMMENT ON COLUMN atlas.mv_mailles_geotech.n_essais_total IS 'Somme de tous les types d''essais';
COMMENT ON COLUMN atlas.mv_mailles_geotech.ip_avg IS 'Indice de plasticité moyen (IP = WL - WP)';
COMMENT ON COLUMN atlas.mv_mailles_geotech.vbs_avg IS 'Valeur de Bleu moyenne (argilosité)';
COMMENT ON COLUMN atlas.mv_mailles_geotech.eg_avg IS 'Potentiel de gonflement moyen';
COMMENT ON COLUMN atlas.mv_mailles_geotech.passant_80um_avg IS 'Pourcentage passant 80µm moyen (fines)';
COMMENT ON COLUMN atlas.mv_mailles_geotech.has_exact_location IS 'true si au moins un sondage avec location_mode=exact';
COMMENT ON COLUMN atlas.mv_mailles_geotech.has_random_location IS 'true si au moins un sondage avec location_mode=random ou adm_random_cell';

-- ============================================================================
-- 6. FONCTION DE RAFRAÎCHISSEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_mv_mailles_geotech()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech;
  RAISE NOTICE 'Vue matérialisée atlas.mv_mailles_geotech rafraîchie';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_mv_mailles_geotech IS 
'Rafraîchit la vue matérialisée des stats géotechniques (CONCURRENTLY pour éviter les locks)';

-- ============================================================================
-- 7. STATISTIQUES FINALES
-- ============================================================================

DO $$
DECLARE
  v_total_mailles INTEGER;
  v_mailles_with_data INTEGER;
  v_total_sondages BIGINT;
  v_total_echantillons BIGINT;
  v_total_essais BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total_mailles FROM atlas.mv_mailles_geotech;
  SELECT COUNT(*) INTO v_mailles_with_data FROM atlas.mv_mailles_geotech WHERE has_data = true;
  SELECT SUM(n_sondages) INTO v_total_sondages FROM atlas.mv_mailles_geotech;
  SELECT SUM(n_echantillons) INTO v_total_echantillons FROM atlas.mv_mailles_geotech;
  SELECT SUM(n_essais_total) INTO v_total_essais FROM atlas.mv_mailles_geotech;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration 044 terminée avec succès';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '  Total mailles           : %', v_total_mailles;
  RAISE NOTICE '  Mailles avec données    : %', v_mailles_with_data;
  RAISE NOTICE '  Total sondages          : %', COALESCE(v_total_sondages, 0);
  RAISE NOTICE '  Total échantillons      : %', COALESCE(v_total_echantillons, 0);
  RAISE NOTICE '  Total essais            : %', COALESCE(v_total_essais, 0);
  RAISE NOTICE '';
  RAISE NOTICE 'Colonnes disponibles pour cartes thématiques :';
  RAISE NOTICE '  ✓ n_sondages, n_echantillons, n_essais_total';
  RAISE NOTICE '  ✓ ip_avg, ip_min, ip_max (Atterberg)';
  RAISE NOTICE '  ✓ vbs_avg, vbs_min, vbs_max (VBS)';
  RAISE NOTICE '  ✓ gamma_d_max_avg, w_opt_avg (Proctor)';
  RAISE NOTICE '  ✓ eg_avg, eg_min, eg_max (Gonflement)';
  RAISE NOTICE '  ✓ passant_80um_avg, passant_2mm_avg (Granulo)';
  RAISE NOTICE '============================================================================';
END $$;

COMMIT;
