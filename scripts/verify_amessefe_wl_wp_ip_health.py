#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import os
import statistics
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import psycopg2


DB_DEFAULT = os.environ.get("DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5432/atlas_clean")


@dataclass
class Agg:
    wl_vals: List[float]
    wp_vals: List[float]
    ip_vals: List[float]


def _mean_or_none(values: Iterable[float]) -> Optional[float]:
    vals = [float(v) for v in values if v is not None]
    return float(statistics.mean(vals)) if vals else None


def _safe_diff(a: Optional[float], b: Optional[float]) -> Optional[float]:
    if a is None or b is None:
        return None
    return abs(float(a) - float(b))


def _status_from_diffs(
    d_wl: Optional[float], d_wp: Optional[float], d_ip: Optional[float], threshold: float
) -> str:
    comparable = [d for d in (d_wl, d_wp, d_ip) if d is not None]
    if not comparable:
        return "NO_COMPARABLE_VALUES"
    if max(comparable) > threshold:
        return "DIVERGENCE_GT_THRESHOLD"
    return "OK"


def _load_excel_aggs() -> Dict[str, Agg]:
    scripts_dir = Path(__file__).resolve().parent
    import sys

    sys.path.insert(0, str(scripts_dir))
    from utils.amessefe_excel import load_limites  # pylint: disable=import-error

    # Group by (localite_norm, depth_m) then keep one value per depth.
    # This avoids bias when the DB contains multiple echantillons at the same depth.
    by_loc_depth: Dict[str, Dict[float, Agg]] = defaultdict(
        lambda: defaultdict(lambda: Agg([], [], []))
    )
    for rec in load_limites():
        loc = rec.localite_norm
        if not loc or rec.depth_m is None:
            continue
        d = float(rec.depth_m)
        if rec.wl is not None:
            by_loc_depth[loc][d].wl_vals.append(float(rec.wl))
        if rec.wp is not None:
            by_loc_depth[loc][d].wp_vals.append(float(rec.wp))
        ip_calc = rec.ip
        if ip_calc is None and rec.wl is not None and rec.wp is not None:
            ip_calc = float(rec.wl) - float(rec.wp)
        if ip_calc is not None:
            by_loc_depth[loc][d].ip_vals.append(float(ip_calc))

    # Flatten to localite-level lists of depth-means.
    by_loc: Dict[str, Agg] = defaultdict(lambda: Agg([], [], []))
    for loc, depth_map in by_loc_depth.items():
        for _, depth_agg in depth_map.items():
            wl_mean = _mean_or_none(depth_agg.wl_vals)
            wp_mean = _mean_or_none(depth_agg.wp_vals)
            ip_mean = _mean_or_none(depth_agg.ip_vals)
            if wl_mean is not None:
                by_loc[loc].wl_vals.append(wl_mean)
            if wp_mean is not None:
                by_loc[loc].wp_vals.append(wp_mean)
            if ip_mean is not None:
                by_loc[loc].ip_vals.append(ip_mean)
    return by_loc


