-- Migration pour créer les tables d'import manquantes
BEGIN;

-- Table des imports
CREATE TABLE IF NOT EXISTS atlas.imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    total_rows INTEGER NOT NULL DEFAULT 0,
    processed_rows INTEGER NOT NULL DEFAULT 0,
    success_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    import_type TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by TEXT,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_imports_status ON atlas.imports(status);
CREATE INDEX IF NOT EXISTS idx_imports_created_at ON atlas.imports(created_at DESC);

COMMENT ON TABLE atlas.imports IS 'Suivi des imports de données (CSV, Excel, etc.)';

-- Table des erreurs d'import
CREATE TABLE IF NOT EXISTS atlas.import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES atlas.imports(id) ON DELETE CASCADE,
    row_no INTEGER NOT NULL,
    column_name TEXT,
    error_code TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
    value TEXT,
    hint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_errors_import_id ON atlas.import_errors(import_id);
CREATE INDEX IF NOT EXISTS idx_import_errors_severity ON atlas.import_errors(severity);

COMMENT ON TABLE atlas.import_errors IS 'Erreurs détaillées pour chaque import';

-- Table des sondages non géocodés (utilisée dans geocode_manager)
CREATE TABLE IF NOT EXISTS atlas.sondages_non_geocodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    adm1 TEXT,
    adm2 TEXT,
    adm3 TEXT,
    commune_id INTEGER,
    localite TEXT,
    date_sondage DATE,
    profondeur_m NUMERIC(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_sondages_non_geocodes_code ON atlas.sondages_non_geocodes(code);
CREATE INDEX IF NOT EXISTS idx_sondages_non_geocodes_commune ON atlas.sondages_non_geocodes(commune_id);

COMMENT ON TABLE atlas.sondages_non_geocodes IS 'Sondages en attente de géocodage';

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION atlas.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sondages_non_geocodes_updated_at ON atlas.sondages_non_geocodes;
CREATE TRIGGER update_sondages_non_geocodes_updated_at
    BEFORE UPDATE ON atlas.sondages_non_geocodes
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_updated_at_column();

COMMIT;

DO $$
BEGIN
    RAISE NOTICE '✅ Tables d''import créées avec succès';
    RAISE NOTICE '    - atlas.imports';
    RAISE NOTICE '    - atlas.import_errors';
    RAISE NOTICE '    - atlas.sondages_non_geocodes';
END $$;
