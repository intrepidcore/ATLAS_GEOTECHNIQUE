BEGIN;

-- Bloc A — Cinq zones d’étude publiées : correction Fosse (nord Togo), Bado, Plaine du Mono.
-- Emprises WGS84 → 25231 (même convention que 139/140). À affiner avec SIG officiel.

-- 1) Fosse aux Lions : emprise cohérente avec l’extrême nord (~10°45′–10°48′ N, 0°10′–0°15′ E)
UPDATE atlas.zones_etude
SET
  nom = 'Dépression de la Fosse aux Lions (Extrême Nord)',
  description = 'Cuvette topographique au pied des monts de Bombouaka (région des Savanes). Emprise seed — affiner par SIG.',
  geom = ST_Transform(
    ST_GeomFromText(
      'MULTIPOLYGON(((0.10 10.72, 0.22 10.72, 0.22 10.82, 0.12 10.80, 0.10 10.72)))',
      4326
    ),
    25231
  ),
  type_zone = 'depression_geologique',
  type_sol_principal = 'Sols argileux de cuvette, vertisols (approx.)',
  mineraux_argileux = ARRAY['montmorillonite']::text[],
  risque_rga = 'tres_fort',
  source_donnees = 'Seed Atlas (emprise nord) — affiner IRD/FAO',
  updated_at = NOW()
WHERE code = 'FOSSE_LIONS_TG';

-- 2) Dépression du Bado (Bas-Togo / Maritime)
INSERT INTO atlas.zones_etude (
  code, nom, description, type_zone, geom,
  type_sol_principal, mineraux_argileux, risque_rga,
  source_donnees, is_published
)
VALUES (
  'DEPRESSION_BADO_TG',
  'Dépression du Bado (Bas-Togo)',
  'Zone sédimentaire du sud (terres noires, vertisols). Emprise seed — affiner.',
  'depression_geologique',
  ST_Transform(
    ST_GeomFromText(
      'MULTIPOLYGON(((1.12 6.30, 1.42 6.28, 1.45 6.42, 1.38 6.55, 1.22 6.58, 1.10 6.48, 1.12 6.30)))',
      4326
    ),
    25231
  ),
  'Vertisols hydromorphes (terres noires)',
  ARRAY['montmorillonite', 'kaolinite']::text[],
  'fort',
  'Seed Atlas (Bas-Togo) — affiner',
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
  source_donnees = EXCLUDED.source_donnees,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();

-- 3) Plaine du Mono (Moyen-Mono / Plateaux)
INSERT INTO atlas.zones_etude (
  code, nom, description, type_zone, geom,
  type_sol_principal, mineraux_argileux, risque_rga,
  source_donnees, is_published
)
VALUES (
  'PLAINE_MONO_TG',
  'Plaine du Mono (Est)',
  'Plaines de débordement du fleuve Mono. Emprise seed — affiner.',
  'plaine_alluviale',
  ST_Transform(
    ST_GeomFromText(
      'MULTIPOLYGON(((1.28 6.80, 1.55 6.78, 1.58 6.95, 1.52 7.12, 1.35 7.15, 1.22 7.05, 1.20 6.90, 1.28 6.80)))',
      4326
    ),
    25231
  ),
  'Sols alluviaux hydromorphes, vertisols (approx.)',
  ARRAY['montmorillonite', 'smectite']::text[],
  'fort',
  'Seed Atlas (Mono) — affiner',
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
  source_donnees = EXCLUDED.source_donnees,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();

-- Recalcul mailles pour toutes les zones touchées
SELECT atlas.recalc_mailles_zones_etude('FOSSE_LIONS_TG');
SELECT atlas.recalc_mailles_zones_etude('DEPRESSION_BADO_TG');
SELECT atlas.recalc_mailles_zones_etude('PLAINE_MONO_TG');
SELECT atlas.recalc_mailles_zones_etude('PLAINE_OTI_TG');
SELECT atlas.recalc_mailles_zones_etude('DEPRESSION_LAMA_TG');

COMMIT;
