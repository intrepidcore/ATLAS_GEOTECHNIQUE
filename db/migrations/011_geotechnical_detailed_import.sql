-- ============================================================================
-- Migration 011: Import géotechnique détaillé avec courbes granulo complètes
-- Date: 2025-10-22
-- Description: Tables pour échantillons, courbes granulo, essais Atterberg/VBS/Proctor détaillés
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLE ÉCHANTILLONS (niveau profondeur)
-- ============================================================================

CREATE TABLE IF NOT EXISTS echantillons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sondage_id UUID NOT NULL REFERENCES sondages(id) ON DELETE CASCADE,
  depth_m NUMERIC NOT NULL CHECK (depth_m >= 0),
  
  -- Métadonnées échantillon
  date DATE,
  laboratory TEXT,
  norm TEXT,  -- Norme utilisée pour les essais
  
  -- Propriétés physiques de base
  rho_s_gcm3 NUMERIC CHECK (rho_s_gcm3 >= 2.0 AND rho_s_gcm3 <= 3.5),  -- Densité des solides (g/cm³)
  water_content_w NUMERIC CHECK (water_content_w >= 0 AND water_content_w <= 100),  -- Teneur en eau (%)
  is_index NUMERIC CHECK (is_index >= 0 AND is_index <= 1),  -- Indice de gonflement Is
  eg NUMERIC CHECK (eg >= 0 AND eg <= 50),  -- Gonflement œdométrique (%)
  
  -- Métadonnées
  meta JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  
  -- Contrainte unicité logique
  UNIQUE(sondage_id, depth_m, date)
);

CREATE INDEX idx_echantillons_sondage ON echantillons (sondage_id);
CREATE INDEX idx_echantillons_depth ON echantillons (depth_m);
CREATE INDEX idx_echantillons_date ON echantillons (date) WHERE date IS NOT NULL;
CREATE INDEX idx_echantillons_laboratory ON echantillons (laboratory) WHERE laboratory IS NOT NULL;

COMMENT ON TABLE echantillons IS 'Échantillons de sol prélevés à différentes profondeurs';
COMMENT ON COLUMN echantillons.rho_s_gcm3 IS 'Densité absolue des solides (g/cm³)';
COMMENT ON COLUMN echantillons.water_content_w IS 'Teneur en eau naturelle (%)';
COMMENT ON COLUMN echantillons.is_index IS 'Indice de gonflement Is (sans dimension)';
COMMENT ON COLUMN echantillons.eg IS 'Gonflement à l''œdomètre (%)';

-- ============================================================================
-- 2. TABLE ESSAIS ATTERBERG (détaillés)
-- ============================================================================

CREATE TABLE IF NOT EXISTS essais_atterberg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echantillon_id UUID NOT NULL REFERENCES echantillons(id) ON DELETE CASCADE,
  
  -- Limites d'Atterberg
  wl NUMERIC CHECK (wl >= 0 AND wl <= 200),  -- Limite de liquidité (%)
  wp NUMERIC CHECK (wp >= 0 AND wp <= 200),  -- Limite de plasticité (%)
  ip_generated NUMERIC GENERATED ALWAYS AS (
    CASE 
      WHEN wl IS NOT NULL AND wp IS NOT NULL AND wl >= wp 
      THEN wl - wp 
      ELSE NULL 
    END
  ) STORED,  -- Indice de plasticité (calculé automatiquement)
  
  -- Métadonnées
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Un seul essai Atterberg par échantillon
  UNIQUE(echantillon_id)
);

CREATE INDEX idx_atterberg_echantillon ON essais_atterberg (echantillon_id);
CREATE INDEX idx_atterberg_ip ON essais_atterberg (ip_generated) WHERE ip_generated IS NOT NULL;

COMMENT ON TABLE essais_atterberg IS 'Essais de limites d''Atterberg (WL, WP, IP)';
COMMENT ON COLUMN essais_atterberg.wl IS 'Limite de liquidité (%)';
COMMENT ON COLUMN essais_atterberg.wp IS 'Limite de plasticité (%)';
COMMENT ON COLUMN essais_atterberg.ip_generated IS 'Indice de plasticité IP = WL - WP (auto-calculé)';

-- ============================================================================
-- 3. TABLE ESSAIS VBS (Valeur de Bleu)
-- ============================================================================

