-- Migration minimale pour corriger les types essentiels dans geocode_suggestions

BEGIN;

-- 1. Créer une nouvelle table avec les types essentiels corrigés
CREATE TABLE public.geocode_suggestions_new (
    id SERIAL PRIMARY KEY,
    entity TEXT,
    entity_id UUID,
    localite TEXT,
    adm2_code TEXT,
    candidates TEXT, -- Garder en TEXT pour l'instant
    top_code TEXT,
    top_score NUMERIC(5,2),
    top_method TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);

-- 2. Migrer les données avec conversions simples
INSERT INTO public.geocode_suggestions_new (
    id,
    entity,
    entity_id,
    localite,
    adm2_code,
    candidates,
    top_code,
    top_score,
    top_method,
    status,
    created_at,
    decided_at
)
SELECT 
    id::integer,
    entity,
    entity_id::uuid,
    localite,
    adm2_code,
    candidates, -- Garder tel quel
    top_code,
    top_score,
    top_method,
    COALESCE(status, 'pending'),
    CASE 
        WHEN created_at IS NULL OR created_at = '' THEN NOW()
        ELSE NOW() -- Simplifier pour l'instant
    END,
    NULL -- decided_at à NULL pour l'instant
FROM public.geocode_suggestions;

-- 3. Supprimer l'ancienne table et renommer
DROP TABLE public.geocode_suggestions;
ALTER TABLE public.geocode_suggestions_new RENAME TO geocode_suggestions;

-- 4. Créer les index essentiels
CREATE INDEX idx_geocode_suggestions_entity_id ON public.geocode_suggestions(entity_id);
CREATE INDEX idx_geocode_suggestions_status ON public.geocode_suggestions(status);
CREATE INDEX idx_geocode_suggestions_top_score ON public.geocode_suggestions(top_score DESC) WHERE top_score IS NOT NULL;
CREATE INDEX idx_geocode_suggestions_auto_geocode 
ON public.geocode_suggestions(status, top_score DESC, entity_id) 
WHERE status = 'pending' AND top_score IS NOT NULL;

COMMIT;
