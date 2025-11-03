-- ============================================================================
-- ENRICHISSEMENT RÉFÉRENTIEL ADM3
-- ============================================================================
-- À exécuter après validation manuelle des suggestions

-- Exemple : Ajouter des synonymes validés
-- (À adapter selon les validations réelles)

-- Tekpo → Tchekpo (si validé)
INSERT INTO adm3_synonyms(alias_norm, adm3_code) VALUES
('tekpo', 'TG030709')
ON CONFLICT (alias_norm) DO UPDATE SET adm3_code = EXCLUDED.adm3_code;

-- Konsogou T1 → Koumongou (si validé)
-- INSERT INTO adm3_synonyms(alias_norm, adm3_code) VALUES
-- ('konsogou t1', 'TG051902')
-- ON CONFLICT (alias_norm) DO UPDATE SET adm3_code = EXCLUDED.adm3_code;

-- Konsogou T2 → Koutougou (si validé)
-- INSERT INTO adm3_synonyms(alias_norm, adm3_code) VALUES
-- ('konsogou t2', 'TG020605')
-- ON CONFLICT (alias_norm) DO UPDATE SET adm3_code = EXCLUDED.adm3_code;

-- Refresh la vue
REFRESH MATERIALIZED VIEW adm3_names;

-- Vérifier
SELECT * FROM adm3_synonyms ORDER BY alias_norm;

-- Statistiques
SELECT 
  COUNT(*) AS total_synonyms,
  COUNT(DISTINCT adm3_code) AS distinct_adm3
FROM adm3_synonyms;
