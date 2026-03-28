#!/usr/bin/env python3
"""
E3/E4 — Moteur kriging multi-paramètres (squelette Atlas).

Lit atlas.v_ai_kriging_zone_plan et peut créer des atlas.ai_interpolation_runs
pour traçabilité. L’implémentation PyKrige / GSTools sera branchée sur
atlas.sondages_valides_kriging + atlas.ai_variograms dans une itération suivante.

Usage:
  DATABASE_URL=postgres://... python scripts/kriging_multi_param.py --dry-run
  DATABASE_URL=postgres://... python scripts/kriging_multi_param.py --limit 5
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

import psycopg2


def main() -> int:
    p = argparse.ArgumentParser(description="Kriging multi-paramètres — plan catalogue + runs.")
    p.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""))
    p.add_argument("--limit", type=int, default=0, help="Max lignes du plan (0 = toutes).")
    p.add_argument(
        "--apply",
        action="store_true",
        help="Insérer des lignes ai_interpolation_runs (sinon affichage seul).",
    )
    args = p.parse_args()
    db_url = args.database_url or os.environ.get("DATABASE_URL", "")
    if not db_url:
        sys.exit("DATABASE_URL requis.")

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            q = """
                SELECT parameter_id, zone_id, zone_code, zone_nom
                FROM atlas.v_ai_kriging_zone_plan
                ORDER BY zone_code, parameter_id
            """
            if args.limit and args.limit > 0:
                q += f" LIMIT {int(args.limit)}"
            cur.execute(q)
            rows: List[Tuple[Any, ...]] = cur.fetchall()
            print(f"Plan interpolation: {len(rows)} couple(s).")

            if not args.apply:
                for r in rows[:20]:
                    print(f"  {r[2]} | {r[0]} | {r[3]}")
                if len(rows) > 20:
                    print(f"  ... et {len(rows) - 20} autre(s)")
                print("(Utiliser --apply pour enregistrer des runs pending en base.)")
                return 0

            meta: Dict[str, Any] = {
                "engine": "kriging_multi_param_v0",
                "started_at": datetime.now(timezone.utc).isoformat(),
                "note": "placeholder_no_grid_computation",
            }
            inserted = 0
            for parameter_id, zone_id, zone_code, zone_nom in rows:
                cur.execute(
                    """
                    INSERT INTO atlas.ai_interpolation_runs
                      (zone_id, parameter_id, method, status, metrics, run_type)
                    VALUES (%s::uuid, %s, 'ordinary_kriging', 'queued', %s::jsonb, 'kriging')
                    """,
                    (
                        str(zone_id),
                        parameter_id,
                        json.dumps({**meta, "zone_code": zone_code, "zone_nom": zone_nom}),
                    ),
                )
                inserted += 1
            conn.commit()
            print(f"OK ai_interpolation_runs insérés: {inserted} (status=queued — calcul grille à brancher).")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
