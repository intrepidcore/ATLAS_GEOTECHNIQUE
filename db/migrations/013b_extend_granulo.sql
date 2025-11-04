-- Migration 013b: Étendre granulometrie_points existante
-- Date: 2025-11-03

DO $$
BEGIN
    -- Ajouter colonnes manquantes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='granulometrie_points' AND column_name='methode') THEN
        ALTER TABLE granulometrie_points ADD COLUMN methode TEXT CHECK (methode IN ('tamisage', 'sedimentometrie', 'laser'));
        CREATE INDEX idx_granulo_methode ON granulometrie_points(methode) WHERE methode IS NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='granulometrie_points' AND column_name='meta') THEN
        ALTER TABLE granulometrie_points ADD COLUMN meta JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='granulometrie_points' AND column_name='created_by_batch') THEN
        ALTER TABLE granulometrie_points ADD COLUMN created_by_batch TEXT;
        CREATE INDEX idx_granulo_created_batch ON granulometrie_points(created_by_batch) WHERE created_by_batch IS NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='granulometrie_points' AND column_name='deleted_by_batch') THEN
        ALTER TABLE granulometrie_points ADD COLUMN deleted_by_batch TEXT;
        ALTER TABLE granulometrie_points ADD COLUMN deleted_at TIMESTAMPTZ;
        CREATE INDEX idx_granulo_deleted_batch ON granulometrie_points(deleted_by_batch) WHERE deleted_by_batch IS NOT NULL;
    END IF;
    
    RAISE NOTICE 'Migration 013b terminée: granulometrie_points étendue';
END $$;
