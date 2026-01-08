-- Migration 102: Ajouter code lisible pour mailles 28km
-- Objectif: Remplacer codes numériques (ex: "30") par codes techniques (ex: "TG-28KM-030")
-- Règle: [DATA-02] Codes mailles cohérents et stables

BEGIN;

-- Ajouter colonne code_lisible si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'atlas' 
    AND table_name = 'maille_28km' 
    AND column_name = 'code_lisible'
  ) THEN
    ALTER TABLE atlas.maille_28km ADD COLUMN code_lisible TEXT;
    RAISE NOTICE 'Colonne code_lisible ajoutée à maille_28km';
  END IF;
END $$;

-- Générer codes lisibles au format TG-28KM-XXX
UPDATE atlas.maille_28km
SET code_lisible = 'TG-28KM-' || LPAD(code_m28::text, 3, '0')
WHERE code_lisible IS NULL OR code_lisible = '';

-- Créer index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_maille_28km_code_lisible 
ON atlas.maille_28km(code_lisible);

-- Mettre à jour la vue de couverture pour exposer le code lisible
CREATE OR REPLACE VIEW atlas.v_coverage_mailles_28km AS
SELECT 
  m28.id_m28,
  m28.code_m28,
  m28.code_lisible,
  m28.profil_num,
  m28.geom,
  COALESCE(COUNT(DISTINCT s.id), 0) AS n_sondages,
  COALESCE(COUNT(DISTINCT s.id) FILTER (WHERE s.location_mode IN ('exact', 'gps', 'manual')), 0) AS n_sondages_exact,
  COALESCE(COUNT(DISTINCT s.id) FILTER (WHERE s.location_mode IN ('adm_random_cell', 'adm3', 'adm2', 'adm1', 'random')), 0) AS n_sondages_random,
  COALESCE(COUNT(DISTINCT e.id), 0) AS n_echantillons,
  0 AS n_essais,
  COALESCE(COUNT(DISTINCT m2.code), 0) AS n_mailles_2km,
  COALESCE(COUNT(DISTINCT m2.code) FILTER (WHERE EXISTS (SELECT 1 FROM atlas.sondages s2 WHERE s2.grid_code = m2.code)), 0) AS n_mailles_2km_with_data
FROM atlas.maille_28km m28
LEFT JOIN atlas.sondages s ON s.id_m28 = m28.id_m28
LEFT JOIN atlas.echantillons e ON e.sondage_id = s.id
LEFT JOIN atlas.mailles m2 ON m2.id_m28 = m28.id_m28
GROUP BY m28.id_m28, m28.code_m28, m28.code_lisible, m28.profil_num, m28.geom;

COMMENT ON VIEW atlas.v_coverage_mailles_28km IS 
  'Vue de couverture mailles 28km avec compteurs exact/random et code lisible. '
  'Utilisée par l''API pour affichage carte et recherche.';

DO $$
BEGIN
  RAISE NOTICE 'Migration 102: Codes lisibles 28km générés avec succès';
END $$;

COMMIT;
