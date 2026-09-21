-- Activer l'extension pg_trgm pour la fonction similarity()
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Vérifier que la fonction similarity() fonctionne
SELECT similarity('Bassar', 'Bassa');
SELECT similarity('Komah', 'Koma');
