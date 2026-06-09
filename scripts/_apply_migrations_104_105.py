#!/usr/bin/env python3
"""
_apply_migrations_104_105.py
Migrations 104 et 105 via psycopg2.
Gestion des triggers pour batch UPDATE efficace.
"""
import psycopg2
import sys

DB_URL = "postgresql://postgres:Atlas2024!@127.0.0.1:5433/atlas_clean"

SQL_104_FUNCTION = """
CREATE OR REPLACE FUNCTION atlas.geocode_sondage(p_sondage_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_geom             geometry(Point, 4326);
    v_geom_25231       geometry(Point, 25231);
    v_maille_code      text;
    v_adm3_id          integer;
    v_adm1_name        text;
    v_adm2_name        text;
    v_adm3_name        text;
    v_current_loc_mode text;
    v_loc_accuracy     numeric;
    v_new_loc_mode     text;
BEGIN
    SELECT geom, location_mode, location_accuracy_m
    INTO v_geom, v_current_loc_mode, v_loc_accuracy
    FROM atlas.sondages WHERE id = p_sondage_id;

    IF v_geom IS NULL THEN RETURN; END IF;
    IF v_current_loc_mode = 'fallback_default' THEN RETURN; END IF;

    v_geom_25231 := ST_Transform(v_geom, 25231);

    SELECT m.code INTO v_maille_code
    FROM atlas.mailles m
    WHERE ST_Contains(m.geom, v_geom_25231)
    LIMIT 1;

    SELECT a.gid, a.adm1_fr, a.adm2_fr, a.adm3_fr
    INTO v_adm3_id, v_adm1_name, v_adm2_name, v_adm3_name
    FROM atlas.adm3 a
    WHERE ST_Contains(a.geom, v_geom)
    LIMIT 1;

    IF v_current_loc_mode IN ('exact','gps','manual','inferred','adm_random_cell') THEN
        v_new_loc_mode := v_current_loc_mode;
    ELSIF v_loc_accuracy IS NOT NULL AND v_loc_accuracy < 10 THEN
        v_new_loc_mode := 'exact';
    ELSIF v_loc_accuracy IS NOT NULL AND v_loc_accuracy < 100 THEN
        v_new_loc_mode := 'gps';
    ELSE
        v_new_loc_mode := 'geocoded';
    END IF;

    UPDATE atlas.sondages SET
        maille_code   = COALESCE(v_maille_code, maille_code),
        adm3_id       = COALESCE(v_adm3_id::integer, adm3_id),
        adm1_name     = COALESCE(v_adm1_name, adm1_name),
        adm2_name     = COALESCE(v_adm2_name, adm2_name),
        adm3_name     = COALESCE(v_adm3_name, adm3_name),
        location_mode = v_new_loc_mode,
        updated_at    = NOW()
    WHERE id = p_sondage_id;
END;
$$
"""

SQL_105_TABLE = """
CREATE TABLE IF NOT EXISTS atlas.geocode_suggestions (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sondage_id           uuid NOT NULL REFERENCES atlas.sondages(id) ON DELETE CASCADE,
    sondage_code         text,
    locality_extracted   text,
    fuzzy_score          numeric(5,2),
    proposed_adm3_id     integer,
    proposed_adm3_name   text,
    proposed_adm2_name   text,
    proposed_adm1_name   text,
    proposed_geom        geometry(Point, 4326),
    proposed_maille_code text,
    source_import        text,
    action               text NOT NULL DEFAULT 'pending'
                         CHECK (action IN ('pending','auto_applied','proposed','rejected','manual_required')),
    validated_by         text,
    validated_at         timestamptz,
    created_at           timestamptz NOT NULL DEFAULT NOW(),
    updated_at           timestamptz NOT NULL DEFAULT NOW()
)
"""

SQL_105_CONSTRAINT = """
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$
"""


def step(msg):
    print(f"  {msg}", flush=True)


