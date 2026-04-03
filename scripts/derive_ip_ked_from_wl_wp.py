#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import uuid
from typing import Dict, List, Tuple

import psycopg2
from psycopg2.extras import execute_batch

DB_DEFAULT = os.environ.get("DATABASE_URL", "postgresql://atlas:atlas@localhost:5432/atlas_clean")
HORIZONS: List[str] = ["h1", "h2", "h3"]


def ensure_param(cur, pid: str) -> None:
    cur.execute("SELECT 1 FROM atlas.ai_parameter_catalog WHERE parameter_id=%s LIMIT 1", (pid,))
    if cur.fetchone():
        return
    cur.execute(
        """
        INSERT INTO atlas.ai_parameter_catalog
          (parameter_id, category, source, unit, interpolation_enabled, prediction_enabled, is_active,
           source_table, source_column, domain_type_pref, drift_strategy, physical_min, physical_max,
           depth_stratified, is_derived, derived_from)
        VALUES
          (%s, 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE,
           'ai_interpolation_values', 'value', 'pedologie', 'deterministic_derived', 0, 100,
           TRUE, TRUE, %s::text[])
        ON CONFLICT (parameter_id) DO NOTHING
        """,
        (pid, [f"wl_ked_{pid[-2:]}", f"wp_ked_{pid[-2:]}"]),
    )


def run_one(conn, horizon: str) -> Dict[str, object]:
    src_wl = f"wl_ked_{horizon}"
    src_wp = f"wp_ked_{horizon}"
    src_ip_ked = f"ip_ked_{horizon}"
    dst_ip = f"ip_derived_{horizon}"

    cur = conn.cursor()
    ensure_param(cur, dst_ip)

    run_id = str(uuid.uuid4())
    cur.execute(
        """
        INSERT INTO atlas.ai_interpolation_runs
          (id, run_type, parameter_id, method, model_version, status, metrics, started_at, finished_at, zone_id, kriging_domain_id)
        VALUES
          (%s, 'kriging', %s, 'derived_ip_from_wl_wp', 'v1', 'finished', '{}'::jsonb, now(), now(), NULL, NULL)
        """,
        (run_id, dst_ip),
    )

    cur.execute(
        """
        WITH wl AS (
          SELECT maille_id, value
          FROM atlas.v_latest_ai_interpolation
          WHERE parameter_id = %s
        ),
        wp AS (
          SELECT maille_id, value
          FROM atlas.v_latest_ai_interpolation
          WHERE parameter_id = %s
        )
        SELECT wl.maille_id::text, wl.value::double precision, wp.value::double precision
        FROM wl
        JOIN wp ON wp.maille_id = wl.maille_id
        WHERE wl.value IS NOT NULL AND wp.value IS NOT NULL
        """,
        (src_wl, src_wp),
    )
    rows_src: List[Tuple[str, float, float]] = cur.fetchall()
    if not rows_src:
        conn.rollback()
        cur.close()
        return {"ok": False, "horizon": horizon.upper(), "reason": "no_source_rows"}

    clipped_negative = 0
    rows_insert = []
    for maille_id, wl_val, wp_val in rows_src:
        raw = float(wl_val) - float(wp_val)
        if raw < 0:
            clipped_negative += 1
        ip_val = max(0.0, raw)
        rows_insert.append(
            (
                str(uuid.uuid4()),
                maille_id,
                dst_ip,
                ip_val,
                run_id,
            )
        )

    # Mark current active derived rows as superseded before inserting new ones.
    cur.execute(
        """
        UPDATE atlas.ai_interpolation_values
        SET is_superseded = true
        WHERE parameter_id = %s
          AND COALESCE(is_superseded, false) = false
        """,
        (dst_ip,),
    )

    execute_batch(
        cur,
        """
        INSERT INTO atlas.ai_interpolation_values
          (id, maille_id, zone_id, kriging_domain_id, parameter_id, value, variance, confidence, method, variogram_id, run_id, created_at, is_superseded)
        VALUES
          (%s::uuid, %s::uuid, NULL, NULL, %s, %s, NULL, 100.0, 'derived_ip_from_wl_wp', NULL, %s::uuid, now(), false)
        """,
        rows_insert,
        page_size=2000,
    )

    # P5 rule: ip_ked_h* from P3 becomes superseded once ip_derived_h* is available.
    cur.execute(
        """
        UPDATE atlas.ai_interpolation_values
        SET is_superseded = true
        WHERE parameter_id = %s
          AND COALESCE(is_superseded, false) = false
        """,
        (src_ip_ked,),
    )

    cur.execute(
        """
        UPDATE atlas.ai_interpolation_runs
        SET metrics = %s::jsonb
        WHERE id = %s::uuid
        """,
        (
            json.dumps(
                {
                    "horizon": horizon.upper(),
                    "src_wl": src_wl,
                    "src_wp": src_wp,
                    "src_ip_ked": src_ip_ked,
                    "rows_inserted": len(rows_insert),
                    "clipped_negative": clipped_negative,
                }
            ),
            run_id,
        ),
    )

    conn.commit()
    cur.close()
    return {
        "ok": True,
        "horizon": horizon.upper(),
        "rows_inserted": len(rows_insert),
        "clipped_negative": clipped_negative,
        "run_id": run_id,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--database-url", default=DB_DEFAULT)
    args = ap.parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL required")
    conn = psycopg2.connect(args.database_url)
    try:
        out = [run_one(conn, hz) for hz in HORIZONS]
    finally:
        conn.close()
    print(json.dumps({"runs": out}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

