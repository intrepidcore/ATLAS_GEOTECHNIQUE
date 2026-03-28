BEGIN;

-- Zones géologiques / géotechniques (SRID Atlas: 25231)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS atlas.zones_etude (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  nom                 TEXT NOT NULL,
  description         TEXT,
  type_zone           TEXT NOT NULL CHECK (
    type_zone IN (
      'depression_geologique',
      'plaine_alluviale',
      'zone_argile_gonflante',
      'zone_hydromorph',
      'zone_risque_specifique'
    )
  ),
  -- MultiPolygon car une zone peut être composée de plusieurs polygones
  geom                geometry(MultiPolygon, 25231) NOT NULL,

  type_sol_principal TEXT,
  mineraux_argileux   TEXT[],
  risque_rga          TEXT CHECK (risque_rga IN ('faible', 'moyen', 'fort', 'tres_fort')),
  altitude_moyenne_m  NUMERIC(6,1),

  source_donnees      TEXT,
  reference_biblio    TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          UUID REFERENCES atlas.users(id),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  is_published        BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE atlas.zones_etude IS
  'Zones géologiques/géotechniques délimitées pour des études spécifiques (ex: Dépression de la Lama).';

CREATE INDEX IF NOT EXISTS idx_zones_etude_geom ON atlas.zones_etude USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_zones_etude_type ON atlas.zones_etude(type_zone);
CREATE INDEX IF NOT EXISTS idx_zones_etude_risque ON atlas.zones_etude(risque_rga);

-- Liaison mailles <-> zones (calculée)
CREATE TABLE IF NOT EXISTS atlas.mailles_zones_etude (
  maille_id            UUID NOT NULL REFERENCES atlas.mailles(id) ON DELETE CASCADE,
  zone_id              UUID NOT NULL REFERENCES atlas.zones_etude(id) ON DELETE CASCADE,

  pct_intersection     NUMERIC(5,2) NOT NULL CHECK (pct_intersection BETWEEN 0 AND 100),
  intersection_method TEXT DEFAULT 'ST_Intersects',

  priorite_recherche  INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN pct_intersection >= 75 THEN 1
      WHEN pct_intersection >= 50 THEN 2
      WHEN pct_intersection >= 25 THEN 3
      ELSE 4
    END
  ) STORED,

  calculated_at        TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (maille_id, zone_id)
);

CREATE INDEX IF NOT EXISTS idx_mzp_zone ON atlas.mailles_zones_etude(zone_id);
CREATE INDEX IF NOT EXISTS idx_mzp_priorite ON atlas.mailles_zones_etude(zone_id, priorite_recherche);

-- Recalcul / (ré)insertion idempotente pour une zone par code
CREATE OR REPLACE FUNCTION atlas.recalc_mailles_zones_etude(p_zone_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_zone_id UUID;
BEGIN
  SELECT id INTO v_zone_id
  FROM atlas.zones_etude
  WHERE code = p_zone_code;

  IF v_zone_id IS NULL THEN
    RAISE NOTICE 'recalc_mailles_zones_etude: zone % introuvable (skip)', p_zone_code;
    RETURN;
  END IF;

  -- Nettoyage ciblé (idempotence)
  DELETE FROM atlas.mailles_zones_etude mz
  WHERE mz.zone_id = v_zone_id;

  -- Recalcul intersections (seuil minimal 10% de la maille dans la zone)
  INSERT INTO atlas.mailles_zones_etude (maille_id, zone_id, pct_intersection)
  SELECT
    m.id AS maille_id,
    v_zone_id AS zone_id,
    ROUND(
      (ST_Area(ST_Intersection(m.geom, z.geom)) / NULLIF(ST_Area(m.geom), 0) * 100)::numeric,
      2
    ) AS pct_intersection
  FROM atlas.mailles m
  CROSS JOIN atlas.zones_etude z
  WHERE z.id = v_zone_id
    AND ST_Intersects(m.geom, z.geom)
    AND (ST_Area(ST_Intersection(m.geom, z.geom)) / NULLIF(ST_Area(m.geom), 0)) >= 0.10;
END;
$$;

-- Vue lecture pratique pour la Lama (filtres par code)
CREATE OR REPLACE VIEW atlas.v_mailles_lama AS
SELECT
  m.id,
  m.code,
  m.geom,
  mze.pct_intersection,
  mze.priorite_recherche,
  ze.nom AS zone_nom,
  ze.risque_rga,
  ze.type_sol_principal,

  -- Nombre de sondages (géométrie legacy ou fallback maille_code)
  (
    SELECT COUNT(DISTINCT s2.id)
    FROM atlas.sondages s2
    WHERE s2.deleted_at IS NULL
      AND (
        (s2.geom IS NOT NULL AND ST_Within(s2.geom, ST_Transform(m.geom, 4326)))
        OR
        (s2.geom IS NULL AND s2.maille_code = m.code)
      )
  ) AS nb_sondages,

  (
    -- Essais VBS via échantillons rattachés aux sondages ci-dessus
    SELECT COUNT(DISTINCT ev.id)
    FROM atlas.essais_vbs ev
    INNER JOIN atlas.echantillons e ON e.id = ev.echantillon_id
    INNER JOIN atlas.sondages s2 ON s2.id = e.sondage_id
    WHERE s2.deleted_at IS NULL
      AND (
        (s2.geom IS NOT NULL AND ST_Within(s2.geom, ST_Transform(m.geom, 4326)))
        OR
        (s2.geom IS NULL AND s2.maille_code = m.code)
      )
  ) AS nb_essais_vbs
FROM atlas.mailles m
JOIN atlas.mailles_zones_etude mze ON mze.maille_id = m.id
JOIN atlas.zones_etude ze ON ze.id = mze.zone_id
WHERE ze.code = 'DEPRESSION_LAMA_TG'
  AND ze.is_published = TRUE;

COMMIT;

