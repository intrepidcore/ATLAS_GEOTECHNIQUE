-- Migration 010: Cartes Thématiques v1.5.0
-- Date: 2025-10-19
-- Description: Tables pour essais géotechniques, configurations thématiques, et vue matérialisée

-- ============================================================================
-- 1. SUPPRESSION ANCIENNE TABLE ESSAIS (si existe)
-- ============================================================================

-- Sauvegarder les données existantes si nécessaire
-- CREATE TABLE essais_backup AS SELECT * FROM essais;

DROP TABLE IF EXISTS essais CASCADE;

-- ============================================================================
-- 2. TABLE ESSAIS GÉOTECHNIQUES (nouvelle source de vérité)
-- ============================================================================

CREATE TABLE essais_geotechniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sondage_id UUID NOT NULL REFERENCES sondages(id) ON DELETE CASCADE,
  depth_m NUMERIC NOT NULL CHECK (depth_m >= 0),
  
  -- Granulométrie
  passant_80um NUMERIC CHECK (passant_80um >= 0 AND passant_80um <= 100),  -- % fines (argile + limon)
  passant_2mm NUMERIC CHECK (passant_2mm >= 0 AND passant_2mm <= 100),     -- % sable + fines
  passant_20mm NUMERIC CHECK (passant_20mm >= 0 AND passant_20mm <= 100),  -- % sans gros cailloux
  
  -- Limites d'Atterberg
  wl NUMERIC CHECK (wl >= 0 AND wl <= 200),  -- Limite de liquidité (%)
  wp NUMERIC CHECK (wp >= 0 AND wp <= 200),  -- Limite de plasticité (%)
  ip NUMERIC GENERATED ALWAYS AS (
    CASE 
      WHEN wl IS NOT NULL AND wp IS NOT NULL AND wl >= wp 
      THEN wl - wp 
      ELSE NULL 
    END
  ) STORED,  -- Indice de plasticité (calculé)
  
  -- Bleu de Méthylène
  vbs NUMERIC CHECK (vbs >= 0 AND vbs <= 20),  -- Valeur de Bleu du Sol (g/100g)
  
  -- Proctor
  gamma_d_max NUMERIC CHECK (gamma_d_max >= 10 AND gamma_d_max <= 30),  -- Densité sèche max (kN/m³)
  w_opt NUMERIC CHECK (w_opt >= 0 AND w_opt <= 50),  -- Teneur en eau optimale (%)
  proctor_type TEXT CHECK (proctor_type IN ('normal', 'modifie')),
  
  -- Gonflement
  eg NUMERIC CHECK (eg >= 0 AND eg <= 50),  -- Potentiel de gonflement (%)
  
  -- Métadonnées
  test_date DATE,
  laboratory TEXT,
  norm TEXT,  -- Ex: "NF P94-051", "ASTM D4318"
  meta JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID
);

-- Index pour performance
CREATE INDEX idx_eg_sondage ON essais_geotechniques (sondage_id);
CREATE INDEX idx_eg_depth ON essais_geotechniques (depth_m);
CREATE INDEX idx_eg_ip ON essais_geotechniques (ip) WHERE ip IS NOT NULL;
CREATE INDEX idx_eg_vbs ON essais_geotechniques (vbs) WHERE vbs IS NOT NULL;
CREATE INDEX idx_eg_eg ON essais_geotechniques (eg) WHERE eg IS NOT NULL;
CREATE INDEX idx_eg_test_date ON essais_geotechniques (test_date) WHERE test_date IS NOT NULL;

-- Commentaires
COMMENT ON TABLE essais_geotechniques IS 'Essais géotechniques (granulo, Atterberg, VBS, Proctor, gonflement)';
COMMENT ON COLUMN essais_geotechniques.passant_80um IS 'Pourcentage passant au tamis 80µm (fines)';
COMMENT ON COLUMN essais_geotechniques.ip IS 'Indice de plasticité IP = WL - WP (calculé automatiquement)';
COMMENT ON COLUMN essais_geotechniques.vbs IS 'Valeur de Bleu de Méthylène (argilosité)';
COMMENT ON COLUMN essais_geotechniques.eg IS 'Potentiel de gonflement à l''œdomètre';

-- ============================================================================
-- 3. TABLE CONFIGURATIONS CARTES THÉMATIQUES
-- ============================================================================

CREATE TABLE thematic_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  map_type TEXT NOT NULL CHECK (map_type IN ('choropleth', 'proportional', 'heatmap', 'isolines', 'density', 'comparative')),
  parameter TEXT NOT NULL,  -- Ex: "ip_avg", "vbs_avg", "eg_avg"
  config JSONB NOT NULL,  -- { classification, style, filters }
  is_public BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_tc_type ON thematic_configs (map_type);
