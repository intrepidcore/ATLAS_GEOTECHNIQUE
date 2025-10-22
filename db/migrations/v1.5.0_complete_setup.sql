-- ============================================================================
-- Migration v1.5.0 - Setup complet pour cartes thématiques + import bulk
-- ============================================================================

BEGIN;

-- 1) Extension UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2) UUID auto pour sondages et essais
ALTER TABLE sondages 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE essais_geotechniques 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3) Fonction d'insert WGS84 → UTM 25231
CREATE OR REPLACE FUNCTION upsert_sondage_wgs84(
  p_code TEXT,
  p_lon DOUBLE PRECISION,
  p_lat DOUBLE PRECISION,
  p_date DATE DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_meta JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Chercher si existe déjà
  SELECT id INTO v_id FROM sondages WHERE meta->>'code' = p_code LIMIT 1;
  
  IF v_id IS NULL THEN
    -- Créer nouveau
    v_id := gen_random_uuid();
    INSERT INTO sondages(
      id, 
      geom, 
      date_sondage, 
      source, 
      meta,
      created_at,
      updated_at
    )
    VALUES(
      v_id,
      ST_Transform(ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326), 25231),
      p_date,
      p_source,
      COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object('code', p_code, 'location_mode', 'exact'),
      NOW(),
      NOW()
    );
  ELSE
    -- Mettre à jour
    UPDATE sondages 
    SET 
      geom = ST_Transform(ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326), 25231),
      date_sondage = COALESCE(p_date, date_sondage),
      source = COALESCE(p_source, source),
      updated_at = NOW()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_sondage_wgs84 IS 
'Insert/update sondage avec coordonnées WGS84 (4326) converties en UTM 25231';

-- 4) Vue compatibilité mailles ↔ grid
-- grid existe déjà comme table (816 mailles), mailles aussi (29407)
-- On utilise mailles comme source principale pour la MV
-- Pas de DROP, on garde les deux tables

-- 5) Materialized View standardisée pour cartes thématiques
DROP MATERIALIZED VIEW IF EXISTS mailles_geotechnique_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS grid_stats_geotechnical CASCADE;

CREATE MATERIALIZED VIEW mailles_geotechnique_stats AS
SELECT
  m.id,
  m.code,
  m.geom,
  m.adm1_name,
  m.adm2_name,
  m.adm3_name,
  
  -- Compteurs
  COUNT(DISTINCT s.id) AS n_sondages,
  COUNT(eg.id) AS n_essais_geo,
  
  -- Granulométrie - Passant 80µm
  AVG(eg.passant_80um) AS passant_80um_avg,
  STDDEV(eg.passant_80um) AS passant_80um_stddev,
  MIN(eg.passant_80um) AS passant_80um_min,
  MAX(eg.passant_80um) AS passant_80um_max,
  
  -- Granulométrie - Passant 2mm
  AVG(eg.passant_2mm) AS passant_2mm_avg,
  STDDEV(eg.passant_2mm) AS passant_2mm_stddev,
  MIN(eg.passant_2mm) AS passant_2mm_min,
  MAX(eg.passant_2mm) AS passant_2mm_max,
  
  -- Granulométrie - Passant 20mm
  AVG(eg.passant_20mm) AS passant_20mm_avg,
  STDDEV(eg.passant_20mm) AS passant_20mm_stddev,
  MIN(eg.passant_20mm) AS passant_20mm_min,
  MAX(eg.passant_20mm) AS passant_20mm_max,
  
  -- Atterberg - WL
  AVG(eg.wl) AS wl_avg,
  STDDEV(eg.wl) AS wl_stddev,
  MIN(eg.wl) AS wl_min,
  MAX(eg.wl) AS wl_max,
  
  -- Atterberg - WP
  AVG(eg.wp) AS wp_avg,
  STDDEV(eg.wp) AS wp_stddev,
  MIN(eg.wp) AS wp_min,
  MAX(eg.wp) AS wp_max,
  
  -- Atterberg - IP (calculé)
  AVG(eg.ip) AS ip_avg,
  STDDEV(eg.ip) AS ip_stddev,
  MIN(eg.ip) AS ip_min,
  MAX(eg.ip) AS ip_max,
  
  -- VBS
  AVG(eg.vbs) AS vbs_avg,
  STDDEV(eg.vbs) AS vbs_stddev,
  MIN(eg.vbs) AS vbs_min,
  MAX(eg.vbs) AS vbs_max,
  
  -- Proctor - Gamma d max
  AVG(eg.gamma_d_max) AS gamma_d_max_avg,
  STDDEV(eg.gamma_d_max) AS gamma_d_max_stddev,
  MIN(eg.gamma_d_max) AS gamma_d_max_min,
  MAX(eg.gamma_d_max) AS gamma_d_max_max,
  
  -- Proctor - W opt
  AVG(eg.w_opt) AS w_opt_avg,
  STDDEV(eg.w_opt) AS w_opt_stddev,
  MIN(eg.w_opt) AS w_opt_min,
  MAX(eg.w_opt) AS w_opt_max,
  
  -- Gonflement - Eg
  AVG(eg.eg) AS eg_avg,
  STDDEV(eg.eg) AS eg_stddev,
  MIN(eg.eg) AS eg_min,
  MAX(eg.eg) AS eg_max
  
