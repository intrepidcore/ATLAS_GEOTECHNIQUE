-- Ajouter les synonymes pour Konsogou T1/T2
INSERT INTO adm3_synonyms(alias_norm, adm3_code) VALUES
('konsogou t1', 'TG020605'),
('konsogou t2', 'TG020605')
ON CONFLICT (alias_norm) DO UPDATE SET adm3_code = EXCLUDED.adm3_code;

-- Re-matcher
WITH to_do AS (
  SELECT s.id, s.meta->>'localite' AS localite
  FROM sondages s
  WHERE (s.meta->>'adm3_code') IS NULL
    AND nullif(s.meta->>'localite','') IS NOT NULL
)
UPDATE sondages s
SET meta = jsonb_set(s.meta, '{adm3_code}', to_jsonb(m.adm3_code))
FROM to_do t
CROSS JOIN LATERAL match_adm3_from_localite(t.localite) m
WHERE s.id = t.id
  AND m.score >= 0.72
RETURNING s.meta->>'code' AS code_site, s.meta->>'localite' AS localite, 
          s.meta->>'adm3_code' AS adm3_code, m.score;
