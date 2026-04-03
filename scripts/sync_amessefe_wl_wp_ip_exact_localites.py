#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import psycopg2


DB_DEFAULT = os.environ.get("DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5432/atlas_clean")
AMESSEFE_SOURCE = "AMESSEFE Komi Yoan Freddy"


def _parse_target_localites(s: str) -> List[str]:
    # Inputs are assumed to be already localite_norm-like (no fuzzy), but we normalize anyway.
    from utils.normalize import normalize_localite

    raw = [x.strip() for x in s.split(",") if x.strip()]
    out: List[str] = []
    for x in raw:
        n = normalize_localite(x)
        if n:
            out.append(n)
    return sorted(set(out))


def _get_sondage_map(conn, source_label: str, target_set: Sequence[str]) -> Dict[str, str]:
    """
    Map localite_norm -> sondage_id for AMESSEFE rows in DB.
    We normalize DB display fields using `normalize_localite` to match excel.localite_norm.
    """
    from utils.normalize import normalize_localite

    cur = conn.cursor()
    cur.execute(
        """
        SELECT
          id::text AS sondage_id,
          COALESCE(localite, localite_base, meta->>'localite', code) AS localite_raw
        FROM atlas.sondages
        WHERE source = %s
          AND deleted_at IS NULL
        """,
        (source_label,),
    )
    mapping: Dict[str, str] = {}
    for sondage_id, localite_raw in cur.fetchall():
        norm = normalize_localite(localite_raw or "")
        if not norm:
            continue
        if norm in target_set and norm not in mapping:
            mapping[norm] = sondage_id
    cur.close()
    return mapping


def _get_echantillon_map(conn, sondage_id: str, depths: Iterable[float]) -> Dict[float, List[str]]:
    depths_list = list(depths)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id::text AS echantillon_id, depth_m
        FROM atlas.echantillons
        WHERE sondage_id = %s
          AND depth_m = ANY(CAST(%s AS numeric[]))
        """,
        (sondage_id, depths_list),
    )
    out: Dict[float, List[str]] = {}
    for echantillon_id, depth_m in cur.fetchall():
        if depth_m is None:
            continue
        out.setdefault(float(depth_m), []).append(echantillon_id)
    cur.close()
    return out


def _compute_ip(wl: Optional[float], wp: Optional[float], ip: Optional[float]) -> Optional[float]:
    if ip is not None:
        return float(ip)
    if wl is not None and wp is not None:
        return float(wl - wp)
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Exact sync WL/WP/IP from Excel into DB for target localities")
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument("--localites", required=True, help="Comma-separated target localite_norm values.")
    ap.add_argument("--excel-limit-depths", default=None, help="Optional: comma-separated depths (numeric).")
    ap.add_argument("--commit", action="store_true", help="If set, write DB updates. Otherwise dry-run.")
    ap.add_argument(
        "--clear-non-excel-depths",
        action="store_true",
        help="If set, set wl/wp/ip_generated to NULL for all essais_atterberg rows whose depth_m is NOT present in Excel for the target locality.",
    )
    args = ap.parse_args()

    target_localites = _parse_target_localites(args.localites)
    if not target_localites:
        raise SystemExit("No valid target localites after normalization.")

    from utils.amessefe_excel import load_limites

    excel_by_loc: Dict[str, List] = {loc: [] for loc in target_localites}
    for rec in load_limites():
        if rec.localite_norm not in target_localites:
            continue
        if args.excel_limit_depths:
            depths_allowed = {float(x.strip()) for x in args.excel_limit_depths.split(",") if x.strip()}
            if rec.depth_m not in depths_allowed:
                continue
        excel_by_loc[rec.localite_norm].append(rec)

    conn = psycopg2.connect(args.database_url)
    try:
        sondage_map = _get_sondage_map(conn, AMESSEFE_SOURCE, target_localites)
        missing_db = [loc for loc in target_localites if loc not in sondage_map]
        if missing_db:
            print(f"[ERROR] Missing DB sondage mapping for: {missing_db}")
            raise SystemExit(2)

        total_updated = 0
        for loc in target_localites:
            recs = excel_by_loc.get(loc, [])
            if not recs:
                print(f"[WARN] No Excel limite records found for localite_norm={loc}")
                continue

            sid = sondage_map[loc]
            depths = sorted({float(r.depth_m) for r in recs if r.depth_m is not None})
            e_map = _get_echantillon_map(conn, sid, depths)

            missing_e = [d for d in depths if d not in e_map]
            if missing_e:
                print(f"[WARN] Missing echantillon for localite_norm={loc}, depths={missing_e}. Those rows will be skipped.")

            if args.clear_non_excel_depths:
                # Clear all existing essais_atterberg numeric values for depths not present in Excel.
                # This is required for the strict health gate based on DB means vs Excel means.
                clear_cur = conn.cursor()
                if depths:
                    clear_cur.execute(
                        """
                        UPDATE atlas.essais_atterberg ea
                        SET wl = NULL,
                            wp = NULL,
                            ip_generated = NULL
                        FROM atlas.echantillons e
                        WHERE e.id = ea.echantillon_id
                          AND e.sondage_id = %s
                          AND NOT (e.depth_m = ANY(CAST(%s AS numeric[])))
                        """,
                        (sid, depths),
                    )
                else:
                    clear_cur.execute(
                        """
                        UPDATE atlas.essais_atterberg ea
                        SET wl = NULL,
                            wp = NULL,
                            ip_generated = NULL
                        FROM atlas.echantillons e
                        WHERE e.id = ea.echantillon_id
                          AND e.sondage_id = %s
                        """,
                        (sid,),
                    )
                clear_cur.close()

            cur = conn.cursor()
            for rec in recs:
                if rec.depth_m is None:
                    continue
                d = float(rec.depth_m)
                if d not in e_map:
                    continue
                wl = rec.wl if rec.wl is not None else None
                wp = rec.wp if rec.wp is not None else None
                ip = rec.ip if rec.ip is not None else None
                ip_generated = _compute_ip(wl, wp, ip)

                # If all are missing, skip to avoid creating empty rows.
                if wl is None and wp is None and ip_generated is None:
                    continue

                for eid in e_map[d]:
                    if not args.commit:
                        print(
                            f"[DRYRUN] {loc} depth={d} eid={eid} wl={wl} wp={wp} ip_generated={ip_generated}"
                        )
                        continue

                    cur.execute(
                        """
                        INSERT INTO atlas.essais_atterberg (echantillon_id, wl, wp, ip_generated, source_reference, created_at)
                        VALUES (%s, %s, %s, %s, %s, now())
                        ON CONFLICT (echantillon_id) DO UPDATE SET
                          wl = EXCLUDED.wl,
                          wp = EXCLUDED.wp,
                          ip_generated = EXCLUDED.ip_generated,
                          source_reference = EXCLUDED.source_reference
                        """,
                        (eid, wl, wp, ip_generated, AMESSEFE_SOURCE),
                    )
                    total_updated += 1
            cur.close()

        if args.commit:
            conn.commit()
        print(f"[SYNC] targets={target_localites} total_rows_written={total_updated} commit={args.commit}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())

