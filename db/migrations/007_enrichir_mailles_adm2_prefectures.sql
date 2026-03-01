-- ============================================================================
-- Migration 007: Enrichissement mailles avec ADM2 (préfectures)
-- Date: 27/12/2025
-- Objectif: Rattacher chaque maille à sa préfecture pour boxplots et choroplèthes
-- ============================================================================

-- ÉTAPE 1: Ajouter colonnes préfecture dans table mailles
-- ============================================================================

ALTER TABLE atlas.mailles 
ADD COLUMN IF NOT EXISTS pref_code TEXT,
ADD COLUMN IF NOT EXISTS pref_name TEXT;

COMMENT ON COLUMN atlas.mailles.pref_code IS 'Code préfecture (ADM2) - rattachement spatial';
COMMENT ON COLUMN atlas.mailles.pref_name IS 'Nom préfecture (ADM2) - rattachement spatial';

-- ÉTAPE 2: Créer index GIST pour performance
-- ============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'adm2'
  ) THEN
    RAISE NOTICE '⏭️  Migration 007 skippée: table public.adm2 introuvable (schéma desktop différent).';
    RETURN;
  END IF;

  -- Index sur géométrie mailles (si pas déjà présent)
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mailles_geom ON atlas.mailles USING GIST (geom)';

  -- Index sur géométrie préfectures (table adm2)
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_adm2_geom ON public.adm2 USING GIST (geom)';

  -- Rattachement spatial mailles → préfectures
  EXECUTE $sql$
    UPDATE atlas.mailles m
    SET 
      pref_code = adm2.code,
      pref_name = adm2.name
    FROM public.adm2
    WHERE ST_Contains(
      adm2.geom,
      ST_PointOnSurface(m.geom)
    )
  $sql$;

  -- Index pour requêtes rapides
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mailles_pref_name ON atlas.mailles (pref_name)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mailles_pref_code ON atlas.mailles (pref_code)';

  -- VUE 1: Mailles + Préfecture + KPI
  EXECUTE $sql$
    CREATE OR REPLACE VIEW atlas.v_maille_kpi_pref AS
    SELECT 
      m.maille_id,
      m.pref_code,
      m.pref_name,
      m.geom,
      t.eg_avg,
      t.vbs_avg,
      t.ip_avg,
      t.wl_avg,
      t.wp_avg,
      t.gamma_d_max_avg,
      t.w_opt_avg,
      t.passant_80um_avg,
      t.passant_2mm_avg,
      t.n_sondages
    FROM atlas.mailles m
    LEFT JOIN (
      SELECT 
        grid_code as maille_id,
        AVG(eg) as eg_avg,
        AVG(vbs) as vbs_avg,
        AVG(ip) as ip_avg,
        AVG(wl) as wl_avg,
        AVG(wp) as wp_avg,
        AVG(gamma_d_max) as gamma_d_max_avg,
        AVG(w_opt) as w_opt_avg,
        AVG(passant_80um) as passant_80um_avg,
        AVG(passant_2mm) as passant_2mm_avg,
        COUNT(*) as n_sondages
      FROM public.sondages s
      WHERE s.grid_code IS NOT NULL
      GROUP BY s.grid_code
    ) t ON m.maille_id = t.maille_id
    WHERE m.pref_name IS NOT NULL
  $sql$;

  -- VUE 2: Préfectures agrégées
  EXECUTE $sql$
    CREATE OR REPLACE VIEW atlas.v_pref_kpi AS
    SELECT 
      p.code as pref_code,
      p.name as pref_name,
      p.geom,
      COUNT(DISTINCT m.maille_id) as n_mailles,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.eg_avg) as eg_med,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.vbs_avg) as vbs_med,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.ip_avg) as ip_med,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.wl_avg) as wl_med,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.wp_avg) as wp_med,
      AVG(v.eg_avg) as eg_avg,
      AVG(v.vbs_avg) as vbs_avg,
      AVG(v.ip_avg) as ip_avg,
      STDDEV(v.eg_avg) as eg_std,
      STDDEV(v.vbs_avg) as vbs_std,
      STDDEV(v.ip_avg) as ip_std,
      MIN(v.eg_avg) as eg_min,
      MAX(v.eg_avg) as eg_max,
      MIN(v.vbs_avg) as vbs_min,
      MAX(v.vbs_avg) as vbs_max,
      MIN(v.ip_avg) as ip_min,
      MAX(v.ip_avg) as ip_max,
      SUM(v.n_sondages) as n_sondages_total
    FROM public.adm2 p
    LEFT JOIN atlas.mailles m ON m.pref_code = p.code
    LEFT JOIN atlas.v_maille_kpi_pref v ON v.maille_id = m.maille_id
    GROUP BY p.code, p.name, p.geom
  $sql$;

  -- FONCTION: Export GeoJSON préfectures
  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION atlas.get_pref_kpi_geojson(
      kpi_name TEXT DEFAULT 'eg_med'
    )
    RETURNS JSON AS $$
    DECLARE
      result JSON;
    BEGIN
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', json_agg(
          json_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(geom)::json,
            'properties', json_build_object(
              'pref_code', pref_code,
              'pref_name', pref_name,
              'n_mailles', n_mailles,
              'n_sondages', n_sondages_total,
              'eg_med', eg_med,
              'vbs_med', vbs_med,
              'ip_med', ip_med,
              'eg_avg', eg_avg,
              'vbs_avg', vbs_avg,
              'ip_avg', ip_avg,
              'eg_std', eg_std,
              'vbs_std', vbs_std,
              'ip_std', ip_std,
              'eg_min', eg_min,
              'eg_max', eg_max,
              'vbs_min', vbs_min,
              'vbs_max', vbs_max,
              'ip_min', ip_min,
              'ip_max', ip_max
            )
          )
        )
      ) INTO result
      FROM atlas.v_pref_kpi
      WHERE n_mailles > 0;
      
      RETURN result;
    END;
    $$ LANGUAGE plpgsql
  $sql$;

  RAISE NOTICE '✅ Migration 007 terminée - Mailles enrichies avec préfectures';
