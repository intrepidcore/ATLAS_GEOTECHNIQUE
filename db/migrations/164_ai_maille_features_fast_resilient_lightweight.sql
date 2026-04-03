BEGIN;

ALTER TABLE atlas.ai_maille_features_fast
  ADD COLUMN IF NOT EXISTS feature_version smallint NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_maille_features_fast_feature_version_ck'
  ) THEN
    ALTER TABLE atlas.ai_maille_features_fast
      ADD CONSTRAINT ai_maille_features_fast_feature_version_ck
      CHECK (feature_version IN (1, 2));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION atlas.refresh_ai_maille_features_fast_lightweight_for_code(p_code text)
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
    feature_version,
    updated_at
  )
  SELECT
    m.id AS maille_id,
    m.code AS maille_code,
    COALESCE((
      SELECT COUNT(DISTINCT s.id)::int
      FROM atlas.sondages s
      WHERE s.deleted_at IS NULL AND s.maille_code = m.code
    ), 0) AS n_sondages,
    (
      SELECT AVG(ev.vbs)::float8
      FROM atlas.sondages s
      JOIN atlas.echantillons e ON e.sondage_id = s.id
      JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id
      WHERE s.deleted_at IS NULL AND s.maille_code = m.code
    ) AS vbs_moyen,
    (
      SELECT AVG(COALESCE(ea.ip_generated, (ea.wl - ea.wp)))::float8
      FROM atlas.sondages s
      JOIN atlas.echantillons e ON e.sondage_id = s.id
      JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id
      WHERE s.deleted_at IS NULL AND s.maille_code = m.code
    ) AS ip_moyen,
    (
      SELECT AVG(pg.cg)::float8
      FROM atlas.sondages s
      JOIN atlas.echantillons e ON e.sondage_id = s.id
      JOIN atlas.essais_potentiel_gonflement pg ON pg.echantillon_id = e.id
      WHERE s.deleted_at IS NULL AND s.maille_code = m.code
    ) AS gonflement_cg_moyen,
    NULL::float8 AS dsm_altitude_mean,
    NULL::float8 AS dsm_altitude_stddev,
    NULL::float8 AS dsm_altitude_range,
    COALESCE((
      SELECT MAX(mz.pct_intersection)::float8
      FROM atlas.mailles_zones_etude mz
      JOIN atlas.zones_etude ze ON ze.id = mz.zone_id
      WHERE mz.maille_id = m.id
        AND ze.is_published = true
    ), 0)::float8 AS pct_in_lama,
    1::smallint AS feature_version,
    now() AS updated_at
  FROM atlas.mailles m
  WHERE m.code = p_code
  ON CONFLICT (maille_id) DO UPDATE SET
    maille_code = EXCLUDED.maille_code,
    n_sondages = EXCLUDED.n_sondages,
    vbs_moyen = EXCLUDED.vbs_moyen,
    ip_moyen = EXCLUDED.ip_moyen,
    gonflement_cg_moyen = EXCLUDED.gonflement_cg_moyen,
    -- Lightweight mode keeps DSM values untouched if already computed by full mode.
    dsm_altitude_mean = COALESCE(atlas.ai_maille_features_fast.dsm_altitude_mean, EXCLUDED.dsm_altitude_mean),
    dsm_altitude_stddev = COALESCE(atlas.ai_maille_features_fast.dsm_altitude_stddev, EXCLUDED.dsm_altitude_stddev),
    dsm_altitude_range = COALESCE(atlas.ai_maille_features_fast.dsm_altitude_range, EXCLUDED.dsm_altitude_range),
    pct_in_lama = EXCLUDED.pct_in_lama,
    feature_version = LEAST(atlas.ai_maille_features_fast.feature_version, EXCLUDED.feature_version),
    updated_at = now();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION atlas.refresh_ai_maille_features_fast_lightweight_for_codes(codes text[])
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  n bigint;
  c text;
BEGIN
  n := 0;
  FOREACH c IN ARRAY codes LOOP
    IF c IS NOT NULL AND length(trim(c)) > 0 THEN
      n := n + atlas.refresh_ai_maille_features_fast_lightweight_for_code(c);
    END IF;
  END LOOP;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION atlas.refresh_ai_maille_features_fast_resilient_for_codes(
  codes text[],
  mode text DEFAULT 'auto'
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  n bigint;
  c text;
  m text;
BEGIN
  n := 0;
  m := lower(COALESCE(mode, 'auto'));

  FOREACH c IN ARRAY codes LOOP
    IF c IS NULL OR length(trim(c)) = 0 THEN
      CONTINUE;
    END IF;

    IF m = 'lightweight' THEN
      n := n + atlas.refresh_ai_maille_features_fast_lightweight_for_code(c);
    ELSIF m = 'full' THEN
      n := n + atlas.refresh_ai_maille_features_fast_for_code(c);
    ELSE
      BEGIN
        n := n + atlas.refresh_ai_maille_features_fast_for_code(c);
      EXCEPTION
        WHEN OTHERS THEN
          n := n + atlas.refresh_ai_maille_features_fast_lightweight_for_code(c);
      END;
    END IF;
  END LOOP;
  RETURN n;
END;
$$;

COMMIT;
