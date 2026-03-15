BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS atlas.docs_vault (
  id          SERIAL PRIMARY KEY,
  path        TEXT NOT NULL UNIQUE,
  content     TEXT NOT NULL,
  sha256      TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  doc_type    TEXT NOT NULL DEFAULT 'doc',
  git_commit  TEXT,
  git_branch  TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verify_ok   BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_docs_vault_type
  ON atlas.docs_vault(doc_type);

CREATE INDEX IF NOT EXISTS idx_docs_vault_content_fts
  ON atlas.docs_vault USING gin(to_tsvector('french', content));

CREATE OR REPLACE FUNCTION atlas.verify_docs_vault()
RETURNS TABLE(path TEXT, status TEXT, detail TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dv.path,
    CASE
      WHEN dv.sha256 = encode(digest(convert_to(dv.content, 'UTF8'), 'sha256'), 'hex') THEN 'OK'
      ELSE 'CORRUPT'
    END AS status,
    CASE
      WHEN dv.sha256 = encode(digest(convert_to(dv.content, 'UTF8'), 'sha256'), 'hex')
        THEN 'sha256_ok size_bytes=' || dv.size_bytes::text
      ELSE 'sha256_expected=' || dv.sha256 || ' sha256_actual=' || encode(digest(convert_to(dv.content, 'UTF8'), 'sha256'), 'hex')
    END AS detail
  FROM atlas.docs_vault dv;
END;
$$ LANGUAGE plpgsql;

COMMIT;