CREATE TABLE IF NOT EXISTS essais_vbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echantillon_id UUID NOT NULL REFERENCES echantillons(id) ON DELETE CASCADE,
  
  -- Valeur de Bleu
  vbs NUMERIC NOT NULL CHECK (vbs >= 0 AND vbs <= 20),  -- g/100g
  
  -- Commentaire/classification
  commentaire TEXT,
  
  -- Métadonnées
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Un seul essai VBS par échantillon
  UNIQUE(echantillon_id)
);

CREATE INDEX idx_vbs_echantillon ON essais_vbs (echantillon_id);
CREATE INDEX idx_vbs_value ON essais_vbs (vbs);

COMMENT ON TABLE essais_vbs IS 'Essais de Valeur de Bleu de Méthylène (argilosité)';
COMMENT ON COLUMN essais_vbs.vbs IS 'Valeur de Bleu du Sol (g/100g)';

-- ============================================================================
-- 4. TABLE ESSAIS PROCTOR
-- ============================================================================

CREATE TABLE IF NOT EXISTS essais_proctor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echantillon_id UUID NOT NULL REFERENCES echantillons(id) ON DELETE CASCADE,
  
  -- Type de Proctor
  proctor_type TEXT NOT NULL CHECK (proctor_type IN ('normal', 'modifie')),
  
  -- Résultats
  gamma_d_max NUMERIC NOT NULL CHECK (gamma_d_max >= 10 AND gamma_d_max <= 30),  -- kN/m³
  w_opt NUMERIC NOT NULL CHECK (w_opt >= 0 AND w_opt <= 50),  -- %
  
  -- Métadonnées
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Un seul essai Proctor par type et échantillon
  UNIQUE(echantillon_id, proctor_type)
);

CREATE INDEX idx_proctor_echantillon ON essais_proctor (echantillon_id);
CREATE INDEX idx_proctor_type ON essais_proctor (proctor_type);

COMMENT ON TABLE essais_proctor IS 'Essais Proctor (normal ou modifié)';
COMMENT ON COLUMN essais_proctor.gamma_d_max IS 'Densité sèche maximale (kN/m³)';
COMMENT ON COLUMN essais_proctor.w_opt IS 'Teneur en eau optimale (%)';

-- ============================================================================
-- 5. TABLE GRANULO_POINTS (courbes granulométriques complètes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS granulo_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echantillon_id UUID NOT NULL REFERENCES echantillons(id) ON DELETE CASCADE,
  
  -- Méthode
  method TEXT NOT NULL CHECK (method IN ('tamisage', 'sedimento')),
  
  -- Point de mesure
  sieve_mm NUMERIC NOT NULL CHECK (sieve_mm > 0),  -- Diamètre tamis en mm
  passing_pct NUMERIC NOT NULL CHECK (passing_pct >= 0 AND passing_pct <= 100),  -- % passant
  
  -- Métadonnées
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Un seul point par échantillon/méthode/tamis
  UNIQUE(echantillon_id, method, sieve_mm)
);

CREATE INDEX idx_granulo_echantillon ON granulo_points (echantillon_id);
CREATE INDEX idx_granulo_method ON granulo_points (method);
CREATE INDEX idx_granulo_sieve ON granulo_points (sieve_mm);
CREATE INDEX idx_granulo_composite ON granulo_points (echantillon_id, method, sieve_mm);

COMMENT ON TABLE granulo_points IS 'Points de courbes granulométriques (tamisage + sédimentométrie)';
COMMENT ON COLUMN granulo_points.method IS 'Méthode: tamisage (>80µm) ou sedimento (<80µm)';
COMMENT ON COLUMN granulo_points.sieve_mm IS 'Diamètre du tamis en mm (0.08 = 80µm)';
COMMENT ON COLUMN granulo_points.passing_pct IS 'Pourcentage de passant cumulé (%)';

-- ============================================================================
-- 6. FONCTION: Calculer passants synthétiques (80µm, 2mm, 20mm)
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_passant_synthetic(p_echantillon_id UUID)
RETURNS TABLE(passant_80um NUMERIC, passant_2mm NUMERIC, passant_20mm NUMERIC) AS $$
DECLARE
  v_80um NUMERIC;
  v_2mm NUMERIC;
  v_20mm NUMERIC;
