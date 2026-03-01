-- Migration 101: Vue mailles 28km clipées à la frontière ADM0
-- Objectif: Éviter les rectangles qui dépassent au Bénin/Ghana
-- Règle: [DB-12] Ne pas modifier la table de base, créer une vue

BEGIN;

-- Créer vue clipée des mailles 28km à la frontière du Togo
CREATE OR REPLACE VIEW atlas.v_mailles_28km_clip AS
SELECT 
  m28.id_m28,
  m28.code_m28,
  m28.profil_num,
  m28.pk_min_km,
  m28.pk_max_km,
  -- Clipper la géométrie à la frontière du Togo
  ST_Intersection(m28.geom, bt.geom) AS geom
FROM atlas.maille_28km m28
CROSS JOIN atlas.boundary_togo bt
WHERE ST_Intersects(m28.geom, bt.geom);

COMMENT ON VIEW atlas.v_mailles_28km_clip IS 
  'Vue des mailles 28km clipées à la frontière ADM0 du Togo. '
  'Évite les rectangles qui dépassent aux pays voisins. '
  'Utilisée par l''API pour l''affichage carte.';

DO $$
BEGIN
  RAISE NOTICE 'Migration 101: Vue v_mailles_28km_clip créée avec succès';
END $$;

COMMIT;
