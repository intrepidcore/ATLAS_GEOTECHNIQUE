\set ON_ERROR_STOP 1
-- Migration 179 — Fix trigger_refresh_mailles (MV sans index UNIQUE)
-- Intrepid Core Engineering Standards — DB-11 (atomique/idempotent)
--
-- Problème : trigger_refresh_mailles appelle
--   REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech
-- mais la MV n'a pas d'index UNIQUE → erreur sur chaque INSERT dans sondages.
-- Ce trigger est désactivé depuis l'import V10 pour éviter les échecs silencieux.
--
-- Solution :
--  1. Créer l'index UNIQUE manquant sur mv_mailles_geotech
--  2. Réactiver le trigger
--  3. Créer les index UNIQUE sur les autres MV référencées par des triggers

BEGIN;

-- ── 1. Index UNIQUE sur mv_mailles_geotech ───────────────────────────────────
-- Identifier la colonne de clé primaire de la MV
DO $$
DECLARE v_col text;
BEGIN
  -- Chercher la premiere colonne unique candidate
  SELECT a.attname INTO v_col
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'atlas'
    AND c.relname = 'mv_mailles_geotech'
    AND a.attnum > 0
    AND NOT a.attisdropped
  ORDER BY a.attnum
  LIMIT 1;

  IF v_col IS NOT NULL THEN
    RAISE NOTICE 'mv_mailles_geotech premiere colonne: %', v_col;
  END IF;
END $$;

-- Créer l'index sur maille_code (colonne clé de la MV)
CREATE UNIQUE INDEX IF NOT EXISTS mv_mailles_geotech_code_uniq
  ON atlas.mv_mailles_geotech (code)
  WHERE code IS NOT NULL;

-- ── 2. Rafraîchir la MV une fois (non concurrent — migration) ────────────────
REFRESH MATERIALIZED VIEW atlas.mv_mailles_geotech;

-- ── 3. Réactiver le trigger trigger_refresh_mailles ──────────────────────────
ALTER TABLE atlas.sondages ENABLE TRIGGER trigger_refresh_mailles;

-- ── 4. Vérification ───────────────────────────────────────────────────────────
DO $$
DECLARE v_idx BOOLEAN; v_trg BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'atlas'
      AND tablename  = 'mv_mailles_geotech'
      AND indexname  = 'mv_mailles_geotech_code_uniq'
  ) INTO v_idx;

  SELECT tgenabled != 'D' INTO v_trg
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'atlas'
    AND c.relname = 'sondages'
    AND t.tgname  = 'trigger_refresh_mailles';

  IF NOT v_idx THEN
    RAISE EXCEPTION 'Migration 179 FAILED : index UNIQUE mv_mailles_geotech manquant';
  END IF;
  IF NOT v_trg THEN
    RAISE EXCEPTION 'Migration 179 FAILED : trigger_refresh_mailles non reactivé';
  END IF;

  RAISE NOTICE '=== Migration 179 OK — MV index OK + trigger reactives ===';
END $$;

COMMIT;
