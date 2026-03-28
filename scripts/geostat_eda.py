#!/usr/bin/env python3
"""
E1 — Pipeline EDA géostatistique (Atlas).

Étapes prévues : variogram cloud, variogrammes directionnels, surfaces de tendance,
histogrammes par zone. Cette version enregistre une exécution dans
atlas.ai_geostat_eda_runs et peut matérialiser un nuage variographique minimal
dès que les données point sont branchées (voir TODO dans le code).

Usage:
  DATABASE_URL=postgres://... python scripts/geostat_eda.py --zone-code DEPRESSION_LAMA_TG
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import psycopg2


def _require_db(url: str) -> None:
    if not url:
        sys.exit("DATABASE_URL requis (ou --database-url).")


def main() -> int:
    p = argparse.ArgumentParser(description="EDA géostatistique — enregistrement run + plan.")
    p.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""))
    p.add_argument("--zone-code", default="", help="Code atlas.zones_etude (optionnel).")
    p.add_argument("--parameter-id", default="vbs_avg", help="parameter_id du catalogue.")
    p.add_argument("--dry-run", action="store_true", help="Ne pas écrire en base.")
    args = p.parse_args()
    db_url = args.database_url or os.environ.get("DATABASE_URL", "")
    _require_db(db_url)

    payload: Dict[str, Any] = {
        "pipeline": "geostat_eda_v0",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "steps": [
            "variogram_cloud",
            "directional_variograms",
            "trend_surface",
            "histograms_by_zone",
        ],
        "note": "Artefacts lourds : pairs JSON dans atlas.ai_variogram_cloud ; tendance dans ai_spatial_trend_surface.",
    }

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            if args.zone_code:
                cur.execute(
                    "SELECT COUNT(*) FROM atlas.v_ai_kriging_zone_plan WHERE zone_code = %s",
                    (args.zone_code,),
                )
            else:
                cur.execute("SELECT COUNT(*) FROM atlas.v_ai_kriging_zone_plan")
            (plan_count,) = cur.fetchone()

            zone_id: Optional[str] = None
            if args.zone_code:
                cur.execute(
                    "SELECT id FROM atlas.zones_etude WHERE code = %s LIMIT 1",
                    (args.zone_code,),
                )
                row = cur.fetchone()
                if not row:
                    sys.exit(f"Zone inconnue: {args.zone_code}")
                zone_id = str(row[0])

            if args.dry_run:
                print(f"[dry-run] couples (parameter×zone) filtrés: {plan_count}")
                print(json.dumps(payload, indent=2))
                return 0

            cur.execute(
                """
                INSERT INTO atlas.ai_geostat_eda_runs (zone_id, parameter_id, payload)
                VALUES (%s::uuid, %s, %s::jsonb)
                RETURNING id
                """,
                (zone_id, args.parameter_id, json.dumps(payload)),
            )
            (run_id,) = cur.fetchone()
            conn.commit()
            print(f"OK ai_geostat_eda_runs id={run_id} plan_couples={plan_count}")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