FROM mailles m
LEFT JOIN sondages s ON ST_Within(s.geom, m.geom) AND s.deleted_at IS NULL
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
GROUP BY m.id, m.code, m.geom, m.adm1_name, m.adm2_name, m.adm3_name;

-- Index pour performance
CREATE UNIQUE INDEX idx_mgs_id ON mailles_geotechnique_stats (id);
CREATE INDEX idx_mgs_code ON mailles_geotechnique_stats (code);
CREATE INDEX idx_mgs_geom ON mailles_geotechnique_stats USING GIST (geom);
CREATE INDEX idx_mgs_adm1 ON mailles_geotechnique_stats (adm1_name) WHERE adm1_name IS NOT NULL;
CREATE INDEX idx_mgs_n_sondages ON mailles_geotechnique_stats (n_sondages) WHERE n_sondages > 0;

COMMENT ON MATERIALIZED VIEW mailles_geotechnique_stats IS 
'Vue matérialisée des statistiques géotechniques par maille. 
Refresh: REFRESH MATERIALIZED VIEW mailles_geotechnique_stats;';

-- 6) Alias pour compatibilité avec ancien code
CREATE OR REPLACE VIEW grid_stats_geotechnical AS
  SELECT * FROM mailles_geotechnique_stats;

-- 7) Table de queue pour refresh automatique
CREATE TABLE IF NOT EXISTS refresh_queue (
  id BIGSERIAL PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_queue_created ON refresh_queue (created_at DESC);

COMMENT ON TABLE refresh_queue IS 
'Queue pour déclencher le refresh de mailles_geotechnique_stats';

-- 8) Refresh initial
REFRESH MATERIALIZED VIEW mailles_geotechnique_stats;

-- 9) Statistiques
SELECT 
    COUNT(*) as total_mailles,
    COUNT(*) FILTER (WHERE n_sondages > 0) as mailles_avec_donnees,
    SUM(n_sondages) as total_sondages,
    SUM(n_essais_geo) as total_essais,
    COUNT(*) FILTER (WHERE passant_80um_avg IS NOT NULL) as mailles_avec_passant_80um,
    COUNT(*) FILTER (WHERE wl_avg IS NOT NULL) as mailles_avec_wl,
    COUNT(*) FILTER (WHERE vbs_avg IS NOT NULL) as mailles_avec_vbs
FROM mailles_geotechnique_stats;

COMMIT;

-- Message de succès
SELECT '✅ Migration v1.5.0 terminée avec succès !' as status;
