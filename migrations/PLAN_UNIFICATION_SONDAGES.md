# Plan d'Unification des Sondages

## 🎯 Objectif
Résoudre le problème des doublons `BLEU-DOUTIKOPE`, `GRANULO-DOUTIKOPE`, etc.
Un sondage = une localité unique, avec plusieurs essais rattachés.

## 📊 État actuel (AUDIT)

### 1. Audit des tables existantes
```sql
-- Voir toutes les tables de sondages/essais
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema IN ('public','atlas') 
  AND table_name ILIKE ANY(ARRAY['sondage%', 'survey%', 'bleu%', 'granul%', 'vbs%', 'atterberg%', 'limite%'])
ORDER BY 1,2;

-- Colonnes de atlas.sondages
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='atlas' AND table_name='sondages'
ORDER BY ordinal_position;

-- Aperçu des codes préfixés
SELECT code, source, location_mode
FROM atlas.sondages
WHERE code ~* '^(bleu|granulo|limite)[-_]'
ORDER BY code
LIMIT 50;

-- Comptage des doublons par localité
WITH norm AS (
  SELECT id, code,
         lower(regexp_replace(unaccent(code), '^(bleu|granulo|limite)[-_]', '', 'i')) AS localite_norm
  FROM atlas.sondages
)
SELECT localite_norm, COUNT(*) AS n, array_agg(code) as codes
FROM norm
GROUP BY 1
HAVING COUNT(*)>1
ORDER BY n DESC, localite_norm
LIMIT 20;
```

### 2. Vérifier les tables d'essais
```sql
-- Structure des essais
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='atlas' 
  AND table_name IN ('essais_bleu','essais_granulo','essais_vbs','essais_atterberg','essais_limite')
ORDER BY table_name, ordinal_position;

-- Vérifier les FK
SELECT COUNT(*) FILTER (WHERE survey_id IS NULL) AS sans_fk,
       COUNT(*) AS total
FROM atlas.essais_granulo;
```

## 🔧 Phase 1: Fonction de normalisation

```sql
-- Extension unaccent
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Fonction pour extraire la localité du code
CREATE OR REPLACE FUNCTION atlas.extract_localite_from_code(code_in text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(
    regexp_replace(
      lower(unaccent(code_in)),
      '^(bleu|granulo|limite)[-_]',
      '',
      'i'
    )
  );
$$;

-- Test
SELECT code, atlas.extract_localite_from_code(code) as localite_canon
FROM atlas.sondages
WHERE code ~* '^(bleu|granulo|limite)[-_]'
LIMIT 10;
```

## 📋 Phase 2: Vues unifiées (sans casser l'existant)

### Vue principale: sondages unifiés
```sql
CREATE OR REPLACE VIEW atlas.v_sondages_unifies AS
WITH base AS (
  SELECT
    s.*,
    atlas.extract_localite_from_code(s.code) AS localite_canon
  FROM atlas.sondages s
),
grp AS (
  SELECT
    localite_canon,
    MIN(id) AS survey_id_canon,
    MIN(code) FILTER (WHERE code !~* '^(bleu|granulo|limite)[-_]') AS code_sans_prefixe
  FROM base
  GROUP BY localite_canon
)
SELECT
  g.survey_id_canon AS id,
  COALESCE(g.code_sans_prefixe, MAX(b.code)) AS code,
  b.localite_canon,
  MAX(b.adm3_id) FILTER (WHERE b.adm3_id IS NOT NULL) AS adm3_id,
  MAX(b.geom) FILTER (WHERE b.geom IS NOT NULL) AS geom,
  BOOL_OR(b.is_geocoded) AS is_geocoded,
  MAX(b.date) AS date,
  MIN(b.created_at) AS created_at,
  MAX(b.updated_at) AS updated_at,
  -- Flags d'essais disponibles
  EXISTS (
    SELECT 1 FROM atlas.essais_bleu e
    WHERE e.code = ANY (ARRAY_AGG(b.code))
  ) AS has_bleu,
  EXISTS (
    SELECT 1 FROM atlas.essais_granulo e
    WHERE e.code = ANY (ARRAY_AGG(b.code))
  ) AS has_granulo,
  EXISTS (
    SELECT 1 FROM atlas.essais_vbs e
    WHERE e.code = ANY (ARRAY_AGG(b.code))
  ) AS has_vbs,
  EXISTS (
    SELECT 1 FROM atlas.essais_atterberg e
    WHERE e.code = ANY (ARRAY_AGG(b.code))
  ) AS has_atterberg,
  EXISTS (
    SELECT 1 FROM atlas.essais_limite e
    WHERE e.code = ANY (ARRAY_AGG(b.code))
  ) AS has_limite,
  ARRAY_AGG(DISTINCT b.id) AS source_survey_ids,
  ARRAY_AGG(DISTINCT b.code) AS alias_codes
FROM base b
JOIN grp g ON g.localite_canon = b.localite_canon
GROUP BY g.survey_id_canon, g.code_sans_prefixe, b.localite_canon;

-- Test
SELECT id, code, localite_canon, has_bleu, has_granulo, has_vbs, has_atterberg, has_limite
FROM atlas.v_sondages_unifies
LIMIT 20;
```

