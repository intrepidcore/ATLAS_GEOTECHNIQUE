-- ============================================================================
-- FONCTION API PANEL CELL : Point d'entrée unique pour panneau gauche
-- ============================================================================

CREATE OR REPLACE FUNCTION api_panel_cell(p_maille_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH sids AS (
  SELECT DISTINCT sondage_id
  FROM v_maille_sondages_all
  WHERE maille_code = p_maille_code
),
src AS (
  SELECT source, COUNT(DISTINCT sondage_id) AS n
  FROM v_maille_sondages_all
  WHERE maille_code = p_maille_code
  GROUP BY source
),
cell AS (
  SELECT
    m.code,
    COALESCE(SUM(CASE WHEN src.source='real'   THEN src.n END),0) AS n_real,
    COALESCE(SUM(CASE WHEN src.source='spread' THEN src.n END),0) AS n_spread
  FROM mailles m
  LEFT JOIN src ON TRUE
  WHERE m.code = p_maille_code
  GROUP BY m.code
),
sondages AS (
  SELECT
    s.id,
    s.meta->>'code' AS code_site,
    s.meta->>'localite' AS localite,
    s.meta->>'adm3_code' AS adm3_code,
    COALESCE(s.loc_mode,'spread') AS mode,
    COALESCE((SELECT COUNT(*) FROM echantillons e WHERE e.sondage_id=s.id), 0) AS samples,
    COALESCE((SELECT COUNT(*) FROM essais_atterberg a JOIN echantillons e ON e.id=a.echantillon_id WHERE e.sondage_id=s.id), 0)
      + COALESCE((SELECT COUNT(*) FROM essais_vbs v JOIN echantillons e ON e.id=v.echantillon_id WHERE e.sondage_id=s.id), 0) AS tests,
    s.created_at::date AS date
  FROM sondages s
  WHERE s.id IN (SELECT sondage_id FROM sids)
),
atterberg AS (
  SELECT jsonb_agg(jsonb_build_object(
           'depth_m', e.depth_m,
           'wl', a.wl, 
           'wp', a.wp
         ) ORDER BY e.depth_m) AS arr
  FROM essais_atterberg a
  JOIN echantillons e ON e.id=a.echantillon_id
  WHERE e.sondage_id IN (SELECT sondage_id FROM sids)
    AND (a.wl IS NOT NULL OR a.wp IS NOT NULL)
),
vbs AS (
  SELECT jsonb_agg(jsonb_build_object(
           'depth_m', e.depth_m,
           'vbs', v.vbs
         ) ORDER BY e.depth_m) AS arr
  FROM essais_vbs v
  JOIN echantillons e ON e.id=v.echantillon_id
  WHERE e.sondage_id IN (SELECT sondage_id FROM sids)
    AND v.vbs IS NOT NULL
),
depth_hist AS (
  SELECT jsonb_agg(jsonb_build_object(
           'bin', bin,
           'n', cnt
         ) ORDER BY bin) AS arr
  FROM (
    SELECT width_bucket(e.depth_m, 0, 30, 6) AS bin, COUNT(*) AS cnt
    FROM echantillons e
    WHERE e.sondage_id IN (SELECT sondage_id FROM sids)
      AND e.depth_m IS NOT NULL
    GROUP BY width_bucket(e.depth_m, 0, 30, 6)
  ) sub
)
SELECT jsonb_build_object(
  'cell', jsonb_build_object(
    'code', (SELECT code FROM cell),
    'sources', jsonb_build_object(
       'real',   (SELECT n_real   FROM cell),
       'spread', (SELECT n_spread FROM cell)
    ),
    'n_sondages', (SELECT COALESCE(n_real,0)+COALESCE(n_spread,0) FROM cell)
  ),
  'sondages', COALESCE((SELECT jsonb_agg(to_jsonb(sondages) ORDER BY date DESC) FROM sondages), '[]'::jsonb),
  'charts', jsonb_build_object(
    'atterberg', COALESCE((SELECT arr FROM atterberg), '[]'::jsonb),
    'vbs',       COALESCE((SELECT arr FROM vbs),       '[]'::jsonb),
    'granulo',   '[]'::jsonb,
    'depth_hist', COALESCE((SELECT arr FROM depth_hist), '[]'::jsonb)
  )
);
$$;

-- Test
SELECT api_panel_cell('TG-0496-0210-01');
