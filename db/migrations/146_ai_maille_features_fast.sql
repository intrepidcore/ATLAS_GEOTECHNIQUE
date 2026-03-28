BEGIN;

CREATE TABLE IF NOT EXISTS atlas.ai_maille_features_fast (
  maille_id uuid PRIMARY KEY REFERENCES atlas.mailles(id) ON DELETE CASCADE,
  maille_code text NOT NULL,
  n_sondages int NOT NULL DEFAULT 0,
  vbs_moyen float8 NULL,
  ip_moyen float8 NULL,
  gonflement_cg_moyen float8 NULL,
  dsm_altitude_mean float8 NULL,
  dsm_altitude_stddev float8 NULL,
  dsm_altitude_range float8 NULL,
  pct_in_lama float8 NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_maille_features_fast_code ON atlas.ai_maille_features_fast(maille_code);
CREATE INDEX IF NOT EXISTS idx_ai_maille_features_fast_updated_at ON atlas.ai_maille_features_fast(updated_at DESC);

CREATE OR REPLACE FUNCTION atlas.refresh_ai_maille_features_fast()
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  n bigint;
BEGIN
  INSERT INTO atlas.ai_maille_features_fast (
    maille_id,
    maille_code,
    n_sondages,
    vbs_moyen,
    ip_moyen,
    gonflement_cg_moyen,
    dsm_altitude_mean,
    dsm_altitude_stddev,
    dsm_altitude_range,
    pct_in_lama,
    updated_at
  )
  SELECT
    m.id AS maille_id,
    m.code AS maille_code,
    COALESCE(COUNT(DISTINCT s.id), 0)::int AS n_sondages,
    AVG(ev.vbs)::float8 AS vbs_moyen,
    AVG(COALESCE(ea.ip_generated, (ea.wl - ea.wp)))::float8 AS ip_moyen,
    AVG(pg.cg)::float8 AS gonflement_cg_moyen,
    d.altitude_mean::float8 AS dsm_altitude_mean,
    d.altitude_stddev::float8 AS dsm_altitude_stddev,
    d.altitude_range::float8 AS dsm_altitude_range,
    MAX(CASE WHEN ze.code = 'DEPRESSION_LAMA_TG' THEN COALESCE(mze.pct_intersection, 0) ELSE 0 END)::float8 AS pct_in_lama,
    now() AS updated_at
  FROM atlas.mailles m
  LEFT JOIN atlas.sondages s ON s.maille_code = m.code AND s.deleted_at IS NULL
  LEFT JOIN atlas.echantillons e ON e.sondage_id = s.id
  LEFT JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id
  LEFT JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id
  LEFT JOIN atlas.essais_potentiel_gonflement pg ON pg.echantillon_id = e.id
  LEFT JOIN atlas.v_maille_dsm_2km_flat d ON d.id = m.id
  LEFT JOIN atlas.mailles_zones_etude mze ON mze.maille_id = m.id
  LEFT JOIN atlas.zones_etude ze ON ze.id = mze.zone_id
  GROUP BY
    m.id, m.code,
    d.altitude_mean, d.altitude_stddev, d.altitude_range;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- One-time initial refresh (idempotent; will upsert at next step)
-- We keep it as an explicit call in deployment scripts to avoid heavy work during migrations.

COMMIT;

