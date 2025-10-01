-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Schema and tables
CREATE TABLE IF NOT EXISTS sondages (
  id UUID PRIMARY KEY,
  geom geometry(Point, 25231) NOT NULL,
  date_sondage date,
  source text,
  meta jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sondages_geom ON sondages USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_sondages_date ON sondages (date_sondage);

CREATE TABLE IF NOT EXISTS essais (
  id UUID PRIMARY KEY,
  sondage_id UUID REFERENCES sondages(id) ON DELETE CASCADE,
  type text NOT NULL,
  depth_m numeric,
  value numeric,
  unit text,
  meta jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_essais_sondage ON essais (sondage_id);
CREATE INDEX IF NOT EXISTS idx_essais_type ON essais (type);

CREATE TABLE IF NOT EXISTS mailles (
  id UUID PRIMARY KEY,
  geom geometry(Polygon, 25231) NOT NULL,
  code text UNIQUE NOT NULL,
  stats jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mailles_geom ON mailles USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_mailles_code ON mailles (code);
