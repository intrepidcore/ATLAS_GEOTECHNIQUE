-- ============================================================================
-- MIGRATION COMPLÈTE: Localités Unifiées + Géocodage Robuste
-- ============================================================================
-- 1) Autorise location_mode='unknown' sans ADM/GEOM
-- 2) Ajoute colonnes générées pour localité
-- 3) Crée table de suggestions de géocodage
-- 4) Trigger automatique pour suggestions
-- ============================================================================

-- 1) Extensions
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2) Schéma atlas
CREATE SCHEMA IF NOT EXISTS atlas;

-- 3) Fonctions de normalisation (IMMUTABLE pour colonnes générées)
CREATE OR REPLACE FUNCTION atlas.norm_key(txt text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN txt IS NULL THEN NULL
    ELSE upper(regexp_replace(unaccent(txt), '[^A-Za-z0-9]+', '', 'g'))
  END
$$;

CREATE OR REPLACE FUNCTION atlas.extract_localite(code text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  -- Retire préfixes BLEU-/LIMITE-/GRANULO-/VBS- et suffixe entre ()
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(coalesce(code,''), '^(BLEU|LIMITE|GRANULO|VBS|ATTERBERG)[-_]*', '', 'i'),
      '\s*\(.*\)$', '', 'g'
    ),
    ''
  )
$$;

-- 4) Ajouter colonnes générées à sondages
ALTER TABLE sondages
  ADD COLUMN IF NOT EXISTS localite_base text
    GENERATED ALWAYS AS (atlas.extract_localite(code)) STORED,
  ADD COLUMN IF NOT EXISTS localite_key text
    GENERATED ALWAYS AS (atlas.norm_key(atlas.extract_localite(code))) STORED;

-- 5) Index sur les nouvelles colonnes
CREATE INDEX IF NOT EXISTS sondages_localite_key_idx ON sondages(localite_key);
CREATE INDEX IF NOT EXISTS sondages_localite_base_idx ON sondages(localite_base);
CREATE INDEX IF NOT EXISTS sondages_adm3_id_idx ON sondages(adm3_id);

-- 6) Modifier contrainte location_mode pour autoriser 'unknown'
DO $$
DECLARE
  c_name text;
BEGIN
  -- Trouver et supprimer l'ancienne contrainte
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'sondages'::regclass
    AND contype = 'c'
    AND (conname LIKE '%location%' OR conname LIKE '%unknown%' OR conname LIKE '%adm%');
  
  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE sondages DROP CONSTRAINT IF EXISTS %I', c_name);
  END IF;
END$$;

-- Nouvelle contrainte: 'unknown' autorisé sans ADM/GEOM
ALTER TABLE sondages ADD CONSTRAINT sondages_location_mode_ck CHECK (
     (location_mode = 'exact'    AND geom IS NOT NULL)
  OR (location_mode IN ('centroid','spread','adm_random_cell') AND adm3_id IS NOT NULL)
  OR (location_mode = 'unknown')  -- Autorisé sans ADM/GEOM
  OR (location_mode = 'random')   -- Aléatoire global
);

-- 7) Table de suggestions de géocodage
CREATE TABLE IF NOT EXISTS atlas.geocode_suggestions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sondage_id    uuid NOT NULL REFERENCES sondages(id) ON DELETE CASCADE,
  reason        text NOT NULL,                     -- 'missing_location', 'missing_adm', etc.
  status        text NOT NULL DEFAULT 'pending',   -- pending|done|rejected
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sondage_id, status)  -- Évite doublons "pending"
);

CREATE INDEX IF NOT EXISTS geocode_suggestions_status_idx ON atlas.geocode_suggestions(status);
CREATE INDEX IF NOT EXISTS geocode_suggestions_created_idx ON atlas.geocode_suggestions(created_at);
CREATE INDEX IF NOT EXISTS geocode_suggestions_sondage_idx ON atlas.geocode_suggestions(sondage_id);

COMMENT ON TABLE atlas.geocode_suggestions IS 
'File d''attente des sondages nécessitant un géocodage. 
Alimentée automatiquement par trigger quand location_mode=unknown ou geom IS NULL.';

