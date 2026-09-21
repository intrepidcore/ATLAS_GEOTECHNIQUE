-- ============================================================================
-- Migration 107: Système de paquets opérateur hors-ligne (.atlaspack)
--
-- Workflow : Atlas Colab -> génération paquet signé/chiffré par opérateur
-- -> app mobile hors-ligne -> export terrain -> réimport Colab (.atlasreturn).
--
-- Additive uniquement (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT
-- EXISTS), appliquée manuellement via psql comme les migrations précédentes
-- de ce dossier (sqlx::migrate! est désactivé, cf. src/main.rs).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Clés de signature Ed25519. Seule la clé PUBLIQUE est stockée ici — la clé
-- privée ne vit que côté serveur (variable d'environnement), jamais en base,
-- jamais dans l'app mobile. Rotation supportée via plusieurs lignes actives.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atlas.atlaspack_signing_keys (
    id              TEXT PRIMARY KEY,              -- fingerprint (sha256(pubkey)[:16] hex)
    public_key_b64  TEXT NOT NULL,
    algorithm       TEXT NOT NULL DEFAULT 'ed25519',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retired_at      TIMESTAMPTZ
);

COMMENT ON TABLE atlas.atlaspack_signing_keys IS
    'Clés publiques Ed25519 de signature des paquets .atlaspack. La clé privée n''est jamais stockée en base.';