### Vue détails: essais par sondage unifié
```sql
CREATE OR REPLACE VIEW atlas.v_sondages_unifies_details AS
SELECT
  u.id,
  u.code,
  u.localite_canon,
  u.adm3_id,
  u.geom,
  u.is_geocoded,
  jsonb_build_object(
    'bleu', COALESCE(
      (SELECT jsonb_agg(row_to_json(e.*))
       FROM atlas.essais_bleu e
       WHERE e.code = ANY(u.alias_codes)), '[]'::jsonb),
    'granulo', COALESCE(
      (SELECT jsonb_agg(row_to_json(g.*))
       FROM atlas.essais_granulo g
       WHERE g.code = ANY(u.alias_codes)), '[]'::jsonb),
    'vbs', COALESCE(
      (SELECT jsonb_agg(row_to_json(v.*))
       FROM atlas.essais_vbs v
       WHERE v.code = ANY(u.alias_codes)), '[]'::jsonb),
    'atterberg', COALESCE(
      (SELECT jsonb_agg(row_to_json(a.*))
       FROM atlas.essais_atterberg a
       WHERE a.code = ANY(u.alias_codes)), '[]'::jsonb),
    'limite', COALESCE(
      (SELECT jsonb_agg(row_to_json(l.*))
       FROM atlas.essais_limite l
       WHERE l.code = ANY(u.alias_codes)), '[]'::jsonb)
  ) AS essais
FROM atlas.v_sondages_unifies u;

-- Test
SELECT id, code, essais->'bleu' as bleu_count
FROM atlas.v_sondages_unifies_details
LIMIT 5;
```

### Materialized View pour performance
```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS atlas.mv_sondages_unifies AS
SELECT * FROM atlas.v_sondages_unifies;

CREATE UNIQUE INDEX ON atlas.mv_sondages_unifies (id);
CREATE INDEX ON atlas.mv_sondages_unifies (localite_canon);
CREATE INDEX ON atlas.mv_sondages_unifies (code);

-- Fonction de refresh
CREATE OR REPLACE FUNCTION atlas.refresh_sondages_unifies()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_sondages_unifies;
END$$;
```

## 🗄️ Phase 3: Nouvelle structure (migration douce)

### Tables canoniques
```sql
-- Table des sondages canoniques (un par localité)
CREATE TABLE IF NOT EXISTS atlas.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  localite_canon text NOT NULL,
  adm3_id uuid REFERENCES adm3(gid),
  geom geometry(Point, 4326),
  location_mode location_mode_enum,
  is_geocoded boolean DEFAULT false,
  date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX ON atlas.surveys (localite_canon);

-- Table d'alias (codes historiques)
CREATE TABLE IF NOT EXISTS atlas.survey_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES atlas.surveys(id) ON DELETE CASCADE,
  alias_code text UNIQUE NOT NULL,
  source text,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX ON atlas.survey_aliases (survey_id);
CREATE INDEX ON atlas.survey_aliases (alias_code);
```

### Backfill des données
```sql
-- 1) Créer les sondages canoniques
INSERT INTO atlas.surveys (id, code, localite_canon, adm3_id, geom, location_mode, is_geocoded, date, created_at)
SELECT DISTINCT ON (atlas.extract_localite_from_code(s.code))
  MIN(s.id) OVER (PARTITION BY atlas.extract_localite_from_code(s.code)) AS id,
  COALESCE(
    MIN(s.code) FILTER (WHERE s.code !~* '^(bleu|granulo|limite)[-_]'),
    initcap(atlas.extract_localite_from_code(s.code))
  ) AS code,
  atlas.extract_localite_from_code(s.code) AS localite_canon,
  MAX(s.adm3_id) FILTER (WHERE s.adm3_id IS NOT NULL) AS adm3_id,
  MAX(s.geom) FILTER (WHERE s.geom IS NOT NULL) AS geom,
  MAX(s.location_mode) AS location_mode,
  BOOL_OR(s.is_geocoded) AS is_geocoded,
  MAX(s.date) AS date,
  MIN(s.created_at) AS created_at
FROM atlas.sondages s
GROUP BY atlas.extract_localite_from_code(s.code)
ON CONFLICT (id) DO NOTHING;

-- 2) Créer les alias
INSERT INTO atlas.survey_aliases (survey_id, alias_code, source)
SELECT su.id, s.code,
  CASE
    WHEN s.code ~* '^bleu[-_]' THEN 'bleu'
    WHEN s.code ~* '^granulo[-_]' THEN 'granulo'
    WHEN s.code ~* '^limite[-_]' THEN 'limite'
    ELSE NULL
  END
FROM atlas.sondages s
JOIN atlas.surveys su ON atlas.extract_localite_from_code(s.code) = su.localite_canon
ON CONFLICT (alias_code) DO NOTHING;
```

