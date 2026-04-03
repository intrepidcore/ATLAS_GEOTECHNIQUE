#!/usr/bin/env python3
"""Audit DB pour roadmap interpolation nationale (étapes 1,5,7,8,9)."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def load_env() -> None:
    p = Path(__file__).resolve().parent.parent / ".env"
    if not p.is_file():
        return
    try:
        from dotenv import load_dotenv

        load_dotenv(p)
    except ImportError:
        pass
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        key, val = k.strip(), v.strip().strip('"').strip("'")
        if not key or not val:
            continue
        prev = (os.environ.get(key) or "").strip()
        if not prev or key == "DATABASE_URL":
            os.environ[key] = val


def db_url() -> str:
    load_env()
    u = (os.environ.get("DATABASE_URL") or "").strip()
    if u:
        return u
    return (
        f"postgres://{os.environ.get('POSTGRES_USER', 'atlas')}:"
        f"{os.environ.get('POSTGRES_PASSWORD', 'atlas')}@"
        f"{os.environ.get('POSTGRES_HOST', '127.0.0.1')}:"
        f"{os.environ.get('POSTGRES_PORT', '5432')}/"
        f"{os.environ.get('POSTGRES_DB', 'atlas_clean')}"
    )


def main() -> int:
    import psycopg2

    conn = psycopg2.connect(db_url())
    conn.autocommit = True
    c = conn.cursor()

    out: dict = {}

    c.execute(
        """
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'atlas' AND table_name = 'kriging_domains'
        )
        """
    )
    out["kriging_domains_table_exists"] = c.fetchone()[0]

    c.execute(
        """
        SELECT parameter_id, interpolation_enabled
        FROM atlas.ai_parameter_catalog
        WHERE parameter_id IN (
          'wl_avg', 'wp_avg', 'passant_2mm_avg', 'passant_20mm_avg'
        )
        ORDER BY parameter_id
        """
    )
    out["catalog_wl_wp_granulo"] = [
        {"parameter_id": a, "interpolation_enabled": b} for a, b in c.fetchall()
    ]

    c.execute("SELECT COUNT(*)::bigint FROM atlas.mailles")
    out["total_mailles"] = int(c.fetchone()[0])

    c.execute(
        """
        SELECT parameter_id, COUNT(DISTINCT maille_id)::bigint
        FROM atlas.ai_interpolation_values
        GROUP BY parameter_id
        ORDER BY parameter_id
        """
    )
    out["interpolation_coverage_by_parameter"] = [
        {"parameter_id": a, "distinct_maille_id": int(b)} for a, b in c.fetchall()
    ]

    c.execute(
        """
        SELECT DISTINCT target_id
        FROM atlas.ai_prediction_runs
        WHERE status = 'finished'
        ORDER BY target_id
        """
    )
    out["prediction_runs_finished_targets"] = [r[0] for r in c.fetchall()]

    c.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'atlas' AND table_name = 'ai_variograms'
        ORDER BY ordinal_position
        """
    )
    cols = [r[0] for r in c.fetchall()]
    out["ai_variograms_columns"] = cols
    out["variograms_has_anisotropy"] = any(
        "anisotropy" in x.lower() or "direction" in x.lower() for x in cols
    )

    conn.close()
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
