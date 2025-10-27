-- Nettoyage complet pour ré-import propre

-- Supprimer les données (CASCADE supprime aussi échantillons, essais, etc.)
TRUNCATE TABLE sondages CASCADE;
TRUNCATE TABLE raw_lab_agt CASCADE;
TRUNCATE TABLE raw_lab_ags CASCADE;
TRUNCATE TABLE raw_lab_atterberg CASCADE;

SELECT 'Base nettoyée - prête pour ré-import' AS status;
