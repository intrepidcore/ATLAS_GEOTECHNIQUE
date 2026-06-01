#!/usr/bin/env python3
"""
snapshot_rmse_traceability.py
Capture un snapshot des LOO-RMSE courants dans atlas.ai_run_snapshots
pour comparer l'evolution des metriques avant/apres import de nouvelles donnees.

Usage:
  # Snapshot avant import
  python snapshot_rmse_traceability.py --tag pre_trec_import --note "Avant BADJA+DZEMEKEY, N_vbs=810"

  # Snapshot apres import
  python snapshot_rmse_traceability.py --tag post_trec_import --note "Apres BADJA+DZEMEKEY, N_vbs=844"

  # Comparaison
  python snapshot_rmse_traceability.py --compare pre_trec_import post_trec_import
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional

import psycopg2

DB_DEFAULT = os.environ.get(
    "DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
)

# -------------------------------------------------------------------------
# Migration : cree la table si elle n'existe pas
# -------------------------------------------------------------------------

DDL_SNAPSHOTS = """
CREATE TABLE IF NOT EXISTS atlas.ai_run_snapshots (
    id           SERIAL PRIMARY KEY,
    tag          TEXT NOT NULL,
    note         TEXT,
    captured_at  TIMESTAMPTZ DEFAULT now(),
    metrics_json JSONB NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_run_snapshots_tag
    ON atlas.ai_run_snapshots(tag);
"""


def ensure_table(cur):
    cur.execute(DDL_SNAPSHOTS)


# -------------------------------------------------------------------------
# Extraction des metriques courantes
# -------------------------------------------------------------------------

def collect_current_metrics(cur) -> Dict:
    """
    Collecte le dernier run de chaque (parameter_id, method) avec LOO-RMSE.
    Retourne un dict structure par parametre.
    """
    # 1. Methode KED (loo_residual imbriquee)
    cur.execute("""
        SELECT DISTINCT ON (parameter_id, method)
               parameter_id, method,
               (metrics->'loo_residual'->>'rmse')::float  AS loo_rmse,
               (metrics->'loo_residual'->>'n')::float     AS n_pts,
               metrics->>'drift_method'                   AS drift_method,
               metrics->>'n_train'                        AS n_train,
               created_at
        FROM atlas.ai_interpolation_runs
        WHERE metrics->'loo_residual'->>'rmse' IS NOT NULL
        ORDER BY parameter_id, method, created_at DESC
    """)
    ked_rows = cur.fetchall()

    # 2. Methode RK (loo_rmse top-level)
    cur.execute("""
        SELECT DISTINCT ON (parameter_id, method)
               parameter_id, method,
               (metrics->>'loo_rmse')::float   AS loo_rmse,
               NULL::float                     AS n_pts,
               NULL                            AS drift_method,
               NULL                            AS n_train,
               created_at
        FROM atlas.ai_interpolation_runs
        WHERE metrics->>'loo_rmse' IS NOT NULL
        ORDER BY parameter_id, method, created_at DESC
    """)
    rk_rows = cur.fetchall()

    metrics = {}
    for row in ked_rows + rk_rows:
        pid, method, loo_rmse, n_pts, drift, n_train, created_at = row
        if pid not in metrics:
            metrics[pid] = {}
        metrics[pid][method] = {
            "loo_rmse":    round(float(loo_rmse), 6) if loo_rmse is not None else None,
            "n_pts":       int(float(n_pts)) if n_pts is not None else None,
            "n_train":     int(n_train) if n_train else None,
            "drift_method": drift,
            "run_date":    str(created_at)[:19],
        }

    # 3. Comptage sondages par parametre (tracabilite N)
    n_queries = {
        "vbs":     "SELECT COUNT(*) FROM atlas.essais_vbs",
        "wl":      "SELECT COUNT(*) FROM atlas.essais_atterberg WHERE wl IS NOT NULL",
        "wp":      "SELECT COUNT(*) FROM atlas.essais_atterberg WHERE wp IS NOT NULL",
        "ip":      "SELECT COUNT(*) FROM atlas.essais_atterberg WHERE ip_generated IS NOT NULL",
        "rd_mpa":  "SELECT COUNT(*) FROM atlas.essais_penetrometre WHERE rd_mpa IS NOT NULL",
        "cbr_95":  "SELECT COUNT(*) FROM atlas.essais_cbr WHERE cbr_pct IS NOT NULL AND n_coups=55",
        "gamma_d": "SELECT COUNT(*) FROM atlas.essais_proctor WHERE gamma_d_max IS NOT NULL",
        "w_opt":   "SELECT COUNT(*) FROM atlas.essais_proctor WHERE w_opt IS NOT NULL",
        "em_mpa":  "SELECT COUNT(*) FROM atlas.essais_pressiometre WHERE em_mpa IS NOT NULL",
        "pl_mpa":  "SELECT COUNT(*) FROM atlas.essais_pressiometre WHERE pl_mpa IS NOT NULL",
    }
    n_obs = {}
    for p, q in n_queries.items():
        try:
            cur.execute(q)
            n_obs[p] = cur.fetchone()[0]
        except Exception:
            n_obs[p] = None

    # 4. Total sondages
    cur.execute("SELECT COUNT(*) FROM atlas.sondages WHERE deleted_at IS NULL")
    n_sondages_total = cur.fetchone()[0]

    return {
        "n_sondages_total": n_sondages_total,
        "n_observations":   n_obs,
        "loo_rmse_by_param": metrics,
    }


# -------------------------------------------------------------------------
# Capture snapshot
# -------------------------------------------------------------------------

def capture_snapshot(conn, tag: str, note: Optional[str] = None) -> None:
    cur = conn.cursor()
    ensure_table(cur)

    metrics = collect_current_metrics(cur)

    cur.execute("""
        INSERT INTO atlas.ai_run_snapshots (tag, note, metrics_json)
        VALUES (%s, %s, %s::jsonb)
        ON CONFLICT (tag) DO UPDATE
          SET note         = EXCLUDED.note,
              captured_at  = now(),
              metrics_json = EXCLUDED.metrics_json
    """, (tag, note, json.dumps(metrics)))

    conn.commit()
    print(f"Snapshot '{tag}' capture ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})")
    print(f"  N sondages total : {metrics['n_sondages_total']}")
    print(f"  N observations   :")
    for p, n in metrics["n_observations"].items():
        print(f"    {p:12s}: {n}")
    n_runs = sum(len(v) for v in metrics["loo_rmse_by_param"].values())
    print(f"  LOO-RMSE captures: {n_runs} runs")
    cur.close()


# -------------------------------------------------------------------------
# Comparaison deux snapshots
# -------------------------------------------------------------------------

def compare_snapshots(conn, tag_before: str, tag_after: str) -> None:
    cur = conn.cursor()

    cur.execute(
        "SELECT metrics_json, captured_at FROM atlas.ai_run_snapshots WHERE tag=%s",
        (tag_before,),
    )
    row_before = cur.fetchone()
    if not row_before:
        print(f"[ERR] Snapshot '{tag_before}' introuvable", file=sys.stderr)
        return

    cur.execute(
        "SELECT metrics_json, captured_at FROM atlas.ai_run_snapshots WHERE tag=%s",
        (tag_after,),
    )
    row_after = cur.fetchone()
    if not row_after:
        print(f"[ERR] Snapshot '{tag_after}' introuvable", file=sys.stderr)
        return

    mb, t_before = row_before[0], row_before[1]
    ma, t_after  = row_after[0],  row_after[1]

    print(f"\n{'='*70}")
    print(f"COMPARAISON RMSE : {tag_before} -> {tag_after}")
    print(f"  Avant  : {str(t_before)[:19]}")
    print(f"  Apres  : {str(t_after)[:19]}")
    print(f"{'='*70}")

    # N observations delta
    print("\n--- DELTA N observations ---")
    n_before = mb.get("n_observations", {})
    n_after  = ma.get("n_observations", {})
    for p in sorted(set(list(n_before.keys()) + list(n_after.keys()))):
        nb = n_before.get(p)
        na = n_after.get(p)
        if nb != na:
            delta = (na - nb) if (na is not None and nb is not None) else "?"
            arrow = f"+{delta}" if isinstance(delta, int) and delta > 0 else str(delta)
            print(f"  {p:12s}: {nb} -> {na}  ({arrow})")
        else:
            print(f"  {p:12s}: {nb}  (inchange)")

    nb_s = mb.get("n_sondages_total")
    na_s = ma.get("n_sondages_total")
    print(f"\n  N sondages total : {nb_s} -> {na_s}  "
          f"({'+' if isinstance(na_s-nb_s, int) and na_s > nb_s else ''}{na_s - nb_s if nb_s and na_s else '?'})")

    # LOO-RMSE delta
    print(f"\n--- DELTA LOO-RMSE ---")
    print(f"  {'Parametre':<30} {'Methode':<30} {'Avant':>10} {'Apres':>10} {'Delta':>10} {'%':>7}")
    print(f"  {'-'*87}")

    rmse_before = mb.get("loo_rmse_by_param", {})
    rmse_after  = ma.get("loo_rmse_by_param", {})
    all_params  = sorted(set(list(rmse_before.keys()) + list(rmse_after.keys())))

    improved = []
    degraded = []

    for pid in all_params:
        methods_before = rmse_before.get(pid, {})
        methods_after  = rmse_after.get(pid, {})
        all_methods = sorted(set(list(methods_before.keys()) + list(methods_after.keys())))
        for method in all_methods:
            rb = methods_before.get(method, {}).get("loo_rmse")
            ra = methods_after.get(method, {}).get("loo_rmse")
            if rb is None and ra is None:
                continue
            if rb is None:
                flag = "NEW"
                print(f"  {pid:<30} {method:<30} {'N/A':>10} {ra:>10.4f} {'NEW':>10} {'':>7}")
                continue
            if ra is None:
                flag = "DROPPED"
                print(f"  {pid:<30} {method:<30} {rb:>10.4f} {'N/A':>10} {'DROPPED':>10} {'':>7}")
                continue
            delta = ra - rb
            pct   = (delta / rb * 100) if rb != 0 else float("nan")
            flag  = "BETTER" if delta < 0 else ("WORSE" if delta > 0 else "=")
            marker = "<--" if delta < 0 else ("!!!" if delta > 0.1 * rb else "")
            print(
                f"  {pid:<30} {method:<30} {rb:>10.4f} {ra:>10.4f} "
                f"{delta:>+10.4f} {pct:>6.1f}% {marker}"
            )
            if delta < -0.001:
                improved.append((pid, method, delta, pct))
            elif delta > 0.001:
                degraded.append((pid, method, delta, pct))

    print(f"\n  Ameliorations : {len(improved)}")
    print(f"  Degradations  : {len(degraded)}")

    cur.close()


# -------------------------------------------------------------------------
# Main
# -------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Tracabilite LOO-RMSE avant/apres import")
    parser.add_argument("--database-url", default=DB_DEFAULT)
    parser.add_argument("--tag", default=None, help="Tag pour capturer un snapshot")
    parser.add_argument("--note", default=None, help="Note sur ce snapshot")
    parser.add_argument(
        "--compare", nargs=2, metavar=("TAG_BEFORE", "TAG_AFTER"),
        help="Comparer deux snapshots"
    )
    parser.add_argument(
        "--list", action="store_true",
        help="Lister les snapshots disponibles"
    )
    args = parser.parse_args()

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False
    cur = conn.cursor()
    ensure_table(cur)
    conn.commit()

    if args.list:
        cur.execute(
            "SELECT tag, note, captured_at, "
            "metrics_json->>'n_sondages_total' as n_s "
            "FROM atlas.ai_run_snapshots ORDER BY captured_at"
        )
        rows = cur.fetchall()
        print(f"\n{'='*60}")
        print(f"Snapshots disponibles : {len(rows)}")
        print(f"{'='*60}")
        for r in rows:
            print(f"  {r[0]:<30} {str(r[2])[:19]}  N_sondages={r[3]}  {r[1] or ''}")
        cur.close()
        conn.close()
        return 0

    if args.compare:
        compare_snapshots(conn, args.compare[0], args.compare[1])
        cur.close()
        conn.close()
        return 0

    if args.tag:
        capture_snapshot(conn, args.tag, args.note)
        cur.close()
        conn.close()
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
