#!/usr/bin/env python3
"""
Phase 0.2 remediation (AMESSEFE) — fix `localite_key` collisions.

Safety properties:
  - READ/WRITE in a single transaction
  - Preflight UNACCENT availability
  - Collision check right before commit; raises to rollback if any remain
  - Idempotent: can be executed multiple times
"""

from __future__ import annotations

import argparse
from sqlalchemy import create_engine, text


DEFAULT_PG = "postgresql+psycopg2://atlas:atlas@localhost:5432/atlas_clean"


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
    p = argparse.ArgumentParser(description="Remediate Phase 0.2 AMESSEFE localite_key")
    p.add_argument("--pgurl", default=DEFAULT_PG)
    args = p.parse_args()

    eng = create_engine(args.pgurl)
    with eng.begin() as conn:
        # Preflight: validate UNACCENT availability (extension/function)
        conn.execute(text("SELECT UNACCENT('Abc éÈ');"))

        res = conn.execute(text(UPDATE_LOCALITE_KEY_SQL))
        updated_rows = res.rowcount

        collisions = conn.execute(text(COLLISIONS_AFTER_SQL)).fetchall()
        if collisions:
            print("[FAIL] Collisions remain after localite_key remediation.")
            for r in collisions:
                print("  ", r)
            raise RuntimeError("Collisions remain after localite_key remediation.")

        print(f"[OK] localite_key updated_rows={updated_rows} ; collisions_after=0")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

