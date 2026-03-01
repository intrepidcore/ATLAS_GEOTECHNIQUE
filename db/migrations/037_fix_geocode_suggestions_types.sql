-- Migration pour corriger les types de données dans geocode_suggestions
-- Convertir top_score de text vers numeric

BEGIN;

-- 1. Ajouter une nouvelle colonne temporaire avec le bon type
ALTER TABLE public.geocode_suggestions 
ADD COLUMN top_score_numeric NUMERIC(5,2);

-- 2. Convertir les valeurs existantes (gérer les cas NULL et invalides)
UPDATE public.geocode_suggestions 
SET top_score_numeric = CASE 
    WHEN top_score IS NULL OR top_score = '' THEN NULL
    WHEN top_score ~ '^[0-9]+\.?[0-9]*$' THEN top_score::numeric
    ELSE NULL
END;

-- 3. Supprimer l'ancienne colonne
ALTER TABLE public.geocode_suggestions DROP COLUMN top_score;

-- 4. Renommer la nouvelle colonne
ALTER TABLE public.geocode_suggestions RENAME COLUMN top_score_numeric TO top_score;

-- 5. Ajouter un index sur top_score pour les performances
CREATE INDEX idx_geocode_suggestions_top_score ON public.geocode_suggestions(top_score) WHERE top_score IS NOT NULL;

-- 6. Ajouter un index composite pour les requêtes d'auto-géocodage
CREATE INDEX idx_geocode_suggestions_auto_geocode 
ON public.geocode_suggestions(status, top_score DESC, entity_id) 
WHERE status = 'pending' AND top_score IS NOT NULL;

COMMIT;
