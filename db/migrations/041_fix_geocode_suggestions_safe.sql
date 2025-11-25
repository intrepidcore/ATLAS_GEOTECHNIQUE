-- Migration sûre pour corriger seulement les types essentiels

BEGIN;

-- 1. Corriger entity_id pour être UUID (seulement ceux qui sont valides)
ALTER TABLE public.geocode_suggestions ADD COLUMN entity_id_uuid UUID;

UPDATE public.geocode_suggestions 
SET entity_id_uuid = entity_id::uuid 
WHERE entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

ALTER TABLE public.geocode_suggestions DROP COLUMN entity_id;
ALTER TABLE public.geocode_suggestions RENAME COLUMN entity_id_uuid TO entity_id;

-- 2. Ajouter des colonnes avec les bons types pour les timestamps
ALTER TABLE public.geocode_suggestions ADD COLUMN created_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.geocode_suggestions ADD COLUMN decided_at_ts TIMESTAMPTZ;

-- 3. Créer les index essentiels
CREATE INDEX idx_geocode_suggestions_entity_id ON public.geocode_suggestions(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_geocode_suggestions_status ON public.geocode_suggestions(status);
CREATE INDEX idx_geocode_suggestions_top_score ON public.geocode_suggestions(top_score DESC) WHERE top_score IS NOT NULL;
CREATE INDEX idx_geocode_suggestions_auto_geocode 
ON public.geocode_suggestions(status, top_score DESC, entity_id) 
WHERE status = 'pending' AND top_score IS NOT NULL AND entity_id IS NOT NULL;

COMMIT;