CREATE INDEX idx_tc_parameter ON thematic_configs (parameter);
CREATE INDEX idx_tc_public ON thematic_configs (is_public) WHERE is_public = true;
CREATE INDEX idx_tc_created_by ON thematic_configs (created_by) WHERE created_by IS NOT NULL;

COMMENT ON TABLE thematic_configs IS 'Configurations sauvegardées de cartes thématiques';

-- ============================================================================
-- 4. TABLE REFRESH QUEUE (invalidation MatView)
-- ============================================================================

CREATE TABLE refresh_queue (
  id BIGSERIAL PRIMARY KEY,
  object TEXT NOT NULL,  -- Ex: "mailles_geotechnique_stats"
  reason TEXT,  -- Ex: "bulk_import", "survey_created"
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rq_created_at ON refresh_queue (created_at);

COMMENT ON TABLE refresh_queue IS 'File d''attente pour rafraîchissement des vues matérialisées';

-- ============================================================================
-- 5. VUE MATÉRIALISÉE AGRÉGATS PAR MAILLE
-- ============================================================================

CREATE MATERIALIZED VIEW mailles_geotechnique_stats AS
SELECT
  m.id,
  m.code,
  m.geom,
  
  -- Comptages de base
  COUNT(DISTINCT s.id) AS n_sondages,
  COUNT(eg.id) AS n_essais_geo,
  
  -- Granulométrie (moyennes et écarts-types)
  AVG(eg.passant_80um) AS passant_80um_avg,
  STDDEV(eg.passant_80um) AS passant_80um_stddev,
  AVG(eg.passant_2mm) AS passant_2mm_avg,
  AVG(eg.passant_20mm) AS passant_20mm_avg,
  
  -- Atterberg (moyennes et écarts-types)
  AVG(eg.wl) AS wl_avg,
  STDDEV(eg.wl) AS wl_stddev,
  AVG(eg.wp) AS wp_avg,
  STDDEV(eg.wp) AS wp_stddev,
  AVG(eg.ip) AS ip_avg,
  STDDEV(eg.ip) AS ip_stddev,
  MIN(eg.ip) AS ip_min,
  MAX(eg.ip) AS ip_max,
  
  -- VBS (moyennes et écarts-types)
  AVG(eg.vbs) AS vbs_avg,
  STDDEV(eg.vbs) AS vbs_stddev,
  MIN(eg.vbs) AS vbs_min,
  MAX(eg.vbs) AS vbs_max,
  
  -- Proctor (moyennes)
  AVG(eg.gamma_d_max) AS gamma_d_max_avg,
  STDDEV(eg.gamma_d_max) AS gamma_d_max_stddev,
  AVG(eg.w_opt) AS w_opt_avg,
  STDDEV(eg.w_opt) AS w_opt_stddev,
  
  -- Gonflement (moyennes et max)
  AVG(eg.eg) AS eg_avg,
  STDDEV(eg.eg) AS eg_stddev,
  MIN(eg.eg) AS eg_min,
  MAX(eg.eg) AS eg_max,
  
  -- Classifications IP (comptages par classe)
  COUNT(CASE WHEN eg.ip < 12 THEN 1 END) AS n_ip_faible,
  COUNT(CASE WHEN eg.ip BETWEEN 12 AND 25 THEN 1 END) AS n_ip_moyen,
  COUNT(CASE WHEN eg.ip BETWEEN 25 AND 40 THEN 1 END) AS n_ip_plastique,
  COUNT(CASE WHEN eg.ip >= 40 THEN 1 END) AS n_ip_tres_plastique,
  
  -- Classifications VBS (comptages par classe)
  COUNT(CASE WHEN eg.vbs < 0.1 THEN 1 END) AS n_vbs_insensible,
  COUNT(CASE WHEN eg.vbs BETWEEN 0.1 AND 1.5 THEN 1 END) AS n_vbs_peu_sensible,
  COUNT(CASE WHEN eg.vbs BETWEEN 1.5 AND 2.5 THEN 1 END) AS n_vbs_sensible,
  COUNT(CASE WHEN eg.vbs BETWEEN 2.5 AND 6 THEN 1 END) AS n_vbs_moyen_argileux,
  COUNT(CASE WHEN eg.vbs BETWEEN 6 AND 8 THEN 1 END) AS n_vbs_argileux,
  COUNT(CASE WHEN eg.vbs >= 8 THEN 1 END) AS n_vbs_tres_argileux,
  
  -- Classifications gonflement (comptages par classe)
  COUNT(CASE WHEN eg.eg < 0.5 THEN 1 END) AS n_eg_negligeable,
  COUNT(CASE WHEN eg.eg BETWEEN 0.5 AND 2 THEN 1 END) AS n_eg_faible,
  COUNT(CASE WHEN eg.eg BETWEEN 2 AND 5 THEN 1 END) AS n_eg_moyen,
  COUNT(CASE WHEN eg.eg BETWEEN 5 AND 10 THEN 1 END) AS n_eg_fort,
  COUNT(CASE WHEN eg.eg >= 10 THEN 1 END) AS n_eg_tres_fort,
  
  -- Métadonnées
  MAX(eg.test_date) AS last_test_date,
  MIN(eg.test_date) AS first_test_date
  
FROM mailles m
LEFT JOIN sondages s ON ST_Within(s.geom, m.geom)
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
GROUP BY m.id, m.code, m.geom;

-- Index pour performance
CREATE UNIQUE INDEX idx_mg_stats_id ON mailles_geotechnique_stats (id);
CREATE INDEX idx_mg_stats_geom ON mailles_geotechnique_stats USING GIST (geom);
CREATE INDEX idx_mg_stats_code ON mailles_geotechnique_stats (code);
CREATE INDEX idx_mg_stats_n_sondages ON mailles_geotechnique_stats (n_sondages);
CREATE INDEX idx_mg_stats_ip_avg ON mailles_geotechnique_stats (ip_avg) WHERE ip_avg IS NOT NULL;
CREATE INDEX idx_mg_stats_vbs_avg ON mailles_geotechnique_stats (vbs_avg) WHERE vbs_avg IS NOT NULL;
CREATE INDEX idx_mg_stats_eg_avg ON mailles_geotechnique_stats (eg_avg) WHERE eg_avg IS NOT NULL;

COMMENT ON MATERIALIZED VIEW mailles_geotechnique_stats IS 'Agrégats géotechniques par maille (rafraîchi automatiquement)';

-- ============================================================================
-- 6. FONCTION REFRESH MATVIEW
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_mailles_geotechnique_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mailles_geotechnique_stats;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_mailles_geotechnique_stats IS 'Rafraîchit la vue matérialisée des stats géotechniques (CONCURRENTLY)';

-- ============================================================================
-- 7. TRIGGERS POUR AUTO-INVALIDATION
-- ============================================================================

-- Fonction trigger pour insérer dans refresh_queue
CREATE OR REPLACE FUNCTION trigger_refresh_queue()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO refresh_queue (object, reason)
  VALUES ('mailles_geotechnique_stats', TG_TABLE_NAME || '_' || TG_OP);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur essais_geotechniques
CREATE TRIGGER trg_eg_insert_refresh
AFTER INSERT ON essais_geotechniques
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_queue();

CREATE TRIGGER trg_eg_update_refresh
AFTER UPDATE ON essais_geotechniques
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_queue();

CREATE TRIGGER trg_eg_delete_refresh
AFTER DELETE ON essais_geotechniques
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_queue();

-- Trigger sur sondages (car affecte les agrégats)
CREATE TRIGGER trg_sondages_delete_refresh
AFTER DELETE ON sondages
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_queue();

-- ============================================================================
-- 8. DONNÉES INITIALES (configurations prédéfinies)
-- ============================================================================

-- Configuration 1: Densité de Sondages
INSERT INTO thematic_configs (name, description, map_type, parameter, config, is_public) VALUES
('Densité de Sondages', 'Nombre de sondages par maille', 'choropleth', 'n_sondages', 
 '{"classification": {"method": "quantiles", "n_classes": 5}, "style": {"palette": "Blues", "opacity": 0.7, "stroke_width": 1.0, "stroke_color": "#333"}, "filters": {}}'::jsonb, 
 true);

-- Configuration 2: Indice de Plasticité
INSERT INTO thematic_configs (name, description, map_type, parameter, config, is_public) VALUES
('Indice de Plasticité (IP)', 'Classification selon plasticité du sol', 'choropleth', 'ip_avg', 
 '{"classification": {"method": "custom", "n_classes": 4, "custom_breaks": [12, 25, 40]}, "style": {"palette": "RdYlGn", "opacity": 0.7, "stroke_width": 1.0, "stroke_color": "#333"}, "filters": {"min_sondages": 3}}'::jsonb, 
 true);

-- Configuration 3: Valeur de Bleu (VBS)
INSERT INTO thematic_configs (name, description, map_type, parameter, config, is_public) VALUES
('Valeur de Bleu (VBS)', 'Argilosité du sol', 'choropleth', 'vbs_avg', 
 '{"classification": {"method": "custom", "n_classes": 6, "custom_breaks": [0.1, 1.5, 2.5, 6, 8]}, "style": {"palette": "Blues", "opacity": 0.7, "stroke_width": 1.0, "stroke_color": "#333"}, "filters": {"min_sondages": 3}}'::jsonb, 
 true);

-- Configuration 4: Potentiel de Gonflement
INSERT INTO thematic_configs (name, description, map_type, parameter, config, is_public) VALUES
('Potentiel de Gonflement (eg)', 'Risque de gonflement des argiles', 'choropleth', 'eg_avg', 
 '{"classification": {"method": "custom", "n_classes": 5, "custom_breaks": [0.5, 2, 5, 10]}, "style": {"palette": "RdYlGn", "opacity": 0.7, "stroke_width": 1.0, "stroke_color": "#333"}, "filters": {"min_sondages": 3}}'::jsonb, 
 true);

-- Configuration 5: Granulométrie (% Fines)
INSERT INTO thematic_configs (name, description, map_type, parameter, config, is_public) VALUES
('Granulométrie (% Fines)', 'Pourcentage passant 80µm', 'choropleth', 'passant_80um_avg', 
 '{"classification": {"method": "custom", "n_classes": 5, "custom_breaks": [12, 35, 50, 70]}, "style": {"palette": "Greens", "opacity": 0.7, "stroke_width": 1.0, "stroke_color": "#333"}, "filters": {"min_sondages": 3}}'::jsonb, 
 true);

-- Configuration 6: Densité Proctor
INSERT INTO thematic_configs (name, description, map_type, parameter, config, is_public) VALUES
('Densité Proctor (γd max)', 'Densité sèche maximale', 'choropleth', 'gamma_d_max_avg', 
 '{"classification": {"method": "custom", "n_classes": 5, "custom_breaks": [16, 18, 20, 22]}, "style": {"palette": "RdYlGn", "opacity": 0.7, "stroke_width": 1.0, "stroke_color": "#333"}, "filters": {"min_sondages": 3}}'::jsonb, 
 true);

-- Configuration 7: Teneur en Eau Optimale
INSERT INTO thematic_configs (name, description, map_type, parameter, config, is_public) VALUES
('Teneur en Eau Optimale (wopt)', 'Teneur en eau pour compactage optimal', 'choropleth', 'w_opt_avg', 
 '{"classification": {"method": "custom", "n_classes": 4, "custom_breaks": [8, 12, 18, 25]}, "style": {"palette": "Blues", "opacity": 0.7, "stroke_width": 1.0, "stroke_color": "#333"}, "filters": {"min_sondages": 3}}'::jsonb, 
 true);

-- Configuration 8: Gonflement Maximum
INSERT INTO thematic_configs (name, description, map_type, parameter, config, is_public) VALUES
('Gonflement Maximum (eg max)', 'Potentiel de gonflement maximal observé', 'choropleth', 'eg_max', 
 '{"classification": {"method": "custom", "n_classes": 5, "custom_breaks": [0.5, 2, 5, 10]}, "style": {"palette": "Reds", "opacity": 0.7, "stroke_width": 1.0, "stroke_color": "#333"}, "filters": {"min_sondages": 3}}'::jsonb, 
 true);

-- Configuration 9: Symboles Densité-VBS
INSERT INTO thematic_configs (name, description, map_type, parameter, config, is_public) VALUES
('Symboles Densité-VBS', 'Taille = n_sondages, Couleur = VBS', 'proportional', 'vbs_avg', 
 '{"classification": {"method": "custom", "n_classes": 4, "custom_breaks": [1.5, 2.5, 6]}, "style": {"palette": "Blues", "opacity": 0.6, "stroke_width": 1.5, "stroke_color": "#fff"}, "filters": {"min_sondages": 1}}'::jsonb, 
 true);

-- Configuration 10: Comparatif IP vs VBS
INSERT INTO thematic_configs (name, description, map_type, parameter, config, is_public) VALUES
('Comparatif IP vs VBS', 'Comparaison plasticité et argilosité', 'comparative', 'ip_avg,vbs_avg', 
 '{"classification": {"method": "quantiles", "n_classes": 5}, "style": {"palette": "RdYlGn", "opacity": 0.7, "stroke_width": 1.0, "stroke_color": "#333"}, "filters": {"min_sondages": 3}}'::jsonb, 
 true);

-- ============================================================================
-- FIN MIGRATION 010
-- ============================================================================
