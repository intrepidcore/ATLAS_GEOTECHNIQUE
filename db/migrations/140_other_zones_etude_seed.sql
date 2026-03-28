BEGIN;

-- Zones d'étude additionnelles (géométries approximatives à affiner).
-- Objectif: démontrer la généricité du modèle zones_etude et activer l’UI/UX.
-- SRID: import WGS84 (4326) transformé en EPSG:25231 (SRID interne Atlas)

INSERT INTO atlas.zones_etude (
  code,
  nom,
  description,
  type_zone,
  geom,
  type_sol_principal,
  mineraux_argileux,
  risque_rga,
  altitude_moyenne_m,
  source_donnees,
  reference_biblio,
  is_published
)
VALUES
(
  'PLAINE_OTI_TG',
  'Plaine de l''Oti (Togo)',
  'Zone d''étude générique (seed) — emprise approximative à affiner. Utilisée pour tester le pipeline zones_etude.',
  'plaine_alluviale',
  ST_Transform(
    ST_GeomFromText(
      'MULTIPOLYGON(((0.60 10.80, 1.20 10.80, 1.20 10.10, 0.60 10.10, 0.60 10.80)))',
      4326
    ),
    25231
  ),
  'Alluvions / sols hydromorphes (approx.)',
  ARRAY['kaolinite']::text[],
  'moyen',
  NULL,
  'Seed Atlas (à affiner)',
  NULL,
  TRUE
),
(
  'FOSSE_LIONS_TG',
  'Fosse aux Lions (Togo)',
  'Zone d''étude générique (seed) — emprise approximative à affiner. Utilisée pour tester le pipeline zones_etude.',
  'zone_risque_specifique',
  ST_Transform(
    ST_GeomFromText(
      'MULTIPOLYGON(((0.10 8.60, 0.70 8.60, 0.70 8.10, 0.10 8.10, 0.10 8.60)))',
      4326
    ),
    25231
  ),
  NULL,
  NULL,
  'fort',
  NULL,
  'Seed Atlas (à affiner)',
  NULL,
  TRUE
)
ON CONFLICT (code) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description,
  type_zone = EXCLUDED.type_zone,
  geom = EXCLUDED.geom,
  type_sol_principal = EXCLUDED.type_sol_principal,
  mineraux_argileux = EXCLUDED.mineraux_argileux,
  risque_rga = EXCLUDED.risque_rga,
  altitude_moyenne_m = EXCLUDED.altitude_moyenne_m,
  source_donnees = EXCLUDED.source_donnees,
  reference_biblio = EXCLUDED.reference_biblio,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();

-- Recalculer les mailles de ces zones (idempotent)
SELECT atlas.recalc_mailles_zones_etude('PLAINE_OTI_TG');
SELECT atlas.recalc_mailles_zones_etude('FOSSE_LIONS_TG');

COMMIT;