-- ----------------------------------------------------------------------------
-- Un paquet par opérateur. status suit le cycle de vie demandé :
-- not_prepared -> preparing -> ready -> stale (si une mission change)
--                            -> failed (échec génération, réessayable)
--                            -> expired (passé expires_at)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atlas.atlaspack_packages (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_user_id        UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    student_id              UUID REFERENCES atlas.colab_students(id) ON DELETE CASCADE,

    status                  TEXT NOT NULL DEFAULT 'not_prepared'
                            CHECK (status IN ('not_prepared','preparing','ready','stale','failed','expired')),

    format_version          INT NOT NULL,
    schema_version          INT NOT NULL,

    mission_ids             UUID[] NOT NULL DEFAULT '{}',
    mission_snapshot_hash   TEXT,                   -- détecte les missions/affectations modifiées

    generated_at            TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ,

    signing_key_id          TEXT REFERENCES atlas.atlaspack_signing_keys(id),
    package_sha256          TEXT,
    file_path               TEXT,
    file_size_bytes         BIGINT,

    tile_count              INT,
    tile_zoom_min           INT,
    tile_zoom_max           INT,
    tiles_truncated         BOOLEAN NOT NULL DEFAULT FALSE,
    tiles_truncation_reason TEXT,

    error                   TEXT,
    superseded_by           UUID REFERENCES atlas.atlaspack_packages(id),
    obsolete_reason         TEXT,

    created_by              UUID REFERENCES atlas.users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE atlas.atlaspack_packages IS
    'Un paquet .atlaspack par opérateur. Régénéré (nouvelle ligne, ancienne marquée stale) quand ses missions changent.';
COMMENT ON COLUMN atlas.atlaspack_packages.mission_snapshot_hash IS
    'sha256 des (mission_id, updated_at, assignment updated) au moment de la génération — permet de détecter l''obsolescence sans recharger tout le paquet.';

CREATE INDEX IF NOT EXISTS idx_atlaspack_packages_operator ON atlas.atlaspack_packages(operator_user_id);
CREATE INDEX IF NOT EXISTS idx_atlaspack_packages_student ON atlas.atlaspack_packages(student_id);
CREATE INDEX IF NOT EXISTS idx_atlaspack_packages_status ON atlas.atlaspack_packages(status);
-- Un seul paquet "courant" (not_prepared/preparing/ready) par opérateur à la
-- fois — 'stale' et 'failed' sont des états terminaux pour LEUR ligne
-- (remplacée par une nouvelle ligne via superseded_by), donc exclus ici.
CREATE UNIQUE INDEX IF NOT EXISTS uq_atlaspack_packages_active_operator
    ON atlas.atlaspack_packages(operator_user_id)
    WHERE status IN ('not_prepared','preparing','ready');

-- ----------------------------------------------------------------------------
-- File de génération, même pattern que atlas.colab_email_jobs
-- (SELECT ... FOR UPDATE SKIP LOCKED) — réutilisé, pas de nouveau système.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atlas.atlaspack_generation_jobs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id   UUID NOT NULL REFERENCES atlas.atlaspack_packages(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
    attempts     INT NOT NULL DEFAULT 0,
    last_error   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at   TIMESTAMPTZ,
    finished_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_atlaspack_jobs_status_created
    ON atlas.atlaspack_generation_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_atlaspack_jobs_package ON atlas.atlaspack_generation_jobs(package_id);

-- ----------------------------------------------------------------------------
-- Pièces jointes terrain (photos de sondage). N'existait pas avant .atlaspack.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atlas.colab_sondage_attachments (
    id            UUID PRIMARY KEY,                 -- UUID généré côté mobile (idempotent au réimport)
    sondage_id    UUID NOT NULL REFERENCES atlas.sondages(id) ON DELETE CASCADE,
    mission_id    UUID REFERENCES atlas.colab_missions(id) ON DELETE SET NULL,
    kind          TEXT NOT NULL DEFAULT 'photo',
    file_name     TEXT NOT NULL,
    content_type  TEXT NOT NULL DEFAULT 'image/jpeg',
    size_bytes    BIGINT NOT NULL,
    sha256        TEXT NOT NULL,
    storage_path  TEXT NOT NULL,
    caption       TEXT,
    taken_at      TIMESTAMPTZ,
    created_by    UUID REFERENCES atlas.users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colab_sondage_attachments_sondage ON atlas.colab_sondage_attachments(sondage_id);
CREATE INDEX IF NOT EXISTS idx_colab_sondage_attachments_mission ON atlas.colab_sondage_attachments(mission_id);

-- ----------------------------------------------------------------------------
-- Un export terrain (.atlasreturn) réimporté = une ligne. id = export_id
-- généré côté mobile -> réimport idempotent par construction (PK).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atlas.atlaspack_returns (
    id                 UUID PRIMARY KEY,             -- export_id (client, mobile)
    package_id         UUID REFERENCES atlas.atlaspack_packages(id) ON DELETE SET NULL,
    operator_user_id   UUID NOT NULL REFERENCES atlas.users(id),

    generated_at       TIMESTAMPTZ NOT NULL,
    format_version     INT NOT NULL,

    missions_count     INT NOT NULL DEFAULT 0,
    sondages_count     INT NOT NULL DEFAULT 0,
    essais_count       INT NOT NULL DEFAULT 0,
    resultats_count    INT NOT NULL DEFAULT 0,
    attachments_count  INT NOT NULL DEFAULT 0,
    size_bytes         BIGINT NOT NULL DEFAULT 0,
    sha256             TEXT NOT NULL,
    manifest           JSONB NOT NULL,

    status             TEXT NOT NULL DEFAULT 'received'
                        CHECK (status IN ('received','validated','rejected','applied')),
    rejection_reason   TEXT,

    imported_by        UUID REFERENCES atlas.users(id),
    received_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at         TIMESTAMPTZ
);

COMMENT ON TABLE atlas.atlaspack_returns IS
    'Un export terrain (.atlasreturn) reçu au bureau. id = export_id du manifeste mobile -> réimport du même fichier idempotent.';

CREATE INDEX IF NOT EXISTS idx_atlaspack_returns_operator ON atlas.atlaspack_returns(operator_user_id);
CREATE INDEX IF NOT EXISTS idx_atlaspack_returns_package ON atlas.atlaspack_returns(package_id);
CREATE INDEX IF NOT EXISTS idx_atlaspack_returns_status ON atlas.atlaspack_returns(status);

-- ----------------------------------------------------------------------------
-- Journal d'audit terrain réimporté (mirroir serveur du journal local mobile).
-- id = uuid généré côté mobile au moment de l'événement -> réimport idempotent.
-- Table dédiée : atlas.audit_log est un mécanisme générique préexistant
-- (déclencheurs DB sur d'autres tables), on ne le détourne pas pour des
-- événements d'origine mobile.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atlas.atlaspack_audit_events (
    id                 UUID PRIMARY KEY,             -- uuid généré côté mobile
    return_id          UUID REFERENCES atlas.atlaspack_returns(id) ON DELETE CASCADE,
    package_id         UUID REFERENCES atlas.atlaspack_packages(id) ON DELETE SET NULL,
    operator_user_id   UUID REFERENCES atlas.users(id),
    mission_id         UUID REFERENCES atlas.colab_missions(id) ON DELETE SET NULL,

    event_type         TEXT NOT NULL,
    occurred_at        TIMESTAMPTZ NOT NULL,
    object_type        TEXT,
    object_id          TEXT,
    old_values         JSONB,
    new_values         JSONB,
    metadata           JSONB,

    imported_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atlaspack_audit_return ON atlas.atlaspack_audit_events(return_id);
CREATE INDEX IF NOT EXISTS idx_atlaspack_audit_mission ON atlas.atlaspack_audit_events(mission_id);
CREATE INDEX IF NOT EXISTS idx_atlaspack_audit_occurred ON atlas.atlaspack_audit_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_atlaspack_audit_operator ON atlas.atlaspack_audit_events(operator_user_id);

COMMIT;
