-- 017_view_samples_v4.sql
-- Vue unifiée pour l'endpoint /cells/{code}/complete (physiques + classif)

DROP VIEW IF EXISTS v_samples_complete_v4;

CREATE VIEW v_samples_complete_v4 AS
SELECT
  eg.id                                   AS essai_id,
  s.id                                    AS sondage_id,
  s.code                                  AS code_site,
  s.source                                AS source,
  s.location_mode                         AS location_mode,
  s.grid_code                             AS grid_code,
  eg.depth_m,
  eg.wl, eg.wp, (eg.wl - eg.wp) AS ip,    -- IP calculé (si pas colonne générée)
  eg.vbs,
  -- physiques (densité, teneur eau)
  jsonb_strip_nulls(
    jsonb_build_object(
      'densite_absolue_gcm3', ep.densite_absolue_gcm3,
      'teneur_eau_pct',        ep.teneur_eau_pct,
      'source',                ep.source
    )
  ) AS physiques,
  -- classif agrégée (AASHTO / USCS / GTR)
  (
    SELECT jsonb_strip_nulls(
      jsonb_build_object(
        'aashto', (
          SELECT jsonb_agg(jsonb_build_object('class', ec1.classe, 'reason', ec1.reason))
          FROM essais_classif ec1
          WHERE ec1.essai_id = eg.id AND ec1.systeme = 'AASHTO'
        ),
        'uscs', (
          SELECT jsonb_agg(jsonb_build_object('class', ec2.classe, 'reason', ec2.reason))
          FROM essais_classif ec2
          WHERE ec2.essai_id = eg.id AND ec2.systeme = 'USCS'
        ),
        'gtr', (
          SELECT jsonb_agg(jsonb_build_object('class', ec3.classe, 'reason', ec3.reason))
          FROM essais_classif ec3
          WHERE ec3.essai_id = eg.id AND ec3.systeme = 'GTR'
        )
      )
    )
  ) AS classif
FROM essais_geotechniques eg
JOIN sondages s            ON s.id         = eg.sondage_id
LEFT JOIN essais_physiques ep ON ep.essai_id = eg.id;
