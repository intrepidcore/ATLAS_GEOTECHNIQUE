-- Migration 105 : Extension atlas.geocode_suggestions + contrainte anti-fallback
-- Ajoute les colonnes necessaires au workflow fuzzy-regex (AUDIT ?6.2)
-- et une contrainte pour prevenir toute nouvelle insertion du point fallback.
-- Date : 2026-06-04
-- Ref  : AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md - Phase 2 / ?6.2 + ?6.1 (Propriete 3)

BEGIN;

-- ?? 1. Creer la table dans atlas si elle n'existe pas encore ?????????????????
-- (public.geocode_suggestions peut exister deja - on cree atlas.geocode_suggestions
--  avec le schema etendu pour le workflow fuzzy)

CREATE TABLE IF NOT EXISTS atlas.geocode_suggestions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sondage_id          uuid NOT NULL REFERENCES atlas.sondages(id) ON DELETE CASCADE,
    sondage_code        text,
    locality_extracted  text,                   -- Localite extraite par regex
    fuzzy_score         numeric(5,2),            -- Score rapidfuzz WRatio (0?100)
    proposed_adm3_id    integer,                 -- FK atlas.adm3.gid
    proposed_adm3_name  text,
    proposed_adm2_name  text,
    proposed_adm1_name  text,
    proposed_geom       geometry(Point, 4326),  -- Centro?de de l'ADM3 propose
    proposed_maille_code text,                  -- Maille correspondante au centro?de
    source_import       text,                   -- Source du sondage (V10_MASTER_2026, etc.)
    action              text NOT NULL DEFAULT 'pending'
                        CHECK (action IN ('pending','auto_applied','proposed','rejected','manual_required')),
    validated_by        text,
    validated_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT NOW(),
    updated_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS geocode_suggestions_sondage_id_idx
    ON atlas.geocode_suggestions (sondage_id);
CREATE INDEX IF NOT EXISTS geocode_suggestions_action_idx
    ON atlas.geocode_suggestions (action);
CREATE INDEX IF NOT EXISTS geocode_suggestions_score_idx
    ON atlas.geocode_suggestions (fuzzy_score DESC);

COMMENT ON TABLE atlas.geocode_suggestions IS
    'Propositions de re-geocodage generees par regeocod_fuzzy_v1.py - Ref AUDIT-2026-06-04';

-- ?? 2. Contrainte anti-fallback (Propriete 3 de l'architecture cible) ????????
-- Empeche toute future insertion de POINT(1 8.6) avec un mode valide

DO $$ BEGIN
    ALTER TABLE atlas.sondages
    ADD CONSTRAINT chk_no_default_fallback_geom
    CHECK (
        NOT (
            geom = ST_SetSRID(ST_MakePoint(1.0, 8.6), 4326)
            AND location_mode NOT IN ('fallback_default', 'unknown')
            AND location_mode IS NOT NULL
        )
    );
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Contrainte deja presente
END $$;

COMMENT ON CONSTRAINT chk_no_default_fallback_geom ON atlas.sondages IS
    'AUDIT-2026-06-04: interdit POINT(1 8.6) avec un mode de localisation valide';

-- ?? 3. Test de coherence immediat ?????????????????????????????????????????????
DO $$
DECLARE
    v_fallback  INTEGER;
    v_null_mode INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_fallback
    FROM atlas.sondages
    WHERE geom = ST_SetSRID(ST_MakePoint(1, 8.6), 4326)
      AND location_mode != 'fallback_default'
      AND deleted_at IS NULL;

    SELECT COUNT(*) INTO v_null_mode
    FROM atlas.sondages
    WHERE location_mode IS NULL
      AND deleted_at IS NULL
      AND geom = ST_SetSRID(ST_MakePoint(1, 8.6), 4326);

    RAISE NOTICE 'Sondages POINT(1 8.6) sans fallback_default : % (attendu 0)', v_fallback;
    RAISE NOTICE 'Sondages POINT(1 8.6) avec location_mode NULL : % (attendu 0)', v_null_mode;
END;
$$;

COMMIT;
