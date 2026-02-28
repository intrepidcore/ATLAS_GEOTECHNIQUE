BEGIN;

-- Dataset métier (data-only) v1
-- Contraintes:
-- - Aucun CREATE TABLE / DROP
-- - Idempotent (ON CONFLICT / WHERE NOT EXISTS)
-- - Transactionnel

-- Exemple minimal (à remplacer par l'export réel pg_dump -a -t ...):
-- INSERT INTO atlas.mailles (id, code, geom, pref_code, pref_name, adm2_name)
-- VALUES (...)
-- ON CONFLICT (id) DO UPDATE SET
--   code = EXCLUDED.code,
--   geom = EXCLUDED.geom,
--   pref_code = EXCLUDED.pref_code,
--   pref_name = EXCLUDED.pref_name,
--   adm2_name = EXCLUDED.adm2_name;

COMMIT;
