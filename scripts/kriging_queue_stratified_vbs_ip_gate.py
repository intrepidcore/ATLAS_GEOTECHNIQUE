#!/usr/bin/env python3
"""
Queue stratified kriging runs for VBS/IP using a density gate per atlas.zones_etude.

Gate policy:
  - support < 5      => WARN/BLOCKING: skip this zone for that parameter
  - 5 <= support<15  => WARN/NON-BLOCKING: queue run with degraded flag in metrics
  - support >= 15    => OK: queue run normally

We rely on:
  - atlas.sondages_valides_kriging for kriging-valid maille_code + sondage_id
  - atlas.mailles_zones_etude to map maille_code to zone_id
  - atlas.essais_vbs / atlas.essais_atterberg for measurement presence

This script is intentionally conservative: it queues only vbs_avg/ip_avg parameters.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import json
import psycopg2
from psycopg2.extras import execute_values


DEFAULT_DB_URL = os.environ.get("DATABASE_URL", "")
AMESSEFE_SOURCE = "AMESSEFE Komi Yoan Freddy"


PARAM_VBS = "vbs_avg"
PARAM_IP = "ip_avg"


DB_SCHEMA = "atlas"


@dataclass(frozen=True)
class SupportGate:
    low: int = 5
    mid: int = 15


def _require_env_dburl(db_url: str) -> str:
    if db_url:
        return db_url
    if DEFAULT_DB_URL:
        return DEFAULT_DB_URL
    sys.exit("DATABASE_URL (or --database-url) is required")


def compute_support_counts(
    conn,
    priorite_max: int,
) -> Dict[Tuple[str, str], int]:
    """
    Returns counts keyed by (zone_id, parameter_id) where parameter_id in {vbs_avg, ip_avg}.
    Count definition:
      - distinct sondage_id with at least one non-null measurement for the parameter
      - mapped to zone_id via maille_code -> mailles_zones_etude (priorite_recherche <= priorite_max)
      - filtered by sondages_valides_kriging.is_valid_for_kriging
    """
    q = f"""
    WITH valid AS (
        SELECT
            sondage_id,
            maille_code
        FROM {DB_SCHEMA}.sondages_valides_kriging
        WHERE is_valid_for_kriging = true
          AND maille_code IS NOT NULL
    ),
    maille_zone AS (
        SELECT
            v.sondage_id,
            mz.zone_id
        FROM valid v
        JOIN {DB_SCHEMA}.mailles m
          ON m.code = v.maille_code
        JOIN {DB_SCHEMA}.mailles_zones_etude mz
          ON mz.maille_id = m.id
        WHERE mz.priorite_recherche <= %(priorite_max)s
    ),
    vbs_points AS (
        SELECT DISTINCT
            mz.zone_id,
            mz.sondage_id
        FROM maille_zone mz
        JOIN {DB_SCHEMA}.echantillons e
          ON e.sondage_id = mz.sondage_id
        JOIN {DB_SCHEMA}.essais_vbs ev
          ON ev.echantillon_id = e.id
        WHERE ev.vbs IS NOT NULL
    ),
    ip_points AS (
        SELECT DISTINCT
            mz.zone_id,
            mz.sondage_id
        FROM maille_zone mz
        JOIN {DB_SCHEMA}.echantillons e
          ON e.sondage_id = mz.sondage_id
        JOIN {DB_SCHEMA}.essais_atterberg ea
          ON ea.echantillon_id = e.id
        WHERE ea.ip_generated IS NOT NULL
    )
    SELECT
        vp.zone_id::text AS zone_id,
        'vbs_avg'::text AS parameter_id,
        COUNT(DISTINCT vp.sondage_id)::int AS support_points
    FROM vbs_points vp
    GROUP BY vp.zone_id

    UNION ALL

    SELECT
        ip.zone_id::text AS zone_id,
        'ip_avg'::text AS parameter_id,
        COUNT(DISTINCT ip.sondage_id)::int AS support_points
    FROM ip_points ip
    GROUP BY ip.zone_id
    ;
    """

    out: Dict[Tuple[str, str], int] = defaultdict(int)
    with conn.cursor() as cur:
        cur.execute(q, {"priorite_max": priorite_max})
        rows = cur.fetchall()
        for zone_id, param_id, support in rows:
            out[(zone_id, param_id)] = int(support or 0)
    return out


def queue_runs(
    conn,
    zones_to_queue: List[Tuple[str, str]],
    dry_run: bool,
    run_method: str,
    set_metrics_support: bool,
    support_counts: Dict[Tuple[str, str], int],
):
    """
    zones_to_queue: list of (zone_id_text, parameter_id)
    """
    inserted = 0
    if dry_run:
        for zone_id, param_id in zones_to_queue:
            sp = support_counts.get((zone_id, param_id), 0)
            print(f"[DRY-RUN] would queue zone_id={zone_id} param={param_id} support_points={sp}")
        return 0

    rows = []
    # Insert uses the same shape as kriging_multi_param.py (status=queued, run_type=kriging)
    for zone_id, param_id in zones_to_queue:
        sp = support_counts.get((zone_id, param_id), 0)
        metrics: Dict[str, object] = {}
        if set_metrics_support:
            metrics["support_points"] = sp
        metrics["gate"] = "vbs_ip_density"
        rows.append((zone_id, param_id, run_method, json.dumps(metrics, ensure_ascii=False)))

    # Filter out already-queued runs to avoid duplicates (no UNIQUE constraint on zone_id x parameter_id).
    zone_param_pairs = {(r[0], r[1]) for r in rows}
    existing_pairs: set[Tuple[str, str]] = set()
    with conn.cursor() as cur:
        # Fetch already queued runs (status=queued) for these pairs.
        # We cannot use temp tables; instead we constrain by zone_id list and parameter_id IN (...).
        zone_ids = sorted({z for z, _ in zone_param_pairs})
        cur.execute(
            f"""
            SELECT zone_id::text AS zone_id, parameter_id
            FROM {DB_SCHEMA}.ai_interpolation_runs
            WHERE run_type = 'kriging'
              AND status = 'queued'
              AND zone_id = ANY(%s::uuid[])
              AND parameter_id IN (%s, %s)
            """,
            (zone_ids, PARAM_VBS, PARAM_IP),
        )
        for zone_id, parameter_id in cur.fetchall():
            existing_pairs.add((zone_id, str(parameter_id)))

    filtered_rows = [r for r in rows if (r[0], r[1]) not in existing_pairs]

    if filtered_rows:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO atlas.ai_interpolation_runs
                  (zone_id, parameter_id, method, status, metrics, run_type)
                VALUES
                  %s
                """,
                filtered_rows,
                template="(%s::uuid,%s,%s,'queued',%s::jsonb,'kriging')",
                page_size=200,
            )
        inserted = len(filtered_rows)
    else:
        inserted = 0
    conn.commit()
    return inserted


