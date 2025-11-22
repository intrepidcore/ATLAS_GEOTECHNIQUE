-- Migration 035: Normaliser location_mode
-- Problème: Valeurs actuelles 'adm3' non documentées
-- Solution: Migrer vers 'adm3_centroid' et documenter les valeurs

-- Mettre à jour les valeurs existantes
UPDATE public.sondages
SET location_mode = 'adm3_centroid'
WHERE location_mode = 'adm3';

-- Commentaires sur les valeurs attendues
COMMENT ON COLUMN public.sondages.location_mode IS 
'Mode de localisation du sondage:
- unknown: Position inconnue (défaut)
- exact: Coordonnées GPS exactes
- adm3_centroid: Centroïde de la commune ADM3
- random: Position aléatoire dans la commune
- adm_random_cell: Position aléatoire legacy (ancien système)';

-- Vérifier les valeurs après migration
DO $$
DECLARE
  count_unknown INTEGER;
  count_exact INTEGER;
  count_adm3_centroid INTEGER;
  count_random INTEGER;
  count_other INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_unknown FROM public.sondages WHERE location_mode = 'unknown';
  SELECT COUNT(*) INTO count_exact FROM public.sondages WHERE location_mode = 'exact';
  SELECT COUNT(*) INTO count_adm3_centroid FROM public.sondages WHERE location_mode = 'adm3_centroid';
  SELECT COUNT(*) INTO count_random FROM public.sondages WHERE location_mode IN ('random', 'adm_random_cell');
  SELECT COUNT(*) INTO count_other FROM public.sondages WHERE location_mode NOT IN ('unknown', 'exact', 'adm3_centroid', 'random', 'adm_random_cell') AND location_mode IS NOT NULL;
  
  RAISE NOTICE 'Répartition location_mode:';
  RAISE NOTICE '  - unknown: %', count_unknown;
  RAISE NOTICE '  - exact: %', count_exact;
  RAISE NOTICE '  - adm3_centroid: %', count_adm3_centroid;
  RAISE NOTICE '  - random/adm_random_cell: %', count_random;
  RAISE NOTICE '  - autres: %', count_other;
  
  IF count_other > 0 THEN
    RAISE WARNING 'Il reste % sondages avec des valeurs location_mode non standard', count_other;
  END IF;
END $$;
