-- Migration 004: Survey Management & Extended Test Types
-- Date: 2025-01-17
-- Version: 1.1.0

BEGIN;

-- 1. Extend sondages table
ALTER TABLE sondages
  ADD COLUMN IF NOT EXISTS code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS depth_m_min NUMERIC,
  ADD COLUMN IF NOT EXISTS depth_m_max NUMERIC,
  ADD COLUMN IF NOT EXISTS maille_code TEXT,
  ADD COLUMN IF NOT EXISTS adm1_name TEXT,
  ADD COLUMN IF NOT EXISTS adm2_name TEXT,
  ADD COLUMN IF NOT EXISTS adm3_name TEXT,
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for soft delete
CREATE INDEX IF NOT EXISTS idx_sondages_deleted ON sondages(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sondages_maille ON sondages(maille_code);
CREATE INDEX IF NOT EXISTS idx_sondages_code ON sondages(code);

-- 2. Create ENUM for test types (comprehensive)
DO $$ BEGIN
  CREATE TYPE test_type AS ENUM (
    -- In-situ tests
    'SPT_N',           -- Standard Penetration Test
    'qc',              -- Cone tip resistance (CPT)
    'fs',              -- Sleeve friction (CPT)
    'Rf',              -- Friction ratio (CPT)
    'pL',              -- Limit pressure (PMT)
    'pf',              -- Creep pressure (PMT)
    'EM',              -- Pressiometer modulus (PMT)
    'Cu_VST',          -- Undrained shear strength (Vane)
    'K_PLT',           -- Subgrade reaction modulus (Plate Load)
    
    -- Laboratory - Granulometry
    'D10',             -- Effective grain size
    'D50',             -- Median grain size
    'Cu_grain',        -- Uniformity coefficient
    'Cc',              -- Coefficient of curvature
    
    -- Laboratory - Atterberg limits
    'wL',              -- Liquid limit
    'wP',              -- Plastic limit
    'IP',              -- Plasticity index
    
    -- Laboratory - Compaction
    'gamma_d_max',     -- Max dry density
    'w_opt',           -- Optimum water content
    
    -- Laboratory - Strength
    'c_prime',         -- Effective cohesion
    'phi_prime',       -- Effective friction angle
    'Cu_triax',        -- Undrained shear strength (triaxial)
    
    -- Laboratory - Compressibility
    'Cc_compress',     -- Compression index
    'Cs',              -- Swelling index
    'Cv',              -- Coefficient of consolidation
    
    -- Geological parameters
    'water_table',     -- Water table depth
    'layer_thickness', -- Stratigraphic layer thickness
    'USCS',            -- Unified Soil Classification
    'GTR'              -- French classification
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Alter essais table to use ENUM (if not already)
-- Note: This requires data migration if type is currently TEXT
-- For safety, we'll add a new column and migrate later
ALTER TABLE essais
  ADD COLUMN IF NOT EXISTS test_type test_type,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Migrate existing data (SPT_N and qc)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'essais'
      AND column_name = 'type'
  ) THEN
    UPDATE essais
    SET test_type = type::test_type
    WHERE test_type IS NULL AND type IN ('SPT_N', 'qc');
  END IF;
END $$;

-- Index for soft delete
CREATE INDEX IF NOT EXISTS idx_essais_deleted ON essais(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_essais_test_type ON essais(test_type);

-- 4. Create audit table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ DEFAULT now(),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  payload JSONB,
  user_id TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);

-- 5. Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create triggers
DROP TRIGGER IF EXISTS sondages_updated_at ON sondages;
CREATE TRIGGER sondages_updated_at
  BEFORE UPDATE ON sondages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS essais_updated_at ON essais;
CREATE TRIGGER essais_updated_at
  BEFORE UPDATE ON essais
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 7. Create view for active surveys (non-deleted)
CREATE OR REPLACE VIEW v_sondages_active AS
SELECT 
  s.*,
  ST_AsGeoJSON(ST_Transform(s.geom, 4326))::jsonb AS geom_geojson,
  COUNT(DISTINCT e.id) FILTER (WHERE e.deleted_at IS NULL) AS n_essais
FROM sondages s
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id;

-- 8. Create function to auto-tag sondage with maille + ADM
CREATE OR REPLACE FUNCTION tag_sondage_spatial()
RETURNS TRIGGER AS $$
DECLARE
  maille_rec RECORD;
BEGIN
  -- Find maille containing the point
  SELECT code, adm1_name, adm2_name, adm3_name
  INTO maille_rec
  FROM mailles
  WHERE ST_Contains(geom, NEW.geom)
  LIMIT 1;
  
  IF FOUND THEN
    NEW.maille_code := maille_rec.code;
    NEW.adm1_name := maille_rec.adm1_name;
    NEW.adm2_name := maille_rec.adm2_name;
    NEW.adm3_name := maille_rec.adm3_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sondages_tag_spatial ON sondages;
CREATE TRIGGER sondages_tag_spatial
  BEFORE INSERT OR UPDATE OF geom ON sondages
  FOR EACH ROW
  EXECUTE FUNCTION tag_sondage_spatial();

-- 9. Create function to generate auto-code
CREATE OR REPLACE FUNCTION generate_sondage_code()
RETURNS TRIGGER AS $$
DECLARE
  today TEXT;
  seq INT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    today := to_char(now(), 'YYYYMMDD');
    SELECT COALESCE(MAX(SUBSTRING(code FROM 'S-' || today || '-(\d+)')::INT), 0) + 1
    INTO seq
    FROM sondages
    WHERE code LIKE 'S-' || today || '-%';
    
    NEW.code := 'S-' || today || '-' || LPAD(seq::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sondages_auto_code ON sondages;
CREATE TRIGGER sondages_auto_code
  BEFORE INSERT ON sondages
  FOR EACH ROW
  EXECUTE FUNCTION generate_sondage_code();

-- 10. Add constraint for depth validation
ALTER TABLE sondages
  ADD CONSTRAINT check_depth_order CHECK (depth_m_min IS NULL OR depth_m_max IS NULL OR depth_m_min <= depth_m_max);

ALTER TABLE essais
  ADD CONSTRAINT check_depth_positive CHECK (depth_m IS NULL OR depth_m >= 0);

COMMIT;

-- Comments
COMMENT ON TABLE audit_log IS 'Audit trail for all CRUD operations';
COMMENT ON COLUMN sondages.code IS 'Unique survey code (auto-generated if not provided)';
COMMENT ON COLUMN sondages.maille_code IS 'Grid cell code (auto-tagged via spatial trigger)';
COMMENT ON TYPE test_type IS 'Comprehensive geotechnical test types (in-situ + lab + geological)';
