-- Migration 016a: Étendre enum location_mode_enum
-- Date: 2025-11-03

-- Ajouter 'adm_random_cell' à l'enum si pas déjà présent
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e 
        JOIN pg_type t ON e.enumtypid = t.oid 
        WHERE t.typname = 'location_mode_enum' 
        AND e.enumlabel = 'adm_random_cell'
    ) THEN
        ALTER TYPE location_mode_enum ADD VALUE 'adm_random_cell';
        RAISE NOTICE 'Valeur adm_random_cell ajoutée à location_mode_enum';
    END IF;
END $$;

-- Ajouter 'spread' à l'enum pour compatibilité (même si on ne l'utilise plus)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e 
        JOIN pg_type t ON e.enumtypid = t.oid 
        WHERE t.typname = 'location_mode_enum' 
        AND e.enumlabel = 'spread'
    ) THEN
        ALTER TYPE location_mode_enum ADD VALUE 'spread';
        RAISE NOTICE 'Valeur spread ajoutée à location_mode_enum (legacy)';
    END IF;
END $$;

-- Vérifier les valeurs finales
SELECT enumlabel FROM pg_enum e 
JOIN pg_type t ON e.enumtypid = t.oid 
WHERE t.typname = 'location_mode_enum'
ORDER BY enumsortorder;
