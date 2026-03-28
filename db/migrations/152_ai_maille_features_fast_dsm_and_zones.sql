BEGIN;

-- Bloc C — Feature store rapide : DSM = cache matérialisé en priorité (évite vue lourde).
-- pct_in_lama (colonne conservée) = MAX(pct_intersection) sur les zones d’étude publiées listées.

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
    COALESCE(dc.altitude_mean, d.altitude_mean)::float8 AS dsm_altitude_mean,
    COALESCE(dc.altitude_stddev, d.altitude_stddev)::float8 AS dsm_altitude_stddev,
    COALESCE(dc.altitude_range, d.altitude_range)::float8 AS dsm_altitude_range,
    COALESCE(MAX(mze.pct_intersection) FILTER (
      WHERE ze.is_published = true
        AND ze.code IN (
          'DEPRESSION_LAMA_TG',
          'DEPRESSION_BADO_TG',
          'PLAINE_MONO_TG',
          'PLAINE_OTI_TG',
          'FOSSE_LIONS_TG'
        )
    ), 0)::float8 AS pct_in_lama,
    now() AS updated_at
  FROM atlas.mailles m
  LEFT JOIN atlas.sondages s ON s.maille_code = m.code AND s.deleted_at IS NULL
  LEFT JOIN atlas.echantillons e ON e.sondage_id = s.id
  LEFT JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id
  LEFT JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id
  LEFT JOIN atlas.essais_potentiel_gonflement pg ON pg.echantillon_id = e.id
  LEFT JOIN atlas.dsm_maille_flat_cache dc ON dc.id = m.id
  LEFT JOIN atlas.v_maille_dsm_2km_flat d ON d.id = m.id
  LEFT JOIN atlas.mailles_zones_etude mze ON mze.maille_id = m.id
  LEFT JOIN atlas.zones_etude ze ON ze.id = mze.zone_id
  GROUP BY
    m.id, m.code,
    dc.altitude_mean, dc.altitude_stddev, dc.altitude_range,
    d.altitude_mean, d.altitude_stddev, d.altitude_range
  ON CONFLICT (maille_id) DO UPDATE SET
    maille_code = EXCLUDED.maille_code,
    n_sondages = EXCLUDED.n_sondages,
    vbs_moyen = EXCLUDED.vbs_moyen,
    ip_moyen = EXCLUDED.ip_moyen,
    gonflement_cg_moyen = EXCLUDED.gonflement_cg_moyen,
    dsm_altitude_mean = EXCLUDED.dsm_altitude_mean,
    dsm_altitude_stddev = EXCLUDED.dsm_altitude_stddev,
    dsm_altitude_range = EXCLUDED.dsm_altitude_range,
    pct_in_lama = EXCLUDED.pct_in_lama,
    updated_at = now();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION atlas.refresh_ai_maille_features_fast_for_code(p_code text)
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
    COALESCE(dc.altitude_mean, d.altitude_mean)::float8 AS dsm_altitude_mean,
    COALESCE(dc.altitude_stddev, d.altitude_stddev)::float8 AS dsm_altitude_stddev,
    COALESCE(dc.altitude_range, d.altitude_range)::float8 AS dsm_altitude_range,
    COALESCE((
      SELECT MAX(mz.pct_intersection)::float8
      FROM atlas.mailles_zones_etude mz
      JOIN atlas.zones_etude ze ON ze.id = mz.zone_id
      WHERE mz.maille_id = m.id
        AND ze.is_published = true
        AND ze.code IN (
          'DEPRESSION_LAMA_TG',
          'DEPRESSION_BADO_TG',
          'PLAINE_MONO_TG',
          'PLAINE_OTI_TG',
          'FOSSE_LIONS_TG'
        )
    ), 0)::float8 AS pct_in_lama,
    now() AS updated_at
  FROM atlas.mailles m
  LEFT JOIN atlas.dsm_maille_flat_cache dc ON dc.id = m.id
  LEFT JOIN atlas.v_maille_dsm_2km_flat d ON d.id = m.id
  WHERE m.code = p_code
  ON CONFLICT (maille_id) DO UPDATE SET
    maille_code = EXCLUDED.maille_code,
    n_sondages = EXCLUDED.n_sondages,
    vbs_moyen = EXCLUDED.vbs_moyen,
    ip_moyen = EXCLUDED.ip_moyen,
    gonflement_cg_moyen = EXCLUDED.gonflement_cg_moyen,
    dsm_altitude_mean = EXCLUDED.dsm_altitude_mean,
    dsm_altitude_stddev = EXCLUDED.dsm_altitude_stddev,
    dsm_altitude_range = EXCLUDED.dsm_altitude_range,
    pct_in_lama = EXCLUDED.pct_in_lama,
    updated_at = now();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMIT;