BEGIN
  -- Passant 80µm (0.08 mm) - interpolation linéaire log-échelle si nécessaire
  SELECT passing_pct INTO v_80um
  FROM granulo_points
  WHERE echantillon_id = p_echantillon_id 
    AND sieve_mm = 0.08
  LIMIT 1;
  
  -- Si pas de valeur exacte, interpoler entre les deux plus proches
  IF v_80um IS NULL THEN
    SELECT 
      CASE 
        WHEN COUNT(*) >= 2 THEN
          -- Interpolation linéaire simple
          (SELECT passing_pct FROM granulo_points 
           WHERE echantillon_id = p_echantillon_id AND sieve_mm <= 0.08 
           ORDER BY sieve_mm DESC LIMIT 1)
        ELSE NULL
      END INTO v_80um
    FROM granulo_points
    WHERE echantillon_id = p_echantillon_id;
  END IF;
  
  -- Passant 2mm
  SELECT passing_pct INTO v_2mm
  FROM granulo_points
  WHERE echantillon_id = p_echantillon_id 
    AND sieve_mm = 2.0
  LIMIT 1;
  
  IF v_2mm IS NULL THEN
    SELECT passing_pct INTO v_2mm
    FROM granulo_points
    WHERE echantillon_id = p_echantillon_id AND sieve_mm <= 2.0
    ORDER BY sieve_mm DESC LIMIT 1;
  END IF;
  
  -- Passant 20mm
  SELECT passing_pct INTO v_20mm
  FROM granulo_points
  WHERE echantillon_id = p_echantillon_id 
    AND sieve_mm = 20.0
  LIMIT 1;
  
  IF v_20mm IS NULL THEN
    SELECT passing_pct INTO v_20mm
    FROM granulo_points
    WHERE echantillon_id = p_echantillon_id AND sieve_mm <= 20.0
    ORDER BY sieve_mm DESC LIMIT 1;
  END IF;
  
  RETURN QUERY SELECT v_80um, v_2mm, v_20mm;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_passant_synthetic IS 
'Calcule les passants synthétiques (80µm, 2mm, 20mm) depuis granulo_points avec interpolation';

-- ============================================================================
-- 7. VUE: Synthèse échantillons avec tous les essais
-- ============================================================================

CREATE OR REPLACE VIEW v_echantillons_complets AS
SELECT 
  e.id AS echantillon_id,
  e.sondage_id,
  s.code AS sondage_code,
  e.depth_m,
  e.date,
  e.laboratory,
  e.norm,
  
  -- Propriétés physiques
  e.rho_s_gcm3,
  e.water_content_w,
  e.is_index,
  e.eg,
  
  -- Atterberg
  att.wl,
  att.wp,
  att.ip_generated AS ip,
  
  -- VBS
  vbs.vbs,
  vbs.commentaire AS vbs_commentaire,
  
  -- Proctor
  pr.proctor_type,
  pr.gamma_d_max,
  pr.w_opt,
  
  -- Granulométrie synthétique (calculée depuis granulo_points)
  (SELECT passant_80um FROM calculate_passant_synthetic(e.id)) AS passant_80um,
  (SELECT passant_2mm FROM calculate_passant_synthetic(e.id)) AS passant_2mm,
  (SELECT passant_20mm FROM calculate_passant_synthetic(e.id)) AS passant_20mm,
  
  -- Compteurs
  (SELECT COUNT(*) FROM granulo_points WHERE echantillon_id = e.id AND method = 'tamisage') AS n_points_tamisage,
  (SELECT COUNT(*) FROM granulo_points WHERE echantillon_id = e.id AND method = 'sedimento') AS n_points_sedimento,
  
  -- Audit
  e.created_at,
  e.updated_at
  
FROM echantillons e
LEFT JOIN sondages s ON e.sondage_id = s.id
LEFT JOIN essais_atterberg att ON att.echantillon_id = e.id
LEFT JOIN essais_vbs vbs ON vbs.echantillon_id = e.id
LEFT JOIN essais_proctor pr ON pr.echantillon_id = e.id;

COMMENT ON VIEW v_echantillons_complets IS 
'Vue complète des échantillons avec tous les essais associés et granulo synthétique';

-- ============================================================================
-- 8. FONCTION: Synchroniser vers essais_geotechniques (compatibilité)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_to_essais_geotechniques()
RETURNS TRIGGER AS $$
DECLARE
  v_passant_80um NUMERIC;
  v_passant_2mm NUMERIC;
  v_passant_20mm NUMERIC;
  v_wl NUMERIC;
  v_wp NUMERIC;
  v_vbs NUMERIC;
  v_gamma_d_max NUMERIC;
  v_w_opt NUMERIC;
  v_proctor_type TEXT;
