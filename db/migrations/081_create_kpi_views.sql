-- ============================================================================
-- Migration 081: KPI Mailles 28km et Boundary
-- Description:
--   1. Création et population de atlas.boundary_togo (SRID 25231)
--   2. Création de la vue atlas.v_maille_28km_kpi
--   3. Création de la vue atlas.v_maille_28km_map (légère pour l'affichage)
-- ============================================================================

BEGIN;

-- 1. Table boundary_togo
-- ======================
CREATE TABLE IF NOT EXISTS atlas.boundary_togo (
    id smallint PRIMARY KEY DEFAULT 1,
    geom geometry(MultiPolygon, 25231) NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT boundary_togo_srid_chk CHECK (ST_SRID(geom) = 25231)
);

-- Nettoyage et insertion depuis public.adm0_raw (en transformant 4326 -> 25231)
TRUNCATE atlas.boundary_togo;

INSERT INTO atlas.boundary_togo (id, geom)
SELECT 
    1,
    ST_Multi(ST_MakeValid(ST_Transform(geom, 25231)))
FROM public.adm0_raw
LIMIT 1;

CREATE INDEX IF NOT EXISTS boundary_togo_geom_idx ON atlas.boundary_togo USING GIST (geom);

COMMENT ON TABLE atlas.boundary_togo IS 'Frontière nationale du Togo normalisée (SRID 25231)';


-- 2. Vue KPI Maille 28km
-- ======================
CREATE OR REPLACE VIEW atlas.v_maille_28km_kpi AS
WITH
-- Rattachement des sondages à une maille 28 km
sond_m28 AS (
    SELECT
        s.id AS id_sondage, -- Attention: id dans sondages est uuid 'id', pas 'id_sondage'
        COALESCE(m2.id_m28, m28.id_m28) AS id_m28
    FROM atlas.sondages s
    LEFT JOIN atlas.mailles m2
           ON s.grid_code = m2.code -- Lien via grid_code pour les mailles 2km
    LEFT JOIN atlas.maille_28km m28
           ON m2.id_m28 IS NULL -- Si pas de lien via maille 2km, on cherche spatialement
          AND s.geom IS NOT NULL 
          AND ST_Intersects(ST_Transform(s.geom, 25231), m28.geom)
    WHERE COALESCE(m2.id_m28, m28.id_m28) IS NOT NULL
),

-- Observations géotechniques
obs AS (
    SELECT
        sm28.id_m28,
        sm28.id_sondage,
        eg.ip,
        eg.vbs,
        eg.eg
    FROM sond_m28 sm28
    LEFT JOIN atlas.essais_geotechniques eg -- Utilisation de la vue consolidée existante
           ON eg.sondage_id = sm28.id_sondage
)

SELECT
    m28.id_m28,
    m28.code_m28,
    m28.profil_num,
    m28.pk_min_km,
    m28.pk_max_km,

    -- géométrie (en 25231)
    m28.geom,

    -- surface utile (km2)
    ST_Area(m28.geom) / 1000000.0 AS area_km2,

    -- comptages
    COUNT(DISTINCT obs.id_sondage) AS n_sondages,
    COUNT(*) FILTER (WHERE obs.ip  IS NOT NULL) AS n_ip,
    COUNT(*) FILTER (WHERE obs.vbs IS NOT NULL) AS n_vbs,
    COUNT(*) FILTER (WHERE obs.eg  IS NOT NULL) AS n_eg,

    -- moyennes
    AVG(obs.ip)  FILTER (WHERE obs.ip  IS NOT NULL) AS ip_avg,
    AVG(obs.vbs) FILTER (WHERE obs.vbs IS NOT NULL) AS vbs_avg,
    AVG(obs.eg)  FILTER (WHERE obs.eg  IS NOT NULL) AS eg_avg,

    -- stats robustes
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY obs.ip)
        FILTER (WHERE obs.ip IS NOT NULL) AS ip_median,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY obs.ip)
        FILTER (WHERE obs.ip IS NOT NULL) AS ip_p25,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY obs.ip)
        FILTER (WHERE obs.ip IS NOT NULL) AS ip_p75,

    -- % plastiques (IP >= 17)
    CASE
      WHEN COUNT(*) FILTER (WHERE obs.ip IS NOT NULL) = 0 THEN NULL
      ELSE 100.0
           * COUNT(*) FILTER (WHERE obs.ip IS NOT NULL AND obs.ip >= 17)
           / COUNT(*) FILTER (WHERE obs.ip IS NOT NULL)
    END AS pct_plastiques_ip17,
    
    -- % moyen/fort gonflement (EG >= 0.05 par exemple, à ajuster selon règles métier, ici on prend juste une stats ex: EG >= 2)
    -- On va plutôt mettre la dispo data
    CASE 
        WHEN COUNT(DISTINCT obs.id_sondage) > 0 THEN true 
        ELSE false 
    END as has_data,

    -- densité de sondages
    CASE
      WHEN ST_Area(m28.geom) = 0 THEN NULL
      ELSE COUNT(DISTINCT obs.id_sondage) / (ST_Area(m28.geom) / 1000000.0)
    END AS sondages_per_km2

FROM atlas.maille_28km m28
LEFT JOIN obs ON obs.id_m28 = m28.id_m28
GROUP BY
    m28.id_m28, m28.code_m28, m28.profil_num, m28.pk_min_km, m28.pk_max_km, m28.geom;

COMMENT ON VIEW atlas.v_maille_28km_kpi IS 'Vue KPI agrégée par maille 28km';


-- 3. Vue Map 28km (Display only)
-- ==============================
CREATE OR REPLACE VIEW atlas.v_maille_28km_map AS
SELECT
  id_m28,
  code_m28,
  profil_num,
  pk_min_km,
  pk_max_km,
  geom -- 25231
FROM atlas.maille_28km;

COMMENT ON VIEW atlas.v_maille_28km_map IS 'Vue légère pour l''affichage des mailles 28km';

COMMIT;
