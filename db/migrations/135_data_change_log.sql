BEGIN;

CREATE TABLE IF NOT EXISTS atlas.data_change_log (
    id           BIGSERIAL PRIMARY KEY,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    schema_name  TEXT NOT NULL,
    table_name   TEXT NOT NULL,
    operation    TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
    row_pk       JSONB,
    old_row      JSONB,
    new_row      JSONB,
    actor_user_id UUID,
    txid         BIGINT NOT NULL DEFAULT txid_current()
);

CREATE INDEX IF NOT EXISTS idx_data_change_log_table_time
    ON atlas.data_change_log(schema_name, table_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_change_log_txid
    ON atlas.data_change_log(txid);

CREATE INDEX IF NOT EXISTS idx_data_change_log_actor_time
    ON atlas.data_change_log(actor_user_id, occurred_at DESC)
    WHERE actor_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION atlas.data_change_log_row_pk(p_schema TEXT, p_table TEXT, p_row JSONB)
RETURNS JSONB AS $$
DECLARE
    pk_cols TEXT[];
    col TEXT;
    out_json JSONB := '{}'::jsonb;
BEGIN
    IF p_row IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position)
    INTO pk_cols
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = p_schema
      AND tc.table_name = p_table;

    IF pk_cols IS NULL THEN
        RETURN NULL;
    END IF;

    FOREACH col IN ARRAY pk_cols LOOP
        IF p_row ? col THEN
            out_json := out_json || jsonb_build_object(col, p_row->col);
        END IF;
    END LOOP;

    IF out_json = '{}'::jsonb THEN
        RETURN NULL;
    END IF;

    RETURN out_json;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION atlas.log_data_change()
RETURNS TRIGGER AS $$
DECLARE
    schema_name TEXT;
    table_name TEXT;
    oldj JSONB;
    newj JSONB;
    pk JSONB;
    actor UUID;
BEGIN
    schema_name := TG_TABLE_SCHEMA;
    table_name := TG_TABLE_NAME;

    IF TG_OP = 'INSERT' THEN
        newj := to_jsonb(NEW);
        pk := atlas.data_change_log_row_pk(schema_name, table_name, newj);
    ELSIF TG_OP = 'UPDATE' THEN
        oldj := to_jsonb(OLD);
        newj := to_jsonb(NEW);
        pk := atlas.data_change_log_row_pk(schema_name, table_name, COALESCE(newj, oldj));
    ELSIF TG_OP = 'DELETE' THEN
        oldj := to_jsonb(OLD);
        pk := atlas.data_change_log_row_pk(schema_name, table_name, oldj);
    END IF;

    BEGIN
        actor := current_setting('atlas.user_id', true)::uuid;
    EXCEPTION WHEN others THEN
        actor := NULL;
    END;

    INSERT INTO atlas.data_change_log(
        schema_name,
        table_name,
        operation,
        row_pk,
        old_row,
        new_row,
        actor_user_id
    ) VALUES (
        schema_name,
        table_name,
        TG_OP,
        pk,
        oldj,
        newj,
        actor
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
    trg TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'atlas.users',
        'atlas.colab_students',
        'atlas.colab_supervisors',
        'atlas.colab_missions',
        'atlas.colab_mission_assignments',
        'atlas.colab_documents',
        'atlas.colab_field_logs',
        'atlas.colab_maille_assignments'
    ] LOOP
        IF to_regclass(t) IS NULL THEN
            CONTINUE;
        END IF;

        trg := 'trg_data_change_log_' || replace(t, '.', '_');

        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s;', trg, t);
        EXECUTE format(
            'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION atlas.log_data_change();',
            trg,
            t
        );
    END LOOP;
END $$;

COMMIT;