BEGIN
  -- Récupérer les valeurs depuis les tables détaillées
  SELECT passant_80um, passant_2mm, passant_20mm 
  INTO v_passant_80um, v_passant_2mm, v_passant_20mm
  FROM calculate_passant_synthetic(NEW.id);
  
  SELECT wl, wp INTO v_wl, v_wp
  FROM essais_atterberg WHERE echantillon_id = NEW.id;
  
  SELECT vbs INTO v_vbs
  FROM essais_vbs WHERE echantillon_id = NEW.id;
  
  SELECT gamma_d_max, w_opt, proctor_type 
  INTO v_gamma_d_max, v_w_opt, v_proctor_type
  FROM essais_proctor WHERE echantillon_id = NEW.id LIMIT 1;
  
  -- Upsert dans essais_geotechniques
  INSERT INTO essais_geotechniques (
    sondage_id, depth_m, 
    passant_80um, passant_2mm, passant_20mm,
    wl, wp,
    vbs,
    gamma_d_max, w_opt, proctor_type,
    eg,
    test_date, laboratory, norm,
    created_at
  ) VALUES (
    NEW.sondage_id, NEW.depth_m,
    v_passant_80um, v_passant_2mm, v_passant_20mm,
    v_wl, v_wp,
    v_vbs,
    v_gamma_d_max, v_w_opt, v_proctor_type,
    NEW.eg,
    NEW.date, NEW.laboratory, NEW.norm,
    NEW.created_at
  )
  ON CONFLICT (sondage_id, depth_m) 
  DO UPDATE SET
    passant_80um = EXCLUDED.passant_80um,
    passant_2mm = EXCLUDED.passant_2mm,
    passant_20mm = EXCLUDED.passant_20mm,
    wl = EXCLUDED.wl,
    wp = EXCLUDED.wp,
    vbs = EXCLUDED.vbs,
    gamma_d_max = EXCLUDED.gamma_d_max,
    w_opt = EXCLUDED.w_opt,
    proctor_type = EXCLUDED.proctor_type,
    eg = EXCLUDED.eg,
    test_date = EXCLUDED.test_date,
    laboratory = EXCLUDED.laboratory,
    norm = EXCLUDED.norm,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur échantillons
CREATE TRIGGER trg_sync_echantillon_to_eg
AFTER INSERT OR UPDATE ON echantillons
FOR EACH ROW
EXECUTE FUNCTION sync_to_essais_geotechniques();

-- Triggers sur essais détaillés
CREATE TRIGGER trg_sync_atterberg_to_eg
AFTER INSERT OR UPDATE OR DELETE ON essais_atterberg
FOR EACH ROW
EXECUTE FUNCTION sync_to_essais_geotechniques();

CREATE TRIGGER trg_sync_vbs_to_eg
AFTER INSERT OR UPDATE OR DELETE ON essais_vbs
FOR EACH ROW
EXECUTE FUNCTION sync_to_essais_geotechniques();

CREATE TRIGGER trg_sync_proctor_to_eg
AFTER INSERT OR UPDATE OR DELETE ON essais_proctor
FOR EACH ROW
EXECUTE FUNCTION sync_to_essais_geotechniques();

CREATE TRIGGER trg_sync_granulo_to_eg
AFTER INSERT OR UPDATE OR DELETE ON granulo_points
FOR EACH ROW
EXECUTE FUNCTION sync_to_essais_geotechniques();

COMMENT ON FUNCTION sync_to_essais_geotechniques IS 
'Synchronise automatiquement les données détaillées vers essais_geotechniques (compatibilité cartes thématiques)';

-- ============================================================================
-- 9. Contrainte unicité sur essais_geotechniques
-- ============================================================================

-- Ajouter contrainte unicité si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'essais_geotechniques_sondage_depth_unique'
  ) THEN
    ALTER TABLE essais_geotechniques 
    ADD CONSTRAINT essais_geotechniques_sondage_depth_unique 
    UNIQUE (sondage_id, depth_m);
  END IF;
END $$;

-- ============================================================================
-- 10. Trigger pour refresh_queue
-- ============================================================================

-- Trigger sur échantillons pour invalider la matview
CREATE TRIGGER trg_echantillons_refresh
AFTER INSERT OR UPDATE OR DELETE ON echantillons
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_queue();

COMMIT;

-- Message de succès
SELECT '✅ Migration 011 terminée : tables détaillées créées (echantillons, granulo_points, essais_atterberg/vbs/proctor)' as status;