def _load_db_aggs(db_dsn: str) -> Dict[str, Agg]:
    scripts_dir = Path(__file__).resolve().parent
    import sys

    sys.path.insert(0, str(scripts_dir))
    from utils.normalize import normalize_localite  # pylint: disable=import-error

    by_loc_depth: Dict[str, Dict[float, Agg]] = defaultdict(
        lambda: defaultdict(lambda: Agg([], [], []))
    )
    conn = psycopg2.connect(db_dsn)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
              COALESCE(s.localite, s.localite_base, s.localite_key)::text AS localite_db,
              e.depth_m::float8 AS depth_m,
              ea.wl::float8 AS wl,
              ea.wp::float8 AS wp,
              COALESCE(ea.ip_generated, (ea.wl - ea.wp))::float8 AS ip_calc
            FROM atlas.sondages s
            JOIN atlas.echantillons e ON e.sondage_id = s.id
            JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id
            WHERE s.deleted_at IS NULL
              AND (
                s.source ILIKE '%AMESSEFE%'
                OR ea.source_reference ILIKE '%AMESSEFE%'
              )
            """
        )
        for localite_db, depth_m, wl, wp, ip_calc in cur.fetchall():
            loc_norm = normalize_localite(localite_db or "")
            if not loc_norm:
                continue
            d = float(depth_m)
            if wl is not None:
                by_loc_depth[loc_norm][d].wl_vals.append(float(wl))
            if wp is not None:
                by_loc_depth[loc_norm][d].wp_vals.append(float(wp))
            if ip_calc is not None:
                by_loc_depth[loc_norm][d].ip_vals.append(float(ip_calc))
    finally:
        conn.close()
    # Flatten to localite-level lists of depth-means.
    by_loc: Dict[str, Agg] = defaultdict(lambda: Agg([], [], []))
    for loc, depth_map in by_loc_depth.items():
        for _, depth_agg in depth_map.items():
            wl_mean = _mean_or_none(depth_agg.wl_vals)
            wp_mean = _mean_or_none(depth_agg.wp_vals)
            ip_mean = _mean_or_none(depth_agg.ip_vals)
            if wl_mean is not None:
                by_loc[loc].wl_vals.append(wl_mean)
            if wp_mean is not None:
                by_loc[loc].wp_vals.append(wp_mean)
            if ip_mean is not None:
                by_loc[loc].ip_vals.append(ip_mean)
    return by_loc


def main() -> int:
    ap = argparse.ArgumentParser(description="Compare raw Excel vs DB for AMESSEFE WL/WP/IP by locality.")
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument("--threshold", type=float, default=0.1)
    ap.add_argument(
        "--output-csv",
        default="audit_output/amessefe_wl_wp_ip_health_check.csv",
    )
    args = ap.parse_args()

    excel_aggs = _load_excel_aggs()
    db_aggs = _load_db_aggs(args.database_url)

    out_path = Path(args.output_csv)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    localites = sorted(set(excel_aggs.keys()) | set(db_aggs.keys()))
    rows = []
    for loc in localites:
        e = excel_aggs.get(loc, Agg([], [], []))
        d = db_aggs.get(loc, Agg([], [], []))

        e_wl = _mean_or_none(e.wl_vals)
        e_wp = _mean_or_none(e.wp_vals)
        e_ip = _mean_or_none(e.ip_vals)
        d_wl = _mean_or_none(d.wl_vals)
        d_wp = _mean_or_none(d.wp_vals)
        d_ip = _mean_or_none(d.ip_vals)

        diff_wl = _safe_diff(e_wl, d_wl)
        diff_wp = _safe_diff(e_wp, d_wp)
        diff_ip = _safe_diff(e_ip, d_ip)
        status = _status_from_diffs(diff_wl, diff_wp, diff_ip, args.threshold)

        rows.append(
            {
                "localite_norm": loc,
                "excel_n_wl": len(e.wl_vals),
                "excel_n_wp": len(e.wp_vals),
                "excel_n_ip_calc": len(e.ip_vals),
                "excel_wl_mean": e_wl,
                "excel_wp_mean": e_wp,
                "excel_ip_calc_mean": e_ip,
                "db_n_wl": len(d.wl_vals),
                "db_n_wp": len(d.wp_vals),
                "db_n_ip_calc": len(d.ip_vals),
                "db_wl_mean": d_wl,
                "db_wp_mean": d_wp,
                "db_ip_calc_mean": d_ip,
                "abs_diff_wl": diff_wl,
                "abs_diff_wp": diff_wp,
                "abs_diff_ip": diff_ip,
                "threshold": args.threshold,
                "status": status,
            }
        )

    fields = list(rows[0].keys()) if rows else []
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    n_total = len(rows)
    n_bad = sum(1 for r in rows if r["status"] == "DIVERGENCE_GT_THRESHOLD")
    n_ok = sum(1 for r in rows if r["status"] == "OK")
    n_no_cmp = sum(1 for r in rows if r["status"] == "NO_COMPARABLE_VALUES")

    print(f"[HEALTH] total_localites={n_total}")
    print(f"[HEALTH] ok={n_ok} divergence_gt_{args.threshold}={n_bad} no_comparable={n_no_cmp}")
    print(f"[HEALTH] csv={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
