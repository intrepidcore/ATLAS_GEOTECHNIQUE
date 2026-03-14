BEGIN;

ALTER TABLE atlas.users
    ADD COLUMN IF NOT EXISTS telephone VARCHAR(30);

ALTER TABLE atlas.colab_students
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS age INTEGER;

ALTER TABLE atlas.colab_supervisors
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE atlas.colab_missions
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE atlas.colab_documents
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON atlas.users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_colab_students_deleted_at ON atlas.colab_students(deleted_at);
CREATE INDEX IF NOT EXISTS idx_colab_supervisors_deleted_at ON atlas.colab_supervisors(deleted_at);
CREATE INDEX IF NOT EXISTS idx_colab_missions_deleted_at ON atlas.colab_missions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_colab_documents_deleted_at ON atlas.colab_documents(deleted_at);

COMMIT;