def main() -> int:
    ap = argparse.ArgumentParser(description="Queue stratified VBS/IP kriging runs with density gate")
    ap.add_argument("--database-url", default=DEFAULT_DB_URL, help="Postgres SQLAlchemy URL")
    ap.add_argument("--priorite-max", type=int, default=2, help="mailles_zones_etude.priorite_recherche <= N")
    ap.add_argument("--gate-low", type=int, default=5, help="support < low => skip")
    ap.add_argument("--gate-mid", type=int, default=15, help="low <= support < mid => degraded")
    ap.add_argument("--dry-run", action="store_true", help="Do not insert, only print plan")
    ap.add_argument("--apply", action="store_true", help="Actually insert (otherwise dry-run-like).")
    ap.add_argument("--run-method", default="ordinary_kriging", help="Value to set in ai_interpolation_runs.method")
    args = ap.parse_args()

    db_url = _require_env_dburl(args.database_url)

    gate = SupportGate(low=args.gate_low, mid=args.gate_mid)

    conn = psycopg2.connect(db_url)
    try:
        support_counts = compute_support_counts(conn, priorite_max=args.priorite_max)

        # Build candidate zone list from zone plan (so we only queue published zones for these params)
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT DISTINCT zone_id::text, parameter_id
                FROM {DB_SCHEMA}.v_ai_kriging_zone_plan
                WHERE parameter_id IN (%s, %s)
                ORDER BY zone_id::text, parameter_id;
                """,
                (PARAM_VBS, PARAM_IP),
            )
            candidates = cur.fetchall()

        zones_to_queue: List[Tuple[str, str]] = []
        stats = {
            "queued_ok": 0,
            "queued_degraded": 0,
            "skipped_low": 0,
        }

        for zone_id, param_id in candidates:
            sp = int(support_counts.get((zone_id, param_id), 0))
            if sp < gate.low:
                print(f"[WARN][BLOCKING-SKIP] zone={zone_id} param={param_id} support_points={sp} < {gate.low}")
                stats["skipped_low"] += 1
                continue
            if sp < gate.mid:
                # Degraded but queued (later fallback handled by pipeline policy)
                print(f"[WARN][DEGRADED-QUEUE] zone={zone_id} param={param_id} support_points={sp} in [{gate.low},{gate.mid})")
                zones_to_queue.append((zone_id, param_id))
                stats["queued_degraded"] += 1
                continue
            print(f"[OK][QUEUE] zone={zone_id} param={param_id} support_points={sp} >= {gate.mid}")
            zones_to_queue.append((zone_id, param_id))
            stats["queued_ok"] += 1

        dry_run = not args.apply or args.dry_run
        inserted = queue_runs(
            conn=conn,
            zones_to_queue=zones_to_queue,
            dry_run=dry_run,
            run_method=args.run_method,
            set_metrics_support=True,
            support_counts=support_counts,
        )

        print(f"[RESULT] queued candidates={len(zones_to_queue)} inserted_estimate={inserted} stats={stats}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())