### Mise à jour des FK dans les essais
```sql
-- Ajouter survey_id si pas présent
ALTER TABLE atlas.essais_bleu ADD COLUMN IF NOT EXISTS survey_id uuid REFERENCES atlas.surveys(id);
ALTER TABLE atlas.essais_granulo ADD COLUMN IF NOT EXISTS survey_id uuid REFERENCES atlas.surveys(id);
ALTER TABLE atlas.essais_vbs ADD COLUMN IF NOT EXISTS survey_id uuid REFERENCES atlas.surveys(id);
ALTER TABLE atlas.essais_atterberg ADD COLUMN IF NOT EXISTS survey_id uuid REFERENCES atlas.surveys(id);
ALTER TABLE atlas.essais_limite ADD COLUMN IF NOT EXISTS survey_id uuid REFERENCES atlas.surveys(id);

-- Backfill survey_id via alias
UPDATE atlas.essais_bleu e
SET survey_id = a.survey_id
FROM atlas.survey_aliases a
WHERE e.code = a.alias_code AND e.survey_id IS NULL;

UPDATE atlas.essais_granulo e
SET survey_id = a.survey_id
FROM atlas.survey_aliases a
WHERE e.code = a.alias_code AND e.survey_id IS NULL;

UPDATE atlas.essais_vbs e
SET survey_id = a.survey_id
FROM atlas.survey_aliases a
WHERE e.code = a.alias_code AND e.survey_id IS NULL;

UPDATE atlas.essais_atterberg e
SET survey_id = a.survey_id
FROM atlas.survey_aliases a
WHERE e.code = a.alias_code AND e.survey_id IS NULL;

UPDATE atlas.essais_limite e
SET survey_id = a.survey_id
FROM atlas.survey_aliases a
WHERE e.code = a.alias_code AND e.survey_id IS NULL;
```

## 🔒 Phase 4: Protection (empêcher nouveaux doublons)

```sql
-- Trigger pour bloquer les codes préfixés
CREATE OR REPLACE FUNCTION atlas.deny_prefixed_survey()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code ~* '^(bleu|granulo|limite)[-_]' THEN
    RAISE EXCEPTION 'Code de sondage ne doit pas contenir de préfixe d''essai: %', NEW.code;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_deny_prefixed ON atlas.sondages;
CREATE TRIGGER trg_deny_prefixed
BEFORE INSERT OR UPDATE ON atlas.sondages
FOR EACH ROW EXECUTE FUNCTION atlas.deny_prefixed_survey();
```

## 🚀 Phase 5: Adaptation API & UI

### API (Rust)
```rust
// Utiliser v_sondages_unifies ou mv_sondages_unifies
GET /api/surveys -> liste unifiée avec flags has_*
GET /api/surveys/:id -> détails + essais via v_sondages_unifies_details
POST /api/surveys/:id/geocode -> met à jour atlas.surveys
```

### UI (TypeScript)
```typescript
// Liste: affiche code + badges BLEU, GRANULO, VBS, ATT
// Panneau droit: sections d'essais par type
// Recherche: sur localite_canon + alias_codes
```

## ✅ Validation

```sql
-- Vérifier qu'on a bien un seul sondage par localité
SELECT COUNT(*) as total_localites, 
       COUNT(DISTINCT localite_canon) as localites_uniques
FROM atlas.surveys;

-- Vérifier les alias
SELECT COUNT(*) as total_alias,
       COUNT(DISTINCT survey_id) as sondages_avec_alias
FROM atlas.survey_aliases;

-- Vérifier les essais rattachés
SELECT 
  COUNT(*) FILTER (WHERE survey_id IS NOT NULL) as avec_fk,
  COUNT(*) FILTER (WHERE survey_id IS NULL) as sans_fk
FROM atlas.essais_granulo;
```

## 📝 Notes

- **Réversible**: Les vues n'altèrent pas les données existantes
- **Progressif**: Migration par étapes, testable à chaque phase
- **Compatible**: L'ancien code continue de fonctionner via les vues
- **Performant**: Materialized views pour la liste UI
