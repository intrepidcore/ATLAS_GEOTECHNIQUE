-- Migration: ajout contrainte UNIQUE sur maille_spectral_vfs.maille_id
-- Prerequis: deduplication necessaire (29745 lignes pour 29407 mailles uniques)
-- Auteur: Intrepid Core Engineering / 2026-06-01

BEGIN;

-- Etape 1 : Deduplication (garder la ligne la plus recente par maille_id)
DELETE FROM atlas.maille_spectral_vfs
WHERE id NOT IN (
  SELECT DISTINCT ON (maille_id) id
  FROM atlas.maille_spectral_vfs
  ORDER BY maille_id, computed_at DESC NULLS LAST
);

DO $$
DECLARE n_remaining integer;
BEGIN
  SELECT COUNT(*) INTO n_remaining FROM atlas.maille_spectral_vfs;
  RAISE NOTICE 'Lignes apres deduplication : %', n_remaining;
END $$;

-- Etape 2 : Supprimer l'ancien index non-unique
DROP INDEX IF EXISTS atlas.idx_maille_spectral_maille_id;

-- Etape 3 : Ajouter la contrainte UNIQUE
ALTER TABLE atlas.maille_spectral_vfs
  ADD CONSTRAINT uq_maille_spectral_maille_id UNIQUE (maille_id);

DO $$
BEGIN
  RAISE NOTICE 'UNIQUE constraint added: uq_maille_spectral_maille_id';
END $$;

COMMIT;