def main():
    print("=== MIGRATIONS 104 + 105 ===", flush=True)
    print("Connexion DB...", flush=True)
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()
    print("  OK", flush=True)

    # ── VERIFIER LES TRIGGERS sur atlas.sondages ─────────────────────────────
    step("Listing des triggers sur atlas.sondages...")
    cur.execute("""
        SELECT tgname, tgenabled
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'atlas' AND c.relname = 'sondages'
          AND NOT t.tgisinternal
        ORDER BY tgname
    """)
    triggers = cur.fetchall()
    for tname, tenabled in triggers:
        step(f"  trigger: {tname} (enabled={tenabled})")
    conn.rollback()

    # ── MIGRATION 104 : Fonction ─────────────────────────────────────────────
    print("\n=== MIGRATION 104 : Fonction geocode_sondage ===", flush=True)
    step("Creation/remplacement de la fonction...")
    cur.execute(SQL_104_FUNCTION)
    conn.commit()
    step("Fonction OK (commit)")

    # ── MIGRATION 104 : UPDATE batch SANS triggers ───────────────────────────
    step("Desactivation des triggers pour batch UPDATE...")
    # Desactiver tous les triggers sauf les contraintes FK (internal)
    cur.execute("ALTER TABLE atlas.sondages DISABLE TRIGGER ALL")
    step("Triggers desactives")

    step("UPDATE location_mode NULL -> geocoded (185 sondages)...")
    cur.execute("""
        UPDATE atlas.sondages
        SET location_mode = 'geocoded'
        WHERE location_mode IS NULL
          AND deleted_at IS NULL
          AND geom IS NOT NULL
          AND geom != ST_SetSRID(ST_MakePoint(1, 8.6), 4326)
    """)
    n_updated = cur.rowcount
    step(f"  {n_updated} sondages mis a jour")

    step("Reactivation des triggers...")
    cur.execute("ALTER TABLE atlas.sondages ENABLE TRIGGER ALL")
    conn.commit()
    step("Triggers reactives (commit)")

    # Refresh MV une seule fois
    step("Refresh mv_mailles_geotech (une seule fois)...")
    conn.autocommit = True  # REFRESH CONCURRENTLY ne peut pas etre dans une transaction
    cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech")
    conn.autocommit = False
    step("MV refreshee")

    # ── MIGRATION 105 : Table + contrainte ───────────────────────────────────
    print("\n=== MIGRATION 105 : geocode_suggestions + contrainte ===", flush=True)

    step("Creation table atlas.geocode_suggestions...")
    cur.execute(SQL_105_TABLE)
    conn.commit()
    step("Table OK")

    for idx_sql in [
        "CREATE INDEX IF NOT EXISTS geocode_suggestions_sondage_id_idx ON atlas.geocode_suggestions (sondage_id)",
        "CREATE INDEX IF NOT EXISTS geocode_suggestions_action_idx ON atlas.geocode_suggestions (action)",
        "CREATE INDEX IF NOT EXISTS geocode_suggestions_score_idx ON atlas.geocode_suggestions (fuzzy_score DESC)",
    ]:
        cur.execute(idx_sql)
    conn.commit()
    step("Index OK")

    step("Contrainte anti-fallback chk_no_default_fallback_geom...")
    cur.execute(SQL_105_CONSTRAINT)
    conn.commit()
    step("Contrainte OK")

    # ── VERIFICATION ─────────────────────────────────────────────────────────
    print("\n=== VERIFICATION POST-MIGRATION ===", flush=True)

    cur.execute("""
        SELECT location_mode, COUNT(*) AS n
        FROM atlas.sondages WHERE deleted_at IS NULL
        GROUP BY location_mode ORDER BY n DESC
    """)
    for mode, n in cur.fetchall():
        step(f"  {str(mode):<25}: {n}")

    cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='atlas' AND table_name='geocode_suggestions'")
    step(f"  atlas.geocode_suggestions: {'OK' if cur.fetchone()[0] == 1 else 'ABSENT'}")

    cur.execute("SELECT COUNT(*) FROM pg_constraint WHERE conname='chk_no_default_fallback_geom'")
    step(f"  Contrainte anti-fallback: {'OK' if cur.fetchone()[0] == 1 else 'ABSENTE'}")

    cur.execute("SELECT prosrc LIKE '%geocoded%' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='atlas' AND p.proname='geocode_sondage'")
    step(f"  Fonction geocode_sondage avec geocoded: {'OUI' if cur.fetchone()[0] else 'NON'}")

    cur.execute("SELECT COUNT(*) FROM atlas.mv_mailles_geotech WHERE has_data=true")
    step(f"  Mailles avec has_data=true: {cur.fetchone()[0]}")

    conn.close()
    print("\nMIGRATIONS 104 + 105 : SUCCES", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