END $do$;

-- ÉTAPE 4: Contrôle qualité
-- ============================================================================

-- Compter mailles sans préfecture (devrait être proche de 0)
DO $$
DECLARE
  null_count INTEGER;
  total_count INTEGER;
  null_pct NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'adm2'
  ) THEN
    -- Migration skippée plus haut: ne pas exécuter les contrôles/rapports.
    RETURN;
  END IF;

  SELECT COUNT(*) INTO null_count FROM atlas.mailles WHERE pref_name IS NULL;
  SELECT COUNT(*) INTO total_count FROM atlas.mailles;
  null_pct := (null_count::NUMERIC / NULLIF(total_count, 0)) * 100;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'CONTRÔLE QUALITÉ - Rattachement mailles → préfectures';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'Total mailles: %', total_count;
  RAISE NOTICE 'Mailles sans préfecture: % (%.1f%%)', null_count, null_pct;
  RAISE NOTICE '';
  
  IF null_pct > 5 THEN
    RAISE WARNING '⚠️ Plus de 5%% de mailles sans préfecture - vérifier géométries';
  ELSE
    RAISE NOTICE '✅ Rattachement OK (< 5%% NULL)';
  END IF;
END $$;

-- Répartition par préfecture (rapport best-effort)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'adm2'
  ) THEN
    RETURN;
  END IF;

  -- NOTE: on évite les SELECT top-level pour ne pas casser le boot desktop
  -- (rapport disponible via requêtes manuelles si nécessaire)
END $$;

-- Note: le reste (index/vues/fonctions) dépend de la présence de public.adm2.
-- Il est appliqué (ou skippé) dans le bloc DO précédent afin de garantir un boot desktop robuste.
