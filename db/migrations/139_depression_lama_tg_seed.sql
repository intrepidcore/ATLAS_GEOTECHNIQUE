BEGIN;

-- Dépression de la Lama (Togo) - zone d'étude
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
VALUES (
  'DEPRESSION_LAMA_TG',
  'Dépression de la Lama (Togo)',
  'Prolongement occidental de la zone sédimentaire béninoise. '
    'Zone de vertisols à argiles gonflantes actives (montmorillonite). '
    'Préfecture de Yoto, centrée sur Tabligbo.',
  'depression_geologique',
  ST_Transform(
    ST_GeomFromText(
      'MULTIPOLYGON(((
        1.20 6.30,
        1.55 6.30,
        1.65 6.45,
        1.60 6.60,
        1.45 6.75,
        1.30 6.75,
        1.15 6.60,
        1.15 6.45,
        1.20 6.30
      )))',
      4326
    ),
    25231
  ),
  'Vertisols (terres noires argileuses)',
  ARRAY['montmorillonite', 'kaolinite', 'illite'],
  'tres_fort',
  45.0,
  'FAO/ORSTOM — Études pédohydrologiques au Togo; IRD Horizon',
  'LAMOUROUX 1961; FAO SF:13/T0; EZI K.E. Elom (2022)',
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
  is_published = EXCLUDED.is_published;

-- Recalcul des mailles intersectant la zone (idempotence via delete ciblé)
SELECT atlas.recalc_mailles_zones_etude('DEPRESSION_LAMA_TG');

COMMIT;

