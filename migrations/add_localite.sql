-- Ajouter colonne localite
ALTER TABLE sondages ADD COLUMN IF NOT EXISTS localite text;

-- Backfill: deviner la localité à partir des alias
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
UPDATE sondages s
SET localite = initcap(g.localite_guess)
FROM guess g
WHERE s.id = g.survey_id
  AND s.localite IS NULL
  AND g.localite_guess <> '';

-- Filet de sécurité : si on n'a rien trouvé, on garde ADM3
UPDATE sondages
SET localite = COALESCE(localite, initcap(adm3_name))
WHERE localite IS NULL AND adm3_name IS NOT NULL;