-- 8) Trigger: Enqueue automatique des suggestions
CREATE OR REPLACE FUNCTION atlas.enqueue_geocode_suggestion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Si sondage sans localisation ou avec location_mode='unknown'
  IF (NEW.location_mode = 'unknown' OR NEW.geom IS NULL) AND NEW.deleted_at IS NULL THEN
    INSERT INTO atlas.geocode_suggestions(sondage_id, reason, payload)
    VALUES (
      NEW.id,
      CASE 
        WHEN NEW.location_mode = 'unknown' THEN 'missing_location'
        WHEN NEW.geom IS NULL THEN 'missing_geometry'
        ELSE 'needs_geocoding'
      END,
      jsonb_build_object(
        'code', NEW.code,
        'source', NEW.source,
        'adm3_id', NEW.adm3_id,
        'adm3_name', NEW.adm3_name,
        'localite_key', NEW.localite_key,
        'localite_base', NEW.localite_base
      )
    )
    ON CONFLICT (sondage_id, status) DO UPDATE
      SET updated_at = now(),
          payload = EXCLUDED.payload;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_enqueue_geocode_suggestion ON sondages;
CREATE TRIGGER trg_enqueue_geocode_suggestion
AFTER INSERT OR UPDATE OF location_mode, geom, adm3_id
ON sondages
FOR EACH ROW EXECUTE FUNCTION atlas.enqueue_geocode_suggestion();

