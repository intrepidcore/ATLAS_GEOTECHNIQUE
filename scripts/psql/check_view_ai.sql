-- Ajouter les colonnes RK à v_thematic_ai_geotech
-- Cette vue est utilisée par l'API thematic pour lire les params AI

-- Vérifier la vue existante
SELECT definition FROM pg_views WHERE viewname = 'v_thematic_ai_geotech';