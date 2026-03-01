-- Migration complète pour corriger TOUS les types de données dans geocode_suggestions

BEGIN;

-- 1. Créer une nouvelle table avec les bons types
CREATE TABLE public.geocode_suggestions_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity TEXT,
    entity_id UUID,
    localite TEXT,
    adm2_code TEXT,
    candidates JSONB,
    top_code TEXT,
    top_score NUMERIC(5,2),
    top_method TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);

-- 2. Migrer les données existantes avec conversions appropriées
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
    COALESCE(id::uuid, gen_random_uuid()) as id,
    entity,
    CASE 
        WHEN entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN entity_id::uuid 
        ELSE NULL 
    END as entity_id,
    localite,
    adm2_code,
    CASE 
        WHEN candidates IS NULL OR candidates = '' THEN NULL
        WHEN candidates::text ~ '^[\[\{]' THEN candidates::jsonb
        ELSE NULL
    END as candidates,
    top_code,
    top_score, -- Déjà converti dans la migration précédente
    top_method,
    COALESCE(status, 'pending') as status,
    CASE 
        WHEN created_at IS NULL OR created_at = '' THEN NOW()
        WHEN created_at ~ '^\d{4}-\d{2}-\d{2}' THEN created_at::timestamptz
        ELSE NOW()
    END as created_at,
    CASE 
        WHEN decided_at IS NULL OR decided_at = '' THEN NULL
        WHEN decided_at ~ '^\d{4}-\d{2}-\d{2}' THEN decided_at::timestamptz
        ELSE NULL
    END as decided_at
FROM public.geocode_suggestions;

-- 3. Supprimer l'ancienne table et renommer la nouvelle
DROP TABLE public.geocode_suggestions;
ALTER TABLE public.geocode_suggestions_new RENAME TO geocode_suggestions;

-- 4. Créer les index pour les performances
CREATE INDEX idx_geocode_suggestions_entity_id ON public.geocode_suggestions(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_geocode_suggestions_status ON public.geocode_suggestions(status);
CREATE INDEX idx_geocode_suggestions_top_score ON public.geocode_suggestions(top_score DESC) WHERE top_score IS NOT NULL;
CREATE INDEX idx_geocode_suggestions_auto_geocode 
ON public.geocode_suggestions(status, top_score DESC, entity_id) 
WHERE status = 'pending' AND top_score IS NOT NULL AND entity_id IS NOT NULL;

-- 5. Ajouter une contrainte de clé étrangère vers sondages
ALTER TABLE public.geocode_suggestions 
ADD CONSTRAINT fk_geocode_suggestions_sondage 
FOREIGN KEY (entity_id) REFERENCES public.sondages(id) ON DELETE CASCADE;

COMMIT;
