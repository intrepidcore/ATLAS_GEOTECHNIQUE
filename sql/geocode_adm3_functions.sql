-- ============================================================================
-- FONCTIONS GÉOCODAGE ADM3 - SPREAD + REAL
-- ============================================================================

-- 1) SPREAD : Diffusion sur tout l'ADM3 (geom=NULL, broadcast)
CREATE OR REPLACE FUNCTION geocode_adm3_spread(p_sondage uuid, p_adm3 text)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_mailles_count int;
BEGIN
  -- Sauvegarder l'ancienne géométrie si elle existe
  UPDATE sondages
  SET geom_real = COALESCE(geom_real, geom)
  WHERE id = p_sondage AND geom IS NOT NULL;

  -- Mettre à jour le sondage en mode spread
  UPDATE sondages
  SET meta = jsonb_set(meta, '{adm3_code}', to_jsonb(p_adm3)),
      geom = NULL,
      loc_mode = 'spread',
      updated_at = now()
  WHERE id = p_sondage;

  -- Compter les mailles impactées
  SELECT COUNT(DISTINCT m.id) INTO v_mailles_count
  FROM mailles m
  JOIN mv_adm3_maille_map map ON map.maille_id = m.id
  WHERE map.adm3_code = p_adm3;

  -- Notification pour refresh asynchrone
  PERFORM pg_notify('atlas_refresh', p_adm3);

  RETURN jsonb_build_object(
    'ok', true,
    'mode', 'spread',
    'adm3_code', p_adm3,
    'mailles_impactees', v_mailles_count
  );
END$$;

-- 2) REAL : Centroïde ADM3 (geom≠NULL, pas de broadcast)
CREATE OR REPLACE FUNCTION geocode_adm3_real(p_sondage uuid, p_adm3 text)
RETURNS jsonb
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sondages s
  SET meta = jsonb_set(s.meta, '{adm3_code}', to_jsonb(p_adm3)),
      geom = ST_Transform(ST_Centroid(a.geom), 25231),
      geom_real = ST_Transform(ST_Centroid(a.geom), 25231),
      loc_mode = 'real',
      updated_at = now()
  FROM adm3 a
  WHERE s.id = p_sondage
    AND a.adm3_pcode = p_adm3;

  -- Notification pour refresh
  PERFORM pg_notify('atlas_refresh', p_adm3);

  RETURN jsonb_build_object(
    'ok', true,
    'mode', 'real',
    'adm3_code', p_adm3
  );
END$$;

-- 3) Fonction pour revenir en mode real depuis spread
CREATE OR REPLACE FUNCTION restore_geom_real(p_sondage uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sondages
  SET geom = geom_real,
      loc_mode = 'real',
      updated_at = now()
  WHERE id = p_sondage
    AND geom_real IS NOT NULL;

  RETURN jsonb_build_object('ok', true, 'restored', true);
END$$;

-- Vérifier
SELECT 'Fonctions créées avec succès' AS status;