-- 9) Recréer vue unifiée avec colonnes générées
DROP VIEW IF EXISTS atlas.v_sondages_unifies CASCADE;
CREATE OR REPLACE VIEW atlas.v_sondages_unifies AS
WITH g AS (
  SELECT
    s.localite_key,
    min(initcap(lower(s.localite_base))) AS localite,
    array_agg(s.id ORDER BY s.id) AS survey_ids,
    array_agg(s.code ORDER BY s.code) AS survey_codes,
    bool_or(s.code ILIKE 'BLEU-%' OR s.source = 'bleu') AS has_bleu,
    bool_or(s.code ILIKE 'LIMITE-%' OR s.source = 'limite') AS has_limite,
    bool_or(s.code ILIKE 'GRANULO-%' OR s.source = 'Granulométrie') AS has_granulo,
    bool_or(s.code ILIKE 'VBS-%') AS has_vbs,
    count(*) AS variants,
    -- ADM3 le plus fréquent
    (SELECT adm3_id FROM (
       SELECT adm3_id, count(*) c FROM sondages s2
       WHERE s2.localite_key = s.localite_key AND s2.deleted_at IS NULL
       GROUP BY adm3_id ORDER BY c DESC NULLS LAST, adm3_id ASC LIMIT 1
     ) t) AS adm3_id,
    (SELECT adm3_name FROM (
       SELECT adm3_name, count(*) c FROM sondages s2
       WHERE s2.localite_key = s.localite_key AND s2.deleted_at IS NULL
       GROUP BY adm3_name ORDER BY c DESC NULLS LAST, adm3_name ASC LIMIT 1
     ) t) AS adm3_name,
    -- Géométrie prioritaire (non nulle)
    (SELECT geom FROM sondages s2
     WHERE s2.localite_key = s.localite_key AND s2.geom IS NOT NULL AND s2.deleted_at IS NULL
     ORDER BY s2.id LIMIT 1) AS geom,
    max(s.date) AS latest_date,
    bool_or(s.geom IS NOT NULL) AS has_geometry
  FROM sondages s
  WHERE s.deleted_at IS NULL AND s.localite_key IS NOT NULL AND s.localite_key != ''
  GROUP BY s.localite_key
)
SELECT
  g.localite_key,
  g.localite,
  g.survey_ids,
  g.survey_codes,
  g.has_bleu, g.has_limite, g.has_granulo, g.has_vbs,
  g.variants,
  g.adm3_id, g.adm3_name, g.geom, g.has_geometry,
  g.latest_date,
  -- Compter les essais
  COALESCE((SELECT count(*) FROM echantillons e 
            JOIN essais_atterberg a ON a.echantillon_id = e.id 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) AS atterberg_count,
  COALESCE((SELECT count(*) FROM echantillons e 
            JOIN granulo_points gr ON gr.echantillon_id = e.id 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) AS granulo_count,
  COALESCE((SELECT count(*) FROM echantillons e 
            JOIN essais_vbs v ON v.echantillon_id = e.id 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) AS vbs_count,
  COALESCE((SELECT count(*) FROM echantillons e 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) AS echantillons_count,
  -- Total essais
  COALESCE((SELECT count(*) FROM echantillons e 
            JOIN essais_atterberg a ON a.echantillon_id = e.id 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) +
  COALESCE((SELECT count(*) FROM echantillons e 
            JOIN granulo_points gr ON gr.echantillon_id = e.id 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) +
  COALESCE((SELECT count(*) FROM echantillons e 
            JOIN essais_vbs v ON v.echantillon_id = e.id 
            WHERE e.sondage_id = ANY(g.survey_ids)), 0) AS total_essais
FROM g;

-- 10) Vue matérialisée avec REFRESH CONCURRENT
DROP MATERIALIZED VIEW IF EXISTS atlas.mv_sondages_unifies CASCADE;
CREATE MATERIALIZED VIEW atlas.mv_sondages_unifies AS
  SELECT * FROM atlas.v_sondages_unifies;

-- Index UNIQUE requis pour REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS mv_sondages_unifies_uidx
  ON atlas.mv_sondages_unifies(localite_key);

-- Index secondaires
CREATE INDEX IF NOT EXISTS mv_sondages_unifies_localite_idx 
  ON atlas.mv_sondages_unifies USING gin(to_tsvector('french', localite));
CREATE INDEX IF NOT EXISTS mv_sondages_unifies_localite_trgm
  ON atlas.mv_sondages_unifies USING gin (localite gin_trgm_ops);
CREATE INDEX IF NOT EXISTS mv_sondages_unifies_geom_idx 
  ON atlas.mv_sondages_unifies USING gist(geom);
CREATE INDEX IF NOT EXISTS mv_sondages_unifies_adm3_idx
  ON atlas.mv_sondages_unifies(adm3_id);

-- 11) Fonction de refresh concurrent
CREATE OR REPLACE FUNCTION atlas.refresh_sondages_unifies()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_sondages_unifies;
END;
$$;

-- 12) Refresh initial
SELECT atlas.refresh_sondages_unifies();

-- 13) Enqueue suggestions pour sondages existants sans localisation
INSERT INTO atlas.geocode_suggestions(sondage_id, reason, payload)
SELECT 
  s.id,
  CASE 
    WHEN s.location_mode = 'unknown' THEN 'missing_location'
    WHEN s.geom IS NULL THEN 'missing_geometry'
    ELSE 'needs_geocoding'
  END,
  jsonb_build_object(
    'code', s.code,
    'source', s.source,
    'adm3_id', s.adm3_id,
    'adm3_name', s.adm3_name,
    'localite_key', s.localite_key,
    'localite_base', s.localite_base
  )
FROM sondages s
WHERE s.deleted_at IS NULL 
  AND (s.location_mode = 'unknown' OR s.geom IS NULL)
ON CONFLICT (sondage_id, status) DO NOTHING;

-- ============================================================================
-- STATISTIQUES
-- ============================================================================

-- Sondages par location_mode
SELECT location_mode, COUNT(*) 
FROM sondages 
WHERE deleted_at IS NULL 
GROUP BY location_mode 
ORDER BY COUNT(*) DESC;

-- Suggestions en attente
SELECT status, COUNT(*) 
FROM atlas.geocode_suggestions 
GROUP BY status;

-- Localités unifiées
SELECT 
  COUNT(*) as localites_uniques,
  SUM(variants) as total_sondages,
  SUM(CASE WHEN variants > 1 THEN 1 ELSE 0 END) as avec_doublons,
  SUM(total_essais) as total_essais
FROM atlas.mv_sondages_unifies;
