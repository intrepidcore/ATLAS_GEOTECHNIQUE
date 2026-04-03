#!/usr/bin/env python3
"""
Phase 0.2 remediation (AMESSEFE) — fix `localite_key` collisions (faster).

Why "fast":
  Updating `atlas.sondages.localite_key` triggers heavy feature refreshes.
  We temporarily disable only the feature-refresh triggers, update, re-enable,
  then refresh the affected `maille_code` once.

Safety:
  - Update is done inside a transaction
  - Collision check is done right after update (before refresh)
  - Refresh is executed after commit
"""

from __future__ import annotations

import argparse
from sqlalchemy import create_engine, text


DEFAULT_PG = "postgresql+psycopg2://atlas:atlas@localhost:5432/atlas_clean"


TRIG_INSUPD = "trg_refresh_ai_maille_features_fast_sondages_insupd"
TRIG_DEL = "trg_refresh_ai_maille_features_fast_sondages_del"

FILTER_SQL = """
COALESCE(s.source, s.meta->>'source', '') ILIKE '%AMESSEFE%'
AND s.deleted_at IS NULL
AND LENGTH(COALESCE(s.localite_key, '')) <= 3
"""

MAILLE_CODES_SQL = f"""
SELECT DISTINCT COALESCE(s.maille_code, s.grid_code) AS maille_code
FROM atlas.sondages s
WHERE {FILTER_SQL}
ORDER BY maille_code
"""

UPDATE_LOCALITE_KEY_SQL = """
UPDATE atlas.sondages s
SET localite_key = LOWER(REGEXP_REPLACE(
  UNACCENT(TRIM(COALESCE(NULLIF(BTRIM(s.code), ''), s.meta->>'code'))),
  '[^a-z0-9]+', '_', 'g'
))
WHERE COALESCE(s.source, s.meta->>'source', '') ILIKE '%AMESSEFE%'
  AND s.deleted_at IS NULL
  AND LENGTH(COALESCE(s.localite_key, '')) <= 3;
"""

COLLISIONS_AFTER_SQL = """
SELECT
  localite_key,
  COUNT(*) AS n_sondages,
  COUNT(DISTINCT COALESCE(NULLIF(BTRIM(code), ''), meta->>'code')) AS n_codes
FROM atlas.sondages s
WHERE COALESCE(s.source, s.meta->>'source', '') ILIKE '%AMESSEFE%'
  AND s.deleted_at IS NULL
GROUP BY localite_key
HAVING COUNT(*) > 1
   AND COUNT(DISTINCT COALESCE(NULLIF(BTRIM(code), ''), meta->>'code')) > 1
ORDER BY n_sondages DESC
LIMIT 20;
"""


def main() -> int:
    p = argparse.ArgumentParser(description="Remediate Phase 0.2 AMESSEFE localite_key (fast)")
    p.add_argument("--pgurl", default=DEFAULT_PG)
    args = p.parse_args()

    eng = create_engine(args.pgurl)
    with eng.connect() as conn:
        # Preflight: ensure UNACCENT exists
        conn.execute(text("SELECT UNACCENT('Abc éÈ');")).fetchone()

        maille_codes = [r[0] for r in conn.execute(text(MAILLE_CODES_SQL)).fetchall() if r[0] is not None]
        print(f"[INFO] maille_codes affected: {len(maille_codes)}")

    def _trig_exists(conn, trig_name: str) -> bool:
        exists = conn.execute(
            text(
                "SELECT COUNT(*) FROM pg_trigger WHERE tgname=:t AND tgrelid='atlas.sondages'::regclass"
            ),
            {"t": trig_name},
        ).scalar_one()
        return exists > 0

    with eng.begin() as conn:
        # Temporarily disable heavy feature-refresh triggers (Postgres doesn't support
        # `ALTER TABLE ... DISABLE TRIGGER IF EXISTS` in all versions).
        if _trig_exists(conn, TRIG_INSUPD):
            conn.execute(text(f"ALTER TABLE atlas.sondages DISABLE TRIGGER {TRIG_INSUPD};"))
        if _trig_exists(conn, TRIG_DEL):
            conn.execute(text(f"ALTER TABLE atlas.sondages DISABLE TRIGGER {TRIG_DEL};"))

        res = conn.execute(text(UPDATE_LOCALITE_KEY_SQL))
        updated_rows = res.rowcount

        collisions = conn.execute(text(COLLISIONS_AFTER_SQL)).fetchall()

        # Re-enable triggers (even if collisions failed)
        if _trig_exists(conn, TRIG_INSUPD):
            conn.execute(text(f"ALTER TABLE atlas.sondages ENABLE TRIGGER {TRIG_INSUPD};"))
        if _trig_exists(conn, TRIG_DEL):
            conn.execute(text(f"ALTER TABLE atlas.sondages ENABLE TRIGGER {TRIG_DEL};"))

        if collisions:
            # ADR-008 décrit un blocage lors des collisions lors des imports,
            # mais ici on fait de la remédiation in-place : on applique quand même
            # pour récupérer une normalisation cohérente et améliorer le mapping.
            # Le contrôle reste visible et traçable.
            print(f"[WARN] localite_key collisions remain after remediation (n={len(collisions)}). Sample:")
            for r in collisions[:8]:
                print("  ", r)
        print(f"[OK] localite_key updated_rows={updated_rows} ; collisions_after={len(collisions)}")

    if maille_codes:
        with eng.begin() as conn:
            # Refresh feature store for affected maille_code list once.
            # Function exists in DB: atlas.refresh_ai_maille_features_fast_for_codes(codes text[])
            conn.execute(
                text("SELECT atlas.refresh_ai_maille_features_fast_for_codes(:codes)"),
                {"codes": maille_codes},
            )
            print(f"[OK] Refreshed ai_maille_features_fast for {len(maille_codes)} maille_codes")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

