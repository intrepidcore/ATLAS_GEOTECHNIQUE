BEGIN;

CREATE TABLE IF NOT EXISTS atlas.ai_infer_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maille_id UUID NOT NULL REFERENCES atlas.mailles(id) ON DELETE CASCADE,
  maille_code TEXT NOT NULL,
  model_version TEXT NOT NULL,
  features JSONB NOT NULL,
  prediction JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES atlas.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_infer_runs_maille ON atlas.ai_infer_runs(maille_id, created_at DESC);

CREATE TABLE IF NOT EXISTS atlas.ai_opti_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maille_id UUID NOT NULL REFERENCES atlas.mailles(id) ON DELETE CASCADE,
  maille_code TEXT NOT NULL,
  model_version TEXT NOT NULL,
  constraints JSONB NOT NULL,
  candidates JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES atlas.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_opti_runs_maille ON atlas.ai_opti_runs(maille_id, created_at DESC);

CREATE OR REPLACE VIEW atlas.v_maille_features_ai AS
SELECT
  m.id AS maille_id,
  m.code AS maille_code,
  m.geom,
  m.pref_name AS adm1_name,
  m.adm2_name,
  COALESCE(COUNT(DISTINCT s.id), 0)::bigint AS n_sondages,
  AVG(ev.vbs)::float8 AS vbs_moyen,
  AVG(COALESCE(ea.ip_generated, (ea.wl - ea.wp)))::float8 AS atterberg_ip_moyen,
  COALESCE(MAX(e.depth_m), 0)::float8 AS depth_max_m,
  EXISTS (
    SELECT 1
    FROM atlas.mailles_zones_etude mze
    JOIN atlas.zones_etude ze ON ze.id = mze.zone_id
    WHERE mze.maille_id = m.id
      AND ze.code = 'DEPRESSION_LAMA_TG'
  ) AS in_lama_zone
FROM atlas.mailles m
LEFT JOIN atlas.sondages s ON s.maille_code = m.code AND s.deleted_at IS NULL
LEFT JOIN atlas.echantillons e ON e.sondage_id = s.id
LEFT JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id
LEFT JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id
GROUP BY m.id, m.code, m.geom, m.pref_name, m.adm2_name;

COMMIT;
