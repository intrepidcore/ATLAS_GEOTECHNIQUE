-- Ajouter colonne localite (idempotent)
DO $$
BEGIN
    -- Ajouter la colonne si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'atlas' 
        AND table_name = 'sondages' 
        AND column_name = 'localite'
    ) THEN
        ALTER TABLE atlas.sondages ADD COLUMN localite TEXT;
    END IF;

    -- Backfill seulement si la table survey_aliases existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'atlas' 
        AND table_name = 'survey_aliases'
    ) THEN
        WITH guess AS (
            SELECT
                a.survey_id,
                lower(
                    unaccent(
                        regexp_replace(a.alias_code, '^(bleu|granulo|limite)[-_]', '', 'i')
                    )
                ) AS localite_guess
            FROM atlas.survey_aliases a
        )
        UPDATE atlas.sondages s
        SET localite = initcap(g.localite_guess)
        FROM guess g
        WHERE s.id = g.survey_id
          AND s.localite IS NULL
          AND g.localite_guess <> '';
    END IF;

    -- Filet de sécurité : si on n'a rien trouvé, on garde ADM3
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'atlas' 
        AND table_name = 'sondages' 
        AND column_name = 'adm3_name'
    ) THEN
        UPDATE atlas.sondages
        SET localite = COALESCE(localite, initcap(adm3_name))
        WHERE localite IS NULL AND adm3_name IS NOT NULL;
    END IF;
END $$;
